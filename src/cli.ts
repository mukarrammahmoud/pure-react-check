import pc from 'picocolors';
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { scanDirectory } from './scanner.js';
import type { ScanOptions } from './scanner.js';
import { generateHtmlReport } from './reporters/html.js';
import { generateJsonReport } from './reporters/json.js';
import { generateSarifReport } from './reporters/sarif.js';
import { loadConfig } from './config.js';
import type { Violation } from './rules/types.js';

// Bailout analysis layer
import {
  analyseBailouts,
  saveBaseline,
  loadBaseline,
  compareToBaseline,
} from './bailout/analyser.js';
import {
  printBailoutReport,
  printRegressionReport,
} from './reporters/bailout-terminal.js';
import { generateBailoutJsonReport } from './reporters/bailout-json.js';

// Compiler compatibility layer
import { runCompilerCompatibility } from './compiler/fixture-runner.js';
import { printCompilerCompatReport } from './reporters/compiler-compat-terminal.js';
import { generateCompilerCompatJsonReport } from './reporters/compiler-compat-json.js';

// ─── Version ──────────────────────────────────────────────────────────────────

function getVersion(): string {
  try {
    const pkgPath = path.resolve(
      path.dirname(new URL(import.meta.url).pathname),
      '../package.json',
    );
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

// ─── Help text ────────────────────────────────────────────────────────────────

function printHelp(): void {
  const version = getVersion();
  console.log(`
${pc.bold('pure-react-check')} ${pc.dim(`v${version}`)}
${pc.dim('React Compiler Preflight Analyzer')}

${pc.bold('USAGE')}
  npx pure-react-check [command] [target] [options]

${pc.bold('COMMANDS')}
  ${pc.cyan('compiler-report')} [target]   Run compiler preflight analysis ${pc.dim('(recommended)')}
  ${pc.cyan('compiler-compat')} [dir]      Run compiler compatibility suite
  ${pc.cyan('scan')} [target]              Legacy file-level scan

  If no command is given, runs the legacy scan interactively.

${pc.bold('COMPILER-REPORT OPTIONS')}
  --explain                    Show detailed per-violation explanations
  --format=terminal|json       Output format (default: terminal)
  --ci                         Enable CI mode (exit 1 on failures)
  --max-bailouts=<n>           CI: max predicted-bailout components
  --min-readiness=<n>          CI: minimum readiness percentage
  --fail-on=any|new            CI: fail on any bailout or only new ones
  --baseline                   Capture a readiness baseline snapshot
  --diff                       Compare against saved baseline

${pc.bold('COMPILER-COMPAT OPTIONS')}
  --format=terminal|json       Output format (default: terminal)
  --rule=<ruleName>            Filter to a single rule
  --fixture=<substring>        Filter to specific fixture path
  --ci                         Enable CI mode
  --min-agreement=<n>          Minimum agreement percentage (default: 80)

${pc.bold('LEGACY SCAN OPTIONS')}
  --format=terminal|html|json|sarif  Output format (default: terminal)
  --threshold=<n>              Minimum readiness threshold percentage

${pc.bold('GLOBAL OPTIONS')}
  --help, -h                   Show this help message
  --version, -v                Show version number

${pc.bold('CONFIG FILE')}
  Create ${pc.cyan('.purereactrc.json')} or ${pc.cyan('purereact.config.json')} in your project root:
  ${pc.dim('{')}
  ${pc.dim('  "target": "./src",')}
  ${pc.dim('  "format": "terminal",')}
  ${pc.dim('  "ignore": ["**/test/**", "**/stories/**"],')}
  ${pc.dim('  "rules": { "no-nested-components": "warn", "no-unstable-default-props": "off" }')}
  ${pc.dim('}')}

${pc.bold('EXAMPLES')}
  ${pc.dim('$')} npx pure-react-check compiler-report ./src
  ${pc.dim('$')} npx pure-react-check compiler-report ./src --explain
  ${pc.dim('$')} npx pure-react-check compiler-report ./src --ci --max-bailouts=0
  ${pc.dim('$')} npx pure-react-check compiler-report ./src --baseline
  ${pc.dim('$')} npx pure-react-check compiler-report ./src --diff --ci
  ${pc.dim('$')} npx pure-react-check compiler-compat --ci --min-agreement=85
  ${pc.dim('$')} npx pure-react-check scan ./src --format=sarif
`);
}

// ─── Legacy scan CLI ─────────────────────────────────────────────────────────

type OutputFormat = 'terminal' | 'html' | 'json' | 'sarif';

interface CliOptions {
  target: string;
  threshold?: number;
  format: OutputFormat;
  scanOptions?: ScanOptions;
}

async function promptForOptions(): Promise<CliOptions> {
  const readline = createInterface({ input, output });
  try {
    const targetAnswer = (await readline.question('Scan target [./]: ')).trim();
    const formatAnswer = (
      await readline.question('Output format (terminal/html/json/sarif) [terminal]: ')
    )
      .trim()
      .toLowerCase();
    const thresholdAnswer = (
      await readline.question('Minimum readiness threshold (optional): ')
    ).trim();

    const format = formatAnswer === '' ? 'terminal' : formatAnswer;
    if (
      format !== 'terminal' &&
      format !== 'html' &&
      format !== 'json' &&
      format !== 'sarif'
    ) {
      throw new Error('Format must be terminal, html, json, or sarif.');
    }

    let threshold: number | undefined;
    if (thresholdAnswer !== '') {
      const parsed = Number(thresholdAnswer);
      if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
        throw new Error('Threshold must be a number between 0 and 100.');
      }
      threshold = parsed;
    }

    return { target: targetAnswer || './', format: format as OutputFormat, threshold };
  } finally {
    readline.close();
  }
}

function openReportInBrowser(reportPath: string): void {
  const url = pathToFileURL(reportPath).href;
  console.log(`Open report: ${pc.cyan(url)}`);

  const command =
    process.platform === 'win32'
      ? { file: 'cmd', args: ['/c', 'start', '', url] }
      : process.platform === 'darwin'
        ? { file: 'open', args: [url] }
        : { file: 'xdg-open', args: [url] };

  execFile(command.file, command.args, (error) => {
    if (error)
      console.log(pc.dim('Could not open the browser automatically. Use the URL above.'));
  });
}

function isValidFormat(value: string): value is OutputFormat {
  return value === 'terminal' || value === 'html' || value === 'json' || value === 'sarif';
}

function parseOptions(args: string[]): Partial<CliOptions> {
  let target: string | undefined;
  let threshold: number | undefined;
  let format: OutputFormat | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--threshold' || argument.startsWith('--threshold=')) {
      const value = argument.includes('=')
        ? argument.slice(argument.indexOf('=') + 1)
        : args[++index];
      const parsed = Number(value);
      if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100)
        throw new Error('--threshold must be a number between 0 and 100.');
      threshold = parsed;
    } else if (argument === '--format' || argument.startsWith('--format=')) {
      const value = argument.includes('=')
        ? argument.slice(argument.indexOf('=') + 1)
        : args[++index];
      if (!isValidFormat(value))
        throw new Error('--format must be terminal, html, json, or sarif.');
      format = value;
    } else if (!argument.startsWith('--')) {
      target = argument;
    }
  }
  return { target, threshold, format };
}

