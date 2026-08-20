import { noDomGlobalsInRenderRule } from "./no-dom-globals-in-render.js";
import { noImpureCallsRule } from "./no-impure-calls.js";
import { noNestedComponentsRule } from "./no-nested-components.js";
import { noPropStateMutationRule } from "./no-prop-state-mutation.js";
import { noRefReadInRenderRule } from "./no-ref-read-in-render.js";
import { noRenderMutationRule } from "./no-render-mutation.js";
import { noSetStateInRenderRule } from "./no-set-state-in-render.js";
import type { AnalysisRule } from "./types.js";

export const allRules: AnalysisRule[] = [
  noRenderMutationRule,
  noRefReadInRenderRule,
  noImpureCallsRule,
  noSetStateInRenderRule,
  noPropStateMutationRule,
  noNestedComponentsRule,
  noDomGlobalsInRenderRule,
];

