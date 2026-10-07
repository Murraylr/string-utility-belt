import { run } from '../harness'
for (const e of ['0 0 1 * MON', '0 0 * * 7', '0 0 1-7 * 1', '0 */6 * * *', '0 0 * * 1-7', '15 3 * * sun', '0 0 1 jan *', '*/5 9-17 * * 1-5', '0 0 L * *', '@annually', '@midnight', '@hourly', '0 0 29 2 *']) {
  const r = await run(e, [{ id: 'd', utilityId: 'cron_describe', enabled: true, params: {} } as any])
  console.log(JSON.stringify(e), '=>', r.out.split('\n')[0], JSON.stringify(r.errors))
}
