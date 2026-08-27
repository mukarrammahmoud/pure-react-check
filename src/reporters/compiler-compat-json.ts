/**
 * JSON reporter for pure-react-check compiler-compat.
 */

import fs from 'node:fs';
import path from 'node:path';
import type { CompatibilityReport } from '../compiler/types.js';

export function generateCompilerCompatJsonReport(
  report: CompatibilityReport,
  outputPath = 'pure-react-compiler-compat-report.json',
): string {
  const absolutePath = path.resolve(process.cwd(), outputPath);
  const jsonContent = JSON.stringify(report, null, 2);
  fs.writeFileSync(absolutePath, jsonContent, 'utf-8');
  return absolutePath;
}
