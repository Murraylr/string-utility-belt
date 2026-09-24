/**
 * Minimal fake of the `vscode` API surface the extension touches — enough to drive
 * the commands end-to-end without a real extension host. Tests pass an instance to
 * `createExtension` (../commands.ts) and configure its jest-style mocks per case.
 * Where the real editor refuses something (overlapping edit ranges), so does the fake.
 */
import { vi } from 'vitest'

export class FakePosition {
  constructor(public line: number, public character: number) {}
}

export class FakeRange {
  constructor(public start: FakePosition, public end: FakePosition) {}
}

export class FakeSelection extends FakeRange {
  get isEmpty() { return this.start.character === this.end.character && this.start.line === this.end.line }
}

/** Backing text is offset-addressed via `character` on line 0 — plenty for these tests. */
export function makeDocument(initialText: string) {
  let text = initialText
  let version = 1
  return {
    getText(range?: FakeRange) {
      if (!range) return text
      return text.slice(range.start.character, range.end.character)
    },
    positionAt(offset: number) { return new FakePosition(0, Math.max(0, Math.min(offset, text.length))) },
    uri: { fsPath: '/fake/doc.txt' },
    /** Bumped on every change, like `TextDocument.version`. */
    get version() { return version },
    /** Simulates the user (or another extension) editing the document. */
    _setText(t: string) { text = t; version++ },
    _text() { return text },
  }
}

export type FakeDocument = ReturnType<typeof makeDocument>

export function makeEditor(document: FakeDocument, selections: FakeSelection[]) {
  return {
    document,
    selections,
    /** Set to false to simulate VS Code declining the edit. */
    _accept: true,
    async edit(cb: (b: { replace(range: FakeRange, text: string): void }) => void) {
      const ops: { range: FakeRange; text: string }[] = []
      cb({ replace: (range, text) => ops.push({ range, text }) })
      if (!this._accept) return false
      const sorted = [...ops].sort((a, b) => a.range.start.character - b.range.start.character)
      for (let i = 1; i < sorted.length; i++) {
        // Same message the real TextEditorEdit throws with.
        if (sorted[i].range.start.character < sorted[i - 1].range.end.character) throw new Error('Overlapping ranges are not allowed!')
      }
      // Apply back-to-front so earlier offsets stay valid.
      let text = document._text()
      for (const op of sorted.reverse()) {
        text = text.slice(0, op.range.start.character) + op.text + text.slice(op.range.end.character)
      }
      document._setText(text)
      return true
    },
  }
}

export function createFakeVscode() {
  const handlers = new Map<string, (...args: unknown[]) => unknown>()
  const files = new Map<string, string>()
  return {
    window: {
      activeTextEditor: undefined as ReturnType<typeof makeEditor> | undefined,
      showQuickPick: vi.fn(),
      showInputBox: vi.fn(),
      showOpenDialog: vi.fn(),
      showErrorMessage: vi.fn(),
      showWarningMessage: vi.fn(),
      showInformationMessage: vi.fn(),
      showTextDocument: vi.fn(),
    },
    workspace: {
      openTextDocument: vi.fn(async (opts: { content: string; language: string }) => ({
        getText: () => opts.content,
        languageId: opts.language,
      })),
      fs: {
        readFile: vi.fn(async (uri: { fsPath: string }) => {
          const content = files.get(uri.fsPath)
          if (content === undefined) throw new Error(`ENOENT: ${uri.fsPath}`)
          return new TextEncoder().encode(content)
        }),
      },
    },
    commands: {
      _handlers: handlers,
      registerCommand: vi.fn((name: string, handler: (...args: unknown[]) => unknown) => {
        handlers.set(name, handler)
        return { dispose: () => handlers.delete(name) }
      }),
    },
    Range: FakeRange,
    /** Files `workspace.fs.readFile` can see, by fsPath. */
    _files: files,
  }
}

export type FakeVscode = ReturnType<typeof createFakeVscode>

export function makeContext() {
  const store = new Map<string, unknown>()
  return {
    subscriptions: [] as { dispose(): void }[],
    globalState: {
      get: <T>(key: string, fallback: T): T => (store.has(key) ? (store.get(key) as T) : fallback),
      update: async (key: string, value: unknown) => { store.set(key, value) },
    },
  }
}
