/**
 * Types for the React Compiler Compatibility Layer.
 *
 * This layer compares static analysis predictions from `pure-react-check`
 * against observed or reference behavior of the React Compiler.
 */

import type { CompilerPrediction } from '../bailout/types.js';

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
  reason?: string;
  diagnostics?: CompilerDiagnostic[];
  compilerVersion?: string;
}

export type CompatibilityComparisonResult = 'agreement' | 'mismatch' | 'unknown';

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
  /** Comparison status */
  result: CompatibilityComparisonResult;
  /** Diagnostic or explanatory notes */
  notes?: string[];
}

export interface RuleMatrixEntry {
  total: number;
  agreement: number;
  mismatch: number;
  unknown: number;
  status: 'MATCH' | 'REVIEW' | 'UNKNOWN';
}

export interface CompatibilityReport {
  schemaVersion: number;
  toolVersion: string;
  compilerVersion: string;
  adapterName: string;
  timestamp: string;
  summary: {
    totalFixtures: number;
    agreement: number;
    mismatch: number;
    unknown: number;
    agreementPercent: number;
  };
  ruleMatrix: Record<string, RuleMatrixEntry>;
  results: CompatibilityResult[];
  mismatches: CompatibilityResult[];
}
