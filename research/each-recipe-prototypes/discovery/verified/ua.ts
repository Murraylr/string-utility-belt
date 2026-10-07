import { proto, run } from '../../harness'
import { recipe } from './ua-def'
import { withoutEach } from '../without'
import { toPipelineSteps } from '/home/user/string-utility-belt/src/recipes/types'
await proto(recipe)
await withoutEach(recipe)
