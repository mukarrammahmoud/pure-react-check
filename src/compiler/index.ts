/**
 * pure-react-check — Compiler Compatibility Layer
 */

export { runCompilerCompatibility } from './fixture-runner.js';
export type { FixtureRunnerOptions } from './fixture-runner.js';

export { createCompilerAdapter, ReferenceCompilerAdapter, ReactCompilerAdapter } from './adapter.js';
export type { CompilerAdapter } from './adapter.js';

export { comparePredictionAndObservation } from './comparator.js';

export type {
  CompilerOutcome,
  CompilerDiagnostic,
  CompilerObservation,
  CompatibilityComparisonResult,
  CompatibilityResult,
  RuleMatrixEntry,
  CompatibilityReport,
} from './types.js';
