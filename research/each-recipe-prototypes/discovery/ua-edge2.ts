import { run } from '../harness'
import { recipe } from './user-agents-to-csv-def'
import { toPipelineSteps } from '/home/user/string-utility-belt/src/recipes/types'
const steps = toPipelineSteps(recipe.steps)
const log = [
  '198.51.100.23 - - [07/Oct/2026:09:12:01 +0000] "GET /pricing HTTP/2.0" 200 18234 "https://www.example.com/blog/how-to-build-a-bot/" "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"',
  '203.0.113.5 - - [07/Oct/2026:09:12:04 +0000] "GET / HTTP/1.1" 200 5120 "-" "Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1"',
].join('\n')
console.log((await run(log, steps)).out)
