import { Step } from '@/types/utility';

export const CURRENT_KEY = 'state';

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

  return { steps: [], showPreviews: true };
}
