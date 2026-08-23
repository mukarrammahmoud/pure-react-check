/**
 * pure-react-check Programmatic API
 *
 * Use this when you want to call the scanner from Node.js code
 * instead of the CLI.
 *
 * @example
 * import { scan, getScore } from 'pure-react-check/api';
 *
 * const result = await scan('./src');
 * const score  = getScore(result);
 * console.log(`Score: ${score.toFixed(1)}%`);
 */

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
 * Computes the Compiler Readiness Score from a ScanResult.
 *
 * Score = ((scanned files − files with violations) / scanned files) × 100
 * Returns 100 when no files were scanned.
 */
export function getScore(result: import('./scanner.js').ScanResult): number {
  const { files, violations } = result;
  const filesWithViolations = new Set(violations.map((v) => v.filePath)).size;
  return files.length === 0 ? 100 : ((files.length - filesWithViolations) / files.length) * 100;
}
