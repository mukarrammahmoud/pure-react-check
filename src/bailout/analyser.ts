/**
 * pure-react-check — Bailout Analysis Engine (schema v2)
 */

import fs from 'node:fs';
import path from 'node:path';
import { scanDirectory, type ScanResult, type ScanOptions, type RuleSeverity } from '../scanner.js';
import type { Violation } from '../rules/types.js';
import { getBailoutMapping } from './rule-map.js';
import { buildDirectiveVisitors } from './directive-scanner.js';
import {
  buildComponentVisitors,
  type DetectedComponent,
} from './component-extractor.js';
import {
  SCHEMA_VERSION,
  SCORE_VERSION,
  type BailoutBaseline,
  type BailoutReport,
  type AnnotatedViolation,
  type CompilerDirective,
  type CompilerPrediction,
  type ComponentBailoutSummary,
  type ComponentKind,
  type ComponentStatus,
  type ReadinessStats,
  type RegressionReport,
  type BailoutLikelihood,
  type DetectionConfidence,
} from './types.js';

const TOOL_VERSION = '1.2.0';

// ─── Annotation ───────────────────────────────────────────────────────────────

function annotateViolation(v: Violation): AnnotatedViolation {
  const m = getBailoutMapping(v.rule);
  return {
    rule: v.rule,
    filePath: v.filePath,
    line: v.line,
    message: v.message,
    recommendation: v.recommendation,
    bailoutCategory: m.category,
    impact: m.impact,
    reason: m.reason,
    compilerNote: m.compilerNote,
    bailoutLikelihood: m.bailoutLikelihood,
    detectionConfidence: m.detectionConfidence,
    blockedOptimization: m.blockedOptimization,
  };
}

// ─── Component kind ───────────────────────────────────────────────────────────

function detectKind(name: string): ComponentKind {
  return /^use[A-Z]/.test(name) ? 'hook' : 'component';
}

// ─── Status computation ───────────────────────────────────────────────────────

function computeStatus(
  violations: AnnotatedViolation[],
  directives: CompilerDirective[],
): ComponentStatus {
  const hasOptOut = directives.some((d) => d.kind === 'use-no-memo');
  if (hasOptOut) return 'opted-out';

  const hasOptIn = directives.some((d) => d.kind === 'use-memo');

  if (violations.length === 0) {
    return hasOptIn ? 'forced-opt-in' : 'ready';
  }

  // Only classify as predicted-bailout if there is a violation with compiler-bailout impact
  const hasDefiniteBailout = violations.some(
    (v) => v.impact === 'compiler-bailout' && v.bailoutLikelihood !== 'possible',
  );

  if (hasDefiniteBailout) return 'predicted-bailout';
  return 'at-risk';
}

// ─── Prediction ───────────────────────────────────────────────────────────────

function buildPrediction(
  status: ComponentStatus,
  violations: AnnotatedViolation[],
): CompilerPrediction {
  const likelihoodOrder: BailoutLikelihood[] = ['definite', 'likely', 'possible'];
  const topViolation = violations
    .slice()
    .sort((a, b) =>
      likelihoodOrder.indexOf(a.bailoutLikelihood) -
      likelihoodOrder.indexOf(b.bailoutLikelihood),
    )[0];

  const outcome =
    status === 'ready' ? 'ready' :
    status === 'predicted-bailout' ? 'bailout' :
    status === 'at-risk' ? 'at-risk' :
    status === 'opted-out' ? 'opted-out' :
    'forced-opt-in';

  return {
    outcome,
    likelihood: topViolation?.bailoutLikelihood ?? 'possible',
    impact: topViolation?.impact ?? 'best-practice',
    reason: topViolation?.reason,
  };
}

// ─── Primary reason ───────────────────────────────────────────────────────────

function pickPrimaryReason(violations: AnnotatedViolation[]): string | null {
  if (violations.length === 0) return null;
  const order: BailoutLikelihood[] = ['definite', 'likely', 'possible'];
  const sorted = [...violations].sort((a, b) => {
    const diff = order.indexOf(a.bailoutLikelihood) - order.indexOf(b.bailoutLikelihood);
    return diff !== 0 ? diff : a.line - b.line;
  });
  return sorted[0].reason;
}

// ─── Scoring (scoreVersion = 2) ───────────────────────────────────────────────

function componentWeight(comp: ComponentBailoutSummary): number {
  switch (comp.status) {
    case 'ready':
    case 'forced-opt-in':
      return 1.0;
    case 'at-risk':
    case 'opted-out':
      return 0.5;
    case 'predicted-bailout': {
      const penaltyMap: Record<
        BailoutLikelihood,
        Record<DetectionConfidence, number>
      > = {
        definite: { high: 1.0, medium: 0.9, low: 0.75 },
        likely:   { high: 0.6, medium: 0.5, low: 0.4 },
        possible: { high: 0.3, medium: 0.2, low: 0.1 },
      };
      const likelihoodOrder: BailoutLikelihood[] = ['definite', 'likely', 'possible'];
      const worst = comp.violations
        .slice()
        .sort((a, b) =>
          likelihoodOrder.indexOf(a.bailoutLikelihood) -
          likelihoodOrder.indexOf(b.bailoutLikelihood),
        )[0];
      if (!worst) return 0;
      const penalty = penaltyMap[worst.bailoutLikelihood][worst.detectionConfidence];
      return Math.max(0, 1 - penalty);
    }
  }
}

