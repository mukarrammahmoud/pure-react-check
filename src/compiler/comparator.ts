/**
 * Comparator for pure-react-check predictions vs React Compiler observations.
 */

import type { CompilerPrediction } from '../bailout/types.js';
import type {
  CompilerObservation,
  CompatibilityResult,
  CompatibilityComparisonResult,
} from './types.js';

export function comparePredictionAndObservation(
  fixture: string,
  componentName: string,
  prediction: CompilerPrediction,
  observation: CompilerObservation,
  rule?: string,
): CompatibilityResult {
  const notes: string[] = [];
  let result: CompatibilityComparisonResult = 'unknown';

  const pOutcome = prediction.outcome;
  const cOutcome = observation.outcome;

  if (pOutcome === 'ready' && cOutcome === 'optimized') {
    result = 'agreement';
    notes.push('Both static analyzer and React Compiler agree component is optimized.');
  } else if (pOutcome === 'bailout' && cOutcome === 'bailed-out') {
    result = 'agreement';
    notes.push('Both static analyzer and React Compiler agree component bails out.');
  } else if (pOutcome === 'opted-out' && cOutcome === 'skipped') {
    result = 'agreement';
    notes.push('Both static analyzer and React Compiler respect directive opt-out.');
  } else if (pOutcome === 'forced-opt-in' && (cOutcome === 'optimized' || cOutcome === 'bailed-out')) {
    // Forced opt-in is a developer override attempt
    result = cOutcome === 'optimized' ? 'agreement' : 'mismatch';
    notes.push(`Forced opt-in component observed as '${cOutcome}'.`);
  } else if (pOutcome === 'at-risk' && cOutcome === 'bailed-out') {
    result = 'agreement';
    notes.push('At-risk static pattern resulted in observed compiler bailout.');
  } else if (pOutcome === 'at-risk' && cOutcome === 'optimized') {
    // Static analyzer was conservative (at risk), but compiler succeeded
    result = 'agreement';
    notes.push('Static analyzer flagged pattern as at-risk, but compiler successfully handled it.');
  } else if (pOutcome === 'ready' && cOutcome === 'bailed-out') {
    result = 'mismatch';
    notes.push('⚠ FALSE NEGATIVE: Static analyzer predicted READY, but compiler BAILED OUT.');
    if (observation.reason) {
      notes.push(`Compiler reason: ${observation.reason}`);
    }
  } else if (pOutcome === 'bailout' && cOutcome === 'optimized') {
    result = 'mismatch';
    notes.push('⚠ FALSE POSITIVE: Static analyzer predicted BAILOUT, but compiler OPTIMIZED.');
    if (prediction.reason) {
      notes.push(`Static reason: ${prediction.reason}`);
    }
  } else if (cOutcome === 'unknown') {
    result = 'unknown';
    notes.push('Compiler outcome could not be determined.');
  } else {
    result = 'mismatch';
    notes.push(`Mismatch between prediction (${pOutcome}) and compiler observation (${cOutcome}).`);
  }

  return {
    fixture,
    componentName,
    rule,
    prediction,
    compilerObservation: observation,
    result,
    notes,
  };
}
