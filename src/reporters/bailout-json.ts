/**
 * JSON reporter for the compiler-preflight analysis.
 *
 * Output file: pure-react-bailout-report.json
 *
 * The JSON schema is versioned (schemaVersion field in BailoutReport).
 * Do not rename or remove existing fields without incrementing SCHEMA_VERSION.
 */

import fs from 'node:fs';
import path from 'node:path';
import type { BailoutReport } from '../bailout/types.js';

const OUTPUT_FILE = 'pure-react-bailout-report.json';

/**
 * Serialise the BailoutReport to JSON and write to disk.
 * Returns the absolute path of the written file.
 */
export function generateBailoutJsonReport(
  report: BailoutReport,
  outputPath = OUTPUT_FILE,
): string {
  const absolutePath = path.resolve(process.cwd(), outputPath);
  fs.writeFileSync(absolutePath, JSON.stringify(report, null, 2), 'utf-8');
  return absolutePath;
}
