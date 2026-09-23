/**
 * Comparator for pure-react-check predictions vs React Compiler observations.
 */

import type { CompilerPrediction } from '../bailout/types.js';
import type {
  CompilerObservation,
  CompilerOutcome,
  CompatibilityResult,
  CompatibilityClassification,
  MismatchKind,
  StaticPrediction,
  CompatibilityComparison,
  ComponentCompatibilityComparison,
  GroundTruthClassification,
} from './types.js';

export function comparePredictionAndObservation(
  fixture: string,
  componentName: string,
  prediction: CompilerPrediction,
  observation: CompilerObservation,
  rule?: string,
): CompatibilityResult {
  const notes: string[] = [];
  let result: CompatibilityClassification = 'unknown';
  let mismatchKind: MismatchKind | undefined;

  const pOutcome = prediction.outcome;
  const cOutcome = observation.outcome;

  if (pOutcome === 'ready' && cOutcome === 'optimized') {
    result = 'agreement';
    notes.push('Both static analyzer and compiler observation agree component is optimized.');
  } else if (pOutcome === 'bailout' && cOutcome === 'bailed-out') {
    result = 'agreement';
    notes.push('Both static analyzer and compiler observation agree component bails out.');
  } else if (pOutcome === 'opted-out' && cOutcome === 'skipped') {
    result = 'agreement';
    notes.push('Both static analyzer and compiler observation respect directive opt-out.');
  } else if (pOutcome === 'forced-opt-in' && (cOutcome === 'optimized' || cOutcome === 'bailed-out')) {
    result = cOutcome === 'optimized' ? 'agreement' : 'mismatch';
    if (result === 'mismatch') mismatchKind = 'analyzer-too-narrow';
    notes.push(`Forced opt-in component observed as '${cOutcome}'.`);
  } else if (pOutcome === 'ready' && cOutcome === 'skipped') {
    // Clean static result + file-level directive skip measures different domains
    result = 'not-comparable';
    mismatchKind = 'not-comparable';
    notes.push('Clean static analysis result in a directive-skipped file is not-comparable.');
  } else if (rule === 'no-nested-components' && cOutcome === 'optimized' && pOutcome === 'bailout') {
    result = 'mismatch';
    mismatchKind = 'rule-misclassified';
    notes.push('Rule classification mismatch: nested components are a React pattern concern, not a guaranteed compiler bailout.');
  } else if (rule === 'no-unstable-default-props' && cOutcome === 'optimized' && pOutcome === 'bailout') {
    result = 'mismatch';
    mismatchKind = 'analyzer-too-broad';
    notes.push('Analyzer prediction too broad: default prop literals create referential stability risks but do not guarantee compiler bailout.');
  } else if (pOutcome === 'at-risk' && cOutcome === 'optimized') {
    // Static analyzer flagged pattern as at-risk, but compiler successfully optimized
    result = 'agreement';
    notes.push('Static analyzer flagged pattern as at-risk, and compiler successfully optimized component.');
  } else if (pOutcome === 'at-risk' && cOutcome === 'bailed-out') {
    result = 'agreement';
    notes.push('At-risk static pattern resulted in observed compiler bailout.');
  } else if (pOutcome === 'ready' && cOutcome === 'bailed-out') {
    result = 'mismatch';
    mismatchKind = 'analyzer-too-narrow';
    notes.push('⚠ FALSE NEGATIVE: Static analyzer predicted READY, but compiler BAILED OUT.');
    if (observation.reason) {
      notes.push(`Compiler reason: ${observation.reason}`);
    }
  } else if (pOutcome === 'bailout' && cOutcome === 'optimized') {
    result = 'mismatch';
    mismatchKind = 'analyzer-too-broad';
    notes.push('⚠ FALSE POSITIVE: Static analyzer predicted BAILOUT, but compiler OPTIMIZED.');
    if (prediction.reason) {
      notes.push(`Static reason: ${prediction.reason}`);
    }
  } else if (cOutcome === 'unknown') {
    result = 'unknown';
    mismatchKind = 'unknown';
    notes.push('Compiler outcome could not be determined.');
  } else {
    result = 'mismatch';
    mismatchKind = 'unknown';
    notes.push(`Mismatch between prediction (${pOutcome}) and compiler observation (${cOutcome}).`);
  }

  if (observation.observationSource === 'reference-model') {
    notes.push('Observation source: Reference Compiler Model (simulation).');
  }

  return {
    fixture,
    componentName,
    rule,
    prediction,
    compilerObservation: observation,
    result,
    mismatchKind,
    notes,
  };
}

// ─── Ground Truth Comparator ──────────────────────────────────────────────────

/**
 * Classifies a single (predicted, actual) outcome pair according to Ground Truth semantics.
 * Ensures compiler execution errors are never classified as false-positive or false-negative.
 */
export function classifyOutcomePair(
  predicted: CompilerOutcome,
  actual: CompilerOutcome,
  executionStatus?: string,
): { classification: GroundTruthClassification; details: string } {
  if (executionStatus === 'error' || executionStatus === 'timeout') {
    return {
      classification: 'unknown',
      details: `Compiler execution ${executionStatus}: outcome could not be determined reliably.`,
    };
  }

  if (predicted === 'unknown' || actual === 'unknown') {
    return {
      classification: 'unknown',
      details: 'Outcome could not be determined with certainty.',
    };
  }

  if (predicted === actual) {
    return {
      classification: 'agreement',
      details: `Both predicted and observed outcome agree on "${actual}".`,
    };
  }

  if (predicted === 'bailed-out' && actual === 'optimized') {
    return {
      classification: 'false-positive',
      details: 'False Positive: static analysis predicted bailout, but compiler successfully optimized.',
    };
  }

  if (predicted === 'optimized' && actual === 'bailed-out') {
    return {
      classification: 'false-negative',
      details: 'False Negative: static analysis predicted optimization, but compiler bailed out.',
    };
  }

  return {
    classification: 'unknown',
    details: `Unmatched outcome pair: predicted "${predicted}" vs actual "${actual}".`,
  };
}

/**
 * Compares static prediction against compiler observation for a fixture.
 * Pure, side-effect free, and deterministic.
 */
export function compareGroundTruth(
  prediction: StaticPrediction,
  observation: CompilerObservation,
): CompatibilityComparison {
  const fixturePair = classifyOutcomePair(
    prediction.outcome,
    observation.outcome,
    observation.executionStatus,
  );

  const componentComparisons: ComponentCompatibilityComparison[] = [];
  const obsComponents = observation.components ?? [];

  for (const predComp of prediction.components) {
    const matchingObs = obsComponents.find((c) => c.componentName === predComp.name);
    const actualOutcome = matchingObs ? matchingObs.outcome : 'unknown';
    const pair = classifyOutcomePair(
      predComp.outcome,
      actualOutcome,
      observation.executionStatus,
    );

    componentComparisons.push({
      componentName: predComp.name,
      predictedOutcome: predComp.outcome,
      actualOutcome,
      classification: pair.classification,
      reason: predComp.reason ?? matchingObs?.reason,
    });
  }

  return {
    classification: fixturePair.classification,
    details: fixturePair.details,
    components: componentComparisons,
  };
}

