/**
 * pure-react-check — Programmatic Node.js API
 *
 * Public surface area for integration with build tools, CI/CD scripts,
 * custom reporting pipelines, and compiler compatibility suites.
 */

// ── Scanner & Config ──
export { scanDirectory } from './scanner.js';
export type { ScanOptions, RuleSeverity, ScanResult } from './scanner.js';

export { loadConfig } from './config.js';
export type { PureReactCheckConfig } from './config.js';

// ── Bailout Engine ──
export {
  analyseBailouts,
  saveBaseline,
  loadBaseline,
  compareToBaseline,
} from './bailout/analyser.js';

export type { BailoutAnalysisOptions } from './bailout/analyser.js';

export {
  printBailoutReport,
} from './reporters/bailout-terminal.js';

export {
  generateBailoutJsonReport,
} from './reporters/bailout-json.js';

export {
  RULE_TO_BAILOUT_MAP,
  getBailoutMapping,
} from './bailout/rule-map.js';

export type { BailoutMapping } from './bailout/rule-map.js';

export type {
  BailoutCategory,
  RuleImpact,
  BailoutLikelihood,
  DetectionConfidence,
  CompilerPrediction,
  AnnotatedViolation,
  CompilerDirective,
  ComponentStatus,
  ComponentKind,
  ComponentBailoutSummary,
  ReadinessStats,
  BailoutBaseline,
  RegressionReport,
  BailoutReport,
} from './bailout/types.js';

export { SCHEMA_VERSION, SCORE_VERSION } from './bailout/types.js';

// ── Compiler Compatibility Layer ──
export {
  runCompilerCompatibility,
  createCompilerAdapter,
  ReferenceCompilerAdapter,
  ReactCompilerAdapter,
  comparePredictionAndObservation,
} from './compiler/index.js';

export type {
  CompilerAdapter,
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
  FixtureRunnerOptions,
} from './compiler/index.js';
