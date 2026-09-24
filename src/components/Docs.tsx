import React, { useEffect } from 'react'

const SITE_NAME = 'String Utility Belt'

const SECTIONS = [
  { id: 'pipeline', title: 'Build a pipeline' },
  { id: 'steps', title: 'Work with steps' },
  { id: 'advanced', title: 'Branches, macros and conditions' },
  { id: 'previews', title: 'Previews and errors' },
  { id: 'types', title: 'Strings, bytes and JSON' },
  { id: 'output', title: 'Get the result out' },
  { id: 'saved', title: "What's saved" },
  { id: 'example', title: 'Example: title to URL slug' },
  { id: 'utilities', title: 'Utility reference' },
]

const STEP_CONTROLS: [string, string][] = [
  ['Checkbox', 'Turns the step on or off. A disabled step passes its input through unchanged.'],
  ['Drag handle, or ▲ / ▼', 'Moves the step. With the handle focused, Alt+Arrow keys move it too. Order matters.'],
  ['Bin icon', 'Removes the step.'],
  ['Step menu', 'Rename, duplicate, move, solo or delete the step.'],
  ['utility dropdown', 'Swaps the step to a different utility. The new utility starts at its defaults.'],
  ['Parameter fields', 'Settings for the utility, such as case mode, regex pattern or max length. Each field starts at a sensible default.'],
]

const EXAMPLE: [string, string, string][] = [
  ['trim', '—', 'Crème Brûlée: A Guide!'],
  ['remove diacritics', '—', 'Creme Brulee: A Guide!'],
  ['slug', '—', 'creme-brulee-a-guide'],
  ['truncate', 'max length 12, ellipsis cleared', 'creme-brulee'],
]

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="card p-6 grid gap-3 scroll-mt-24">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="grid gap-3 text-sm leading-relaxed">{children}</div>
    </section>
  )
}

