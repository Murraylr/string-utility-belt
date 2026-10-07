import { proto } from '../harness'
const files = process.argv.slice(2)
for (const f of files) {
  const { recipe } = await import(f)
  await proto(recipe)
}
