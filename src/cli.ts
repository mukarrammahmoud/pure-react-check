import pc from 'picocolors';
import { scanDirectory } from './scanner.js';
import type { Violation } from './rules/types.js';

function groupViolations(violations: Violation[]): Map<string, Violation[]> {
  const grouped = new Map<string, Violation[]>();
  for (const violation of violations) {
    const entries = grouped.get(violation.filePath) ?? [];
    entries.push(violation);
    grouped.set(violation.filePath, entries);
  }
  return grouped;
}

function formatScore(score: number): string {
  const value = `${score.toFixed(1)}% Pure`;
  if (score === 100) return pc.bold(pc.green(value));
  if (score >= 80) return pc.bold(pc.yellow(value));
  return pc.bold(pc.red(value));
}

export async function runCli(args: string[] = process.argv.slice(2)): Promise<number> {
  const target = args[0] ?? './';

  console.log(pc.bold(pc.cyan('\npure-react-check')));
  console.log(pc.dim('React component purity and compiler readiness\n'));

  const result = await scanDirectory(target);
  const groupedViolations = groupViolations(result.violations);

  for (const [filePath, violations] of groupedViolations) {
    console.log(pc.bold(pc.white(filePath)));
    for (const violation of violations) {
      const ruleBadge = pc.bgRed(pc.white(` ${violation.rule} `));
      const lineBadge = pc.yellow(`line ${violation.line}`);
      console.log(`  ${ruleBadge} ${lineBadge}`);
      console.log(`    ${violation.message}`);
      console.log(pc.dim(`    Fix: ${violation.recommendation}`));
    }
    console.log();
  }

  for (const error of result.errors) {
    console.error(`${pc.bgRed(pc.white(' PARSE ERROR '))} ${pc.bold(error.filePath)}`);
    console.error(`  ${error.message}\n`);
  }

  const filesWithViolations = new Set(result.violations.map((violation) => violation.filePath)).size;
  const readinessScore = result.files.length === 0
    ? 100
    : ((result.files.length - filesWithViolations) / result.files.length) * 100;

  console.log(pc.bold(pc.cyan('Summary')));
  console.log(pc.dim('----------------------------------------'));
  console.log(`Compiler Readiness Score: ${formatScore(readinessScore)}`);
  console.log(`Scanned Files: ${pc.bold(String(result.files.length))}`);
  console.log(`Total Violations: ${pc.bold(String(result.violations.length))}`);
  if (result.errors.length > 0) {
    console.log(`Total Errors: ${pc.bold(pc.red(String(result.errors.length)))}`);
  }
  console.log();

  return result.violations.length > 0 || result.errors.length > 0 ? 1 : 0;
}
