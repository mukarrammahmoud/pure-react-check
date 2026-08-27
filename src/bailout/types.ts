/**
 * pure-react-check — Bailout Analysis Types (schema v2)
 *
 * IMPORTANT DISCLAIMER
 * ────────────────────
 * This module performs STATIC ANALYSIS only.
 *
 * pure-react-check is NOT the React Compiler. It cannot prove that a component
 * will or will not be optimised. Its predictions are based on well-known
 * patterns that the React Compiler is documented to struggle with, but:
 *
 *  - A "COMPILER READY" status does NOT guarantee compiler optimisation.
 *  - A "PREDICTED BAILOUT" is a prediction, not a certainty.
 *  - The React Compiler remains the authoritative source of truth.
 *
 * Use this tool as a preflight check, not as a replacement for actually
 * running and testing with the React Compiler enabled.
 */

// ─── Schema versioning ────────────────────────────────────────────────────────

/**
 * The schema version of the BailoutReport JSON output.
 * Increment when fields are renamed, removed, or semantically changed.
 * New fields can be added without incrementing (additive changes are safe).
 */
export const SCHEMA_VERSION = 2 as const;

/**
 * The scoring algorithm version.
 * Increment when the readiness score formula changes so that dashboards and
 * CI systems can detect scoring-formula changes independently of schema changes.
 */
export const SCORE_VERSION = 2 as const;

// ─── Bailout categories ───────────────────────────────────────────────────────

/**
 * Stable, pure-react-check–owned category names.
 *
 * These are NOT React Compiler internal identifiers. They are this tool's
 * own stable taxonomy, derived from React documentation and the Rules of React.
 * They may loosely correspond to compiler internals, but are intentionally
 * decoupled so that compiler-internal changes don't break this API.
 */
export type BailoutCategory =
  /** Direct mutation of a variable, prop, or state during render */
  | 'mutation-during-render'
  /** Reading or writing ref.current during the render phase */
  | 'ref-access-in-render'
  /** Calling impure functions (Math.random, Date.now) during render */
  | 'impure-call-in-render'
  /** Unconditionally calling setState / dispatch during render */
  | 'state-update-during-render'
  /** Accessing browser globals (window, document, etc.) during render */
  | 'dom-access-during-render'
  /** Calling timers (setTimeout, setInterval) during render */
  | 'timer-in-render'
  /** Hooks called inside conditionals or loops */
  | 'conditional-hook'
  /** Component function is declared async */
  | 'async-component'
  /** Component or hook defined inside another component's render body */
  | 'nested-component-definition'
  /** Unstable reference (object/array literal) used as a prop default or key */
  | 'unstable-value'
  /** Mutation of a module-level variable inside render */
  | 'global-mutation'
  /** Catch-all for patterns not yet classified */
  | 'unknown';

// ─── Confidence model ─────────────────────────────────────────────────────────

/**
 * How likely the analyser believes the React Compiler will bail out.
 *
 * - `definite`  — The pattern is a documented Rules-of-React violation. The
 *                 compiler is expected to refuse to optimise this component.
 * - `likely`    — The pattern is strongly discouraged. Most compiler versions
 *                 will bail out, but edge cases exist.
 * - `possible`  — The pattern may cause issues depending on context that
 *                 static analysis cannot determine.
 *
 * This is about the *compiler's predicted behaviour*, not detection certainty.
 */
export type BailoutLikelihood = 'definite' | 'likely' | 'possible';

/**
 * How confident the static analyser is that it correctly identified the pattern.
 *
 * - `high`    — The AST pattern is unambiguous. False-positive risk is low.
 * - `medium`  — The AST pattern is likely correct but context may change meaning.
 * - `low`     — The detection uses a heuristic that has known false-positive cases.
 *
 * This is about the *analyser's detection accuracy*, NOT the compiler's behaviour.
 */
export type DetectionConfidence = 'high' | 'medium' | 'low';

// ─── Component prediction ─────────────────────────────────────────────────────

/**
 * A structured prediction for a single component or hook.
 *
 * Intended to be read as: "Based on static analysis, the predicted compiler
 * outcome is [outcome] with [confidence] likelihood."
 */
export interface CompilerPrediction {
  /**
   * The predicted compiler outcome for this component.
   *
   * - `ready`     — No known patterns that would prevent optimisation.
   * - `bailout`   — One or more patterns strongly suggest the compiler will skip this.
   * - `at-risk`   — Patterns present that may prevent optimisation depending on context.
   * - `opted-out` — An explicit "use no memo" directive was found.
   */
  outcome: 'ready' | 'bailout' | 'at-risk' | 'opted-out' | 'forced-opt-in';

