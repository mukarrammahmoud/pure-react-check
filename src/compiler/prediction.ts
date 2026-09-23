/**
 * Static Prediction Adapter for Ground Truth Runner.
 *
 * Runs pure-react-check's static analyzer and adapts its findings into
 * the standardized StaticPrediction model without treating it as ground truth.
 */

import { performance } from 'node:perf_hooks';
import { analyseBailouts } from '../bailout/analyser.js';
import type { ComponentBailoutSummary } from '../bailout/types.js';
import type {
  CompilerFixture,
  CompilerOutcome,
  ComponentPrediction,
  StaticPrediction,
} from './types.js';

const ANALYZER_VERSION = '1.3.0';

/**
 * Maps a pure-react-check static prediction status to a standardized CompilerOutcome.
 */
export function mapComponentPredictionToOutcome(
  comp: ComponentBailoutSummary,
): CompilerOutcome {
  const pOutcome = comp.prediction.outcome;

  switch (pOutcome) {
    case 'ready':
      return 'optimized';
    case 'bailout':
      return 'bailed-out';
    case 'opted-out':
      return 'skipped';
    case 'forced-opt-in':
      return 'optimized';
    case 'at-risk':
      // If any violation has definite bailout likelihood or compiler-bailout impact, predict bailed-out
      return comp.violations.some(
        (v) => v.impact === 'compiler-bailout' || v.bailoutLikelihood === 'definite',
      )
        ? 'bailed-out'
        : 'optimized';
    default:
      return 'unknown';
  }
}

/**
 * Derives an aggregate fixture-level outcome from individual component predictions.
 */
export function aggregateFixtureOutcome(
  components: ComponentPrediction[],
): CompilerOutcome {
  if (components.length === 0) {
    return 'unknown';
  }

  // If any component is predicted to bail out, the fixture contains a bailout
  if (components.some((c) => c.outcome === 'bailed-out')) {
    return 'bailed-out';
  }

  // If any is skipped and none bailed out
  if (components.some((c) => c.outcome === 'skipped')) {
    return 'skipped';
  }

  // If all are optimized
  if (components.every((c) => c.outcome === 'optimized')) {
    return 'optimized';
  }

  return 'unknown';
}

/**
 * Executes pure-react-check static analysis on a fixture and returns a StaticPrediction.
 */
export async function predictStaticFixture(
  fixture: CompilerFixture,
): Promise<StaticPrediction> {
  const startTime = performance.now();

  const report = await analyseBailouts({
    target: fixture.entry,
  });

  const durationMs = Math.round(performance.now() - startTime);

  const componentPredictions: ComponentPrediction[] = report.components.map((comp) => {
    const outcome = mapComponentPredictionToOutcome(comp);
    const rules = Array.from(new Set(comp.violations.map((v) => v.rule)));

    return {
      name: comp.name,
      outcome,
      rules,
      reason: comp.primaryBailoutReason ?? comp.prediction.reason,
      rawPrediction: comp.prediction.outcome,
    };
  });

  const fixtureOutcome = aggregateFixtureOutcome(componentPredictions);

  return {
    fixtureId: fixture.id,
    outcome: fixtureOutcome,
    violations: report.violations,
    components: componentPredictions,
    analyzerVersion: ANALYZER_VERSION,
    durationMs,
  };
}
