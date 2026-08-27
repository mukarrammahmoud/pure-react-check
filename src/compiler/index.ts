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
  CompatibilityClassification,
  MismatchKind,
  CompatibilityResult,
  RuleMatrixEntry,
  RuleReliability,
  CompatibilityReport,
  ObservationSource,
} from './types.js';