  /**
   * How likely this prediction is to be correct.
   * Derived from the most severe violation's bailoutLikelihood.
   */
  likelihood: BailoutLikelihood;

  /**
   * A brief human-readable reason for the prediction.
   * Absent when there are no violations.
   */
  reason?: string;
}

// ─── Per-violation annotation ─────────────────────────────────────────────────

/**
 * A single rule violation enriched with compiler-analysis metadata.
 *
 * The `bailoutLikelihood` and `detectionConfidence` fields are intentionally
 * separate — see their type documentation above for the distinction.
 */
export interface AnnotatedViolation {
  /** Rule that produced this violation (e.g. "no-ref-read-in-render") */
  rule: string;
  /** File path relative to the working directory */
  filePath: string;
  /** 1-based source line of the violation */
  line: number;
  /** Human-readable description of the problem */
  message: string;
  /** Suggested action to resolve the violation */
  recommendation: string;

  // ── Bailout analysis ──
  /** The pure-react-check bailout category (stable, tool-owned) */
  bailoutCategory: BailoutCategory;
  /**
   * A stable, tool-authored explanation of why this pattern is problematic
   * for compiler optimisation. Written in terms of React semantics, not
   * compiler internals, so it won't break when the compiler changes.
   */
  reason: string;
  /**
   * Optional supplementary information about the specific compiler diagnostic
   * this corresponds to. Treated as informational only — NOT a stable API.
   * @see compilerNote
   */
  compilerNote?: string;
  /** How likely this violation is to cause a compiler bailout */
  bailoutLikelihood: BailoutLikelihood;
  /** How confident the analyser is that it correctly detected this pattern */
  detectionConfidence: DetectionConfidence;
  /**
   * Which optimisation category is blocked by this violation.
   * Written in pure-react-check terms, not compiler-internal terms.
   */
  blockedOptimization: string;
}

// ─── Compiler directives ──────────────────────────────────────────────────────

export type DirectiveKind = 'use-no-memo' | 'use-memo';

/** A "use no memo" or "use memo" directive found in source */
export interface CompilerDirective {
  kind: DirectiveKind;
  /** File path relative to the working directory */
  filePath: string;
  /** 1-based line of the directive string literal */
  line: number;
  /** Name of the enclosing component / hook, or null for module-level */
  componentName: string | null;
  /** true when the directive is at the top of the file (module scope) */
  isModuleLevel: boolean;
}

// ─── Per-component status ─────────────────────────────────────────────────────

/**
 * The predicted compiler status of a single component or hook.
 *
 * Use these values in the JSON API — they are stable across tool versions.
 *
 * Terminal labels:
 *   ready            → ✓ COMPILER READY
 *   predicted-bailout → ✗ PREDICTED BAILOUT
 *   at-risk          → ⚠ AT RISK
 *   opted-out        → ○ OPTED OUT
 *   forced-opt-in    → ⚡ FORCED OPT-IN
 */
export type ComponentStatus =
  | 'ready'            // No known bailout signals
  | 'predicted-bailout' // Definite or likely bailout patterns detected
  | 'at-risk'          // Possible bailout patterns detected
  | 'opted-out'        // "use no memo" found
  | 'forced-opt-in';   // "use memo" found

/** Whether this entry is a React component or a custom hook */
export type ComponentKind = 'component' | 'hook';

/** Summary for a single component or hook */
export interface ComponentBailoutSummary {
  /** Component or hook name */
  name: string;
  /** Whether this is a component or a hook */
  kind: ComponentKind;
  /** File path relative to the working directory */
  filePath: string;
  /** 1-based line where the function starts */
  line: number;
  /** Predicted compiler status */
  status: ComponentStatus;
  /** All violations attributed to this component */
  violations: AnnotatedViolation[];
  /** Compiler directives that apply to this component */
  directives: CompilerDirective[];
  /**
   * The most important bailout reason (from the highest-severity violation).
   * null when there are no violations.
   */
  primaryBailoutReason: string | null;
  /** Structured compiler outcome prediction */
  prediction: CompilerPrediction;
}

// ─── Readiness scoring ────────────────────────────────────────────────────────

