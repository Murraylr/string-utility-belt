// jsdom ships without types and @types/jsdom isn't installed: just the slice the dist test uses.
declare module 'jsdom' {
  export class JSDOM {
    constructor(html?: string, options?: { runScripts?: 'dangerously' | 'outside-only'; url?: string })
    readonly window: Window & typeof globalThis
  }
}
