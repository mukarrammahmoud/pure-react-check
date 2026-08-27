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

// ─── Rule Impact Classification ───────────────────────────────────────────────

/**
 * Stable classification of a rule's impact on React Compiler optimization.
 *
 * - `compiler-bailout` — Definite or documented compiler bailout pattern.
 * - `compiler-risk`    — Risk to optimization stability, referential equality, or scope caching.
 * - `react-pattern`    — React architectural / anti-pattern concern that may not guarantee compiler bailout.
 * - `best-practice`   — General code hygiene or style practice.
 */
export type RuleImpact =
  | 'compiler-bailout'
  | 'compiler-risk'
  | 'react-pattern'
  | 'best-practice';

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
 * outcome is [outcome] with [confidence] likelihood and [impact] classification."
 */
export interface CompilerPrediction {
  /**
   * The predicted compiler outcome for this component.
   *
   * - `ready`            — No known patterns that would prevent optimisation.
   * - `bailout`          — One or more patterns strongly suggest the compiler will skip this.
   * - `at-risk`          — Patterns present that may prevent optimisation depending on context.
   * - `opted-out`        — An explicit "use no memo" directive was found.
   * - `forced-opt-in`    — An explicit "use memo" directive was found.
   */
  outcome: 'ready' | 'bailout' | 'at-risk' | 'opted-out' | 'forced-opt-in';

  /**
   * How likely this prediction is to be correct.
   * Derived from the primary violation's bailoutLikelihood.
   */
  likelihood: BailoutLikelihood;

  /**
   * Impact classification of the primary rule violation.
   */
  impact: RuleImpact;

  /**
   * A brief human-readable reason for the prediction.
   * Absent when there are no violations.
   */
  reason?: string;
}

// ─── Per-violation annotation ─────────────────────────────────────────────────

/**
 * A single rule violation enriched with compiler-analysis metadata.
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
  /** Rule impact classification */
  impact: RuleImpact;
  /** Tool-authored explanation of why this pattern is problematic */
  reason: string;
  /** Optional supplementary information about compiler behavior */
  compilerNote?: string;
  /** How likely this violation is to cause a compiler bailout */
  bailoutLikelihood: BailoutLikelihood;
  /** How confident the analyser is that it correctly detected this pattern */
  detectionConfidence: DetectionConfidence;
  /** Which optimisation category is blocked by this violation */
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

export type ComponentStatus =
  | 'ready'            // No known bailout signals
  | 'predicted-bailout' // Definite or likely compiler-bailout rules triggered
  | 'at-risk'          // Compiler-risk or react-pattern rules triggered
  | 'opted-out'        // "use no memo" found
  | 'forced-opt-in';   // "use memo" found

export type ComponentKind = 'component' | 'hook';

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
  /** Primary bailout reason from top violation */
  primaryBailoutReason: string | null;
  /** Structured compiler outcome prediction */
  prediction: CompilerPrediction;
}

// ─── Readiness scoring ────────────────────────────────────────────────────────

export interface ReadinessStats {
  compilerReadinessPercent: number;
  totalFiles: number;
  totalComponents: number;
  readyComponents: number;
  predictedBailoutComponents: number;
  atRiskComponents: number;
  optedOutComponents: number;
  forcedOptInComponents: number;
  totalViolations: number;
  definiteLikelihood: number;
  likelyLikelihood: number;
  possibleLikelihood: number;
}

// ─── Baseline / regression ────────────────────────────────────────────────────

export interface BailoutBaseline {
  capturedAt: string;
  target: string;
  schemaVersion: number;
  scoreVersion: number;
  compilerReadinessPercent: number;
  components: Record<string, {
    status: ComponentStatus;
    violationCount: number;
  }>;
}

export interface RegressionReport {
  baseline: BailoutBaseline;
  previousReadiness: number;
  currentReadiness: number;
  readinessDelta: number;
  newComponents: ComponentBailoutSummary[];
  removedComponentKeys: string[];
  regressions: Array<{
    name: string;
    filePath: string;
    previousStatus: ComponentStatus;
    currentStatus: ComponentStatus;
  }>;
  improvements: Array<{
    name: string;
    filePath: string;
    previousStatus: ComponentStatus;
    currentStatus: ComponentStatus;
  }>;
  hasRegressions: boolean;
}

// ─── Top-level report ─────────────────────────────────────────────────────────

export interface BailoutReport {
  schemaVersion: typeof SCHEMA_VERSION;
  scoreVersion: typeof SCORE_VERSION;
  toolVersion: string;
  generatedAt: string;
  target: string;
  files: string[];
  components: ComponentBailoutSummary[];
  directives: CompilerDirective[];
  violations: AnnotatedViolation[];
  stats: ReadinessStats;
}
