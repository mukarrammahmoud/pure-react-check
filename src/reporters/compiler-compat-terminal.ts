/**
 * Terminal reporter for pure-react-check compiler-compat.
 */

import pc from 'picocolors';
import type { CompatibilityReport } from '../compiler/types.js';

export function printCompilerCompatReport(report: CompatibilityReport): void {
  console.log(`\n${pc.bold(pc.magenta('Pure React Check'))}`);
  console.log(`${pc.bold('React Compiler Compatibility Matrix')}`);
  console.log('────────────────────────────────────────────────────────────────\n');

  const sourceLabel = report.observationSource === 'react-compiler'
    ? pc.green('React Compiler (Official plugin)')
    : pc.yellow('Reference Model (Simulation fallback)');

  console.log(`${pc.dim('Compiler source:')}      ${sourceLabel}`);
  console.log(`${pc.dim('Compiler version:')}     ${report.compilerVersion}`);
  console.log(`${pc.dim('Adapter name:')}         ${report.adapterName}`);
  console.log(`${pc.dim('Tool version:')}         ${report.toolVersion}\n`);

  const s = report.summary;
  console.log(`${pc.dim('Fixtures evaluated:')}   ${s.totalFixtures}`);
  console.log(`  ${pc.green('✓ Agreement:')}         ${s.agreement}`);
  console.log(`  ${pc.red('✗ Mismatch:')}           ${s.mismatch}`);
  if (s.notComparable > 0) {
    console.log(`  ${pc.dim('○ Not Comparable:')}     ${s.notComparable}`);
  }
  if (s.unknown > 0) {
    console.log(`  ${pc.yellow('○ Unknown:')}           ${s.unknown}`);
  }

  const pct = s.agreementPercent.toFixed(1);
  const colorFn = s.agreementPercent >= 90 ? pc.green : s.agreementPercent >= 80 ? pc.yellow : pc.red;
  console.log(`\n${pc.bold('Agreement Rate:')}        ${colorFn(`${pct}%`)}\n`);

  // ─── Rule Reliability Section ─────────────────────────────────────────────
  console.log('────────────────────────────────────────────────────────────────');
  console.log(`${pc.bold('RULE RELIABILITY')}`);
  console.log('────────────────────────────────────────────────────────────────');

  const reliabilities = Object.values(report.ruleReliability);
  const highConf = reliabilities.filter((r) => r.confidence === 'high' && r.agreements === r.fixtures);
  const reviewReq = reliabilities.filter((r) => r.mismatches > 0 || r.confidence !== 'high');

  if (highConf.length > 0) {
    console.log(`\n${pc.bold(pc.green('HIGH CONFIDENCE'))}`);
    for (const r of highConf) {
      const name = r.ruleId.padEnd(28, ' ');
      const pctStr = `${r.agreementPercent.toFixed(0)}%`.padStart(5, ' ');
      console.log(`  ${name} ${pc.green(pctStr)}   ${pc.dim(`${r.fixtures} fixture${r.fixtures === 1 ? '' : 's'}`)}`);
    }
  }

  if (reviewReq.length > 0) {
    console.log(`\n${pc.bold(pc.yellow('REVIEW REQUIRED'))}`);
    for (const r of reviewReq) {
      const name = r.ruleId.padEnd(28, ' ');
      const pctStr = `${r.agreementPercent.toFixed(0)}%`.padStart(5, ' ');
      console.log(`  ${name} ${pc.yellow(pctStr)}   ${pc.dim(`${r.agreements}/${r.fixtures} agree`)}`);
    }
  }

  // ─── Rule Matrix by Impact ──────────────────────────────────────────────────
  console.log('\n────────────────────────────────────────────────────────────────');
  console.log(`${pc.bold('RULE MATRIX BY IMPACT')}`);
  console.log('────────────────────────────────────────────────────────────────');

  const impactGroups: Record<string, string[]> = {
    'Compiler Bailout Rules': [],
    'Compiler Risk Rules': [],
    'React Pattern Rules': [],
    'Best Practice Rules': [],
  };

  for (const [rule, entry] of Object.entries(report.ruleMatrix)) {
    const reliability = report.ruleReliability[rule];
    const impact = reliability?.impact ?? 'best-practice';
    const groupName =
      impact === 'compiler-bailout' ? 'Compiler Bailout Rules' :
      impact === 'compiler-risk' ? 'Compiler Risk Rules' :
      impact === 'react-pattern' ? 'React Pattern Rules' : 'Best Practice Rules';

    const badge =
      entry.status === 'MATCH' ? pc.green('✓ MATCH ') :
      entry.status === 'NOT-COMPARABLE' ? pc.dim('○ N/A   ') :
      entry.status === 'REVIEW' ? pc.red('⚠ REVIEW') : pc.yellow('○ UNKNOWN');

    const ruleFormatted = rule.padEnd(28, ' ');
    const counts = `${entry.agreement}/${entry.total} agree`.padEnd(14, ' ');
    impactGroups[groupName].push(`  ${ruleFormatted} ${badge}  ${pc.dim(counts)}`);
  }

  for (const [groupName, lines] of Object.entries(impactGroups)) {
    if (lines.length === 0) continue;
    console.log(`\n${pc.bold(pc.cyan(groupName))}`);
    for (const line of lines) {
      console.log(line);
    }
  }

  // ─── Mismatch Details ───────────────────────────────────────────────────────
  if (report.mismatches.length > 0) {
    console.log('\n────────────────────────────────────────────────────────────────');
    console.log(`${pc.bold(pc.red('MISMATCH DETAILS'))} (${report.mismatches.length})`);
    console.log('────────────────────────────────────────────────────────────────\n');

    for (const m of report.mismatches) {
      const obsSourceText = m.compilerObservation.observationSource === 'react-compiler'
        ? 'React Compiler'
        : 'Reference Model';

      console.log(`  ${pc.bold(m.fixture)} → ${pc.cyan(m.componentName)}`);
      console.log(`    ${pc.dim('Prediction:')}      ${pc.yellow(m.prediction.outcome)} (likelihood: ${m.prediction.likelihood}, impact: ${m.prediction.impact})`);
      console.log(`    ${pc.dim(`${obsSourceText}:`)} ${pc.yellow(m.compilerObservation.outcome)}`);
      if (m.mismatchKind) {
        console.log(`    ${pc.dim('Mismatch Category:')} ${pc.magenta(m.mismatchKind)}`);
      }
      if (m.rule) {
        console.log(`    ${pc.dim('Rule:')}            ${m.rule}`);
      }
      for (const note of m.notes ?? []) {
        console.log(`    ${pc.dim('•')} ${note}`);
      }
      console.log();
    }
  }

  console.log('────────────────────────────────────────────────────────────────');
  console.log(pc.dim('React Compiler observations and Reference Model observations are distinct.'));
  console.log(pc.dim('The official React Compiler remains the ultimate source of truth.\n'));
}
