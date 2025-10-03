const CURRENT_KEY = 'string-utility-belt';

export function saveState(state: { steps: any; showPreviews: any; }) {
  // Only persist pipeline config
  const safe = { steps: state?.steps ?? [], showPreviews: !!state?.showPreviews };
  localStorage.setItem(CURRENT_KEY, JSON.stringify(safe));
}

export function loadState() {
  let raw = localStorage.getItem(CURRENT_KEY);
  if (!raw) return { steps: [], showPreviews: true };
  try {
    const parsed = JSON.parse(raw);
    const steps = Array.isArray(parsed.steps) ? parsed.steps : [];
    return { steps, showPreviews: !!parsed.showPreviews };
  } catch {
    return { steps: [], showPreviews: true };
  }
}
