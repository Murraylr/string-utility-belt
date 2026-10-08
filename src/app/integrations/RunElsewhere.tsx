import React, { useEffect, useId, useState } from 'react'
import type { UtilityMeta } from '@/core/registry'
import type { Params } from '@/types/utility'
import { INTEGRATION_LINKS, type IntegrationId } from './links'
import { MCP_ADD_COMMAND, cliCommand, mcpArguments } from './snippets'

const COPIED_MS = 1500

const hrefOf = (id: IntegrationId): string => INTEGRATION_LINKS.find(l => l.id === id)!.href

export type SnippetIntegration = Extract<IntegrationId, 'cli' | 'mcp'>

interface SnippetProps {
  label: string
  code: string
  onCopied?: () => void
}

function Snippet({ label, code, onCopied }: SnippetProps) {
  const [copied, setCopied] = useState(false)
  const labelId = useId()
  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), COPIED_MS)
    return () => clearTimeout(timer)
  }, [copied])
  const onCopy = () => {
    navigator.clipboard?.writeText(code).then(() => {
      setCopied(true)
      onCopied?.()
    }, () => { /* clipboard refused (permissions, insecure context): nothing was copied */ })
  }
  return (
    <div className="grid gap-1">
      <div className="flex items-center justify-between gap-2">
        <span id={labelId} className="text-xs text-muted">{label}</span>
        <button type="button" className="btn text-xs" aria-describedby={labelId} onClick={onCopy}>
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre aria-labelledby={labelId} className="mono text-xs whitespace-pre-wrap wrap-anywhere bg-surface-2 rounded-lg p-3">
        <code>{code}</code>
      </pre>
    </div>
  )
}

export interface RunElsewhereProps {
  meta: Pick<UtilityMeta, 'id' | 'params' | 'env'>
  /** The playground's current input and params: the commands repeat what the page just ran. */
  input: string
  params: Params
  /** A command was copied (reported by the app; the pre-render passes nothing). */
  onCopy?: (integration: SnippetIntegration) => void
  /** A link to the tool's section of /integrations/ was followed. */
  onDocsClick?: (integration: SnippetIntegration) => void
}

/**
 * The same run from the shell (`subelt`) and from an AI agent (the MCP server), following the
 * doc page's playground. Nothing for a utility those Node hosts cannot run. Free of browser
 * APIs until clicked, so `scripts/seo/content.ts` pre-renders it as is.
 */
export default function RunElsewhere({ meta, input, params, onCopy, onDocsClick }: RunElsewhereProps) {
  const headingId = useId()
  const cli = cliCommand(meta, input, params)
  if (cli === undefined) return null
  return (
    <section className="card p-6 grid gap-3" aria-labelledby={headingId}>
      <h2 id={headingId} className="text-lg font-medium">Run it from your terminal or AI agent</h2>
      <p className="text-sm muted">
        The same utility runs on your own machine in the{' '}
        <a className="underline" href={hrefOf('cli')} onClick={() => onDocsClick?.('cli')}>subelt command-line tool</a>{' '}
        and the <a className="underline" href={hrefOf('mcp')} onClick={() => onDocsClick?.('mcp')}>MCP server</a>, so
        scripts and agents get the exact result instead of a guess. They update as you try the utility on this page.
      </p>
      <Snippet label="Terminal (Node.js 20+)" code={cli} onCopied={() => onCopy?.('cli')} />
      <Snippet label="Add the MCP server to Claude Code" code={MCP_ADD_COMMAND} onCopied={() => onCopy?.('mcp')} />
      <p className="text-sm muted">
        Your agent then calls <code className="mono">run_utility</code> with{' '}
        <code className="mono wrap-anywhere">{mcpArguments(meta, params)}</code> and your text as{' '}
        <code className="mono">input</code>.
      </p>
    </section>
  )
}
