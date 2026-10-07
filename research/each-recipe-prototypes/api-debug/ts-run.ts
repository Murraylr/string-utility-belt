import { proto } from '../harness'
import { dateCheck } from './util'
import recipe from './ts-recipe'
await proto(recipe)
await dateCheck(recipe)