/**
 * Readiness statistics for the scanned codebase.
 *
 * Scoring formula (scoreVersion = 2):
 * ─────────────────────────────────────────────────────────────────
 *  Each component contributes a "readiness weight" between 0 and 1:
 *
 *   ready            → 1.0
 *   forced-opt-in    → 1.0   (explicitly requested optimisation)
 *   at-risk          → 0.5   (uncertain; penalised but not fully)
 *   opted-out        → 0.5   (intentional, but not compiler-ready)
 *   predicted-bailout → 0.0  (hard blocked)
 *
 *  Within a predicted-bailout component, violations further weight the score:
 *   definite (high detection) → 1.0 penalty
 *   definite (medium)         → 0.9
 *   likely   (high)           → 0.5 penalty
 *   likely   (medium/low)     → 0.4 penalty
 *   possible                  → 0.2 penalty
 *
 *  compilerReadinessPercent = (sum of component weights / total components) × 100
 *  Returns 100 when no components are found.
 * ─────────────────────────────────────────────────────────────────
 *
 * This score is a HEURISTIC. It is not a guarantee of compiler behaviour.
 * The score will change across scoreVersion releases.
 */
export interface ReadinessStats {
  /**
   * The heuristic compiler-readiness score (0–100).
   * See scoring formula above.
   */
  compilerReadinessPercent: number;

  /** Total source files scanned */
  totalFiles: number;
  /** Total React components and hooks detected */
  totalComponents: number;

  /** Components with no known bailout signals */
  readyComponents: number;
  /** Components with definite or likely bailout patterns */
  predictedBailoutComponents: number;
  /** Components with possible (uncertain) bailout patterns */
  atRiskComponents: number;
  /** Components with "use no memo" directive */
  optedOutComponents: number;
  /** Components with "use memo" directive */
  forcedOptInComponents: number;

  /** Total number of annotated violations across all components */
  totalViolations: number;

  /** Violations classified as definite bailout risk */
  definiteLikelihood: number;
  /** Violations classified as likely bailout risk */
  likelyLikelihood: number;
  /** Violations classified as possible (uncertain) risk */
  possibleLikelihood: number;
}

// ─── Baseline / regression ────────────────────────────────────────────────────

/**
 * A serialisable baseline snapshot written by `--baseline` and read by `--diff`.
 */
export interface BailoutBaseline {
  /** ISO 8601 timestamp when the baseline was captured */
  capturedAt: string;
  /** The target that was scanned */
  target: string;
  /** schemaVersion at baseline capture time */
  schemaVersion: number;
  /** scoreVersion at baseline capture time */
  scoreVersion: number;
  /** Readiness percent at baseline capture time */
  compilerReadinessPercent: number;
  /** Snapshot of per-component statuses keyed by "filePath:name" */
  components: Record<string, {
    status: ComponentStatus;
    violationCount: number;
  }>;
}

/**
 * The result of comparing a current report against a stored baseline.
 */
export interface RegressionReport {
  /** The baseline that was compared against */
  baseline: BailoutBaseline;
  /** Previous readiness percent */
  previousReadiness: number;
  /** Current readiness percent */
  currentReadiness: number;
  /** Positive = improvement, negative = regression */
  readinessDelta: number;

  /** Components that are new since the baseline */
  newComponents: ComponentBailoutSummary[];
  /** Components present in baseline that are now gone */
  removedComponentKeys: string[];
  /** Components whose status changed for the worse */
  regressions: Array<{
    name: string;
    filePath: string;
    previousStatus: ComponentStatus;
    currentStatus: ComponentStatus;
  }>;
  /** Components whose status improved */
  improvements: Array<{
    name: string;
    filePath: string;
    previousStatus: ComponentStatus;
    currentStatus: ComponentStatus;
  }>;

  /** true when there are new regressions compared to baseline */
  hasRegressions: boolean;
}

// ─── Top-level report ─────────────────────────────────────────────────────────

export interface BailoutReport {
  /** Schema version — increment when fields are removed or renamed */
  schemaVersion: typeof SCHEMA_VERSION;
  /** Scoring algorithm version */
  scoreVersion: typeof SCORE_VERSION;
  /** Semver of pure-react-check that generated this report */
  toolVersion: string;
  /** ISO 8601 timestamp */
  generatedAt: string;
  /** Directory, file, or glob that was scanned */
  target: string;
  /** All files examined */
  files: string[];

  /** Per-component summaries — primary unit of the report */
  components: ComponentBailoutSummary[];

  /** All compiler directives found (flat list) */
  directives: CompilerDirective[];

  /** All annotated violations (flat list for easy tooling) */
  violations: AnnotatedViolation[];

  /** Heuristic readiness statistics */
  stats: ReadinessStats;
}
