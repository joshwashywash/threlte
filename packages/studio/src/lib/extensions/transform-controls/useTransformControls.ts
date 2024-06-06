import { useStudio } from '../../internal/extensions'
import {
  transformControlsScope,
  type TransformControlsActions,
  type TransformControlsState
} from './types'

export const useTransformControls = () => {
  const { useExtension } = useStudio()
  const extension = useExtension<Partial<TransformControlsState>, TransformControlsActions>(
    transformControlsScope
  )

  const setMode = (mode: TransformControlsState['mode']) => {
    extension.setMode(mode)
  }

  return {
    /** @reactive */
    get inUse() {
      return extension.state.inUse
    },
    setMode: extension.setMode,
    enable: extension.enable,
    disable: extension.disable,
    toggle: extension.toggle,
    translate: extension.translate,
    rotate: extension.rotate,
    scale: extension.scale
  }
}
