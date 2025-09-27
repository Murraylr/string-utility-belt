import { Value } from '@/types/values';
import { LoadedUtility, Step } from '@/types/utility';
import { serializePreview } from '@/lib/preview';

/**
 * runPipeline
 * Ensures the raw value is passed between utilities WITHOUT string coercion.
 * The preview is created separately and never fed back into the chain.
 */
export async function runPipeline(input: Value, steps: Step[], registry: Record<string, LoadedUtility>) {
  let current: Value = input;
  const previews: string[] = [];

  for (const step of steps) {
    const util = registry[step.name];
    if (!util) throw new Error(`Utility not found: ${step.name}`);

    // Keep raw value moving through the chain
    const out = await util.apply(current as never, step.params as never);
    current = out as Value;

    // Previews are derived strings ONLY for UI — they are NOT persisted nor reused as inputs.
    previews.push(serializePreview(current));
  }

  return { out: current, previews };
}
