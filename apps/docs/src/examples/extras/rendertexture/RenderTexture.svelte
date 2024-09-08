<script lang="ts">
  import type { RenderTextureProps } from './RenderTexture.svelte'
  import { T, createCameraContext, createSceneContext, useThrelte } from '@threlte/core'
  import { useFBO } from '@threlte/extras'

  const { camera } = createCameraContext()
  const { scene } = createSceneContext()

  const { renderStage, renderer } = useThrelte()

  let {
    width,
    height,
    autoRender = true,
    stage = renderStage,
    ref = $bindable(),
    children,
    ...props
  }: RenderTextureProps = $props()

  const target = useFBO()

  $effect.pre(() => {
    target.setSize(width ?? target.width, height ?? target.height)
  })

  const { texture } = target

  const key = Symbol('threlte-render-texture-stage')

  $effect.pre(() => {
    if (!autoRender) {
      return
    }

    stage.createTask(key, () => {
      const { autoClear } = renderer
      const last = renderer.getRenderTarget()

      renderer.setRenderTarget(target)
      renderer.autoClear = false
      renderer.render(scene, camera.current)
      renderer.autoClear = autoClear
      renderer.setRenderTarget(last)
    })
    return () => stage.removeTask(key)
  })

  $effect(() => {
    return target.dispose
  })
</script>

<T
  is={scene}
  attach={false}
>
  {@render children?.({ ref: texture })}
</T>

<T
  is={texture}
  bind:ref
  {...props}
/>
