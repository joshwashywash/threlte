<script lang="ts">
  import RenderTexture from './RenderTexture.svelte'
  import RenderTextureScene from './RenderTextureScene.svelte'
  import { OrbitControls } from '@threlte/extras'
  import { T } from '@threlte/core'

  let camera: PerspectiveCamera
</script>

<T.PerspectiveCamera
  makeDefault
  position.z={3}
  bind:ref={camera}
>
  <OrbitControls />
</T.PerspectiveCamera>

<T.Color
  attach="background"
  args={['black']}
/>

<T.AmbientLight />

<T.Mesh>
  {#snippet children({ ref })}
    <T.BoxGeometry />
    <T.MeshStandardMaterial>
      <RenderTexture
        attach="map"
        width={512}
        height={512}
      >
        <RenderTextureScene
          mesh={ref}
          {camera}
        />
      </RenderTexture>
    </T.MeshStandardMaterial>
  {/snippet}
</T.Mesh>
