/**
 * Fixture Runner for Compiler Compatibility Suite.
 */

import fs from 'node:fs';
import path from 'node:path';
import fastGlob from 'fast-glob';
import { analyseBailouts } from '../bailout/analyser.js';
import { getBailoutMapping } from '../bailout/rule-map.js';
import { createCompilerAdapter, type CompilerAdapter } from './adapter.js';
import { comparePredictionAndObservation } from './comparator.js';
import type {
  CompatibilityReport,
  CompatibilityResult,
  RuleMatrixEntry,
  RuleReliability,
  ObservationSource,
} from './types.js';

export interface FixtureRunnerOptions {
  /** Target directory containing compiler compatibility fixtures */
  fixturesDir?: string;
  /** Filter by rule name */
  ruleFilter?: string;
  /** Filter by fixture name or subpath */
  fixtureFilter?: string;
  /** Custom compiler adapter instance */
  adapter?: CompilerAdapter;
}

const TOOL_VERSION = '1.2.0';
const SCHEMA_VERSION = 1;

export async function runCompilerCompatibility(
  options: FixtureRunnerOptions = {},
): Promise<CompatibilityReport> {
  const rootDir = process.cwd();
  const defaultDir = path.resolve(rootDir, 'tests/compiler-compat');
  const fixturesDir = options.fixturesDir
    ? path.resolve(rootDir, options.fixturesDir)
    : defaultDir;

  const adapter = options.adapter ?? (await createCompilerAdapter());
  const observationSource: ObservationSource = adapter.isRealCompiler
    ? 'react-compiler'
    : 'reference-model';

  // Locate all .tsx fixture files
  const fixtureFiles = await fastGlob('**/*.tsx', {
    cwd: fixturesDir,
    absolute: true,
    onlyFiles: true,
  });

  const results: CompatibilityResult[] = [];
  const ruleMatrix: Record<string, RuleMatrixEntry> = {};

  for (const absoluteFile of fixtureFiles) {
    const relativePath = path
      .relative(fixturesDir, absoluteFile)
      .replaceAll('\\', '/');

    if (options.fixtureFilter && !relativePath.includes(options.fixtureFilter)) {
      continue;
    }

    const source = fs.readFileSync(absoluteFile, 'utf-8');

    // 1. Run pure-react-check static analysis
    const report = await analyseBailouts({ target: absoluteFile });

    // 2. Run compiler observation (adapter)
    const observations = await adapter.analyse(source, relativePath);

    // 3. Match predictions & observations component by component
    for (const comp of report.components) {
      const primaryViolation = comp.violations[0];
      const rule = primaryViolation?.rule;

      if (options.ruleFilter && rule !== options.ruleFilter) {
        continue;
      }

      const obs = observations.find((o) => o.componentName === comp.name) ?? {
        componentName: comp.name,
        outcome: 'unknown',
        observationSource,
        reason: 'No observation found for component.',
        compilerVersion: adapter.version,
      };

      const compRes = comparePredictionAndObservation(
        relativePath,
        comp.name,
        comp.prediction,
        obs,
        rule,
      );

      results.push(compRes);

      // Update Rule Matrix
      const ruleKey = rule ?? 'no-violation-detected';
      if (!ruleMatrix[ruleKey]) {
        ruleMatrix[ruleKey] = {
          total: 0,
          agreement: 0,
          mismatch: 0,
          notComparable: 0,
          unknown: 0,
          status: 'UNKNOWN',
        };
      }
      const entry = ruleMatrix[ruleKey];
      entry.total += 1;

      if (compRes.result === 'agreement') entry.agreement += 1;
      else if (compRes.result === 'mismatch') entry.mismatch += 1;
      else if (compRes.result === 'not-comparable') entry.notComparable += 1;
      else entry.unknown += 1;

      entry.status =
        entry.mismatch > 0 ? 'REVIEW' :
        entry.notComparable > 0 ? 'NOT-COMPARABLE' :
        entry.agreement > 0 ? 'MATCH' : 'UNKNOWN';
    }
  }

  const agreement = results.filter((r) => r.result === 'agreement').length;
  const mismatch = results.filter((r) => r.result === 'mismatch').length;
  const notComparable = results.filter((r) => r.result === 'not-comparable').length;
  const unknown = results.filter((r) => r.result === 'unknown').length;
  const total = results.length;
  const validTotal = total - notComparable;
  const agreementPercent = validTotal <= 0 ? 100 : (agreement / validTotal) * 100;

  const mismatches = results.filter((r) => r.result === 'mismatch');

  // Compute Rule Reliability
  const ruleReliability: Record<string, RuleReliability> = {};
  for (const [ruleId, entry] of Object.entries(ruleMatrix)) {
    const mapping = getBailoutMapping(ruleId);
    const validCount = entry.total - entry.notComparable;
    const ruleAgreementPct = validCount <= 0 ? 100 : (entry.agreement / validCount) * 100;

    let confidence: 'high' | 'medium' | 'low' = 'high';
    if (entry.total < 3 || ruleAgreementPct < 80) {
      confidence = ruleAgreementPct >= 80 ? 'medium' : 'low';
    }

    ruleReliability[ruleId] = {
      ruleId,
      fixtures: entry.total,
      agreements: entry.agreement,
      mismatches: entry.mismatch,
      notComparable: entry.notComparable,
      agreementPercent: ruleAgreementPct,
      confidence,
      impact: mapping.impact,
    };
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    toolVersion: TOOL_VERSION,
    compilerVersion: adapter.version,
    adapterName: adapter.name,
    observationSource,
    timestamp: new Date().toISOString(),
    summary: {
      totalFixtures: total,
      agreement,
      mismatch,
      notComparable,
      unknown,
      agreementPercent,
    },
    ruleMatrix,
    ruleReliability,
    results,
    mismatches,
  };
}
