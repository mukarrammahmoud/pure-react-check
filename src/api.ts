/**
 * pure-react-check Programmatic API
 *
 * @example
 * // Legacy scanner (file-level violations)
 * import { scan, getScore } from 'pure-react-check/api';
 * const result = await scan('./src');
 * const score  = getScore(result);
 *
 * // Compiler preflight analysis (component-level predictions)
 * import { analyseBailouts } from 'pure-react-check/api';
 * const report = await analyseBailouts({ target: './src' });
 * console.log(`Readiness: ${report.stats.compilerReadinessPercent.toFixed(1)}%`);
 *
 * IMPORTANT: pure-react-check is a static analysis preflight tool.
 * It does NOT run the React Compiler. Results are predictions only.
 */

// ─── Legacy scanner API ───────────────────────────────────────────────────────

export { scanDirectory as scan } from './scanner.js';
export type { ScanResult, ScanError } from './scanner.js';
export type { Violation, AnalysisRule, RuleContext } from './rules/types.js';
export { allRules } from './rules/index.js';
export { loadConfig } from './config.js';
export type { PureReactCheckConfig } from './config.js';
export { generateHtmlReport } from './reporters/html.js';
export { generateJsonReport } from './reporters/json.js';
export { generateSarifReport } from './reporters/sarif.js';
export type { JsonReport } from './reporters/json.js';

/**
 * Computes the legacy file-based readiness score.
 * Score = (clean files / total files) × 100
 * Returns 100 when no files were scanned.
 *
 * For component-level scoring use BailoutReport.stats.compilerReadinessPercent.
 */
export function getScore(result: import('./scanner.js').ScanResult): number {
  const { files, violations } = result;
  const filesWithViolations = new Set(violations.map((v) => v.filePath)).size;
  return files.length === 0 ? 100 : ((files.length - filesWithViolations) / files.length) * 100;
}

// ─── Compiler Preflight API ───────────────────────────────────────────────────
//
// This layer provides component-level compiler-readiness predictions.
// It does NOT replace the React Compiler.

export {
  analyseBailouts,
  saveBaseline,
  loadBaseline,
  compareToBaseline,
} from './bailout/analyser.js';
export type { BailoutAnalysisOptions } from './bailout/analyser.js';

export {
  SCHEMA_VERSION,
  SCORE_VERSION,
} from './bailout/types.js';
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
} from './bailout/types.js';

export { getBailoutMapping, RULE_TO_BAILOUT_MAP } from './bailout/rule-map.js';
export type { BailoutMapping } from './bailout/rule-map.js';

export { generateBailoutJsonReport } from './reporters/bailout-json.js';
export { printBailoutReport, printRegressionReport } from './reporters/bailout-terminal.js';
export type { PrintBailoutOptions } from './reporters/bailout-terminal.js';
