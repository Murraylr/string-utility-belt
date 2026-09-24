export type ValueType = 'string' | 'bytes' | 'json';
export type Produces = ValueType | ValueType[];
export type Accepts = ValueType | ValueType[];

export type Value = string | Uint8Array | Record<string, unknown> | unknown[];

export type Params = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Params
// ---------------------------------------------------------------------------

/**
 * Fields every param kind shares. Validation is declarative (plain data) so the
 * generated manifest can carry it without shipping the utility's code.
 */
interface ParamBase {
  label: string;
  /** Longer help text shown under the control. */
  description?: string;
  /** An empty value is a validation error. */
  required?: boolean;
}

export type ParamSpec =
  | (ParamBase & { kind: 'string'; default?: string; placeholder?: string; pattern?: string; maxLength?: number })
  | (ParamBase & { kind: 'number'; default?: number; min?: number; max?: number; step?: number; integer?: boolean })
  | (ParamBase & { kind: 'boolean'; default?: boolean })
  | (ParamBase & { kind: 'select'; options: string[]; default?: string })
  | (ParamBase & { kind: 'code'; default?: string; placeholder?: string; language?: string })
  /** Plain multi-line text (a second input, a word list). */
  | (ParamBase & { kind: 'textarea'; default?: string; placeholder?: string; rows?: number; maxLength?: number })
  /** A regular-expression source; `flagsParam` names the sibling param holding its flags. */
  | (ParamBase & { kind: 'regex'; default?: string; placeholder?: string; flagsParam?: string })
  /** Ordered key/value pairs. */
  | (ParamBase & { kind: 'keyvalue'; default?: Array<[string, string]>; keyLabel?: string; valueLabel?: string })
  /** A file's content, read in the browser: text, or base64 for binary. */
  | (ParamBase & { kind: 'file'; default?: string; placeholder?: string; accept?: string; as?: 'text' | 'base64' })
  /** A CSS color string (hex by default). */
  | (ParamBase & { kind: 'color'; default?: string; placeholder?: string })
  /** An ISO-8601 date (`YYYY-MM-DD`) or date-time. */
  | (ParamBase & { kind: 'date'; default?: string; withTime?: boolean })
  | (ParamBase & { kind: 'multiselect'; options: string[]; default?: string[] })
  | (ParamBase & { kind: 'range'; default?: number; min: number; max: number; step?: number });

export type ParamKind = ParamSpec['kind'];

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/**
 * Runtime capabilities a utility needs beyond plain ECMAScript + WebCrypto.
 * - `dom`:  DOMParser / document (unavailable in Web Workers and Cloudflare Workers)
 * - `wasm`: compiles WebAssembly at runtime (disallowed in Cloudflare Workers)
 * - `eval`: executes user-supplied code (never on a server)
 * - `main`: must run on the browser main thread
 */
export type UtilityEnv = 'dom' | 'wasm' | 'eval' | 'main';

/** A worked example — rendered on doc pages and executed by the golden test. */
export interface UtilityExample {
  title?: string;
  input: string;
  /** How `input` is decoded before it is passed to the utility. Default `text`. */
  inputEncoding?: 'text' | 'hex' | 'base64' | 'json';
  params?: Params;
  /** Exact expected output, as rendered by `formatForDisplay`. */
  output?: string;
  /** Regex source the rendered output must match (for non-deterministic output). */
  outputMatches?: string;
}

/** Where a pipeline is executing — lets a utility adapt or refuse. */
export type RunEnv = 'browser-main' | 'browser-worker' | 'node' | 'edge';

export interface StepContext {
  signal?: AbortSignal;
  env?: RunEnv;
}

export interface Utility {
  id: string;
  name: string;
  category: string;
  description?: string;
  accepts?: Accepts;
  produces?: Produces;
  params: Record<string, ParamSpec>;
  /** Search keywords beyond the name ("uppercase", "b64", …). */
  tags?: string[];
  /** Other names people call this utility ("atob" for base64 decode). */
  aliases?: string[];
  examples?: UtilityExample[];
  /** Capabilities this utility needs; merged with what the manifest generator detects. */
  env?: UtilityEnv[];
  /**
   * Line-local: f(a + '\n' + b) === f(a) + '\n' + f(b) for all a, b without newlines.
   * Lets the chunked runner process huge inputs piecewise. Verified by a property test.
   */
  streamable?: boolean;
  apply(input: Value, params: Params, ctx?: StepContext): Promise<Value> | Value;
}

// ---------------------------------------------------------------------------
// Pipelines (schema v2)
// ---------------------------------------------------------------------------

/** Gate a step on its input; when false the input passes through untouched. */
export type Condition = (
  | { kind: 'always' }
  | { kind: 'nonEmpty' }
  | { kind: 'regex'; pattern: string; flags?: string }
  | { kind: 'type'; type: ValueType }
) & { negate?: boolean };

/**
 * What a failing step does to the rest of its sequence.
 * - `passthrough`: record the error, hand the step's input to the next step (default)
 * - `stop`:        record the error and halt the enclosing sequence
 * - `empty`:       record the error and continue with an empty string
 */
export type ErrorPolicy = 'passthrough' | 'stop' | 'empty';

export type MergeSpec =
  | { mode: 'concat'; separator?: string }
  /** Interleave branch outputs line by line. */
  | { mode: 'zip'; separator?: string }
  /** A JSON array of every branch's output. */
  | { mode: 'json' }
  /** One branch's output. */
  | { mode: 'pick'; index: number };

interface StepBase {
  id: string;
  enabled?: boolean;
  /** Optional user-facing name. */
  label?: string;
  condition?: Condition;
  onError?: ErrorPolicy;
}

export interface UtilityStep extends StepBase {
  type?: 'utility';
  utilityId: string;
  params?: Record<string, unknown>;
}

/** Fork: every branch runs on the same input, then the outputs are merged. */
export interface BranchStep extends StepBase {
  type: 'branch';
  branches: PipelineStep[][];
  merge: MergeSpec;
}

/** A named, collapsible sub-pipeline. */
export interface MacroStep extends StepBase {
  type: 'macro';
  name: string;
  steps: PipelineStep[];
  /** Library id of the macro this was inserted from, if any. */
  macroId?: string;
}

export type PipelineStep = UtilityStep | BranchStep | MacroStep;

/** A whole pipeline as stored, shared, and exchanged with the CLI/API. */
export interface PipelineDoc {
  v: 2;
  name?: string;
  description?: string;
  steps: PipelineStep[];
  /** Only present when the author chose to share their input. */
  input?: string;
}
