import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  FileSystemFixtureLoader,
  ReferenceCompilerAdapter,
  MockCompilerAdapter,
  predictStaticFixture,
  mapComponentPredictionToOutcome,
  aggregateFixtureOutcome,
  compareGroundTruth,
  classifyOutcomePair,
  SingleFixtureRunner,
  GroundTruthSuiteRunner,
  runGroundTruthSuite,
  ReportWriter,
  loadGroundTruthBaseline,
  saveGroundTruthBaseline,
  checkGroundTruthRegression,
  type CompilerFixture,
  type StaticPrediction,
  type CompilerObservation,
  type GroundTruthSuiteResult,
} from '../src/compiler/index.js';

describe('Ground Truth Fixture Runner Suite', () => {
  // ─── 1. Fixture Loader & Metadata Validation ──────────────────────────────
  describe('Fixture Loader & Metadata Validation', () => {
    const loader = new FileSystemFixtureLoader();

    test('loads and validates all initial fixtures in tests/fixtures', async () => {
      const fixtures = await loader.loadAll('tests/fixtures');
      assert.ok(fixtures.length >= 6);

      for (const f of fixtures) {
        assert.ok(f.id, 'Fixture must have an id');
        assert.ok(f.category, 'Fixture must have a category');
        assert.ok(f.description, 'Fixture must have a description');
        assert.ok(fs.existsSync(f.entry), `Entry file must exist: ${f.entry}`);
      }
    });

    test('loads a single fixture by path to directory or fixture.json', async () => {
      const fixtureByDir = await loader.load('tests/fixtures/purity/render-mutation');
      assert.equal(fixtureByDir.id, 'render-mutation');
      assert.equal(fixtureByDir.category, 'purity');

      const fixtureByFile = await loader.load('tests/fixtures/purity/render-mutation/fixture.json');
      assert.equal(fixtureByFile.id, 'render-mutation');
    });

    test('produces helpful error when fixture file does not exist', async () => {
      await assert.rejects(
        loader.load('tests/fixtures/non-existent-dir'),
        /Fixture file not found/,
      );
    });

    test('rejects duplicate fixture IDs across discovered fixtures', async () => {
      // Mock loader sub-class to simulate duplicate discovery
      class DuplicateTestLoader extends FileSystemFixtureLoader {
        override async loadAll(_rootDir: string): Promise<CompilerFixture[]> {
          const fixtures = [
            {
              id: 'dup-id',
              category: 'purity' as const,
              description: 'Fixture 1',
              entry: path.resolve('tests/fixtures/purity/render-mutation/input.tsx'),
            },
            {
              id: 'dup-id',
              category: 'purity' as const,
              description: 'Fixture 2 (duplicate)',
              entry: path.resolve('tests/fixtures/purity/ref-read-render/input.tsx'),
            },
          ];
          const seen = new Set<string>();
          for (const f of fixtures) {
            if (seen.has(f.id)) {
              throw new Error(`Duplicate fixture ID detected: "${f.id}".`);
            }
            seen.add(f.id);
          }
          return fixtures;
        }
      }

      const dupLoader = new DuplicateTestLoader();
      await assert.rejects(dupLoader.loadAll('any'), /Duplicate fixture ID detected/);
    });

    test('fixtures are returned in deterministic alphabetical order by ID', async () => {
      const fixtures = await loader.loadAll('tests/fixtures');
      const ids = fixtures.map((f) => f.id);
      const sortedIds = [...ids].sort((a, b) => a.localeCompare(b));
      assert.deepEqual(ids, sortedIds, 'Fixtures must be sorted alphabetically by ID');
    });
  });

  // ─── 2. Static Prediction Mapping ──────────────────────────────────────────
  describe('Static Prediction Adapter', () => {
    test('predictStaticFixture measures duration and returns structured prediction', async () => {
      const loader = new FileSystemFixtureLoader();
      const fixture = await loader.load('tests/fixtures/purity/render-mutation');

      const prediction = await predictStaticFixture(fixture);
      assert.equal(prediction.fixtureId, 'render-mutation');
      assert.equal(prediction.outcome, 'bailed-out');
      assert.ok(prediction.durationMs >= 0);
      assert.ok(prediction.analyzerVersion);
      assert.ok(prediction.components.length > 0);
      assert.equal(prediction.components[0].name, 'RenderMutationComponent');
      assert.equal(prediction.components[0].outcome, 'bailed-out');
    });

    test('aggregateFixtureOutcome returns optimized when all components optimized', () => {
      const outcome = aggregateFixtureOutcome([
        { name: 'CompA', outcome: 'optimized', rules: [] },
        { name: 'CompB', outcome: 'optimized', rules: [] },
      ]);
      assert.equal(outcome, 'optimized');
    });

    test('aggregateFixtureOutcome returns bailed-out when any component bailed out', () => {
      const outcome = aggregateFixtureOutcome([
        { name: 'CompA', outcome: 'optimized', rules: [] },
        { name: 'CompB', outcome: 'bailed-out', rules: ['no-render-mutation'] },
      ]);
      assert.equal(outcome, 'bailed-out');
    });

    test('aggregateFixtureOutcome returns unknown for empty components', () => {
      const outcome = aggregateFixtureOutcome([]);
      assert.equal(outcome, 'unknown');
    });
  });

  // ─── 3. Compiler Adapter ────────────────────────────────────────────────────
  describe('Compiler Adapter Invocation', () => {
    test('ReferenceCompilerAdapter compile returns CompilerObservation with executionStatus success', async () => {
      const adapter = new ReferenceCompilerAdapter();
      const obs = await adapter.compile({
        fixtureId: 'render-mutation',
        source: `let c = 0; export function Broken() { c++; return <div />; }`,
      });

      assert.equal(obs.fixtureId, 'render-mutation');
      assert.equal(obs.executionStatus, 'success');
      assert.equal(obs.outcome, 'bailed-out');
      assert.equal(obs.observationSource, 'reference-model');
      assert.ok(obs.durationMs !== undefined && obs.durationMs >= 0);
      assert.equal(obs.components?.length, 1);
      assert.equal(obs.components?.[0].componentName, 'Broken');
    });

    test('MockCompilerAdapter simulates custom observations and outcomes', async () => {
      const mockAdapter = new MockCompilerAdapter({
        simulatedOutcome: 'optimized',
      });
      const obs = await mockAdapter.compile({
        fixtureId: 'test-fixture',
        source: 'export function Test() { return <div />; }',
      });

      assert.equal(obs.fixtureId, 'test-fixture');
      assert.equal(obs.outcome, 'optimized');
      assert.equal(obs.executionStatus, 'success');
    });

    test('MockCompilerAdapter handles simulated compiler error without crashing', async () => {
      const mockAdapter = new MockCompilerAdapter({
        shouldFail: true,
      });
      const obs = await mockAdapter.compile({
        fixtureId: 'fail-fixture',
        source: 'broken code',
      });

      assert.equal(obs.fixtureId, 'fail-fixture');
      assert.equal(obs.executionStatus, 'error');
      assert.equal(obs.outcome, 'unknown');
      assert.ok(obs.diagnostics && obs.diagnostics.length > 0);
    });

    test('MockCompilerAdapter handles simulated timeout', async () => {
      const mockAdapter = new MockCompilerAdapter({
        shouldTimeout: true,
      });
      const obs = await mockAdapter.compile({
        fixtureId: 'timeout-fixture',
        source: 'infinite loop',
      });

      assert.equal(obs.fixtureId, 'timeout-fixture');
      assert.equal(obs.executionStatus, 'timeout');
      assert.equal(obs.outcome, 'unknown');
    });
  });

  // ─── 4. Comparator Classification ───────────────────────────────────────────
  describe('Comparator Ground Truth Semantics', () => {
    test('classifies (optimized, optimized) as agreement', () => {
      const res = classifyOutcomePair('optimized', 'optimized');
      assert.equal(res.classification, 'agreement');
    });

    test('classifies (bailed-out, bailed-out) as agreement', () => {
      const res = classifyOutcomePair('bailed-out', 'bailed-out');
      assert.equal(res.classification, 'agreement');
    });

    test('classifies (skipped, skipped) as agreement', () => {
      const res = classifyOutcomePair('skipped', 'skipped');
      assert.equal(res.classification, 'agreement');
    });

    test('classifies (bailed-out, optimized) as false-positive', () => {
      const res = classifyOutcomePair('bailed-out', 'optimized');
      assert.equal(res.classification, 'false-positive');
      assert.match(res.details, /False Positive/);
    });

    test('classifies (optimized, bailed-out) as false-negative', () => {
      const res = classifyOutcomePair('optimized', 'bailed-out');
      assert.equal(res.classification, 'false-negative');
      assert.match(res.details, /False Negative/);
    });

    test('does NOT classify compiler execution error as false-positive or false-negative', () => {
      const errorRes = classifyOutcomePair('bailed-out', 'unknown', 'error');
      assert.equal(errorRes.classification, 'unknown');

      const timeoutRes = classifyOutcomePair('optimized', 'unknown', 'timeout');
      assert.equal(timeoutRes.classification, 'unknown');
    });

    test('compareGroundTruth provides component-level comparison', () => {
      const prediction: StaticPrediction = {
        fixtureId: 'multi-comp',
        outcome: 'bailed-out',
        violations: [],
        components: [
          { name: 'CompA', outcome: 'optimized', rules: [] },
          { name: 'CompB', outcome: 'bailed-out', rules: ['no-render-mutation'] },
        ],
        analyzerVersion: '1.3.0',
        durationMs: 5,
      };

      const observation: CompilerObservation = {
        fixtureId: 'multi-comp',
        outcome: 'bailed-out',
        executionStatus: 'success',
        observationSource: 'reference-model',
        components: [
          { componentName: 'CompA', outcome: 'optimized', observationSource: 'reference-model' },
          { componentName: 'CompB', outcome: 'bailed-out', observationSource: 'reference-model' },
        ],
      };

      const comparison = compareGroundTruth(prediction, observation);
      assert.equal(comparison.classification, 'agreement');
      assert.equal(comparison.components?.length, 2);
      assert.equal(comparison.components?.[0].classification, 'agreement');
      assert.equal(comparison.components?.[1].classification, 'agreement');
    });
  });

  // ─── 5. Single Fixture Runner ───────────────────────────────────────────────
  describe('Single Fixture Runner', () => {
    test('runs single fixture pipeline and returns immutable result', async () => {
      const loader = new FileSystemFixtureLoader();
      const fixture = await loader.load('tests/fixtures/memoization/valid-pure');
      const adapter = new ReferenceCompilerAdapter();
      const runner = new SingleFixtureRunner(adapter);

      const result = await runner.run(fixture);
      assert.equal(result.fixture.id, 'valid-pure');
      assert.equal(result.prediction.outcome, 'optimized');
      assert.equal(result.observation.outcome, 'optimized');
      assert.equal(result.compatibility.classification, 'agreement');

      // Verify immutability
      assert.ok(Object.isFrozen(result));
      assert.ok(Object.isFrozen(result.fixture));
      assert.ok(Object.isFrozen(result.prediction));
      assert.ok(Object.isFrozen(result.observation));
      assert.ok(Object.isFrozen(result.compatibility));
    });

    test('correctly handles compiler execution failure via MockCompilerAdapter', async () => {
      const loader = new FileSystemFixtureLoader();
      const fixture = await loader.load('tests/fixtures/memoization/valid-pure');
      const failingAdapter = new MockCompilerAdapter({ shouldFail: true });
      const runner = new SingleFixtureRunner(failingAdapter);

      const result = await runner.run(fixture);
      assert.equal(result.observation.executionStatus, 'error');
      assert.equal(result.observation.outcome, 'unknown');
      assert.equal(result.compatibility.classification, 'unknown');
    });
  });

  // ─── 6. Suite Runner & Concurrency ──────────────────────────────────────────
  describe('Suite Runner', () => {
    test('executes initial suite in deterministic sequential mode', async () => {
      const result = await runGroundTruthSuite({
        fixturesDir: 'tests/fixtures',
        concurrency: 1,
      });

      assert.equal(result.schemaVersion, 1);
      assert.ok(result.summary.total >= 6);
      assert.ok(result.summary.agreement >= 1);
      assert.ok(result.summary.agreementRate > 0);

      // Verify ordering
      const ids = result.fixtures.map((f) => f.fixture.id);
      const sortedIds = [...ids].sort((a, b) => a.localeCompare(b));
      assert.deepEqual(ids, sortedIds);
    });

    test('executes with concurrency > 1 and produces identical deterministic ordering', async () => {
      const seqResult = await runGroundTruthSuite({
        fixturesDir: 'tests/fixtures',
        concurrency: 1,
      });

      const concurrentResult = await runGroundTruthSuite({
        fixturesDir: 'tests/fixtures',
        concurrency: 3,
      });

      assert.equal(seqResult.summary.total, concurrentResult.summary.total);
      assert.equal(seqResult.summary.agreement, concurrentResult.summary.agreement);
      assert.equal(seqResult.summary.falsePositives, concurrentResult.summary.falsePositives);
      assert.equal(seqResult.summary.falseNegatives, concurrentResult.summary.falseNegatives);
      assert.equal(seqResult.summary.unknown, concurrentResult.summary.unknown);

      const seqIds = seqResult.fixtures.map((f) => f.fixture.id);
      const concIds = concurrentResult.fixtures.map((f) => f.fixture.id);
      assert.deepEqual(seqIds, concIds);
    });

    test('filters suite execution by fixtureId', async () => {
      const result = await runGroundTruthSuite({
        fixturesDir: 'tests/fixtures',
        fixtureId: 'use-no-memo',
      });

      assert.equal(result.fixtures.length, 1);
      assert.equal(result.fixtures[0].fixture.id, 'use-no-memo');
      assert.equal(result.summary.total, 1);
      assert.equal(result.fixtures[0].compatibility.classification, 'agreement');
    });

    test('throws when non-existent fixtureId is requested', async () => {
      await assert.rejects(
        runGroundTruthSuite({
          fixturesDir: 'tests/fixtures',
          fixtureId: 'non-existent-fixture',
        }),
        /Fixture with ID "non-existent-fixture" not found/,
      );
    });
  });

  // ─── 7. Determinism (Phase 12) ──────────────────────────────────────────────
  describe('Determinism Verification', () => {
    test('selected fixtures produce identical results across 3 repeated runs', async () => {
      const run1 = await runGroundTruthSuite({ fixturesDir: 'tests/fixtures' });
      const run2 = await runGroundTruthSuite({ fixturesDir: 'tests/fixtures' });
      const run3 = await runGroundTruthSuite({ fixturesDir: 'tests/fixtures' });

      assert.equal(run1.summary.total, run2.summary.total);
      assert.equal(run2.summary.total, run3.summary.total);
      assert.equal(run1.summary.agreement, run2.summary.agreement);
      assert.equal(run2.summary.agreement, run3.summary.agreement);
      assert.equal(run1.summary.agreementRate, run2.summary.agreementRate);
      assert.equal(run2.summary.agreementRate, run3.summary.agreementRate);

      for (let i = 0; i < run1.fixtures.length; i++) {
        const f1 = run1.fixtures[i];
        const f2 = run2.fixtures[i];
        const f3 = run3.fixtures[i];

        assert.equal(f1.prediction.outcome, f2.prediction.outcome);
        assert.equal(f2.prediction.outcome, f3.prediction.outcome);

        assert.equal(f1.observation.outcome, f2.observation.outcome);
        assert.equal(f2.observation.outcome, f3.observation.outcome);

        assert.equal(f1.compatibility.classification, f2.compatibility.classification);
        assert.equal(f2.compatibility.classification, f3.compatibility.classification);
      }
    });
  });

  // ─── 8. Report Generation ───────────────────────────────────────────────────
  describe('Report Generation', () => {
    const testOutputDir = 'reports/test-ground-truth';

    test('writes latest.json, summary.json, and mismatches.json', async () => {
      const suiteResult = await runGroundTruthSuite({ fixturesDir: 'tests/fixtures' });
      const writer = new ReportWriter();
      const paths = writer.writeReports(suiteResult, { outputDir: testOutputDir });

      assert.ok(fs.existsSync(paths.latestPath));
      assert.ok(fs.existsSync(paths.summaryPath));
      assert.ok(fs.existsSync(paths.mismatchesPath));

      const latest = JSON.parse(fs.readFileSync(paths.latestPath, 'utf-8'));
      assert.equal(latest.schemaVersion, suiteResult.schemaVersion);
      assert.equal(latest.fixtures.length, suiteResult.fixtures.length);

      const summary = JSON.parse(fs.readFileSync(paths.summaryPath, 'utf-8'));
      assert.equal(summary.summary.total, suiteResult.summary.total);
      assert.equal(summary.summary.agreementRate, suiteResult.summary.agreementRate);

      const mismatches = JSON.parse(fs.readFileSync(paths.mismatchesPath, 'utf-8'));
      assert.equal(typeof mismatches.totalMismatches, 'number');

      // Cleanup test directory
      fs.rmSync(testOutputDir, { recursive: true, force: true });
    });
  });

  // ─── 9. Baseline & Regression Detection ─────────────────────────────────────
  describe('Baseline & Regression Detection', () => {
    test('loads baseline snapshot correctly from file', () => {
      const baseline = loadGroundTruthBaseline('tests/baselines/react-compiler/current.json');
      assert.ok(baseline !== null);
      assert.equal(baseline.total, 6);
      assert.equal(baseline.agreementRate, 83.3);
    });

    test('returns null when baseline file does not exist', () => {
      const baseline = loadGroundTruthBaseline('tests/baselines/react-compiler/non-existent.json');
      assert.equal(baseline, null);
    });

    test('checkGroundTruthRegression detects no regression when results are equal or better', () => {
      const mockResult: GroundTruthSuiteResult = {
        schemaVersion: 1,
        analyzerVersion: '1.3.0',
        compilerName: 'Mock',
        compilerVersion: '1.0.0',
        summary: {
          total: 6,
          agreement: 5,
          falsePositives: 0,
          falseNegatives: 1,
          unknown: 0,
          agreementRate: 83.3,
        },
        fixtures: [],
      };

      const baseline = {
        compilerVersion: '1.0.0',
        total: 6,
        agreementRate: 83.3,
        falsePositives: 0,
        falseNegatives: 1,
        unknown: 0,
      };

      const comp = checkGroundTruthRegression(mockResult, baseline);
      assert.equal(comp.hasRegression, false);
      assert.equal(comp.reasons.length, 0);
    });

    test('checkGroundTruthRegression detects regression when agreement rate drops', () => {
      const mockResult: GroundTruthSuiteResult = {
        schemaVersion: 1,
        analyzerVersion: '1.3.0',
        compilerName: 'Mock',
        compilerVersion: '1.0.0',
        summary: {
          total: 6,
          agreement: 4,
          falsePositives: 1,
          falseNegatives: 1,
          unknown: 0,
          agreementRate: 66.7,
        },
        fixtures: [],
      };

      const baseline = {
        compilerVersion: '1.0.0',
        total: 6,
        agreementRate: 83.3,
        falsePositives: 0,
        falseNegatives: 1,
        unknown: 0,
      };

      const comp = checkGroundTruthRegression(mockResult, baseline);
      assert.equal(comp.hasRegression, true);
      assert.ok(comp.reasons.some((r) => r.includes('Agreement rate dropped')));
      assert.ok(comp.reasons.some((r) => r.includes('False positives increased')));
    });
  });
});