function computeReadinessStats(
  components: ComponentBailoutSummary[],
  files: string[],
  violations: AnnotatedViolation[],
): ReadinessStats {
  const total = components.length;
  const weightSum = components.reduce((sum, c) => sum + componentWeight(c), 0);
  const compilerReadinessPercent = total === 0 ? 100 : (weightSum / total) * 100;

  return {
    compilerReadinessPercent,
    totalFiles: files.length,
    totalComponents: total,
    readyComponents: components.filter((c) => c.status === 'ready').length,
    predictedBailoutComponents: components.filter((c) => c.status === 'predicted-bailout').length,
    atRiskComponents: components.filter((c) => c.status === 'at-risk').length,
    optedOutComponents: components.filter((c) => c.status === 'opted-out').length,
    forcedOptInComponents: components.filter((c) => c.status === 'forced-opt-in').length,
    totalViolations: violations.length,
    definiteLikelihood: violations.filter((v) => v.bailoutLikelihood === 'definite').length,
    likelyLikelihood: violations.filter((v) => v.bailoutLikelihood === 'likely').length,
    possibleLikelihood: violations.filter((v) => v.bailoutLikelihood === 'possible').length,
  };
}

// ─── Extra AST pass ───────────────────────────────────────────────────────────

async function runExtraPass(
  absoluteFiles: string[],
  relativeFiles: string[],
): Promise<{
  directives: CompilerDirective[];
  components: DetectedComponent[];
}> {
  const parser = await import('@babel/parser');
  const traverseModule = await import('@babel/traverse');
  const traverse = traverseModule.default;

  const allDirectives: CompilerDirective[] = [];
  const allComponents: DetectedComponent[] = [];

  for (const [index, absoluteFile] of absoluteFiles.entries()) {
    const filePath = relativeFiles[index];
    if (!filePath) continue;
    try {
      const code = fs.readFileSync(absoluteFile, 'utf-8');
      const ast = parser.parse(code, {
        sourceType: 'unambiguous',
        plugins: ['jsx', 'typescript'],
      });

      const fileDirectives: CompilerDirective[] = [];
      traverse(ast, buildDirectiveVisitors(filePath, fileDirectives));
      allDirectives.push(...fileDirectives);

      const fileComponents: DetectedComponent[] = [];
      traverse(ast, buildComponentVisitors(filePath, fileComponents));
      allComponents.push(...fileComponents);
    } catch {
      // Parse errors reported by main scanner
    }
  }

  return { directives: allDirectives, components: allComponents };
}

// ─── File resolution ──────────────────────────────────────────────────────────

const DEFAULT_IGNORE = ['**/node_modules/**', '**/dist/**', '**/build/**'];

async function resolveAbsoluteFiles(target: string, extraIgnore?: string[]): Promise<string[]> {
  const fastGlobModule = await import('fast-glob');
  const fastGlob = fastGlobModule.default;

  const absoluteTarget = path.resolve(target);
  const targetStats = fs.existsSync(absoluteTarget) ? fs.statSync(absoluteTarget) : null;
  const ignorePatterns = extraIgnore && extraIgnore.length > 0
    ? [...DEFAULT_IGNORE, ...extraIgnore]
    : DEFAULT_IGNORE;

  let absoluteFiles: string[];
  if (targetStats?.isFile()) {
    absoluteFiles = [absoluteTarget];
  } else if (targetStats?.isDirectory()) {
    absoluteFiles = await fastGlob('**/*.{js,jsx,ts,tsx}', {
      cwd: absoluteTarget,
      absolute: true,
      ignore: ignorePatterns,
    });
  } else {
    absoluteFiles = await fastGlob(target, {
      absolute: true,
      ignore: ignorePatterns,
    });
  }

  return absoluteFiles;
}

// ─── Public options ───────────────────────────────────────────────────────────

export interface BailoutAnalysisOptions {
  /** Directory, file, or glob to scan */
  target: string;
  /** Additional glob patterns to ignore (merged with defaults) */
  ignore?: string[];
  /** Per-rule severity overrides. Rules set to 'off' are skipped entirely. */
  rules?: Record<string, RuleSeverity>;
}

// ─── Main analyser ────────────────────────────────────────────────────────────

