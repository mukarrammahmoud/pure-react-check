/**
 * Compiler Bailout Analysis — barrel export
 * Import from 'pure-react-check/bailout'
 */

export { analyseBailouts, saveBaseline, loadBaseline, compareToBaseline } from './analyser.js';
export type { BailoutAnalysisOptions } from './analyser.js';

export {
  SCHEMA_VERSION,
  SCORE_VERSION,
} from './types.js';
export type {
  BailoutReport,
  BailoutCategory,
  BailoutLikelihood,
  DetectionConfidence,
  AnnotatedViolation,
  CompilerDirective,
  ComponentBailoutSummary,
  ComponentStatus,
  ComponentKind,
  CompilerPrediction,
  DirectiveKind,
  ReadinessStats,
  BailoutBaseline,
  RegressionReport,
} from './types.js';

export { getBailoutMapping, RULE_TO_BAILOUT_MAP } from './rule-map.js';
export type { BailoutMapping } from './rule-map.js';
