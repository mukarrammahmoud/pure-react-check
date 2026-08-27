/**
 * Comparator for pure-react-check predictions vs React Compiler observations.
 */

import type { CompilerPrediction } from '../bailout/types.js';
import type {
  CompilerObservation,
  CompatibilityResult,
  CompatibilityClassification,
  MismatchKind,
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
