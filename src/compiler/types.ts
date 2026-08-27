/**
 * Types for the React Compiler Compatibility & Ground Truth Layer.
 *
 * This layer compares static analysis predictions from `pure-react-check`
 * against observed or reference behavior of the React Compiler.
 */

import type { CompilerPrediction, RuleImpact } from '../bailout/types.js';

/**
 * Indicates whether the observation was produced by the real React Compiler
 * plugin or by pure-react-check's reference model.
 */
export type ObservationSource = 'react-compiler' | 'reference-model';

/**
 * The outcome observed from running or modeling the React Compiler.
 */
export type CompilerOutcome =
  | 'optimized'   // Component was successfully memoized / optimized
  | 'bailed-out'  // Component was skipped / bailed out due to a rule violation
  | 'skipped'     // Component was explicitly skipped via directive ("use no memo")
  | 'unknown';    // Compiler outcome could not be determined with certainty

export interface CompilerDiagnostic {
  line?: number;
  message: string;
  severity?: 'error' | 'warning' | 'info';
}

export interface CompilerObservation {
  componentName: string;
  outcome: CompilerOutcome;
  /** Explicit source of observation (never call reference model ground truth) */
  observationSource: ObservationSource;
  reason?: string;
  diagnostics?: CompilerDiagnostic[];
  compilerVersion?: string;
}

export type CompatibilityClassification =
  | 'agreement'
  | 'mismatch'
  | 'not-comparable'
  | 'unknown';

export type MismatchKind =
  | 'analyzer-too-broad'          // Static rule flagged bailout, but compiler optimized
  | 'analyzer-too-narrow'         // Static rule predicted ready, but compiler bailed out
  | 'rule-misclassified'          // Rule impact classification needs adjustment
  | 'compiler-behavior-changed'   // Observed compiler behavior diverged across versions
  | 'reference-model-divergence'  // Fallback reference model behavior diverged
  | 'not-comparable'              // Measured domains differ (e.g. directive skip vs pattern)
  | 'unknown';

export interface CompatibilityResult {
  /** Relative path or name of the fixture */
  fixture: string;
  /** Component or hook name */
  componentName: string;
  /** Primary rule tested (if applicable) */
  rule?: string;
  /** Static prediction from pure-react-check */
  prediction: CompilerPrediction;
  /** Observation from React Compiler (real or reference adapter) */
  compilerObservation: CompilerObservation;
  /** Comparison classification */
  result: CompatibilityClassification;
  /** Explicit mismatch category if result is 'mismatch' or 'not-comparable' */
  mismatchKind?: MismatchKind;
  /** Diagnostic or explanatory notes */
  notes?: string[];
}

export interface RuleMatrixEntry {
  total: number;
  agreement: number;
  mismatch: number;
  notComparable: number;
  unknown: number;
  status: 'MATCH' | 'REVIEW' | 'NOT-COMPARABLE' | 'UNKNOWN';
}

export interface RuleReliability {
  ruleId: string;
  fixtures: number;
  agreements: number;
  mismatches: number;
  notComparable: number;
  agreementPercent: number;
  confidence: 'high' | 'medium' | 'low';
  impact: RuleImpact;
}

export interface CompatibilityReport {
  schemaVersion: number;
  toolVersion: string;
  compilerVersion: string;
  adapterName: string;
  observationSource: ObservationSource;
  timestamp: string;
  summary: {
    totalFixtures: number;
    agreement: number;
    mismatch: number;
    notComparable: number;
    unknown: number;
    agreementPercent: number;
  };
  ruleMatrix: Record<string, RuleMatrixEntry>;
  ruleReliability: Record<string, RuleReliability>;
  results: CompatibilityResult[];
  mismatches: CompatibilityResult[];
}
