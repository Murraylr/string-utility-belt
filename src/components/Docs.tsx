import React from 'react'
import { UTIL_DISPLAY, CATEGORIES } from '@/utilities'

const SECTIONS = [
  { id: 'pipeline', title: 'Build a pipeline' },
  { id: 'steps', title: 'Work with steps' },
  { id: 'previews', title: 'Previews and errors' },
  { id: 'types', title: 'Strings, bytes and JSON' },
  { id: 'output', title: 'Get the result out' },
  { id: 'saved', title: "What's saved" },
  { id: 'example', title: 'Example: title to URL slug' },
  { id: 'utilities', title: 'Utility reference' },
]

const STEP_CONTROLS: [string, string][] = [
  ['Checkbox (top left)', 'Turns the step on or off. A disabled step passes its input through unchanged.'],
  ['▲ / ▼', 'Moves the step up or down. Order matters.'],
  ['Bin icon', 'Removes the step.'],
  ['utility dropdown', "Swaps the step to a different utility. The step's parameters reset."],
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
      <div className="grid gap-3 text-sm leading-relaxed text-gray-700">{children}</div>
    </section>
  )
}

function Table({ head, rows, monoCols = [] }: { head: string[]; rows: React.ReactNode[][]; monoCols?: number[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm border-collapse">
        <thead>
          <tr>{head.map(h => <th key={h} className="py-2 pr-4 border-b font-medium text-gray-500">{h}</th>)}</tr>
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

export default function Docs() {
  const categories = CATEGORIES.filter(c => c !== 'All')

  return (
    <div className="grid gap-6 md:grid-cols-[200px_1fr] items-start">
      <nav aria-label="Docs sections" className="md:sticky md:top-24 grid gap-1 text-sm">
        {SECTIONS.map(s => (
          <a key={s.id} href={`#/docs`} onClick={e => { e.preventDefault(); document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth' }) }}
            className="px-3 py-1.5 rounded-lg hover:bg-white/70">{s.title}</a>
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
            <li>Type or paste text into the <strong>input</strong> box.</li>
            <li>
              Add steps. <strong>Add utility</strong> opens a browser where you can filter by category or search by name.
              Click a utility to add it. You can also use the <strong>quick add</strong> dropdown.
            </li>
            <li>New steps go to the end of the pipeline. The result updates as you type. You don't need to run anything.</li>
          </ol>
        </Section>

        <Section id="steps" title="Work with steps">
          <p>Each step card has these controls:</p>
          <Table head={['Control', 'What it does']} rows={STEP_CONTROLS} />
          <p>
            The badges next to the step number show the step's category and, when a preview is showing, the type of value it
            produced (<code className="mono">string</code>, <code className="mono">bytes</code> or <code className="mono">json</code>).
          </p>
        </Section>

        <Section id="previews" title="Previews and errors">
          <ul className="list-disc pl-5 grid gap-1">
            <li>
              Tick <strong>show intermediate previews</strong> to see each step's output below its card. This helps you find
              where a chain goes wrong.
            </li>
            <li>
              If a step fails, for example because of an invalid regex or bad hex, its card shows the error in red. The
              pipeline skips that step and keeps going with the previous value.
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
          <p>
            Under the result panel, <strong>copy</strong> puts the output on your clipboard and <strong>download</strong> saves
            it as <code className="mono">result.txt</code>.
          </p>
        </Section>

        <Section id="saved" title="What's saved">
          <p>
            Your steps, their settings and the preview toggle are saved in this browser, so the pipeline is still there after
            you reload. The input text <strong>is not</strong> saved. To start over, delete the steps.
          </p>
        </Section>

        <Section id="example" title="Example: title to URL slug">
          <p>Input: <code className="mono bg-gray-100 rounded px-1 whitespace-pre">{'  Crème Brûlée: A Guide!  '}</code></p>
          <Table head={['Step', 'Utility', 'Settings', 'Output']} monoCols={[3]}
            rows={EXAMPLE.map(([u, s, o], i) => [String(i + 1), u, s, o])} />
        </Section>

        <Section id="utilities" title="Utility reference">
          {categories.map(cat => (
            <div key={cat} className="grid gap-2">
              <h3 className="font-medium text-ink-900">{cat}</h3>
              <Table head={['Utility', 'What it does', 'Settings']}
                rows={UTIL_DISPLAY.filter(u => u.category === cat).map(u => [
                  <span className="font-medium">{u.name}</span>,
                  u.description,
                  Object.values(u.params).map(p => p.label).join(', ') || '—',
                ])} />
            </div>
          ))}
        </Section>
      </div>
    </div>
  )
}
