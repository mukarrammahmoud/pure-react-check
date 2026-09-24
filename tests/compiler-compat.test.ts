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
import { analyseBailouts } from '../src/bailout/analyser.js';

describe('Compiler Compatibility Suite', () => {
  describe('Adapter Initialization', () => {
    test('creates adapter and returns version string and observation source', async () => {
      const adapter = await createCompilerAdapter();
      assert.ok(adapter.version);
      assert.ok(adapter.name);

      const obs = await adapter.analyse(`export function SimpleComp() { return <div />; }`);
      assert.equal(obs[0].observationSource, adapter.isRealCompiler ? 'react-compiler' : 'reference-model');
    });

    test('ReferenceCompilerAdapter evaluates code with observationSource = reference-model', async () => {
      const adapter = new ReferenceCompilerAdapter();
      const code = `
        let counter = 0;
        export function CleanComp() { return <div>clean</div>; }
        export function BrokenComp() { counter++; return <div>{counter}</div>; }
      `;
      const obs = await adapter.analyse(code);
      assert.equal(obs.length, 2);
      const clean = obs.find((o) => o.componentName === 'CleanComp');
      const broken = obs.find((o) => o.componentName === 'BrokenComp');
      assert.equal(clean?.outcome, 'optimized');
      assert.equal(clean?.observationSource, 'reference-model');
      assert.equal(broken?.outcome, 'bailed-out');
      assert.equal(broken?.observationSource, 'reference-model');
    });
  });

  describe('Comparator Logic & Mismatch Classification', () => {
    test('detects agreement when ready & optimized', () => {
      const pred: CompilerPrediction = {
        outcome: 'ready',
        likelihood: 'possible',
        impact: 'best-practice',
        reason: 'Clean',
      };
      const obs: CompilerObservation = {
        componentName: 'Clean',
        outcome: 'optimized',
        observationSource: 'reference-model',
      };
      const res = comparePredictionAndObservation('test.tsx', 'Clean', pred, obs);
      assert.equal(res.result, 'agreement');
    });

    test('detects agreement when bailout & bailed-out', () => {
      const pred: CompilerPrediction = {
        outcome: 'bailout',
        likelihood: 'definite',
        impact: 'compiler-bailout',
        reason: 'Bailout',
      };
      const obs: CompilerObservation = {
        componentName: 'Broken',
        outcome: 'bailed-out',
        observationSource: 'reference-model',
      };
      const res = comparePredictionAndObservation('test.tsx', 'Broken', pred, obs);
      assert.equal(res.result, 'agreement');
    });

    test('detects mismatch when ready & bailed-out (analyzer-too-narrow)', () => {
      const pred: CompilerPrediction = {
        outcome: 'ready',
        likelihood: 'possible',
        impact: 'best-practice',
        reason: 'Ready',
      };
      const obs: CompilerObservation = {
        componentName: 'Missed',
        outcome: 'bailed-out',
        observationSource: 'reference-model',
      };
      const res = comparePredictionAndObservation('test.tsx', 'Missed', pred, obs);
      assert.equal(res.result, 'mismatch');
      assert.equal(res.mismatchKind, 'analyzer-too-narrow');
      assert.match(res.notes![0], /FALSE NEGATIVE/);
    });

    test('detects mismatch when bailout & optimized (analyzer-too-broad)', () => {
      const pred: CompilerPrediction = {
        outcome: 'bailout',
        likelihood: 'definite',
        impact: 'compiler-bailout',
        reason: 'Bailout',
      };
      const obs: CompilerObservation = {
        componentName: 'Overflagged',
        outcome: 'optimized',
        observationSource: 'reference-model',
      };
      const res = comparePredictionAndObservation('test.tsx', 'Overflagged', pred, obs);
      assert.equal(res.result, 'mismatch');
      assert.equal(res.mismatchKind, 'analyzer-too-broad');
      assert.match(res.notes![0], /FALSE POSITIVE/);
    });

    test('classifies no-nested-components mismatch as rule-misclassified when predicted as bailout', () => {
      const pred: CompilerPrediction = {
        outcome: 'bailout',
        likelihood: 'definite',
        impact: 'compiler-bailout',
        reason: 'Nested component definition',
      };
      const obs: CompilerObservation = {
        componentName: 'InnerComp',
        outcome: 'optimized',
        observationSource: 'reference-model',
      };
      const res = comparePredictionAndObservation('test.tsx', 'InnerComp', pred, obs, 'no-nested-components');
      assert.equal(res.result, 'mismatch');
      assert.equal(res.mismatchKind, 'rule-misclassified');
    });
  });

  describe('Bounded Dataflow & Chained Aliasing', () => {
    test('detects indirect prop mutation through multi-hop chained alias', async () => {
      const report = await analyseBailouts({
        target: 'tests/compiler-compat/dataflow/chained-alias.tsx',
      });
      assert.equal(report.components.length, 1);
      const comp = report.components[0];
      assert.ok(comp.violations.length >= 1);
      assert.ok(comp.violations.some((v) => v.rule === 'no-prop-state-mutation'));
    });

    test('detects indirect prop mutation through nested member alias', async () => {
      const report = await analyseBailouts({
        target: 'tests/compiler-compat/dataflow/nested-alias.tsx',
      });
      assert.equal(report.components.length, 1);
      const comp = report.components[0];
      assert.ok(comp.violations.length >= 1);
      assert.ok(comp.violations.some((v) => v.rule === 'no-prop-state-mutation'));
    });
  });

  describe('Fixture Suite Execution', () => {
    test('runs compatibility fixtures and computes agreement matrix and rule reliability', async () => {
      const report = await runCompilerCompatibility();

      assert.equal(report.schemaVersion, 1);
      assert.equal(report.toolVersion, '1.3.3');
      assert.ok(report.compilerVersion);
      assert.ok(report.observationSource);
      assert.ok(report.summary.totalFixtures > 0);

      // Check Rule Reliability structure
      const reliabilityKeys = Object.keys(report.ruleReliability);
      assert.ok(reliabilityKeys.length > 0);
      for (const key of reliabilityKeys) {
        const rel = report.ruleReliability[key];
        assert.ok(rel.impact);
        assert.ok(rel.confidence);
      }
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
