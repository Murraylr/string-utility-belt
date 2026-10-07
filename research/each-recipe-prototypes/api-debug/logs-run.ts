import { proto } from '../harness'
import { dateCheck } from './util'
import recipe from './logs-recipe'
await proto(recipe)
await dateCheck(recipe)
