import React from 'react'
import { PRESET_INDEX } from '@/presets/_generated/index'
import { PRESETS_TITLE, presetsDescription } from '../seo'
import { useDocumentMeta } from '../useDocumentMeta'
import PagePromo from '@/app/sponsors/PagePromo'
import { PresetsIndex } from './PresetArticle'

/** Every preset, by category (`/presets/`). The pre-render writes the same `PresetsIndex`. */
export default function PresetsIndexPage() {
  useDocumentMeta(PRESETS_TITLE, presetsDescription(PRESET_INDEX.length))
  return <PresetsIndex presets={PRESET_INDEX} promo={<PagePromo page={{ kind: 'index' }} slot="inline" />} />
}
