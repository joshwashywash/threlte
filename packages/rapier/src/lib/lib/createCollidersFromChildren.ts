import { ActiveEvents, Collider, ColliderDesc, World, RigidBody } from '@dimforge/rapier3d-compat'
import { Mesh, Quaternion, Vector3, type Object3D } from 'three'
import type { AutoCollidersShapes } from '../types/types'

const offset = new Vector3()
const worldPosition = new Vector3()
const worldQuaternion = new Quaternion()
const worldScale = new Vector3()
const size = new Vector3()

/**
 *
 * Creates collider descriptions including default translations
 *
 * @param object
 * @param world
 * @param friction
 * @param restitution
 * @param collidersType
 * @param rigidBody
 * @returns
 */
export const createCollidersFromChildren = (
  object: Object3D,
  collidersType: AutoCollidersShapes,
  world: World,
  rigidBody?: RigidBody,
  rigidBodyParentObject?: Object3D
): Collider[] => {
  const colliders: Collider[] = []

  let description: ColliderDesc

  /**
   * Trying to find the parent RigidBody.
   * If we find something, good. If not,
   * the Colliders are created on the world positions
   * of the meshes they resemble.
   */
  const rigidBodyWorldPos = new Vector3()
  const rigidBodyWorldQuatInversed = new Quaternion()
  rigidBodyParentObject?.getWorldPosition(rigidBodyWorldPos)
  rigidBodyParentObject?.getWorldQuaternion(rigidBodyWorldQuatInversed)
  rigidBodyWorldQuatInversed.invert()

  object.traverse((child: Object3D | Mesh) => {
    if ('isMesh' in child) {
      const { geometry } = child
      const worldPos = child.getWorldPosition(worldPosition)
      const translation = worldPos.sub(rigidBodyWorldPos)

      const worldQuat = child.getWorldQuaternion(worldQuaternion)
      const {
        x: rx,
        y: ry,
        z: rz,
        w: rw
      } = worldQuat.clone().premultiply(rigidBodyWorldQuatInversed)

      const scale = child.getWorldScale(worldScale)

      switch (collidersType) {
        case 'cuboid':
          {
            geometry.computeBoundingBox()
            const { boundingBox } = geometry

            boundingBox!.getSize(size)
            boundingBox!.getCenter(offset)

            description = ColliderDesc.cuboid(
              (size.x / 2) * scale.x,
              (size.y / 2) * scale.y,
              (size.z / 2) * scale.z
            )
          }
          break

        case 'ball':
          {
            geometry.computeBoundingSphere()
            const { boundingSphere } = geometry

            const radius = boundingSphere!.radius * scale.x
            offset.copy(boundingSphere!.center)

            description = ColliderDesc.ball(radius)
          }
          break

        case 'trimesh':
          {
            description = ColliderDesc.trimesh(
              new Float32Array(geometry.attributes.position.array),
              new Uint32Array(geometry.index?.array ?? [])
            )
          }
          break

        case 'capsule':
          {
            geometry.computeBoundingBox()
            const { boundingBox } = geometry

            boundingBox!.getSize(size)
            boundingBox!.getCenter(offset)

            const radius = Math.max((size.x / 2) * scale.x, (size.z / 2) * scale.z)

            description = ColliderDesc.capsule((size.y / 2) * scale.y - radius, radius)
          }
          break

        case 'convexHull':
          {
            description = ColliderDesc.convexHull(
              new Float32Array(geometry.attributes.position.array)
            ) as ColliderDesc
          }
          break
      }

      description
        .setTranslation(
          translation.x + offset.x,
          translation.y + offset.y,
          translation.z + offset.z
        )
        .setRotation({ x: rx, y: ry, z: rz, w: rw })
        .setActiveEvents(ActiveEvents.COLLISION_EVENTS)

      const collider = world.createCollider(description, rigidBody)

      colliders.push(collider)
    }
  })

  return colliders
}
