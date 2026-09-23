import fs from 'node:fs';
import path from 'node:path';
import type { ScanResult } from '../scanner.js';
import type { Violation } from '../rules/types.js';
import { getBailoutMapping } from '../bailout/rule-map.js';
import type { RuleImpact } from '../bailout/types.js';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

const IMPACT_PRIORITY: Record<RuleImpact, number> = {
  'compiler-bailout': 1,
  'compiler-risk': 2,
  'react-pattern': 3,
  'best-practice': 4,
};

const IMPACT_LABEL: Record<RuleImpact, string> = {
  'compiler-bailout': 'CRITICAL (BAILOUT)',
  'compiler-risk': 'HIGH RISK',
  'react-pattern': 'PATTERN WARNING',
  'best-practice': 'BEST PRACTICE',
};

const IMPACT_CLASS: Record<RuleImpact, string> = {
  'compiler-bailout': 'badge-critical',
  'compiler-risk': 'badge-risk',
  'react-pattern': 'badge-pattern',
  'best-practice': 'badge-info',
};

function groupAndSortViolations(violations: Violation[]): Map<string, Violation[]> {
  const grouped = new Map<string, Violation[]>();
  for (const violation of violations) {
    const entries = grouped.get(violation.filePath) ?? [];
    entries.push(violation);
    grouped.set(violation.filePath, entries);
  }

  // Sort violations in each file by severity (critical first), then by line number
  for (const list of grouped.values()) {
    list.sort((a, b) => {
      const mapA = getBailoutMapping(a.rule);
      const mapB = getBailoutMapping(b.rule);
      const pA = IMPACT_PRIORITY[mapA.impact] ?? 99;
      const pB = IMPACT_PRIORITY[mapB.impact] ?? 99;
      if (pA !== pB) return pA - pB;
      return a.line - b.line;
    });
  }

  return grouped;
}

export function generateHtmlReport(result: ScanResult, score: number, outputPath = 'index.html'): string {
  const absolutePath = path.resolve(outputPath);
  const cleanFiles = Math.max(result.files.length - new Set(result.violations.map((item) => item.filePath)).size, 0);
  const scoreClass = score >= 80 ? 'good' : 'bad';
  const grouped = groupAndSortViolations(result.violations);

  const details = [...grouped.entries()].map(([filePath, violations]) => `
    <section class="file-group">
      <h2>${escapeHtml(filePath)} <span class="file-count">${violations.length} violation${violations.length === 1 ? '' : 's'}</span></h2>
      ${violations.map((violation) => {
        const mapping = getBailoutMapping(violation.rule);
        const impactLabel = IMPACT_LABEL[mapping.impact] ?? 'INFO';
        const impactClass = IMPACT_CLASS[mapping.impact] ?? 'badge-info';

        return `
        <article class="violation">
          <div class="meta">
            <span class="badge ${impactClass}">${impactLabel}</span>
            <span class="rule-name">${escapeHtml(violation.rule)}</span>
            <span class="line">Line ${violation.line}</span>
          </div>
          <p class="message">${escapeHtml(violation.message)}</p>
          <p class="fix"><strong>Fix:</strong> ${escapeHtml(violation.recommendation)}</p>
        </article>`;
      }).join('')}
    </section>`).join('');

  const emptyState = result.violations.length === 0
    ? '<div class="empty"><div class="check">&#10003;</div><h2>100% Pure Codebase</h2><p>No compiler bailout risks were detected.</p></div>'
    : details;
  const errors = result.errors.length === 0 ? '' : `<div class="errors"><h2>Parse Errors</h2>${result.errors.map((error) => `<p><strong>${escapeHtml(error.filePath)}</strong>: ${escapeHtml(error.message)}</p>`).join('')}</div>`;

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>pure-react-check Report</title><style>
:root{color-scheme:dark;--bg:#0b1020;--panel:#121a2b;--panel2:#18243a;--text:#edf2ff;--muted:#9aa8c2;--green:#45d483;--red:#ff6b7a;--line:#263653;--accent:#7aa7ff}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:15px/1.55 Inter,ui-sans-serif,system-ui,sans-serif}main{max-width:1100px;margin:0 auto;padding:48px 24px 64px}header{margin-bottom:32px}h1{font-size:clamp(28px,5vw,44px);margin:0 0 8px;letter-spacing:-.02em}h2{font-size:18px;margin:0}.subtitle{color:var(--muted);margin:0}.cards{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:36px}.card,.file-group,.errors,.empty{background:var(--panel);border:1px solid var(--line);border-radius:12px}.card{padding:20px}.label{color:var(--muted);font-size:12px;text-transform:uppercase;letter-spacing:.08em}.value{display:block;font-size:28px;font-weight:700;margin-top:7px}.good{color:var(--green)}.bad{color:var(--red)}.file-group{margin:16px 0;overflow:hidden}.file-group h2{padding:17px 20px;background:var(--panel2);border-bottom:1px solid var(--line);font-family:ui-monospace,SFMono-Regular,monospace;font-size:14px}.file-count{float:right;color:var(--muted);font:12px ui-sans-serif,system-ui,sans-serif}.violation{padding:17px 20px;border-bottom:1px solid var(--line)}.violation:last-child{border-bottom:0}.meta{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.badge{border-radius:5px;padding:3px 8px;font:11px/1.2 ui-monospace,monospace;letter-spacing:0.04em}.badge-critical{background:#5a1420;color:#ff8595;border:1px solid #a8293d;font-weight:700}.badge-risk{background:#52310a;color:#ffb86c;border:1px solid #94530f;font-weight:600}.badge-pattern{background:#3b3a12;color:#ffeb3b;border:1px solid #757116}.badge-info{background:#132a47;color:#82b1ff;border:1px solid #2962ff}.rule-name{color:var(--muted);font:12px ui-monospace,monospace;background:var(--panel2);padding:3px 8px;border-radius:4px;border:1px solid var(--line)}.line{color:#ffd166;font:12px ui-monospace,monospace}.message{margin:10px 0 3px}.fix{color:var(--muted);margin:0}.fix strong{color:var(--accent)}.empty{text-align:center;padding:64px 20px}.check{display:grid;place-items:center;width:56px;height:56px;margin:0 auto 16px;border-radius:50%;background:#173e30;color:var(--green);font-size:32px}.empty p{color:var(--muted)}.errors{padding:18px 20px;margin-top:18px;border-color:#914456}.errors h2{color:var(--red);margin-bottom:8px}.errors p{color:var(--muted);margin:5px 0}@media(max-width:760px){.cards{grid-template-columns:repeat(2,1fr)}main{padding:30px 14px 48px}}@media(max-width:420px){.cards{grid-template-columns:1fr 1fr}.value{font-size:22px}}
</style></head><body><main><header><h1>&#128269; pure-react-check Report</h1><p class="subtitle">React Compiler purity and readiness analysis</p></header>
<div class="cards"><div class="card"><span class="label">Readiness Score</span><span class="value ${scoreClass}">${score.toFixed(1)}%</span></div><div class="card"><span class="label">Scanned Files</span><span class="value">${result.files.length}</span></div><div class="card"><span class="label">Clean Files</span><span class="value good">${cleanFiles}</span></div><div class="card"><span class="label">Violations</span><span class="value ${result.violations.length ? 'bad' : 'good'}">${result.violations.length}</span></div></div>
<section><h2>Detailed Findings (Prioritized by Severity)</h2>${emptyState}</section>${errors}</main></body></html>`;

  fs.writeFileSync(absolutePath, html, 'utf8');
  return absolutePath;
}