function groupViolations(violations: Violation[]): Map<string, Violation[]> {
  const grouped = new Map<string, Violation[]>();
  for (const violation of violations)
    grouped.set(violation.filePath, [
      ...(grouped.get(violation.filePath) ?? []),
      violation,
    ]);
  return grouped;
}

function getScore(files: string[], violations: Violation[]): number {
  const filesWithViolations = new Set(violations.map((violation) => violation.filePath)).size;
  return files.length === 0
    ? 100
    : ((files.length - filesWithViolations) / files.length) * 100;
}

function printTerminal(
  result: Awaited<ReturnType<typeof scanDirectory>>,
  score: number,
): void {
  console.log(pc.bold(pc.cyan('\npure-react-check')));
  console.log(pc.dim('React component purity and compiler readiness\n'));
  for (const [filePath, violations] of groupViolations(result.violations)) {
    console.log(pc.bold(pc.white(filePath)));
    for (const violation of violations) {
      console.log(
        `  ${pc.bgRed(pc.white(` ${violation.rule} `))} ${pc.yellow(`line ${violation.line}`)}`,
      );
      console.log(`    ${violation.message}`);
      console.log(pc.dim(`    Fix: ${violation.recommendation}`));
    }
    console.log();
  }
  for (const error of result.errors)
    console.error(
      `${pc.bgRed(pc.white(' PARSE ERROR '))} ${error.filePath}: ${error.message}`,
    );
  console.log(pc.bold(pc.cyan('Summary')));
  console.log(
    `Compiler Readiness Score: ${pc.bold(
      score >= 80
        ? pc.green(`${score.toFixed(1)}%`)
        : pc.red(`${score.toFixed(1)}%`),
    )}`,
  );
  console.log(`Scanned Files: ${result.files.length}`);
  console.log(`Total Violations: ${result.violations.length}`);
  console.log(`Total Errors: ${result.errors.length}\n`);

  console.log(pc.dim('Tip: Run "npx pure-react-check compiler-report ./src" for the full preflight analysis.\n'));
}

