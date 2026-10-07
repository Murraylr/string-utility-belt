import { proto } from '../harness'
import { dateCheck } from './util'
import recipe from './ua-recipe'
console.log('first input length', recipe.samples[0].input.length)
await proto(recipe)
await dateCheck(recipe)
