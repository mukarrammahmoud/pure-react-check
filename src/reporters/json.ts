import fs from 'node:fs';
import path from 'node:path';
import type { ScanResult } from '../scanner.js';

export interface JsonReport {
  version: string;
  scannedAt: string;
  score: number;
  summary: {
    scannedFiles: number;
    cleanFiles: number;
    totalViolations: number;
    totalErrors: number;
  };
  violations: Array<{
    rule: string;
    filePath: string;
    line: number;
    message: string;
    recommendation: string;
  }>;
  errors: Array<{
    filePath: string;
    message: string;
  }>;
}

export function generateJsonReport(
  result: ScanResult,
  score: number,
  outputPath = 'pure-react-check-report.json',
): string {
  const absolutePath = path.resolve(outputPath);
  const cleanFiles = Math.max(
    result.files.length -
      new Set(result.violations.map((v) => v.filePath)).size,
    0,
  );

  const report: JsonReport = {
    version: '1.0.0',
    scannedAt: new Date().toISOString(),
    score: Math.round(score * 10) / 10,
    summary: {
      scannedFiles: result.files.length,
      cleanFiles,
      totalViolations: result.violations.length,
      totalErrors: result.errors.length,
    },
    violations: result.violations.map((v) => ({
      rule: v.rule,
      filePath: v.filePath,
      line: v.line,
      message: v.message,
      recommendation: v.recommendation,
    })),
    errors: result.errors.map((e) => ({
      filePath: e.filePath,
      message: e.message,
    })),
  };

  fs.writeFileSync(absolutePath, JSON.stringify(report, null, 2), 'utf8');
  return absolutePath;
}
