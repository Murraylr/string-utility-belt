export const PREVIOUS_KEYS = [
  'string-workshop-state-v3','string-workshop-state-v4','string-workshop-state-v5',
  'string-workshop-state-v6','string-workshop-state-v7','string-workshop-state-v8','string-workshop-state-v9','string-workshop-state-v10','string-workshop-state-v11'
] as const;
export const CURRENT_KEY = 'string-workshop-state-v12';

export type PipelineState = { input?: string; steps: any[]; showPreviews: boolean; _ts?: number; _origin?: string };

export function stableStringify(obj: unknown) {
  const seen = new WeakSet();
  return JSON.stringify(obj, function (k, v) {
    if (typeof v === 'object' && v !== null) {
      if (seen.has(v)) return;
      seen.add(v);
      const keys = Object.keys(v as Record<string, unknown>).sort();
      const out: Record<string, unknown> = {};
      for (const key of keys) out[key] = (v as any)[key];
      return out;
    }
    return v;
  });
}

function sanitize(x: any): PipelineState {
  return {
    input: (typeof x?.input === 'string') ? x.input : undefined,
    steps: Array.isArray(x?.steps) ? x.steps : [],
    showPreviews: Boolean(x?.showPreviews),
    _ts: Number(x?._ts)||0,
    _origin: typeof x?._origin==='string'?x._origin:undefined
  }
}

export function loadState(): PipelineState {
  try {
    const raw = localStorage.getItem(CURRENT_KEY);
    if (raw) return sanitize(JSON.parse(raw));
  } catch {};
  for (const k of PREVIOUS_KEYS) {
    try {
      const raw = localStorage.getItem(k);
      if (raw) {
        const parsed = sanitize(JSON.parse(raw));
        try { localStorage.setItem(CURRENT_KEY, JSON.stringify(parsed)) } catch {};
        return parsed;
      }
    } catch {};
  }
  return { input: undefined, steps: [], showPreviews: false };
}

export function saveState(state: PipelineState) {
  try {
    const payload: PipelineState = { ...state, _ts: Date.now() };
    localStorage.setItem(CURRENT_KEY, JSON.stringify(payload));
  } catch {};
}
