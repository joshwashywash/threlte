<script lang="ts">
  import { T, useCamera, useTask } from '@threlte/core'
  import { interactivity } from '@threlte/extras'
  import type { Camera, Mesh } from 'three'

  type Props = {
    mesh: Mesh
    camera: Camera
  }

  let { mesh, camera }: Props = $props()

  let y = $state(0)
  let _delta = 0
  let scale = $state(1)

  useTask((delta) => {
    _delta += delta
    y = 2 * Math.sin(_delta)
  })

  const { camera: _camera } = useCamera()

  interactivity({
    compute(event, context) {
      const target = context.target.current
      if (target !== undefined) {
        context.pointer.update((pointer) => {
          pointer.set(
            (event.offsetX / target.clientWidth) * 2 - 1,
            -(event.offsetY / target.clientHeight) * 2 + 1
          )
          return pointer
        })
        context.raycaster.setFromCamera(context.pointer.current, camera)
        const [intersection] = context.raycaster.intersectObject(mesh)
        const uv = intersection?.uv
        if (uv !== undefined) {
          context.pointer.update((pointer) => {
            pointer.set(uv.x * 2 - 1, uv.y * 2 - 1)
            return pointer
          })
          context.raycaster.setFromCamera(context.pointer.current, _camera.current)
        }
      }
    }
  })
</script>

<T.Color
  args={[0xff_ff_00]}
  attach="background"
/>
<T.Mesh
  {scale}
  position.y={y}
  onpointerenter={() => {
    scale *= 2
  }}
  onpointerleave={() => {
    scale /= 2
  }}
>
  <T.SphereGeometry />
  <T.MeshNormalMaterial />
</T.Mesh>
