import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { ClipboardCopy, Download, Plus } from 'lucide-react';
import { UTILITIES, UTIL_DISPLAY, CATEGORIES, runPipeline, formatForDisplay } from '@/utilities';
import StepCard from '@/components/StepCard';
import ToolbarButton from '@/components/ToolbarButton';
import UtilityPicker from '@/components/UtilityPicker';
import Select from '@/components/Select';
import { uid } from '@/utilities/helpers';
import { getRoute, onRouteChange } from '@/lib/router';
import BackgroundFX from '@/components/BackgroundFX';
import UtilityDoc, { DocsIndex } from '@/components/UtilityDoc';
import { loadState, saveState } from '@/lib/persist';

const INSTANCE_ID = Math.random().toString(36).slice(2);

export default function App() {
  const [route, setRoute] = useState(getRoute());
  useEffect(() => onRouteChange(setRoute), []);

  const [input, setInput] = useState('');
  const persisted = loadState();
  const [steps, setSteps] = useState(persisted.steps);
  const [showPreviews, setShowPreviews] = useState(persisted.showPreviews);

  const [finalValue, setFinalValue] = useState<any>('');
  const [showPicker, setShowPicker] = useState(false);
  const [previews, setPreviews] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const lastSavedRef = useRef(JSON.stringify({ steps, showPreviews }));
  const lastSeenTsRef = useRef(persisted._ts || 0);

  useEffect(() => {
    const snapshot = JSON.stringify({ steps, showPreviews });
    if (snapshot === lastSavedRef.current) return;
    lastSavedRef.current = snapshot;
    saveState({ steps, showPreviews, _origin: INSTANCE_ID });
  }, [steps, showPreviews]);

  const addStep = useCallback((utilityId = UTILITIES[0]?.id) => {
    const util = UTILITIES.find((u) => u.id === utilityId) || UTILITIES[0];
    if (!util) return;
    const step = { id: uid('step'), utilityId: util.id, enabled: true, params: {} as Record<string, unknown> };
    Object.entries(util.params || {}).forEach(([k, spec]) => {
      if (Object.prototype.hasOwnProperty.call(spec, 'default')) (step.params as any)[k] = (spec as any).default;
    });
    setSteps((prev: any) => [...prev, step]); setShowPicker(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { out, previews: p, err } = await runPipeline(input, steps, showPreviews);
      if (!cancelled) { setFinalValue(out); setPreviews(p || {}); setErrors(err || {}) }
    })();
    return () => { cancelled = true };
  }, [input, steps, showPreviews]);

  const importRef = useRef<HTMLInputElement|null>(null);
  const onImportFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        const nextSteps = Array.isArray(data.steps) ? data.steps : [];
        setSteps(nextSteps);
      } catch { alert('invalid pipeline file') }
    };
    reader.readAsText(file); e.target.value = '';
  }, []);

  const displayText = useMemo(() => formatForDisplay(finalValue), [finalValue]);

  const copyToClipboard = useCallback(async () => { await navigator.clipboard.writeText(displayText) }, [displayText]);
  const downloadResult = useCallback(() => {
    const blob = new Blob([displayText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'result.txt'; a.click(); URL.revokeObjectURL(url);
  }, [displayText]);

  const groupedOptions = useMemo(() => {
    const groups = CATEGORIES.filter(c => c !== 'All').map(cat => ({
      label: cat,
      options: UTIL_DISPLAY.filter(u => u.category === cat).map(u => ({ label: u.name, value: u.id }))
    }));
    return [{ label: '— select —', value: '' }, ...groups] as any[];
  }, []);

  const Nav = () => (
    <nav className="flex items-center gap-4 text-sm">
      <a href="#/" className="hover:underline">Tool</a>
      <a href="#/docs" className="hover:underline">Docs</a>
      <a href="#/blog" className="hover:underline">Blog</a>
    </nav>
  );

  return (
    <div className="relative min-h-screen text-ink-900">
      <BackgroundFX />
      <header className="sticky top-0 backdrop-blur bg-white/60 border-b z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-primary-600 text-white grid place-content-center font-bold shadow-glow">S</div>
            <div>
              <div className="font-semibold leading-tight">String Utility Belt</div>
              <div className="text-xs text-gray-500">build a chain of string utilities</div>
            </div>
          </div>
          <Nav />
        </div>
      </header>

      {route.name === 'docs' || route.name === 'docsIndex' ? (
      <main className="max-w-4xl mx-auto px-4 py-8">
        {route.name === 'docs' ? <UtilityDoc id={route.params.id} /> : <DocsIndex />}
      </main>
      ) : (
      <main className="max-w-7xl mx-auto px-4 py-8 grid gap-8">
        <section className="glass rounded-[28px] p-6 md:p-8 shadow-glow">
          <div className="grid md:grid-cols-2 gap-6 items-center">
            <div className="space-y-3">
              <h1 className="text-2xl md:text-3xl font-semibold">String Utility Belt</h1>
              <p className="muted">Efficiently chain string utilities, preview every step, and export/share your pipeline.</p>
              <div className="flex gap-2">
                <button className="cta" onClick={()=>setShowPicker(true)}>Add utility</button>
                <a className="px-4 py-2 rounded-xl border bg-white hover:bg-gray-50" href="#/blog">Read blog</a>
              </div>
            </div>
            <div className="card p-4">
              <div className="grid gap-2">
                <label className="muted">input</label>
                <textarea className="border rounded-2xl p-3 min-h-[160px] focus:ring outline-none mono bg-white shadow-soft"
                  placeholder="type or paste your text here…" value={input} onChange={(e)=>setInput(e.target.value)} />
              </div>
              <div className="grid gap-2 mt-4">
                <label className="muted">result</label>
                <div className="border rounded-2xl p-3 min-h-[160px] bg-white overflow-auto">
                  <pre className="mono whitespace-pre-wrap break-words">{displayText}</pre>
                </div>
                <div className="flex gap-2 mt-2">
                  <ToolbarButton icon={ClipboardCopy} label="copy" onClick={copyToClipboard} />
                  <ToolbarButton icon={Download} label="download" onClick={downloadResult} />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="flex flex-wrap items-center gap-3">
          <button className="cta" onClick={() => setShowPicker(p => !p)}>
            <span className="inline-flex items-center gap-2"><Plus size={16}/> Add utility</span>
          </button>
          <span className="muted">or quick add</span>
          <Select value={''} onChange={(val)=>{ if (val) addStep(val) }} options={groupedOptions} className="max-w-sm" />
          <label className="ml-auto text-sm flex items-center gap-2">
            <input type="checkbox" checked={showPreviews} onChange={e=>setShowPreviews(e.target.checked)} />
            show intermediate previews
          </label>
        </section>

        {showPicker && (<section><UtilityPicker onPick={addStep} /></section>)}

        <section className="grid gap-3">
          <AnimatePresence initial={false}>
            {steps.length === 0 && (<div className="muted">no steps yet — add utilities to build your pipeline</div>)}
            {steps.map((step, i) => (
              <StepCard key={step.id} index={i} step={step} total={steps.length}
                onMoveUp={()=>setSteps(prev=>{const arr=[...prev]; if(i>0){const [it]=arr.splice(i,1); arr.splice(i-1,0,it)}; return arr})}
                onMoveDown={()=>setSteps(prev=>{const arr=[...prev]; if(i<arr.length-1){const [it]=arr.splice(i,1); arr.splice(i+1,0,it)}; return arr})}
                onDelete={()=>setSteps(prev=>prev.filter((_, idx)=> idx!==i))}
                onToggle={(v)=>setSteps(prev=>prev.map((s,idx)=> idx===i?{...s, enabled:v}:s))}
                onChangeUtil={(utilId: string)=>setSteps(prev=>prev.map((s,idx)=> idx===i?{...s, utilityId:utilId, params:{}}:s))}
                onChangeParams={(p)=>setSteps(prev=>prev.map((s,idx)=> idx===i?{...s, params:p}:s))}
                preview={previews[step.id]}
                error={errors[step.id]}
              />
            ))}
          </AnimatePresence>
        </section>
      </main>
      )}
      <input type="file" ref={importRef} onChange={onImportFile} accept="application/json" className="hidden" />
    </div>
  );
}