export async function analyseBailouts(
  options: BailoutAnalysisOptions,
): Promise<BailoutReport> {
  const scanOpts: ScanOptions | undefined =
    (options.ignore || options.rules)
      ? { ignore: options.ignore, rules: options.rules }
      : undefined;

  const scanResult: ScanResult = await scanDirectory(options.target, scanOpts);

  const absoluteFiles = await resolveAbsoluteFiles(options.target, options.ignore);
  const relativeFiles = absoluteFiles.map((f) =>
    path.relative(process.cwd(), f).replaceAll('\\', '/'),
  );

  const { directives, components: detectedComponents } =
    await runExtraPass(absoluteFiles, relativeFiles);

  const annotated: AnnotatedViolation[] = scanResult.violations.map(annotateViolation);

  // Group violations and directives by component
  const componentSummaries: ComponentBailoutSummary[] = [];

  for (const comp of detectedComponents) {
    const compViolations = annotated.filter((v) => {
      if (v.filePath !== comp.filePath) return false;
      return v.line >= comp.line && v.line <= comp.endLine;
    });

    const compDirectives = directives.filter((d) => {
      if (d.filePath !== comp.filePath) return false;
      if (d.isModuleLevel) return true;
      return d.componentName === comp.name;
    });

    const status = computeStatus(compViolations, compDirectives);
    const prediction = buildPrediction(status, compViolations);
    const primaryBailoutReason = pickPrimaryReason(compViolations);
    const kind = detectKind(comp.name);

    componentSummaries.push({
      name: comp.name,
      kind,
      filePath: comp.filePath,
      line: comp.line,
      status,
      violations: compViolations,
      directives: compDirectives,
      primaryBailoutReason,
      prediction,
    });
  }

  const stats = computeReadinessStats(componentSummaries, scanResult.files, annotated);

  return {
    schemaVersion: SCHEMA_VERSION,
    scoreVersion: SCORE_VERSION,
    toolVersion: TOOL_VERSION,
    generatedAt: new Date().toISOString(),
    target: options.target,
    files: scanResult.files,
    components: componentSummaries,
    directives,
    violations: annotated,
    stats,
  };
}

// ─── Baseline support ─────────────────────────────────────────────────────────

const BASELINE_FILE = '.pure-react-check-baseline.json';

export function saveBaseline(report: BailoutReport, baselineFile = BASELINE_FILE): string {
  const baseline: BailoutBaseline = {
    capturedAt: report.generatedAt,
    target: report.target,
    schemaVersion: report.schemaVersion,
    scoreVersion: report.scoreVersion,
    compilerReadinessPercent: report.stats.compilerReadinessPercent,
    components: Object.fromEntries(
      report.components.map((c) => [
        `${c.filePath}:${c.name}`,
        { status: c.status, violationCount: c.violations.length },
      ]),
    ),
  };

  const outputPath = path.resolve(process.cwd(), baselineFile);
  fs.writeFileSync(outputPath, JSON.stringify(baseline, null, 2), 'utf-8');
  return outputPath;
}

export function loadBaseline(baselineFile = BASELINE_FILE): BailoutBaseline | null {
  const filePath = path.resolve(process.cwd(), baselineFile);
  if (!fs.existsSync(filePath)) return null;
  try {
    const text = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(text) as BailoutBaseline;
  } catch {
    return null;
  }
}

export function compareToBaseline(
  current: BailoutReport,
  baseline: BailoutBaseline,
): RegressionReport {
  const currentMap = new Map(
    current.components.map((c) => [`${c.filePath}:${c.name}`, c]),
  );

  const regressions: RegressionReport['regressions'] = [];
  const improvements: RegressionReport['improvements'] = [];
  const newComponents: ComponentBailoutSummary[] = [];

  const statusSeverity: Record<ComponentStatus, number> = {
    ready: 0,
    'forced-opt-in': 0,
    'opted-out': 1,
    'at-risk': 2,
    'predicted-bailout': 3,
  };

  for (const comp of current.components) {
    const key = `${comp.filePath}:${comp.name}`;
    const baseEntry = baseline.components[key];

    if (!baseEntry) {
      newComponents.push(comp);
    } else {
      const prevSev = statusSeverity[baseEntry.status];
      const currSev = statusSeverity[comp.status];

      if (currSev > prevSev) {
        regressions.push({
          name: comp.name,
          filePath: comp.filePath,
          previousStatus: baseEntry.status,
          currentStatus: comp.status,
        });
      } else if (currSev < prevSev) {
        improvements.push({
          name: comp.name,
          filePath: comp.filePath,
          previousStatus: baseEntry.status,
          currentStatus: comp.status,
        });
      }
    }
  }

  const currentKeys = new Set(currentMap.keys());
  const removedComponentKeys = Object.keys(baseline.components).filter(
    (key) => !currentKeys.has(key),
  );

  const previousReadiness = baseline.compilerReadinessPercent;
  const currentReadiness = current.stats.compilerReadinessPercent;

  return {
    baseline,
    previousReadiness,
    currentReadiness,
    readinessDelta: currentReadiness - previousReadiness,
    newComponents,
    removedComponentKeys,
    regressions,
    improvements,
    hasRegressions: regressions.length > 0,
  };
}
