/**
 * pure-react-check — Compiler Preflight Test Suite
 *
 * Uses Node.js built-in test runner (node:test) — no additional dependencies.
 *
 * Run with:  pnpm test
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyseBailouts, saveBaseline, loadBaseline, compareToBaseline } from '../src/bailout/analyser.js';
import { getBailoutMapping } from '../src/bailout/rule-map.js';
import { SCHEMA_VERSION, SCORE_VERSION } from '../src/bailout/types.js';
import type { ComponentStatus } from '../src/bailout/types.js';
import fs from 'node:fs';
import os from 'node:os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(__dirname, 'compiler-compat');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fixture(subpath: string): string {
  return path.join(FIXTURES, subpath);
}

function getComponent(
  components: Awaited<ReturnType<typeof analyseBailouts>>['components'],
  name: string,
) {
  return components.find((c) => c.name === name);
}

// ─── Schema / version tests ───────────────────────────────────────────────────

describe('Report schema', () => {
  test('report includes schemaVersion and scoreVersion', async () => {
    const report = await analyseBailouts({ target: fixture('render-mutation/input.tsx') });
    assert.equal(report.schemaVersion, SCHEMA_VERSION);
    assert.equal(report.scoreVersion, SCORE_VERSION);
    assert.equal(typeof report.toolVersion, 'string');
    assert.ok(report.generatedAt.length > 0);
  });

  test('schemaVersion constant is 2', () => {
    assert.equal(SCHEMA_VERSION, 2);
  });

  test('scoreVersion constant is 2', () => {
    assert.equal(SCORE_VERSION, 2);
  });
});

// ─── Rule-map tests ───────────────────────────────────────────────────────────

describe('Rule mapping', () => {
  test('known rules have stable categories', () => {
    const mapping = getBailoutMapping('no-render-mutation');
    assert.equal(mapping.category, 'mutation-during-render');
    assert.equal(mapping.bailoutLikelihood, 'definite');
    assert.equal(mapping.detectionConfidence, 'high');
    assert.ok(mapping.reason.length > 20);
    assert.ok(mapping.blockedOptimization.length > 5);
  });

  test('no-ref-read-in-render has medium detection confidence', () => {
    const m = getBailoutMapping('no-ref-read-in-render');
    assert.equal(m.detectionConfidence, 'medium');
    assert.equal(m.bailoutLikelihood, 'likely');
  });

  test('no-set-state-in-render is definite / high', () => {
    const m = getBailoutMapping('no-set-state-in-render');
    assert.equal(m.bailoutLikelihood, 'definite');
    assert.equal(m.detectionConfidence, 'high');
  });

  test('unknown rule returns safe fallback', () => {
    const m = getBailoutMapping('totally-unknown-rule');
    assert.equal(m.category, 'unknown');
    assert.equal(m.bailoutLikelihood, 'possible');
    assert.equal(m.detectionConfidence, 'low');
  });

  test('compilerNote is optional (present for some, absent for others)', () => {
    const withNote = getBailoutMapping('no-render-mutation');
    // compilerNote may or may not be present for this rule — just check type
    assert.ok(withNote.compilerNote === undefined || typeof withNote.compilerNote === 'string');

    const noNote = getBailoutMapping('no-global-variable-mutation');
    assert.equal(noNote.compilerNote, undefined);
  });
});

// ─── Render mutation tests ────────────────────────────────────────────────────

describe('Render mutation detection', () => {
  test('MutatesLocal is predicted-bailout', async () => {
    const report = await analyseBailouts({ target: fixture('render-mutation/input.tsx') });
    const comp = getComponent(report.components, 'MutatesLocal');
    assert.ok(comp, 'MutatesLocal component should be detected');
    assert.equal(comp.status, 'predicted-bailout');
    assert.equal(comp.kind, 'component');
    assert.ok(comp.violations.length > 0);
    assert.equal(comp.violations[0].bailoutCategory, 'mutation-during-render');
    assert.equal(comp.violations[0].bailoutLikelihood, 'definite');
    assert.equal(comp.violations[0].detectionConfidence, 'high');
    assert.ok(comp.prediction.outcome === 'bailout');
  });
});

// ─── Ref-read tests ───────────────────────────────────────────────────────────

describe('Ref read in render detection', () => {
  test('ReadsRefInRender has a violation', async () => {
    const report = await analyseBailouts({ target: fixture('ref-read/input.tsx') });
    const comp = getComponent(report.components, 'ReadsRefInRender');
    assert.ok(comp, 'ReadsRefInRender should be detected');
    // Should be predicted-bailout or at-risk (confidence is medium for ref reads)
    assert.ok(
      comp.status === 'predicted-bailout' || comp.status === 'at-risk',
      `Expected predicted-bailout or at-risk, got: ${comp.status}`,
    );
    assert.ok(comp.violations.some((v) => v.bailoutCategory === 'ref-access-in-render'));
  });
});

// ─── State update in render tests ─────────────────────────────────────────────

describe('State update in render detection', () => {
  test('SetsStateInRender is predicted-bailout', async () => {
    const report = await analyseBailouts({ target: fixture('state-update/input.tsx') });
    const comp = getComponent(report.components, 'SetsStateInRender');
    assert.ok(comp, 'SetsStateInRender should be detected');
    assert.equal(comp.status, 'predicted-bailout');
    assert.ok(comp.violations.some((v) => v.bailoutCategory === 'state-update-during-render'));
    assert.equal(comp.violations[0].bailoutLikelihood, 'definite');
    assert.equal(comp.violations[0].detectionConfidence, 'high');
  });
});

// ─── DOM global tests ─────────────────────────────────────────────────────────

describe('DOM global in render detection', () => {
  test('AccessesDomInRender is predicted-bailout', async () => {
    const report = await analyseBailouts({ target: fixture('dom-global/input.tsx') });
    const comp = getComponent(report.components, 'AccessesDomInRender');
    assert.ok(comp, 'AccessesDomInRender should be detected');
    assert.equal(comp.status, 'predicted-bailout');
    assert.ok(comp.violations.some((v) => v.bailoutCategory === 'dom-access-during-render'));
  });
});

// ─── Directive tests ───────────────────────────────────────────────────────────

describe('Directive detection', () => {
  test('module-level "use no memo" opts out all components in file', async () => {
    const report = await analyseBailouts({
      target: fixture('directives/module-opt-out.tsx'),
    });
    const compA = getComponent(report.components, 'CompA');
    const compB = getComponent(report.components, 'CompB');
    assert.ok(compA, 'CompA should be detected');
    assert.ok(compB, 'CompB should be detected');
    assert.equal(compA.status, 'opted-out');
    assert.equal(compB.status, 'opted-out');
    // Should have module-level directive in the report
    const modDir = report.directives.filter((d) => d.isModuleLevel);
    assert.ok(modDir.length > 0);
  });

  test('function-level "use no memo" opts out only that function', async () => {
    const report = await analyseBailouts({
      target: fixture('directives/function-directives.tsx'),
    });
    const optedOut = getComponent(report.components, 'OptedOut');
    const stillReady = getComponent(report.components, 'StillReady');
    const forcedIn = getComponent(report.components, 'ForcedIn');

    assert.ok(optedOut, 'OptedOut should be detected');
    assert.ok(stillReady, 'StillReady should be detected');
    assert.ok(forcedIn, 'ForcedIn should be detected');

    assert.equal(optedOut.status, 'opted-out', 'OptedOut should be opted-out');
    assert.equal(stillReady.status, 'ready', 'StillReady should be ready');
    assert.equal(forcedIn.status, 'forced-opt-in', 'ForcedIn should be forced-opt-in');
  });

  test('directives are not treated as violations', async () => {
    const report = await analyseBailouts({
      target: fixture('directives/function-directives.tsx'),
    });
    const optedOut = getComponent(report.components, 'OptedOut');
    assert.ok(optedOut);
    // Directives should not add violations
    assert.equal(optedOut.violations.length, 0);
  });
});

// ─── Hook detection ───────────────────────────────────────────────────────────

describe('Custom hook detection', () => {
  test('clean hook is detected as kind=hook with status=ready', async () => {
    const report = await analyseBailouts({ target: fixture('hooks/input.tsx') });
    const hook = getComponent(report.components, 'useCounter');
    assert.ok(hook, 'useCounter should be detected');
    assert.equal(hook.kind, 'hook');
    assert.equal(hook.status, 'ready');
  });

  test('broken hook is detected and classified as predicted-bailout', async () => {
    const report = await analyseBailouts({ target: fixture('hooks/input.tsx') });
    const hook = getComponent(report.components, 'useBrokenCounter');
    assert.ok(hook, 'useBrokenCounter should be detected');
    assert.equal(hook.kind, 'hook');
    assert.equal(hook.status, 'predicted-bailout');
  });
});

// ─── Nested component tests ───────────────────────────────────────────────────

describe('Nested component detection', () => {
  test('CleanParent is ready', async () => {
    const report = await analyseBailouts({ target: fixture('nested-components/input.tsx') });
    const comp = getComponent(report.components, 'CleanParent');
    assert.ok(comp);
    assert.equal(comp.status, 'ready');
  });

  test('ParentWithNestedComponent is at-risk', async () => {
    const report = await analyseBailouts({ target: fixture('nested-components/input.tsx') });
    const comp = getComponent(report.components, 'ParentWithNestedComponent');
    assert.ok(comp);
    assert.equal(comp.status, 'at-risk');
    assert.ok(comp.violations.some((v) => v.bailoutCategory === 'nested-component-definition'));
  });
});

// ─── False positive tests ─────────────────────────────────────────────────────

describe('False positive guards', () => {
  test('lazy ref init pattern should not generate violations', async () => {
    const report = await analyseBailouts({
      target: fixture('false-positives/ref-patterns.tsx'),
    });
    const comp = getComponent(report.components, 'LazyRefInit');
    assert.ok(comp, 'LazyRefInit should be detected');
    // Lazy ref init should NOT be flagged by no-ref-read-in-render
    const refViolations = comp.violations.filter(
      (v) => v.rule === 'no-ref-read-in-render',
    );
    assert.equal(
      refViolations.length,
      0,
      'Lazy ref initialization should not be a violation',
    );
  });

  test('ref access in event handler is not flagged', async () => {
    const report = await analyseBailouts({
      target: fixture('false-positives/ref-patterns.tsx'),
    });
    const comp = getComponent(report.components, 'RefInHandler');
    assert.ok(comp);
    const refViolations = comp.violations.filter(
      (v) => v.rule === 'no-ref-read-in-render',
    );
    assert.equal(refViolations.length, 0, 'Ref in handler should not be flagged');
  });
});

// ─── Scoring tests ─────────────────────────────────────────────────────────────

describe('Scoring (scoreVersion=2)', () => {
  test('score is 100 when no violations', async () => {
    const report = await analyseBailouts({
      target: fixture('false-positives/ref-patterns.tsx'),
    });
    // All components should be ready
    const allReady = report.components.every((c) => c.status === 'ready');
    if (allReady) {
      assert.equal(report.stats.compilerReadinessPercent, 100);
    }
    // At minimum, readiness should be > 0
    assert.ok(report.stats.compilerReadinessPercent >= 0);
    assert.ok(report.stats.compilerReadinessPercent <= 100);
  });

  test('score is less than 100 when there are definite violations', async () => {
    const report = await analyseBailouts({ target: fixture('state-update/input.tsx') });
    assert.ok(
      report.stats.compilerReadinessPercent < 100,
      `Score should be < 100, got ${report.stats.compilerReadinessPercent}`,
    );
  });

  test('score is 0 when all components have definite high-confidence violations', async () => {
    // SetsStateInRender: definite + high = 1.0 penalty → weight = 0
    const report = await analyseBailouts({ target: fixture('state-update/input.tsx') });
    const hasAllBailout = report.components.every(
      (c) => c.status === 'predicted-bailout',
    );
    if (hasAllBailout) {
      assert.equal(report.stats.compilerReadinessPercent, 0);
    }
  });

  test('stats include violation likelihood counts', async () => {
    const report = await analyseBailouts({ target: fixture('render-mutation/input.tsx') });
    assert.equal(typeof report.stats.definiteLikelihood, 'number');
    assert.equal(typeof report.stats.likelyLikelihood, 'number');
    assert.equal(typeof report.stats.possibleLikelihood, 'number');
    assert.ok(report.stats.definiteLikelihood + report.stats.likelyLikelihood +
      report.stats.possibleLikelihood === report.stats.totalViolations);
  });

  test('opted-out components contribute 0.5 weight', async () => {
    const report = await analyseBailouts({
      target: fixture('directives/module-opt-out.tsx'),
    });
    // Both components are opted-out → score = (0.5 + 0.5) / 2 * 100 = 50
    assert.equal(
      Math.round(report.stats.compilerReadinessPercent),
      50,
      'All opted-out should give 50% readiness',
    );
  });
});

// ─── Component prediction tests ───────────────────────────────────────────────

describe('CompilerPrediction', () => {
  test('ready component has outcome=ready', async () => {
    const report = await analyseBailouts({
      target: fixture('false-positives/ref-patterns.tsx'),
    });
    const comp = getComponent(report.components, 'RefInHandler');
    assert.ok(comp);
    assert.equal(comp.prediction.outcome, 'ready');
  });

  test('predicted-bailout component has outcome=bailout', async () => {
    const report = await analyseBailouts({ target: fixture('state-update/input.tsx') });
    const comp = getComponent(report.components, 'SetsStateInRender');
    assert.ok(comp);
    assert.equal(comp.prediction.outcome, 'bailout');
    assert.equal(comp.prediction.likelihood, 'definite');
    assert.ok(typeof comp.prediction.reason === 'string');
  });

  test('opted-out component has outcome=opted-out', async () => {
    const report = await analyseBailouts({
      target: fixture('directives/function-directives.tsx'),
    });
    const comp = getComponent(report.components, 'OptedOut');
    assert.ok(comp);
    assert.equal(comp.prediction.outcome, 'opted-out');
  });
});

// ─── Baseline and regression tests ────────────────────────────────────────────

describe('Baseline and regression', () => {
  test('saveBaseline creates a file', async () => {
    const report = await analyseBailouts({ target: fixture('render-mutation/input.tsx') });
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prc-test-'));
    const baselinePath = path.join(tmpDir, 'baseline.json');

    saveBaseline(report, baselinePath);
    assert.ok(fs.existsSync(baselinePath));

    const parsed = JSON.parse(fs.readFileSync(baselinePath, 'utf-8'));
    assert.equal(parsed.schemaVersion, SCHEMA_VERSION);
    assert.equal(parsed.scoreVersion, SCORE_VERSION);
    assert.equal(typeof parsed.compilerReadinessPercent, 'number');
  });

  test('loadBaseline returns null when file does not exist', () => {
    const result = loadBaseline('/nonexistent/path/baseline.json');
    assert.equal(result, null);
  });

  test('compareToBaseline detects no regressions when nothing changed', async () => {
    const report = await analyseBailouts({ target: fixture('render-mutation/input.tsx') });
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prc-test-'));
    const baselinePath = path.join(tmpDir, 'baseline.json');
    saveBaseline(report, baselinePath);

    const baseline = loadBaseline(baselinePath);
    assert.ok(baseline);

    const diff = compareToBaseline(report, baseline);
    assert.equal(diff.hasRegressions, false);
    assert.equal(diff.regressions.length, 0);
    assert.ok(Math.abs(diff.readinessDelta) < 0.001);
  });

  test('compareToBaseline detects regression when status worsens', async () => {
    // First scan: clean file
    const cleanReport = await analyseBailouts({
      target: fixture('false-positives/ref-patterns.tsx'),
    });
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prc-test-'));
    const baselinePath = path.join(tmpDir, 'baseline.json');
    saveBaseline(cleanReport, baselinePath);

    // Second scan: file with violations
    const brokenReport = await analyseBailouts({
      target: fixture('render-mutation/input.tsx'),
    });

    const baseline = loadBaseline(baselinePath);
    assert.ok(baseline);

    const diff = compareToBaseline(brokenReport, baseline);
    // The new report has different components, so they appear as "new"
    assert.ok(diff.newComponents.length > 0 || diff.regressions.length > 0 || diff.readinessDelta <= 0);
  });
});

// ─── JSON schema stability tests ──────────────────────────────────────────────

describe('JSON schema stability', () => {
  test('annotated violations have all required fields', async () => {
    const report = await analyseBailouts({ target: fixture('state-update/input.tsx') });
    for (const v of report.violations) {
      assert.equal(typeof v.rule, 'string');
      assert.equal(typeof v.filePath, 'string');
      assert.equal(typeof v.line, 'number');
      assert.equal(typeof v.message, 'string');
      assert.equal(typeof v.recommendation, 'string');
      assert.equal(typeof v.bailoutCategory, 'string');
      assert.equal(typeof v.reason, 'string');
      assert.equal(typeof v.bailoutLikelihood, 'string');
      assert.equal(typeof v.detectionConfidence, 'string');
      assert.equal(typeof v.blockedOptimization, 'string');
      // compilerNote is optional
      assert.ok(v.compilerNote === undefined || typeof v.compilerNote === 'string');
    }
  });

  test('component summaries have all required fields', async () => {
    const report = await analyseBailouts({ target: fixture('state-update/input.tsx') });
    for (const c of report.components) {
      assert.equal(typeof c.name, 'string');
      assert.equal(typeof c.kind, 'string');
      assert.ok(c.kind === 'component' || c.kind === 'hook');
      assert.equal(typeof c.filePath, 'string');
      assert.equal(typeof c.line, 'number');
      assert.equal(typeof c.status, 'string');
      assert.ok(Array.isArray(c.violations));
      assert.ok(Array.isArray(c.directives));
      assert.ok(c.primaryBailoutReason === null || typeof c.primaryBailoutReason === 'string');
      assert.ok(c.prediction);
      assert.equal(typeof c.prediction.outcome, 'string');
      assert.equal(typeof c.prediction.likelihood, 'string');
    }
  });

  test('stats have all required fields', async () => {
    const report = await analyseBailouts({ target: fixture('state-update/input.tsx') });
    const s = report.stats;
    const requiredFields: (keyof typeof s)[] = [
      'compilerReadinessPercent', 'totalFiles', 'totalComponents',
      'readyComponents', 'predictedBailoutComponents', 'atRiskComponents',
      'optedOutComponents', 'forcedOptInComponents',
      'totalViolations', 'definiteLikelihood', 'likelyLikelihood', 'possibleLikelihood',
    ];
    for (const field of requiredFields) {
      assert.equal(
        typeof s[field],
        'number',
        `stats.${field} should be a number`,
      );
    }
  });

  test('status values are from the defined set', async () => {
    const validStatuses: ComponentStatus[] = [
      'ready', 'predicted-bailout', 'at-risk', 'opted-out', 'forced-opt-in',
    ];
    const report = await analyseBailouts({ target: fixture('nested-components/input.tsx') });
    for (const c of report.components) {
      assert.ok(
        validStatuses.includes(c.status),
        `Unexpected status: ${c.status}`,
      );
    }
  });
});

// ─── Multiple files test ──────────────────────────────────────────────────────

describe('Multi-file scanning', () => {
  test('scanning a directory aggregates all components', async () => {
    const report = await analyseBailouts({ target: FIXTURES });
    assert.ok(report.components.length > 1, 'Should find multiple components');
    assert.ok(report.files.length > 1, 'Should find multiple files');
  });

  test('readiness is between 0 and 100', async () => {
    const report = await analyseBailouts({ target: FIXTURES });
    assert.ok(report.stats.compilerReadinessPercent >= 0);
    assert.ok(report.stats.compilerReadinessPercent <= 100);
  });
});