function Table({ head, rows, monoCols = [] }: { head: string[]; rows: React.ReactNode[][]; monoCols?: number[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm border-collapse">
        <thead>
          <tr>{head.map(h => <th key={h} className="py-2 pr-4 border-b font-medium text-muted">{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="align-top">
              {r.map((c, j) => <td key={j} className={`py-2 pr-4 border-b ${monoCols.includes(j) ? 'mono' : ''}`}>{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const Code = ({ children }: { children: React.ReactNode }) => <code className="mono">{children}</code>

/** How to use the tool: the `#/docs` page. */
export default function Docs() {
  // restored on leaving, like the other route pages
  useEffect(() => {
    const prev = document.title
    document.title = `How to use — ${SITE_NAME}`
    return () => { document.title = prev }
  }, [])

  return (
    <div className="grid gap-6 md:grid-cols-[200px_1fr] items-start">
      <nav aria-label="Docs sections" className="md:sticky md:top-24 grid gap-1 text-sm">
        {SECTIONS.map(s => (
          // scroll, don't navigate: with hash routing, href="#id" would route to an unknown page
          <a key={s.id} href="#/docs" onClick={e => { e.preventDefault(); document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth' }) }}
            className="px-3 py-1.5 rounded-lg hover:bg-surface-2">{s.title}</a>
        ))}
      </nav>

      <div className="grid gap-4 min-w-0">
        <header className="glass rounded-[28px] p-6 md:p-8 shadow-glow grid gap-2">
          <h1 className="text-2xl md:text-3xl font-semibold">How to use String Utility Belt</h1>
          <p className="muted">
            Your text runs through a <strong>pipeline</strong>: an ordered list of steps. Each step applies one utility to the
            output of the step before it. The <strong>result</strong> panel shows the output of the last step.
          </p>
          <div><a className="cta inline-block mt-2" href="#/">Open the tool</a></div>
        </header>

        <Section id="pipeline" title="Build a pipeline">
          <ol className="list-decimal pl-5 grid gap-1">
            <li>
              Type or paste text into the <strong>input</strong> box. You can also <strong>open file</strong> or{' '}
              <strong>fetch URL</strong> to load input from elsewhere.
            </li>
            <li>
              Add steps. <strong>Add utility</strong> opens a browser where you can filter by category or search by name.
              You can also use the <strong>quick add</strong> dropdown, start from a <strong>preset</strong>, or press{' '}
              <Code>Ctrl K</Code> to open the command palette.
            </li>
            <li>New steps go to the end of the pipeline. The result updates as you type. You don't need to run anything.</li>
            <li><strong>Undo</strong> (<Code>Ctrl Z</Code>) and <strong>redo</strong> (<Code>Ctrl Shift Z</Code>) cover every change to the pipeline.</li>
          </ol>
        </Section>

        <Section id="steps" title="Work with steps">
          <p>Each step card has these controls:</p>
          <Table head={['Control', 'What it does']} rows={STEP_CONTROLS} />
          <p>
            Badges on each card show the step's category, the type of value it produced (<Code>string</Code>,{' '}
            <Code>bytes</Code> or <Code>json</Code>) and how long it took.
          </p>
        </Section>

        <Section id="advanced" title="Branches, macros and conditions">
          <ul className="list-disc pl-5 grid gap-1">
            <li><strong>branch</strong> forks the pipeline into parallel lanes that each get the same input. Their outputs are merged with a separator you choose.</li>
            <li>Select a run of neighbouring steps to group them into a <strong>macro</strong>: one reusable step you can save to your library.</li>
            <li>In a step's advanced settings, a <strong>run condition</strong> skips the step unless the input is non-empty, matches a regex or is a given type.</li>
          </ul>
        </Section>

        <Section id="previews" title="Previews and errors">
          <ul className="list-disc pl-5 grid gap-1">
            <li>
              Tick <strong>show intermediate previews</strong> to see each step's output below its card. Turn on the diff view
              to see what a step changed. This helps you find where a chain goes wrong.
            </li>
            <li>
              If a step fails, for example because of an invalid regex or bad hex, its card shows the error in red. By default
              the pipeline carries on with that step's input. Change this per step with <strong>on error</strong>: stop the
              pipeline, or continue with empty output.
            </li>
          </ul>
        </Section>

        <Section id="types" title="Strings, bytes and JSON">
          <p>
            Some utilities work on raw bytes instead of text (for example <strong>Get bytes</strong>, <strong>hex decode</strong> and{' '}
            <strong>md5 hash</strong>). The pipeline converts between types for you: text becomes UTF‑8 bytes when a step
            needs bytes, and the other way round.
          </p>
          <p>When the result is bytes, it's shown as decimal values, hex and, where possible, decoded UTF‑8 text.</p>
        </Section>

        <Section id="output" title="Get the result out">
          <ul className="list-disc pl-5 grid gap-1">
            <li>Under the result panel, <strong>copy</strong> puts the output on your clipboard (pick a format) and <strong>download</strong> saves it as a file.</li>
            <li><strong>share</strong> makes a link that opens your pipeline in anyone's browser. Your input text is only included if you tick <strong>Include my input</strong>.</li>
            <li><strong>library</strong> keeps named pipelines and macros you want to reuse. You can export it as <Code>.json</Code> and import it again later.</li>
          </ul>
        </Section>

        <Section id="saved" title="What's saved">
          <p>
            Your current pipeline, its name and the preview toggle are saved in this browser, so they're still there after you
            reload. The input text <strong>is not</strong> saved.
          </p>
        </Section>

        <Section id="example" title="Example: title to URL slug">
          <p>Input: <code className="mono bg-surface-2 rounded px-1 whitespace-pre">{'  Crème Brûlée: A Guide!  '}</code></p>
          <Table head={['Step', 'Utility', 'Settings', 'Output']} monoCols={[3]}
            rows={EXAMPLE.map(([u, s, o], i) => [String(i + 1), u, s, o])} />
        </Section>

        <Section id="utilities" title="Utility reference">
          <p>
            Every utility has its own page with its settings and worked examples. Browse them all on the{' '}
            <a className="underline underline-offset-2" href="#/utilities">utilities index</a>.
          </p>
        </Section>
      </div>
    </div>
  )
}
