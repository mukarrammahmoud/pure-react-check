/**
 * pure-react-check — Compiler Compatibility Layer
 */

// Legacy compiler compatibility exports (preserved for backwards compatibility)
export { runCompilerCompatibility } from './fixture-runner.js';
export type { FixtureRunnerOptions } from './fixture-runner.js';

export {
  createCompilerAdapter,
  ReferenceCompilerAdapter,
  ReactCompilerAdapter,
  MockCompilerAdapter,
} from './adapter.js';
export type {
  CompilerAdapter,
  CompilerCompileRequest,
  MockCompilerAdapterOptions,
} from './adapter.js';

export {
  comparePredictionAndObservation,
  compareGroundTruth,
  classifyOutcomePair,
} from './comparator.js';

export {
  FileSystemFixtureLoader,
} from './fixture-loader.js';
export type {
  FixtureLoader,
} from './fixture-loader.js';

export {
  predictStaticFixture,
  mapComponentPredictionToOutcome,
  aggregateFixtureOutcome,
} from './prediction.js';

export {
  SingleFixtureRunner,
} from './ground-truth-runner.js';
export type {
  GroundTruthRunner,
} from './ground-truth-runner.js';

export {
  GroundTruthSuiteRunner,
  runGroundTruthSuite,
} from './suite-runner.js';
export type {
  GroundTruthSuiteOptions,
} from './suite-runner.js';

export {
  ReportWriter,
  writeGroundTruthReports,
} from './report-writer.js';
export type {
  ReportWriterOptions,
  WrittenReports,
} from './report-writer.js';

export {
  loadBaseline,
  saveBaseline,
  checkRegression,
  loadGroundTruthBaseline,
  saveGroundTruthBaseline,
  checkGroundTruthRegression,
} from './baseline.js';
export type {
  GroundTruthBaseline,
  BaselineComparison,
} from './baseline.js';

export type {
  CompilerOutcome,
  CompilerDiagnostic,
  ComponentObservation,
  CompilerObservation,
  ExecutionStatus,
  CompatibilityClassification,
  MismatchKind,
  CompatibilityResult,
  RuleMatrixEntry,
  RuleReliability,
  CompatibilityReport,
  ObservationSource,
  FixtureCategory,
  CompilerFixture,
  ComponentPrediction,
  StaticPrediction,
  GroundTruthClassification,
  ComponentCompatibilityComparison,
  CompatibilityComparison,
  FixtureRunResult,
  GroundTruthSummary,
  GroundTruthSuiteResult,
} from './types.js';

