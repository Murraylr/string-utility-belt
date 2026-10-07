import { proto } from '../../harness'
import { dateCheck } from '../util'
import recipe from './kinesis-recipe'
await proto(recipe)
await dateCheck(recipe)
