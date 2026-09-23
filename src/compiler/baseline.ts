/**
 * Baseline and Regression Detection for Ground Truth Runner.
 */

import fs from 'node:fs';
import path from 'node:path';
import type { GroundTruthSuiteResult } from './types.js';

export interface GroundTruthBaseline {
  compilerVersion: string;
  total: number;
  agreementRate: number;
  falsePositives: number;
  falseNegatives: number;
  unknown: number;
  updatedAt?: string;
}

export interface BaselineComparison {
  hasRegression: boolean;
  reasons: string[];
  baseline: GroundTruthBaseline;
  current: {
    total: number;
    agreementRate: number;
    falsePositives: number;
    falseNegatives: number;
    unknown: number;
  };
}

export function loadBaseline(baselinePath: string): GroundTruthBaseline | null {
  const resolvedPath = path.resolve(process.cwd(), baselinePath);
  if (!fs.existsSync(resolvedPath)) {
    return null;
  }

  try {
    const raw = fs.readFileSync(resolvedPath, 'utf-8');
    return JSON.parse(raw) as GroundTruthBaseline;
  } catch {
    return null;
  }
}

export function saveBaseline(
  suiteResult: GroundTruthSuiteResult,
  baselinePath: string,
): void {
  const resolvedPath = path.resolve(process.cwd(), baselinePath);
  const dir = path.dirname(resolvedPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const baseline: GroundTruthBaseline = {
    compilerVersion: suiteResult.compilerVersion,
    total: suiteResult.summary.total,
    agreementRate: suiteResult.summary.agreementRate,
    falsePositives: suiteResult.summary.falsePositives,
    falseNegatives: suiteResult.summary.falseNegatives,
    unknown: suiteResult.summary.unknown,
    updatedAt: new Date().toISOString(),
  };

  fs.writeFileSync(resolvedPath, JSON.stringify(baseline, null, 2), 'utf-8');
}

export function checkRegression(
  currentResult: GroundTruthSuiteResult,
  baseline: GroundTruthBaseline,
): BaselineComparison {
  const current = {
    total: currentResult.summary.total,
    agreementRate: currentResult.summary.agreementRate,
    falsePositives: currentResult.summary.falsePositives,
    falseNegatives: currentResult.summary.falseNegatives,
    unknown: currentResult.summary.unknown,
  };

  const reasons: string[] = [];

  // 1. Agreement rate regression
  if (current.agreementRate < baseline.agreementRate) {
    reasons.push(
      `Agreement rate dropped from ${baseline.agreementRate}% to ${current.agreementRate}%.`,
    );
  }

  // 2. Increase in false positives
  if (current.falsePositives > baseline.falsePositives) {
    reasons.push(
      `False positives increased from ${baseline.falsePositives} to ${current.falsePositives}.`,
    );
  }

  // 3. Increase in false negatives
  if (current.falseNegatives > baseline.falseNegatives) {
    reasons.push(
      `False negatives increased from ${baseline.falseNegatives} to ${current.falseNegatives}.`,
    );
  }

  return {
    hasRegression: reasons.length > 0,
    reasons,
    baseline,
    current,
  };
}

export const loadGroundTruthBaseline = loadBaseline;
export const saveGroundTruthBaseline = saveBaseline;
export const checkGroundTruthRegression = checkRegression;

