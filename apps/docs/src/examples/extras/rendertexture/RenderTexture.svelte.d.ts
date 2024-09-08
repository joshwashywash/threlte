import type { Props, Stage } from '@threlte/core'
import type { Texture } from 'three'
import { SvelteComponent } from 'svelte'

export type RenderTextureProps = Props<Texture> & {
  width?: number
  height?: number

  /**
   * @default true
   */
  autoRender?: boolean

  stage?: Stage
}

export default class RenderTexture extends SvelteComponent<RenderTextureProps> {}
