/**
 * sandbox.ts - runs user code in an isolated Web Worker with timeout and blocked APIs.
 */

export function runUserCode(code: string, input: unknown, timeout = 800): Promise<unknown> {
  return new Promise((resolve) => {
    const blob = new Blob([`
      self.onmessage = async (e) => {
        const { code, input } = e.data;
        try {
          // block dangerous globals
          self.fetch = undefined;
          self.XMLHttpRequest = undefined;
          self.WebSocket = undefined;
          self.importScripts = undefined;
          self.Worker = undefined;
          const fn = new Function('input', code);
          const result = await fn(input);
          self.postMessage({ ok: true, result });
        } catch (err) {
          self.postMessage({ ok: false, error: String(err) });
        }
      };
    `], { type: 'application/javascript' });

    const worker = new Worker(URL.createObjectURL(blob), { type: 'module' });
    const timer = setTimeout(() => {
      worker.terminate();
      resolve({ error: 'timeout' });
    }, timeout);

    worker.onmessage = (e) => {
      clearTimeout(timer);
      worker.terminate();
      if (e.data.ok) resolve(e.data.result);
      else resolve({ error: e.data.error });
    };

    worker.postMessage({ code, input });
  });
}
