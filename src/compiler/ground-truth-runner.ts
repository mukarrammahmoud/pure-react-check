/**
 * Single Fixture Ground Truth Runner.
 *
 * Coordinates static prediction and compiler observation execution for a single fixture,
 * and produces a deterministic comparison result.
 */

import fs from 'node:fs';
import type { CompilerAdapter } from './adapter.js';
import { compareGroundTruth } from './comparator.js';
import { predictStaticFixture } from './prediction.js';
import type {
  CompilerFixture,
  FixtureRunResult,
} from './types.js';

export interface GroundTruthRunner {
  run(fixture: CompilerFixture): Promise<FixtureRunResult>;
}

export class SingleFixtureRunner implements GroundTruthRunner {
  private readonly adapter: CompilerAdapter;

  constructor(adapter: CompilerAdapter) {
    this.adapter = adapter;
  }

  /**
   * Executes static analysis and compiler observation for a single fixture,
   * returning an immutable FixtureRunResult.
   *
   * Pure orchestrator: does not write files, log to console, or mutate global state.
   */
  async run(fixture: CompilerFixture): Promise<FixtureRunResult> {
    // 1. Load source from fixture entry
    if (!fs.existsSync(fixture.entry)) {
      throw new Error(`Fixture entry file not found: "${fixture.entry}" (fixture id: ${fixture.id})`);
    }
    const source = fs.readFileSync(fixture.entry, 'utf-8');

    // 2 & 3. Run pure-react-check static analysis & record prediction
    const prediction = await predictStaticFixture(fixture);

    // 4 & 5. Invoke compiler exclusively through CompilerAdapter
    const observation = await this.adapter.compile({
      fixtureId: fixture.id,
      source,
      filePath: fixture.entry,
    });

    // 6. Compare prediction and observation
    const compatibility = compareGroundTruth(prediction, observation);

    // 7. Return immutable result object
    return Object.freeze({
      fixture: Object.freeze({ ...fixture }),
      prediction: Object.freeze({ ...prediction }),
      observation: Object.freeze({ ...observation }),
      compatibility: Object.freeze({ ...compatibility }),
    });
  }
}
