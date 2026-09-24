/**
 * Suite Runner for Ground Truth Fixtures.
 *
 * Discovers and executes fixtures in deterministic order, aggregates predictions
 * and observations, and calculates summary metrics.
 */

import { FileSystemFixtureLoader, type FixtureLoader } from './fixture-loader.js';
import { SingleFixtureRunner } from './ground-truth-runner.js';
import { createCompilerAdapter, type CompilerAdapter } from './adapter.js';
import type {
  CompilerFixture,
  FixtureRunResult,
  GroundTruthSuiteResult,
  GroundTruthSummary,
} from './types.js';

export interface GroundTruthSuiteOptions {
  /** Directory containing fixtures */
  fixturesDir?: string;
  /** Filter to run only a single fixture by id */
  fixtureId?: string;
  /** Custom compiler adapter */
  adapter?: CompilerAdapter;
  /** Custom fixture loader */
  loader?: FixtureLoader;
  /** Concurrency limit (default: 1, sequential) */
  concurrency?: number;
}

const SUITE_SCHEMA_VERSION = 1;
const ANALYZER_VERSION = '1.3.2';

export class GroundTruthSuiteRunner {
  private readonly loader: FixtureLoader;
  private readonly adapter: CompilerAdapter;

  constructor(options: { loader?: FixtureLoader; adapter: CompilerAdapter }) {
    this.loader = options.loader ?? new FileSystemFixtureLoader();
    this.adapter = options.adapter;
  }

  /**
   * Runs the ground truth fixture suite.
   * Fixtures are executed in strictly deterministic order.
   */
  async runSuite(options: GroundTruthSuiteOptions = {}): Promise<GroundTruthSuiteResult> {
    const fixturesDir = options.fixturesDir ?? 'tests/fixtures';
    let fixtures = await this.loader.loadAll(fixturesDir);

    // If fixtureId filter is specified
    if (options.fixtureId) {
      fixtures = fixtures.filter((f) => f.id === options.fixtureId);
      if (fixtures.length === 0) {
        throw new Error(`Fixture with ID "${options.fixtureId}" not found in "${fixturesDir}".`);
      }
    }

    // Ensure deterministic ordering (by fixture ID)
    fixtures.sort((a, b) => a.id.localeCompare(b.id));

    const runner = new SingleFixtureRunner(this.adapter);
    const concurrency = Math.max(1, options.concurrency ?? 1);

    const fixtureResults: FixtureRunResult[] = [];

    if (concurrency === 1) {
      // Sequential execution (default)
      for (const fixture of fixtures) {
        const result = await runner.run(fixture);
        fixtureResults.push(result);
      }
    } else {
      // Bounded concurrency pool
      const queue = [...fixtures];
      const workers = Array.from({ length: Math.min(concurrency, fixtures.length) }, async () => {
        while (queue.length > 0) {
          const fixture = queue.shift();
          if (fixture) {
            const result = await runner.run(fixture);
            fixtureResults.push(result);
          }
        }
      });
      await Promise.all(workers);
      // Re-sort results to guarantee deterministic ordering regardless of worker completion order
      fixtureResults.sort((a, b) => a.fixture.id.localeCompare(b.fixture.id));
    }

    const summary = this.computeSummary(fixtureResults);

    return {
      schemaVersion: SUITE_SCHEMA_VERSION,
      analyzerVersion: ANALYZER_VERSION,
      compilerName: this.adapter.name,
      compilerVersion: this.adapter.version,
      timestamp: new Date().toISOString(),
      summary,
      fixtures: fixtureResults,
    };
  }

  private computeSummary(results: FixtureRunResult[]): GroundTruthSummary {
    let agreement = 0;
    let falsePositives = 0;
    let falseNegatives = 0;
    let unknown = 0;

    for (const res of results) {
      switch (res.compatibility.classification) {
        case 'agreement':
          agreement++;
          break;
        case 'false-positive':
          falsePositives++;
          break;
        case 'false-negative':
          falseNegatives++;
          break;
        case 'unknown':
        default:
          unknown++;
          break;
      }
    }

    const total = results.length;
    const agreementRate = total === 0 ? 100 : Math.round((agreement / total) * 1000) / 10;

    return {
      total,
      agreement,
      falsePositives,
      falseNegatives,
      unknown,
      agreementRate,
    };
  }
}

/**
 * Convenience entry point to run the ground truth suite.
 */
export async function runGroundTruthSuite(
  options: GroundTruthSuiteOptions = {},
): Promise<GroundTruthSuiteResult> {
  const adapter = options.adapter ?? (await createCompilerAdapter());
  const runner = new GroundTruthSuiteRunner({
    loader: options.loader,
    adapter,
  });

  return runner.runSuite(options);
}
