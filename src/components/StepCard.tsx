import React from 'react';
import { BookOpen, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { UTIL_MAP, docsHref, formatForDisplay, valueType } from '@/utilities';
import ParamsEditor from './ParamsEditor';
import Select from './Select';

export default function StepCard({ index, step, total, onMoveUp, onMoveDown, onDelete, onToggle, onChangeParams, onChangeUtil, preview, error }: any) {
  const util = UTIL_MAP[step.utilityId];
  const category = util?.category || 'Other';
  const t = valueType(preview);

  return (
    <div className={`card p-4 flex flex-col gap-3 ${step.enabled ? '' : 'opacity-60'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <input aria-label={`toggle step ${index + 1}`} type="checkbox" checked={step.enabled} onChange={(e)=>onToggle(e.target.checked)} />
          <span className="text-sm text-gray-500">step {index + 1}</span>
          <span className="text-[11px] px-2 py-0.5 rounded-full border bg-gray-50">{category}</span>
          {preview !== undefined && <span className="text-[11px] px-2 py-0.5 rounded-full border bg-gray-50">{t}</span>}
        </div>
        <div className="flex items-center gap-1">
          <button className="p-2 hover:bg-gray-100 rounded-xl" onClick={onMoveUp} disabled={index===0}><ChevronUp size={16}/></button>
          <button className="p-2 hover:bg-gray-100 rounded-xl" onClick={onMoveDown} disabled={index===total-1}><ChevronDown size={16}/></button>
          <button className="p-2 hover:bg-red-50 text-red-600 rounded-xl" onClick={onDelete}><Trash2 size={16}/></button>
        </div>
      </div>
      <div className="grid md:grid-cols-3 gap-4 items-start">
        <div className="md:col-span-1">
          <label className="muted">utility</label>
          <Select value={step.utilityId} onChange={onChangeUtil} options={Object.keys(UTIL_MAP)} />
          <div className="text-xs text-gray-500 mt-1">{util?.description}</div>
          {util && (
            <a href={docsHref(util.id)} className="text-xs text-primary-600 hover:underline inline-flex items-center gap-1 mt-1">
              <BookOpen size={12}/> {util.name} docs
            </a>
          )}
        </div>
        <div className="md:col-span-2">{util && <ParamsEditor spec={util.params || {}} params={step.params} onChange={onChangeParams} />}</div>
      </div>
      {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl p-2">{String(error)}</div>}
      {preview !== undefined && (
        <div className="bg-gray-50 rounded-xl p-3 text-sm whitespace-pre-wrap overflow-auto border">
          <div className="text-gray-500 mb-1">preview</div>
          <pre className="font-mono break-words">{formatForDisplay(preview)}</pre>
        </div>
      )}
    </div>
  );
}
