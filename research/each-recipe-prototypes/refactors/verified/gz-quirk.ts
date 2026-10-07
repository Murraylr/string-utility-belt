import { run } from '../../harness'
for (const s of ['{', '}', '  "awslogs": {', '[', 'hello world', '{"a":1}']) {
  const r = await run(s, [{ id: 'g', utilityId: 'gzip_decompress', enabled: true, params: { output: 'text' } } as any])
  console.log(JSON.stringify(s), '->', JSON.stringify(r.errors))
}
