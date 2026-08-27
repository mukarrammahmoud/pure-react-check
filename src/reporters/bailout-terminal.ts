/**
 * Terminal reporter for the React Compiler Preflight analysis.
 *
 * Default output is concise: summary + predicted bailouts.
 * Pass explain=true for detailed per-violation explanations.
 */

import pc from 'picocolors';
import type {
  BailoutReport,
  ComponentBailoutSummary,
  ComponentStatus,
  RegressionReport,
} from '../bailout/types.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const W = 64; // column width for dividers and wrapping

const STATUS_LABEL: Record<ComponentStatus, string> = {
  ready:              pc.green('✓ COMPILER READY'),
  'predicted-bailout': pc.red('✗ PREDICTED BAILOUT'),
  'at-risk':           pc.yellow('⚠ AT RISK'),
  'opted-out':         pc.dim('○ OPTED OUT'),
  'forced-opt-in':     pc.cyan('⚡ FORCED OPT-IN'),
};

const LIKELIHOOD_BADGE: Record<string, string> = {
  definite: pc.bgRed(pc.white(' DEFINITE ')),
  likely:   pc.bgYellow(pc.black(' LIKELY ')),
  possible: pc.bgBlue(pc.white(' POSSIBLE ')),
};

const CONFIDENCE_LABEL: Record<string, string> = {
  high:   pc.green('HIGH'),
  medium: pc.yellow('MEDIUM'),
  low:    pc.dim('LOW'),
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function divider(): void {
  console.log(pc.dim('─'.repeat(W)));
}

function wrap(text: string, indent = '    '): string {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = indent;
  for (const word of words) {
    if (current.length + word.length > W) {
      lines.push(current);
      current = indent + word + ' ';
    } else {
      current += word + ' ';
    }
  }
  if (current.trim()) lines.push(current);
  return lines.join('\n');
}

// ─── Concise component block (default mode) ───────────────────────────────────

function printCompactBailout(comp: ComponentBailoutSummary): void {
  const kindBadge = comp.kind === 'hook' ? pc.dim('[hook] ') : '';
  console.log(`\n${pc.bold(pc.white(comp.name))} ${kindBadge}${STATUS_LABEL[comp.status]}`);
  console.log(pc.dim(`  ${comp.filePath}:${comp.line}`));

  if (comp.directives.length > 0) {
    for (const d of comp.directives) {
      const tag =
        d.kind === 'use-no-memo'
          ? pc.bgMagenta(pc.white(' "use no memo" '))
          : pc.bgCyan(pc.black(' "use memo" '));
      console.log(`  ${tag} ${pc.dim(d.isModuleLevel ? 'module-level' : `line ${d.line}`)}`);
    }
  }

  if (comp.violations.length === 0) return;

  // Group by category for compact display
  const categories = new Map<string, number>();
  for (const v of comp.violations) {
    categories.set(v.bailoutCategory, (categories.get(v.bailoutCategory) ?? 0) + 1);
  }
  for (const [cat, count] of categories) {
    const suffix = count > 1 ? ` ×${count}` : '';
    console.log(pc.dim(`  • ${cat}${suffix}`));
  }
}

// ─── Explain block (--explain mode) ───────────────────────────────────────────

function printExplainBlock(comp: ComponentBailoutSummary): void {
  const kindBadge = comp.kind === 'hook' ? pc.dim('[hook] ') : '';
  console.log(`\n${pc.bold(pc.white(comp.name))} ${kindBadge}${STATUS_LABEL[comp.status]}`);
  console.log(pc.dim(`  ${comp.filePath}:${comp.line}`));

  if (comp.directives.length > 0) {
    for (const d of comp.directives) {
      const tag =
        d.kind === 'use-no-memo'
          ? pc.bgMagenta(pc.white(' "use no memo" '))
          : pc.bgCyan(pc.black(' "use memo" '));
      console.log(`  ${tag} ${pc.dim(d.isModuleLevel ? 'module-level' : `line ${d.line}`)}`);
    }
  }

  if (comp.violations.length === 0) return;

  console.log();
  for (const v of comp.violations) {
    const badge = LIKELIHOOD_BADGE[v.bailoutLikelihood] ?? pc.dim('[?]');
    const confLabel = CONFIDENCE_LABEL[v.detectionConfidence] ?? pc.dim('?');

    console.log(`  ${badge} ${pc.yellow(`line ${v.line}`)}  ${pc.bgWhite(pc.black(` ${v.rule} `))}`);
    console.log(`  ${pc.dim('Detection confidence:')} ${confLabel}`);
    console.log();
    console.log(`  ${pc.white(v.message)}`);
    console.log();
    console.log(`  ${pc.bold('Why this matters:')}`);
    console.log(pc.dim(wrap(v.reason)));
    console.log();
    console.log(`  ${pc.bold('Blocked optimisation:')} ${pc.dim(v.blockedOptimization)}`);
    console.log(`  ${pc.bold('Suggested direction:')} ${v.recommendation}`);
    if (v.compilerNote) {
      console.log(`  ${pc.dim('ℹ  ' + v.compilerNote)}`);
    }
    console.log();
  }
}

// ─── Main printer ─────────────────────────────────────────────────────────────

export interface PrintBailoutOptions {
  /** Show detailed per-violation explanations */
  explain?: boolean;
}

export function printBailoutReport(
  report: BailoutReport,
  options: PrintBailoutOptions = {},
): void {
  const { explain = false } = options;

  // ── Header ────────────────────────────────────────────────────────────────
  console.log('\n' + pc.bold('Pure React Check'));
  console.log(pc.dim('React Compiler Preflight Analyzer'));
  divider();

  const { stats } = report;
  const coverageColor =
    stats.compilerReadinessPercent >= 80 ? pc.green :
    stats.compilerReadinessPercent >= 50 ? pc.yellow :
    pc.red;

  // ── Score card ────────────────────────────────────────────────────────────
  console.log();
  console.log(
    `Compiler Readiness   ${pc.bold(coverageColor(stats.compilerReadinessPercent.toFixed(1) + '%'))}`,
  );
  console.log(pc.dim('Heuristic score based on static analysis.'));
  console.log();
  console.log(`Components           ${stats.totalComponents}`);
  console.log(`  ${pc.green('✓ Ready')}            ${stats.readyComponents}`);
  console.log(`  ${pc.red('✗ Predicted Bailout')} ${stats.predictedBailoutComponents}`);
  console.log(`  ${pc.yellow('⚠ At Risk')}          ${stats.atRiskComponents}`);
  console.log(`  ${pc.dim('○ Opted Out')}        ${stats.optedOutComponents}`);
  console.log(`  ${pc.cyan('⚡ Forced Opt-In')}   ${stats.forcedOptInComponents}`);
  console.log();
  console.log(`Violations           ${stats.totalViolations}`);
  if (stats.totalViolations > 0) {
    console.log(pc.dim(`  Definite: ${stats.definiteLikelihood}  Likely: ${stats.likelyLikelihood}  Possible: ${stats.possibleLikelihood}`));
  }
  divider();

  // ── Predicted bailouts ────────────────────────────────────────────────────
  const bailouts = report.components.filter((c) => c.status === 'predicted-bailout');
  const atRisk   = report.components.filter((c) => c.status === 'at-risk');
  const optedOut = report.components.filter((c) => c.status === 'opted-out');
  const forced   = report.components.filter((c) => c.status === 'forced-opt-in');
  const clean    = report.components.filter((c) => c.status === 'ready');

  if (bailouts.length > 0) {
    console.log(pc.bold(pc.red(`\nPredicted Bailouts (${bailouts.length})`)));
    for (const comp of bailouts) {
      explain ? printExplainBlock(comp) : printCompactBailout(comp);
    }
    console.log();
    divider();
  }

  if (atRisk.length > 0) {
    console.log(pc.bold(pc.yellow(`\nAt Risk (${atRisk.length})`)));
    for (const comp of atRisk) {
      explain ? printExplainBlock(comp) : printCompactBailout(comp);
    }
    console.log();
    divider();
  }

  if (optedOut.length > 0) {
    console.log(pc.bold(pc.magenta(`\nOpted Out (${optedOut.length})`)));
    for (const comp of optedOut) {
      const kindBadge = comp.kind === 'hook' ? pc.dim('[hook] ') : '';
      console.log(`  ${pc.white(comp.name)} ${kindBadge}— ${pc.dim(`${comp.filePath}:${comp.line}`)}`);
      for (const d of comp.directives.filter((d) => d.kind === 'use-no-memo')) {
        console.log(
          `    ${pc.bgMagenta(pc.white(' "use no memo" '))} ` +
          pc.dim(d.isModuleLevel ? 'module-level' : `line ${d.line}`),
        );
      }
    }
    console.log();
    divider();
  }

  if (forced.length > 0) {
    console.log(pc.bold(pc.cyan(`\nForced Opt-In (${forced.length})`)));
    for (const comp of forced) {
      const kindBadge = comp.kind === 'hook' ? pc.dim('[hook] ') : '';
      console.log(`  ${pc.cyan('⚡')} ${pc.white(comp.name)} ${kindBadge}— ${pc.dim(`${comp.filePath}:${comp.line}`)}`);
    }
    console.log();
    divider();
  }

  if (clean.length > 0 && explain) {
    console.log(pc.bold(pc.green(`\nCompiler Ready (${clean.length})`)));
    for (const comp of clean) {
      const kindBadge = comp.kind === 'hook' ? pc.dim('[hook] ') : '';
      console.log(`  ${pc.green('✓')} ${pc.white(comp.name)} ${kindBadge}${pc.dim(`${comp.filePath}:${comp.line}`)}`);
    }
    console.log();
    divider();
  }

  // ── Module-level directives ────────────────────────────────────────────────
  const moduleDirs = report.directives.filter((d) => d.isModuleLevel);
  if (moduleDirs.length > 0) {
    console.log(pc.bold('\nModule-level directives'));
    for (const d of moduleDirs) {
      const tag =
        d.kind === 'use-no-memo'
          ? pc.bgMagenta(pc.white(' "use no memo" '))
          : pc.bgCyan(pc.black(' "use memo" '));
      console.log(`  ${tag} ${pc.dim(d.filePath + ':' + d.line)}`);
    }
    console.log();
    divider();
  }

  // ── Footer hints ──────────────────────────────────────────────────────────
  const hints: string[] = [];
  if (!explain && (bailouts.length + atRisk.length) > 0) {
    hints.push('Run with --explain for detailed explanations.');
  }
  hints.push('Run with --ci to enforce readiness in CI.');
  hints.push('Run with --baseline to capture a baseline for regression tracking.');

  console.log();
  for (const h of hints) console.log(pc.dim(h));
  console.log();

  // Disclaimer
  console.log(
    pc.dim(
      'Note: COMPILER READY means no known bailout signals were detected.\n' +
      'It does not guarantee React Compiler will optimise this component.\n' +
      'The React Compiler is the authoritative source of truth.',
    ),
  );
  console.log();
}

// ─── Regression reporter ──────────────────────────────────────────────────────

export function printRegressionReport(diff: RegressionReport): void {
  console.log('\n' + pc.bold('React Compiler Readiness Regression Check'));
  divider();

  const deltaColor = diff.readinessDelta >= 0 ? pc.green : pc.red;
  const deltaSign = diff.readinessDelta >= 0 ? '+' : '';
  console.log(`\nPrevious readiness: ${diff.previousReadiness.toFixed(1)}%`);
  console.log(`Current readiness:  ${diff.currentReadiness.toFixed(1)}%`);
  console.log(`Change:             ${deltaColor(deltaSign + diff.readinessDelta.toFixed(1) + '%')}`);
  console.log();

  if (diff.regressions.length > 0) {
    console.log(pc.bold(pc.red(`Regressions (${diff.regressions.length})`)));
    for (const r of diff.regressions) {
      console.log(
        `  ${pc.red('✗')} ${pc.white(r.name)} ${pc.dim(r.filePath)}\n` +
        `    ${STATUS_LABEL[r.previousStatus]} → ${STATUS_LABEL[r.currentStatus]}`,
      );
    }
    console.log();
  }

  if (diff.improvements.length > 0) {
    console.log(pc.bold(pc.green(`Improvements (${diff.improvements.length})`)));
    for (const i of diff.improvements) {
      console.log(
        `  ${pc.green('✓')} ${pc.white(i.name)} ${pc.dim(i.filePath)}\n` +
        `    ${STATUS_LABEL[i.previousStatus]} → ${STATUS_LABEL[i.currentStatus]}`,
      );
    }
    console.log();
  }

  if (diff.newComponents.filter((c) => c.status === 'predicted-bailout').length > 0) {
    const newBailouts = diff.newComponents.filter((c) => c.status === 'predicted-bailout');
    console.log(pc.bold(pc.yellow(`New predicted-bailout components (${newBailouts.length})`)));
    for (const c of newBailouts) {
      console.log(`  ${pc.yellow('+')} ${pc.white(c.name)} ${pc.dim(c.filePath)}`);
    }
    console.log();
  }

  divider();

  if (diff.hasRegressions) {
    console.log(pc.bold(pc.red('\n✗ Regressions detected')));
  } else {
    console.log(pc.bold(pc.green('\n✓ No regressions detected')));
  }
  console.log();
}
