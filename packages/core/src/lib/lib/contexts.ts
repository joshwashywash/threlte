import { getContext, setContext, tick } from 'svelte'
import type { Readable, Writable } from 'svelte/store'
import {
  Scene,
  type Camera,
  type ColorSpace,
  type ShadowMapType,
  type ToneMapping,
  type WebGLRenderer
} from 'three'
import { Scheduler, type Stage, type Task } from '../frame-scheduling'
import type { DisposableThreeObject, Size } from '../types'
import { getDefaultCamera, setDefaultCameraAspectOnSizeChange } from './defaultCamera'
import { currentWritable, watch, type CurrentWritable } from './storeUtils'
import { injectLegacyFrameCompatibilityContext } from '../hooks/legacy/utils'

/**
 * ### `ThrelteContext`
 *
 * This is the main context of a Threlte application.
 * It's exposed to the user via the hook `useThrelte`.
 */
export type ThrelteContext = {
  size: Readable<Size> & { current: Size }
  camera: CurrentWritable<Camera>
  scene: Scene
  dpr: CurrentWritable<number>
  useLegacyLights: CurrentWritable<boolean>
  renderer: WebGLRenderer
  /**
   * If set to 'on-demand', the scene will only be rendered when the current frame is invalidated
   * If set to 'manual', the scene will only be rendered when advance() is called
   * If set to 'always', the scene will be rendered every frame
   */
  renderMode: CurrentWritable<'always' | 'on-demand' | 'manual'>
  /**
   * By default, Threlte will automatically render the scene when necessary.
   * If you want to implement a custom render pipeline, you can set this to
   * false.
   */
  autoRender: CurrentWritable<boolean>
  /**
   * Invalidates the current frame when renderMode === 'on-demand'
   */
  invalidate: () => void
  /**
   * Advance one frame when renderMode === 'manual'
   */
  advance: () => void
  /** The scheduler used by this Threlte app */
  scheduler: Scheduler
  /** The stage which useTask defaults to */
  mainStage: Stage
  /**
   * The default render stage. Tasks in this stage are ran according to
   * on-demand rendering.
   */
  renderStage: Stage
  autoRenderTask: Task
  /**
   * Function to determine if a rendering should happen according to on-demand
   * rendering. The value of this function is valid for the duration of the
   * current frame.
   */
  shouldRender: () => boolean
  colorManagementEnabled: CurrentWritable<boolean>
  colorSpace: CurrentWritable<ColorSpace>
  toneMapping: CurrentWritable<ToneMapping>
  shadows: CurrentWritable<boolean | ShadowMapType>
}

/**
 * The internal context is used to store the state of the task scheduling system and
 * the disposal methods. It is not exposed to the user.
 */
export type ThrelteInternalContext = {
  // ------- Scheduling context -------

  /** A flag to indicate whether the current frame has been invalidated */
  frameInvalidated: boolean

  /** A flag to indicate whether the frame should be advanced in the manual renderMode */
  advance: boolean

  /** If anything is in this set, the frame will be considered invalidated */
  autoInvalidations: Set<unknown>

  /** A function to be called at the end of the frame loop that resets the invalidation flags */
  resetFrameInvalidation: () => void

  // ------- Disposal context -------

  /**
   * Disposes all disposable objects from disposableObjects
   * that are not mounted anymore and clears the Map entry.
   */
  dispose: (force?: boolean) => void

  /**
   * Returns an array of disposable objects.
   * Recursively checks disposable objects for properties
   * that again hold disposable objects and returns
   * them as well.
   */
  collectDisposableObjects: (
    object?: DisposableThreeObject,
    arr?: DisposableThreeObject[]
  ) => DisposableThreeObject[]

  /**
   * Add disposable objects that will be disposed on unmounting.
   */
  addDisposableObjects: (objects: DisposableThreeObject[]) => void

  /**
   * Remove disposable objects and possibly dispose them
   * in the next frame if they are not mounted anywhere else.
   */
  removeDisposableObjects: (objects: DisposableThreeObject[]) => void

  /**
   * A map of currently mounted disposable objects.
   */
  disposableObjects: Map<DisposableThreeObject, number>

  /**
   * A flag that is used to check whether the dispose method
   * should actually run.
   */
  shouldDispose: boolean
}

export type ThrelteUserContext = CurrentWritable<Record<string | symbol, unknown>>

/**
 * This function creates the necessary context objects for a Threlte application.
 */
