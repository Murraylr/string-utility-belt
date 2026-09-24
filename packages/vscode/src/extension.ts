/**
 * VS Code extension entry: run String Utility Belt transforms and pipelines on the
 * active editor's selections, without leaving the editor. Built as a single
 * CommonJS bundle (see vite.config.ts) — every dependency except `vscode` itself
 * ships inside dist/extension.cjs. The commands live in ./commands, which takes the
 * `vscode` API as a parameter so tests never have to resolve this host-only module.
 */
import * as vscode from 'vscode'
import { createExtension } from './commands'

const extension = createExtension(vscode)

export function activate(context: vscode.ExtensionContext): void {
  extension.activate(context)
}

export function deactivate(): void {
  extension.deactivate()
}
