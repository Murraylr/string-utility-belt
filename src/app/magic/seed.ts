import type { DecodeStep } from '@/core/detect'
import type { Params } from '@/types/utility'
import { defaultParams } from '@/core/params'
import { registry } from '@/app/registry'

/** A decode step's params over the utility's declared defaults — what the picker would add. */
export const seededParams = (step: DecodeStep): Params => ({
  ...defaultParams(registry.get(step.utilityId)),
  ...step.params,
})
