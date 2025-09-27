import { Step } from '@/types/utility';

export const CURRENT_KEY = 'string-workshop-state-v7';

export type PersistedState = {
  steps: Step[];
  showPreviews: boolean;
  _origin?: string;
};

export function saveState(state: PersistedState) {
  const toSave: PersistedState = {
    steps: state.steps,
    showPreviews: state.showPreviews,
  };
  localStorage.setItem(CURRENT_KEY, JSON.stringify(toSave));
}

export function loadState(): PersistedState {
  const raw = localStorage.getItem(CURRENT_KEY);
  if (raw) return JSON.parse(raw);
  // migrate older keys if present
  const oldKeys = [
    'string-workshop-state-v6',
    'string-workshop-state-v5',
    'string-workshop-state-v4',
  ];
  for (const k of oldKeys) {
    const r = localStorage.getItem(k);
    if (r) {
      const parsed = JSON.parse(r);
      const migrated: PersistedState = {
        steps: parsed.steps ?? [],
        showPreviews: !!parsed.showPreviews,
      };
      localStorage.setItem(CURRENT_KEY, JSON.stringify(migrated));
      return migrated;
    }
  }
  return { steps: [], showPreviews: true };
}
