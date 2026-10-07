import { proto } from '../harness'
import { dateCheck } from './util'
import recipe from './jwt-recipe'
await proto(recipe)
await dateCheck(recipe)
