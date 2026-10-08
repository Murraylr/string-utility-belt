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
    <div className="border rounded-lg bg-strip min-w-0">
      <div className="flex items-center justify-between gap-2 pl-3.5 pr-1.5 pt-1.5">
        <span id={labelId} className="text-[11px] text-muted">{label}</span>
        <button type="button" className="btn-ghost h-6 text-[11.5px]" aria-describedby={labelId} onClick={onCopy}>
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre aria-labelledby={labelId} className="m-0 px-3.5 pt-1 pb-3 font-mono text-[12.5px] leading-5 whitespace-pre-wrap wrap-anywhere">
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
    <section className="grid gap-3.5 min-w-0" aria-labelledby={headingId}>
      <h2 id={headingId} className="section-title">Run it from your terminal or AI agent</h2>
      <p className="m-0 text-sm leading-[22px] text-muted text-pretty">
        The same utility runs on your own machine in the{' '}
        <a className="text-fg underline decoration-acc underline-offset-[3px]" href={hrefOf('cli')} onClick={() => onDocsClick?.('cli')}>subelt command-line tool</a>{' '}
        and the <a className="text-fg underline decoration-acc underline-offset-[3px]" href={hrefOf('mcp')} onClick={() => onDocsClick?.('mcp')}>MCP server</a>, so
        scripts and agents get the exact result instead of a guess. They update as you try the utility on this page.
      </p>
      <Snippet label="Terminal (Node.js 20+)" code={cli} onCopied={() => onCopy?.('cli')} />
      <Snippet label="Add the MCP server to Claude Code" code={MCP_ADD_COMMAND} onCopied={() => onCopy?.('mcp')} />
      <p className="m-0 text-sm leading-[22px] text-muted text-pretty">
        Your agent then calls <code className="font-mono text-[0.86em] px-[5px] py-px rounded-[4px] bg-surface-2 text-fg">run_utility</code> with{' '}
        <code className="font-mono text-[0.86em] px-[5px] py-px rounded-[4px] bg-surface-2 text-fg wrap-anywhere">{mcpArguments(meta, params)}</code> and your text as{' '}
        <code className="font-mono text-[0.86em] px-[5px] py-px rounded-[4px] bg-surface-2 text-fg">input</code>.
      </p>
    </section>
  )
}