// ─── compiler-report subcommand ───────────────────────────────────────────────

type BailoutFormat = 'terminal' | 'json';

interface CompilerReportOptions {
  target: string;
  format: BailoutFormat;
  explain: boolean;
  ci: boolean;
  maxBailouts?: number;
  minReadiness?: number;
  failOn?: 'any' | 'new';
  baseline: boolean;
  diff: boolean;
}

function parseCompilerReportOptions(args: string[]): CompilerReportOptions {
  let target = './';
  let format: BailoutFormat = 'terminal';
  let explain = false;
  let ci = false;
  let maxBailouts: number | undefined;
  let minReadiness: number | undefined;
  let failOn: 'any' | 'new' | undefined;
  let baseline = false;
  let diff = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--format' || arg.startsWith('--format=')) {
      const val = arg.includes('=') ? arg.slice(arg.indexOf('=') + 1) : args[++i];
      if (val === 'json') format = 'json';
    } else if (arg === '--explain') {
      explain = true;
    } else if (arg === '--ci') {
      ci = true;
    } else if (arg === '--baseline') {
      baseline = true;
    } else if (arg === '--diff') {
      diff = true;
    } else if (arg === '--max-bailouts' || arg.startsWith('--max-bailouts=')) {
      const val = arg.includes('=') ? arg.slice(arg.indexOf('=') + 1) : args[++i];
      maxBailouts = Number(val);
    } else if (arg === '--min-readiness' || arg.startsWith('--min-readiness=')) {
      const val = arg.includes('=') ? arg.slice(arg.indexOf('=') + 1) : args[++i];
      minReadiness = Number(val);
    } else if (arg === '--fail-on' || arg.startsWith('--fail-on=')) {
      const val = arg.includes('=') ? arg.slice(arg.indexOf('=') + 1) : args[++i];
      if (val === 'any' || val === 'new') failOn = val;
    } else if (!arg.startsWith('--')) {
      target = arg;
    }
  }
  return { target, format, explain, ci, maxBailouts, minReadiness, failOn, baseline, diff };
}

