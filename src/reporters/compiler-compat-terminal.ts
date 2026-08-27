/**
 * Terminal reporter for pure-react-check compiler-compat.
 */

import pc from 'picocolors';
import type { CompatibilityReport } from '../compiler/types.js';

export function printCompilerCompatReport(report: CompatibilityReport): void {
  console.log(`\n${pc.bold(pc.magenta('Pure React Check'))}`);
  console.log(`${pc.bold('React Compiler Compatibility Matrix')}`);
  console.log('────────────────────────────────────────────────────────────────\n');

  console.log(`${pc.dim('Compiler version:')}       ${report.compilerVersion}`);
  console.log(`${pc.dim('Adapter name:')}           ${report.adapterName}`);
  console.log(`${pc.dim('Tool version:')}           ${report.toolVersion}\n`);

  const s = report.summary;
  console.log(`${pc.dim('Fixtures evaluated:')}   ${s.totalFixtures}`);
  console.log(`  ${pc.green('✓ Agreement:')}         ${s.agreement}`);
  console.log(`  ${pc.red('✗ Mismatch:')}           ${s.mismatch}`);
  console.log(`  ${pc.yellow('○ Unknown:')}           ${s.unknown}`);

  const pct = s.agreementPercent.toFixed(1);
  const colorFn = s.agreementPercent >= 90 ? pc.green : s.agreementPercent >= 80 ? pc.yellow : pc.red;
  console.log(`\n${pc.bold('Agreement Rate:')}        ${colorFn(`${pct}%`)}\n`);

  console.log('────────────────────────────────────────────────────────────────');
  console.log(`${pc.bold('RULE MATRIX')}`);
  console.log('────────────────────────────────────────────────────────────────');

  for (const [rule, entry] of Object.entries(report.ruleMatrix)) {
    const badge =
      entry.status === 'MATCH' ? pc.green('✓ MATCH ') :
      entry.status === 'REVIEW' ? pc.red('⚠ REVIEW') : pc.yellow('○ UNKNOWN');

    const ruleFormatted = rule.padEnd(28, ' ');
    const counts = `${entry.agreement}/${entry.total} agree`.padEnd(14, ' ');
    console.log(`  ${ruleFormatted} ${badge}  ${pc.dim(counts)}`);
  }

  if (report.mismatches.length > 0) {
    console.log('\n────────────────────────────────────────────────────────────────');
    console.log(`${pc.bold(pc.red('MISMATCH DETAILS'))} (${report.mismatches.length})`);
    console.log('────────────────────────────────────────────────────────────────\n');

    for (const m of report.mismatches) {
      console.log(`  ${pc.bold(m.fixture)} → ${pc.cyan(m.componentName)}`);
      console.log(`    ${pc.dim('Prediction:')} ${pc.yellow(m.prediction.outcome)} (${m.prediction.likelihood})`);
      console.log(`    ${pc.dim('Compiler:')}   ${pc.yellow(m.compilerObservation.outcome)}`);
      if (m.rule) {
        console.log(`    ${pc.dim('Rule:')}       ${m.rule}`);
      }
      for (const note of m.notes ?? []) {
        console.log(`    ${pc.dim('•')} ${note}`);
      }
      console.log();
    }
  }

  console.log('────────────────────────────────────────────────────────────────');
  console.log(pc.dim('Prediction ≠ compiler ground truth. The React Compiler is the authoritative source of truth.\n'));
}
