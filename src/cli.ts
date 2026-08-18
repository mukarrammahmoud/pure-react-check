import pc from 'picocolors';
import { execFile } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { scanDirectory } from './scanner.js';
import { generateHtmlReport } from './reporters/html.js';
import type { Violation } from './rules/types.js';

interface CliOptions {
  target: string;
  threshold?: number;
  format: 'terminal' | 'html';
}

async function promptForOptions(): Promise<CliOptions> {
  const readline = createInterface({ input, output });
  try {
    const targetAnswer = (await readline.question('Scan target [./]: ')).trim();
    const formatAnswer = (await readline.question('Output format (terminal/html) [terminal]: ')).trim().toLowerCase();
    const thresholdAnswer = (await readline.question('Minimum readiness threshold (optional): ')).trim();

    const format = formatAnswer === '' ? 'terminal' : formatAnswer;
    if (format !== 'terminal' && format !== 'html') {
      throw new Error('Format must be terminal or html.');
    }

    let threshold: number | undefined;
    if (thresholdAnswer !== '') {
      const parsed = Number(thresholdAnswer);
      if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
        throw new Error('Threshold must be a number between 0 and 100.');
      }
      threshold = parsed;
    }

    return { target: targetAnswer || './', format, threshold };
  } finally {
    readline.close();
  }
}

function openReportInBrowser(reportPath: string): void {
  const url = pathToFileURL(reportPath).href;
  console.log(`Open report: ${pc.cyan(url)}`);

  const command = process.platform === 'win32'
    ? { file: 'cmd', args: ['/c', 'start', '', url] }
    : process.platform === 'darwin'
      ? { file: 'open', args: [url] }
      : { file: 'xdg-open', args: [url] };

  execFile(command.file, command.args, (error) => {
    if (error) console.log(pc.dim('Could not open the browser automatically. Use the URL above.'));
  });
}

function parseOptions(args: string[]): CliOptions {
  let target = './';
  let threshold: number | undefined;
  let format: 'terminal' | 'html' = 'terminal';

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--threshold' || argument.startsWith('--threshold=')) {
      const value = argument.includes('=') ? argument.slice(argument.indexOf('=') + 1) : args[++index];
      const parsed = Number(value);
      if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) throw new Error('--threshold must be a number between 0 and 100.');
      threshold = parsed;
    } else if (argument === '--format' || argument.startsWith('--format=')) {
      const value = argument.includes('=') ? argument.slice(argument.indexOf('=') + 1) : args[++index];
      if (value !== 'html' && value !== 'terminal') throw new Error('--format must be html or terminal.');
      format = value;
    } else if (!argument.startsWith('--')) {
      target = argument;
    }
  }
  return { target, threshold, format };
}

function groupViolations(violations: Violation[]): Map<string, Violation[]> {
  const grouped = new Map<string, Violation[]>();
  for (const violation of violations) grouped.set(violation.filePath, [...(grouped.get(violation.filePath) ?? []), violation]);
  return grouped;
}

function getScore(files: string[], violations: Violation[]): number {
  const filesWithViolations = new Set(violations.map((violation) => violation.filePath)).size;
  return files.length === 0 ? 100 : ((files.length - filesWithViolations) / files.length) * 100;
}

function printTerminal(result: Awaited<ReturnType<typeof scanDirectory>>, score: number): void {
  console.log(pc.bold(pc.cyan('\npure-react-check')));
  console.log(pc.dim('React component purity and compiler readiness\n'));
  for (const [filePath, violations] of groupViolations(result.violations)) {
    console.log(pc.bold(pc.white(filePath)));
    for (const violation of violations) {
      console.log(`  ${pc.bgRed(pc.white(` ${violation.rule} `))} ${pc.yellow(`line ${violation.line}`)}`);
      console.log(`    ${violation.message}`);
      console.log(pc.dim(`    Fix: ${violation.recommendation}`));
    }
    console.log();
  }
  for (const error of result.errors) console.error(`${pc.bgRed(pc.white(' PARSE ERROR '))} ${error.filePath}: ${error.message}`);
  console.log(pc.bold(pc.cyan('Summary')));
  console.log(`Compiler Readiness Score: ${pc.bold(score >= 80 ? pc.green(`${score.toFixed(1)}% Pure`) : pc.red(`${score.toFixed(1)}% Pure`))}`);
  console.log(`Scanned Files: ${result.files.length}`);
  console.log(`Total Violations: ${result.violations.length}`);
  console.log(`Total Errors: ${result.errors.length}\n`);
}

export async function runCli(args: string[] = process.argv.slice(2)): Promise<number> {
  const options = args.length === 0 && input.isTTY && output.isTTY
    ? await promptForOptions()
    : parseOptions(args);
  const result = await scanDirectory(options.target);
  const score = getScore(result.files, result.violations);

  if (options.format === 'html') {
    const reportPath = generateHtmlReport(result, score);
    console.log(`HTML report written to ${pc.green(reportPath)}`);
    openReportInBrowser(reportPath);
  } else {
    printTerminal(result, score);
  }

  if (options.threshold !== undefined && score < options.threshold) {
    console.error(pc.red(`FAILED: Score (${score.toFixed(1)}%) is below threshold (${options.threshold}%).`));
    return 1;
  }
  return options.threshold === undefined && (result.violations.length > 0 || result.errors.length > 0) ? 1 : 0;
}