async function runCompilerReportCli(args: string[]): Promise<number> {
  const opts = parseCompilerReportOptions(args);

  // Load project config for ignore/rules
  const fileConfig = loadConfig();

  console.log(pc.dim(`\nAnalysing ${pc.white(opts.target)} …\n`));

  const report = await analyseBailouts({
    target: opts.target,
    ignore: fileConfig?.ignore,
    rules: fileConfig?.rules,
  });

  if (opts.baseline) {
    const baselinePath = saveBaseline(report);
    console.log(`${pc.green('✓')} Baseline captured → ${pc.cyan(baselinePath)}`);
    console.log(pc.dim('Run with --diff to compare future scans against this baseline.\n'));
  }

  if (opts.diff) {
    const storedBaseline = loadBaseline();
    if (!storedBaseline) {
      console.error(
        pc.red('No baseline found. Run with --baseline first to capture one.'),
      );
      return 1;
    }
    const diff = compareToBaseline(report, storedBaseline);

    if (opts.format === 'json') {
      const reportPath = generateBailoutJsonReport(report);
      console.log(`Report written to ${pc.green(reportPath)}`);
    } else {
      printBailoutReport(report, { explain: opts.explain });
      printRegressionReport(diff);
    }

    if (opts.ci && diff.hasRegressions) {
      console.error(pc.red(`\n✗ CI failed: ${diff.regressions.length} regression(s) detected.\n`));
      return 1;
    }
    if (opts.ci && opts.failOn === 'new') {
      const newBailouts = diff.newComponents.filter((c) => c.status === 'predicted-bailout');
      if (newBailouts.length > 0) {
        console.error(
          pc.red(`\n✗ CI failed: ${newBailouts.length} new predicted-bailout component(s).\n`),
        );
        return 1;
      }
    }
    return diff.hasRegressions ? 1 : 0;
  }

  if (opts.format === 'json') {
    const reportPath = generateBailoutJsonReport(report);
    console.log(`Report written to ${pc.green(reportPath)}`);
  } else {
    printBailoutReport(report, { explain: opts.explain });
  }

  if (opts.ci) {
    let ciFailed = false;
    const { stats } = report;

    if (opts.maxBailouts !== undefined && stats.predictedBailoutComponents > opts.maxBailouts) {
      console.error(
        pc.red(
          `✗ CI failed: ${stats.predictedBailoutComponents} predicted-bailout component(s) ` +
          `exceeds max-bailouts limit of ${opts.maxBailouts}.`,
        ),
      );
      ciFailed = true;
    }

    if (opts.minReadiness !== undefined && stats.compilerReadinessPercent < opts.minReadiness) {
      console.error(
        pc.red(
          `✗ CI failed: readiness ${stats.compilerReadinessPercent.toFixed(1)}% ` +
          `is below min-readiness of ${opts.minReadiness}%.`,
        ),
      );
      ciFailed = true;
    }

    if (opts.failOn === 'any' && stats.predictedBailoutComponents > 0) {
      console.error(
        pc.red(`✗ CI failed: ${stats.predictedBailoutComponents} predicted-bailout component(s) detected.`),
      );
      ciFailed = true;
    }

    if (!ciFailed) {
      console.log(pc.green('✓ CI readiness check passed.\n'));
    }

    return ciFailed ? 1 : 0;
  }

  return report.stats.predictedBailoutComponents > 0 ? 1 : 0;
}

// ─── compiler-compat subcommand ───────────────────────────────────────────────

interface CompilerCompatOptions {
  fixturesDir?: string;
  rule?: string;
  fixture?: string;
  format: 'terminal' | 'json';
  ci: boolean;
  minAgreement: number;
}

function parseCompilerCompatOptions(args: string[]): CompilerCompatOptions {
  let fixturesDir: string | undefined;
  let rule: string | undefined;
  let fixture: string | undefined;
  let format: 'terminal' | 'json' = 'terminal';
  let ci = false;
  let minAgreement = 80;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--format' || arg.startsWith('--format=')) {
      const val = arg.includes('=') ? arg.slice(arg.indexOf('=') + 1) : args[++i];
      if (val === 'json') format = 'json';
    } else if (arg === '--rule' || arg.startsWith('--rule=')) {
      rule = arg.includes('=') ? arg.slice(arg.indexOf('=') + 1) : args[++i];
    } else if (arg === '--fixture' || arg.startsWith('--fixture=')) {
      fixture = arg.includes('=') ? arg.slice(arg.indexOf('=') + 1) : args[++i];
    } else if (arg === '--ci') {
      ci = true;
    } else if (arg === '--min-agreement' || arg.startsWith('--min-agreement=')) {
      const val = arg.includes('=') ? arg.slice(arg.indexOf('=') + 1) : args[++i];
      minAgreement = Number(val);
    } else if (!arg.startsWith('--')) {
      fixturesDir = arg;
    }
  }

  return { fixturesDir, rule, fixture, format, ci, minAgreement };
}