export const createThrelteContext = (options: {
  colorSpace: ColorSpace
  toneMapping: ToneMapping
  dpr: number
  userSize: Writable<Size | undefined>
  parentSize: Readable<Size>
  renderMode: 'always' | 'on-demand' | 'manual'
  autoRender: boolean
  shadows: boolean | ShadowMapType
  colorManagementEnabled: boolean
  useLegacyLights: boolean
  scheduler?: Scheduler
  mainStage?: Stage
  renderStage?: Stage
  autoRenderTask?: Task
}): ThrelteContext => {
  // If a parent internal context exists (like in the case of HUD), then reuse.
  const internalCtx: ThrelteInternalContext = getContext<ThrelteInternalContext>(
    'threlte-internal-context'
  ) ?? {
    frameInvalidated: true,
    advance: false,
    autoInvalidations: new Set(),
    resetFrameInvalidation: () => {
      internalCtx.frameInvalidated = false
      internalCtx.advance = false
    },
    dispose: async (force = false) => {
      await tick()
      if (!internalCtx.shouldDispose && !force) return
      internalCtx.disposableObjects.forEach((mounted, object) => {
        if (mounted === 0 || force) {
          object?.dispose?.()
          internalCtx.disposableObjects.delete(object)
        }
      })
      internalCtx.shouldDispose = false
    },
    collectDisposableObjects: (object, objects) => {
      const disposables: DisposableThreeObject[] = objects ?? []
      if (!object) return disposables
      // Scenes can't be disposed
      if (object?.dispose && typeof object.dispose === 'function' && object.type !== 'Scene') {
        disposables.push(object)
      }
      // iterate over properties of object
      Object.entries(object).forEach(([propKey, propValue]) => {
        // we don't want to dispose the parent, we can skip "children"
        if (propKey === 'parent' || propKey === 'children' || typeof propValue !== 'object') return
        const value = propValue
        if (value?.dispose) {
          internalCtx.collectDisposableObjects(value, disposables)
        }
      })
      return disposables
    },
    addDisposableObjects: (objects) => {
      objects.forEach((obj) => {
        const currentValue = internalCtx.disposableObjects.get(obj)
        if (currentValue) {
          internalCtx.disposableObjects.set(obj, currentValue + 1)
        } else {
          internalCtx.disposableObjects.set(obj, 1)
        }
      })
    },
    removeDisposableObjects: (objects) => {
      if (objects.length === 0) return
      objects.forEach((obj) => {
        const currentValue = internalCtx.disposableObjects.get(obj)
        if (currentValue && currentValue > 0) {
          internalCtx.disposableObjects.set(obj, currentValue - 1)
        }
      })
      internalCtx.shouldDispose = true
    },
    disposableObjects: new Map(),
    shouldDispose: false
  }

  const renderMode = currentWritable(options.renderMode)
  const autoRender = currentWritable(options.autoRender)

  const shouldRender = () => {
    return (
      renderMode.current === 'always' ||
      (renderMode.current === 'on-demand' &&
        (internalCtx.frameInvalidated || internalCtx.autoInvalidations.size > 0)) ||
      (renderMode.current === 'manual' && internalCtx.advance)
    )
  }

  // TODO: Remove in Threlte 7
  const { useRenderOrders } = injectLegacyFrameCompatibilityContext()

  const scheduler = options.scheduler ?? new Scheduler()
  const mainStage = options.mainStage ?? scheduler.createStage(Symbol('threlte-main-stage'))
  const renderStage =
    options.renderStage ??
    scheduler.createStage(Symbol('threlte-render-stage'), {
      after: mainStage,
      callback(_, runTasks) {
        if (shouldRender()) runTasks()
      }
    })

  const camera = currentWritable(getDefaultCamera())
  const size = currentWritable<Size>(undefined!)

  watch([options.userSize, options.parentSize], ([$userSize, $parentSize]) => {
    size.set($userSize ? $userSize : $parentSize)
  })

  const ctx: ThrelteContext = {
    size,
    camera,
    scene: new Scene(),
    renderer: undefined!,
    invalidate: () => {
      internalCtx.frameInvalidated = true
    },
    advance: () => {
      internalCtx.advance = true
    },
    colorSpace: currentWritable(options.colorSpace),
    toneMapping: currentWritable(options.toneMapping),
    dpr: currentWritable(options.dpr),
    useLegacyLights: currentWritable(options.useLegacyLights),
    shadows: currentWritable(options.shadows),
    colorManagementEnabled: currentWritable(options.colorManagementEnabled),
    renderMode,
    autoRender,
    scheduler,
    mainStage,
    renderStage,
    autoRenderTask:
      options.autoRenderTask ??
      renderStage.createTask(Symbol('threlte-auto-render-task'), (_) => {
        // we're in here when autoRender is true In Threlte 7 we still have to
        // check for the existence of `useRender` instances
        if (useRenderOrders.length > 0) return

        // if there are no useRender instances, we can render the scene
        ctx.renderer.render(ctx.scene, ctx.camera.current)
      }),
    shouldRender
  }

  setDefaultCameraAspectOnSizeChange(ctx)

  const userCtx: ThrelteUserContext = currentWritable({})

  setContext<ThrelteContext>('threlte', ctx)
  setContext<ThrelteInternalContext>('threlte-internal-context', internalCtx)
  setContext<ThrelteUserContext>('threlte-user-context', userCtx)

  return ctx
}
