// Minimal job runner speaking executor.ts's IPC protocol, so the process pool can
// be tested without a built server bundle: { job, timeoutMs } in,
// { ok, value | error, retire? } out.
process.on('message', ({ job }) => {
  switch (job.kind) {
    case 'echo':
      process.send({ ok: true, value: { echo: job.value, pid: process.pid } })
      break
    case 'fail':
      process.send({ ok: false, error: 'boom' })
      break
    case 'retire':
      process.send({ ok: false, error: 'timed out after 1ms', retire: true })
      break
    case 'log':
      console.log('fixture-noise-on-stdout')
      setTimeout(() => process.send({ ok: true, value: 'logged' }), 50)
      break
    case 'spin':
      for (;;) { /* synchronous: no timer or message can interrupt this */ }
    case 'oom':
      // what `repeat` does with a huge count: in a worker *thread* this aborts the whole
      // process (V8 fatal OOM) despite resourceLimits; in a child process it is contained
      Array(1e8).fill('x'.repeat(20)).join('')
      break
    case 'exit':
      process.exit(3)
  }
})
process.on('disconnect', () => process.exit(0))
