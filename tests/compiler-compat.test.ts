import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  runCompilerCompatibility,
  createCompilerAdapter,
  ReferenceCompilerAdapter,
  comparePredictionAndObservation,
} from '../src/compiler/index.js';
import type { CompilerPrediction } from '../src/bailout/types.js';
import type { CompilerObservation } from '../src/compiler/types.js';

describe('Compiler Compatibility Suite', () => {
  describe('Adapter Initialization', () => {
    test('creates adapter and returns version string', async () => {
      const adapter = await createCompilerAdapter();
      assert.ok(adapter.version);
      assert.ok(adapter.name);
    });

    test('ReferenceCompilerAdapter evaluates code', async () => {
      const adapter = new ReferenceCompilerAdapter();
      const code = `
        export function CleanComp() { return <div>clean</div>; }
        export function BrokenComp() { let a = 0; a = a + 1; return <div>{a}</div>; }
      `;
      const obs = await adapter.analyse(code);
      assert.equal(obs.length, 2);
      const clean = obs.find((o) => o.componentName === 'CleanComp');
      const broken = obs.find((o) => o.componentName === 'BrokenComp');
      assert.equal(clean?.outcome, 'optimized');
      assert.equal(broken?.outcome, 'bailed-out');
    });
  });

  describe('Comparator Logic', () => {
    test('detects agreement when ready & optimized', () => {
      const pred: CompilerPrediction = {
        outcome: 'ready',
        likelihood: 'possible',
        reason: 'Clean',
      };
      const obs: CompilerObservation = {
        componentName: 'Clean',
        outcome: 'optimized',
      };
      const res = comparePredictionAndObservation('test.tsx', 'Clean', pred, obs);
      assert.equal(res.result, 'agreement');
    });

    test('detects agreement when bailout & bailed-out', () => {
      const pred: CompilerPrediction = {
        outcome: 'bailout',
        likelihood: 'definite',
        reason: 'Bailout',
      };
      const obs: CompilerObservation = {
        componentName: 'Broken',
        outcome: 'bailed-out',
      };
      const res = comparePredictionAndObservation('test.tsx', 'Broken', pred, obs);
      assert.equal(res.result, 'agreement');
    });

    test('detects mismatch when ready & bailed-out (false negative)', () => {
      const pred: CompilerPrediction = {
        outcome: 'ready',
        likelihood: 'possible',
        reason: 'Ready',
      };
      const obs: CompilerObservation = {
        componentName: 'Missed',
        outcome: 'bailed-out',
      };
      const res = comparePredictionAndObservation('test.tsx', 'Missed', pred, obs);
      assert.equal(res.result, 'mismatch');
      assert.match(res.notes![0], /FALSE NEGATIVE/);
    });

    test('detects mismatch when bailout & optimized (false positive)', () => {
      const pred: CompilerPrediction = {
        outcome: 'bailout',
        likelihood: 'definite',
        reason: 'Bailout',
      };
      const obs: CompilerObservation = {
        componentName: 'Overflagged',
        outcome: 'optimized',
      };
      const res = comparePredictionAndObservation('test.tsx', 'Overflagged', pred, obs);
      assert.equal(res.result, 'mismatch');
      assert.match(res.notes![0], /FALSE POSITIVE/);
    });
  });

  describe('Fixture Suite Execution', () => {
    test('runs compatibility fixtures and computes agreement matrix', async () => {
      const report = await runCompilerCompatibility();

      assert.equal(report.schemaVersion, 1);
      assert.equal(report.toolVersion, '1.2.0');
      assert.ok(report.compilerVersion);
      assert.ok(report.summary.totalFixtures > 0);
      assert.ok(report.summary.agreementPercent >= 80);

      // Check that rule matrix contains entries
      const keys = Object.keys(report.ruleMatrix);
      assert.ok(keys.length > 0);
    });

    test('rule filtering works as expected', async () => {
      const report = await runCompilerCompatibility({
        ruleFilter: 'no-render-mutation',
      });
      assert.ok(report.summary.totalFixtures > 0);
      for (const res of report.results) {
        assert.equal(res.rule, 'no-render-mutation');
      }
    });

    test('fixture name filtering works', async () => {
      const report = await runCompilerCompatibility({
        fixtureFilter: 'lazy-ref-init',
      });
      assert.ok(report.summary.totalFixtures > 0);
      assert.match(report.results[0].fixture, /lazy-ref-init/);
    });
  });
});
