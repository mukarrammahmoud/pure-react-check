/**
 * Report Writer for Ground Truth Suite.
 *
 * Produces structured, machine-readable JSON reports:
 * - latest.json (full report)
 * - summary.json (aggregate summary and metadata)
 * - mismatches.json (only non-agreement fixtures)
 */

import fs from 'node:fs';
import path from 'node:path';
import type { GroundTruthSuiteResult } from './types.js';

export interface ReportWriterOptions {
  outputDir?: string;
  reportPath?: string;
}

export interface WrittenReports {
  latestPath: string;
  summaryPath: string;
  mismatchesPath: string;
}

export class ReportWriter {
  private readonly defaultOutputDir = 'reports/ground-truth';

  /**
   * Writes latest.json, summary.json, and mismatches.json to target output directory.
   */
  writeReports(
    suiteResult: GroundTruthSuiteResult,
    options: ReportWriterOptions = {},
  ): WrittenReports {
    const targetDir = options.reportPath
      ? path.dirname(path.resolve(process.cwd(), options.reportPath))
      : path.resolve(process.cwd(), options.outputDir ?? this.defaultOutputDir);

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const latestPath = options.reportPath
      ? path.resolve(process.cwd(), options.reportPath)
      : path.join(targetDir, 'latest.json');

    const summaryPath = path.join(targetDir, 'summary.json');
    const mismatchesPath = path.join(targetDir, 'mismatches.json');

    // 1. Full report (latest.json)
    fs.writeFileSync(latestPath, JSON.stringify(suiteResult, null, 2), 'utf-8');

    // 2. Summary report (summary.json)
    const summaryData = {
      schemaVersion: suiteResult.schemaVersion,
      analyzerVersion: suiteResult.analyzerVersion,
      compilerName: suiteResult.compilerName,
      compilerVersion: suiteResult.compilerVersion,
      timestamp: suiteResult.timestamp,
      summary: suiteResult.summary,
    };
    fs.writeFileSync(summaryPath, JSON.stringify(summaryData, null, 2), 'utf-8');

    // 3. Mismatches report (mismatches.json)
    const mismatches = suiteResult.fixtures.filter(
      (f) => f.compatibility.classification !== 'agreement',
    );
    const mismatchesData = {
      schemaVersion: suiteResult.schemaVersion,
      analyzerVersion: suiteResult.analyzerVersion,
      compilerName: suiteResult.compilerName,
      compilerVersion: suiteResult.compilerVersion,
      timestamp: suiteResult.timestamp,
      totalMismatches: mismatches.length,
      fixtures: mismatches,
    };
    fs.writeFileSync(mismatchesPath, JSON.stringify(mismatchesData, null, 2), 'utf-8');

    return {
      latestPath,
      summaryPath,
      mismatchesPath,
    };
  }
}

/**
 * Helper function to write all ground truth reports.
 */
export function writeGroundTruthReports(
  suiteResult: GroundTruthSuiteResult,
  options?: ReportWriterOptions,
): WrittenReports {
  const writer = new ReportWriter();
  return writer.writeReports(suiteResult, options);
}