async function runCompilerCompatCli(args: string[]): Promise<number> {
  const opts = parseCompilerCompatOptions(args);
  const report = await runCompilerCompatibility({
    fixturesDir: opts.fixturesDir,
    ruleFilter: opts.rule,
    fixtureFilter: opts.fixture,
  });

  if (opts.format === 'json') {
    const reportPath = generateCompilerCompatJsonReport(report);
    console.log(`Report written to ${pc.green(reportPath)}`);
  } else {
    printCompilerCompatReport(report);
  }

  if (opts.ci) {
    if (report.summary.agreementPercent < opts.minAgreement) {
      console.error(
        pc.red(
          `✗ CI failed: agreement rate ${report.summary.agreementPercent.toFixed(1)}% ` +
          `is below min-agreement threshold of ${opts.minAgreement}%.`,
        ),
      );
      return 1;
    }
    console.log(pc.green('✓ CI compiler compatibility check passed.\n'));
  }

  return 0;
}

// ─── Main CLI entry ───────────────────────────────────────────────────────────

export async function runCli(args: string[] = process.argv.slice(2)): Promise<number> {
  // Global flags: --help / --version
  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    return 0;
  }

  if (args.includes('--version') || args.includes('-v')) {
    console.log(getVersion());
    return 0;
  }

  if (args[0] === 'compiler-report') {
    return runCompilerReportCli(args.slice(1));
  }

  if (args[0] === 'compiler-compat') {
    return runCompilerCompatCli(args.slice(1));
  }

  // Legacy scan path (also accessible via explicit "scan" command)
  const scanArgs = args[0] === 'scan' ? args.slice(1) : args;
  const fileConfig = loadConfig();

  let options: CliOptions;

  if (scanArgs.length === 0 && input.isTTY && output.isTTY && !fileConfig) {
    options = await promptForOptions();
  } else {
    const cliFlags = parseOptions(scanArgs);
    options = {
      target: cliFlags.target ?? fileConfig?.target ?? './',
      format: cliFlags.format ?? fileConfig?.format ?? 'terminal',
      threshold: cliFlags.threshold ?? fileConfig?.threshold,
    };
  }

  // Build scan options from config
  const scanOptions: ScanOptions | undefined =
    (fileConfig?.ignore || fileConfig?.rules)
      ? { ignore: fileConfig.ignore, rules: fileConfig.rules }
      : undefined;

  if (fileConfig) {
    console.log(pc.dim(`Config loaded from project root.\n`));
  }

  const result = await scanDirectory(options.target, scanOptions);
  const score = getScore(result.files, result.violations);

  switch (options.format) {
    case 'html': {
      const reportPath = generateHtmlReport(result, score);
      console.log(`HTML report written to ${pc.green(reportPath)}`);
      openReportInBrowser(reportPath);
      break;
    }
    case 'json': {
      const reportPath = generateJsonReport(result, score);
      console.log(`JSON report written to ${pc.green(reportPath)}`);
      break;
    }
    case 'sarif': {
      const reportPath = generateSarifReport(result, score);
      console.log(`SARIF report written to ${pc.green(reportPath)}`);
      break;
    }
    default: {
      printTerminal(result, score);
    }
  }

  if (options.threshold !== undefined && score < options.threshold) {
    console.error(
      pc.red(
        `FAILED: Score (${score.toFixed(1)}%) is below threshold (${options.threshold}%).`,
      ),
    );
    return 1;
  }
  return options.threshold === undefined &&
    (result.violations.length > 0 || result.errors.length > 0)
    ? 1
    : 0;
}
