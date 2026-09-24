/** Guardrails applied to every tool call, independent of what the underlying utility allows. */

/** A single `input` string over 1 MB is refused outright — this is a tool call, not a file transfer. */
export const MAX_INPUT_BYTES = 1_000_000

/** A `share` link/payload longer than this is refused before it is decompressed. */
export const MAX_SHARE_CHARS = 1_000_000

/** Output text past this many characters is cut off and flagged `truncated` — no agent context can use more. */
export const MAX_OUTPUT_CHARS = 1_000_000

/** A `run_pipeline` request with more steps than this (nested branches/macros included) is refused. */
export const MAX_PIPELINE_STEPS = 100

/** Wall-clock budget for one tool call (a single utility, or a whole pipeline). */
export const TOOL_TIMEOUT_MS = 20_000
