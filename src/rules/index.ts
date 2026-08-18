import { noDomGlobalsInRenderRule } from "./no-dom-globals-in-render.js";
import { noImpureCallsRule } from "./no-impure-calls.js";
import { noNestedComponentsRule } from "./no-nested-components.js";
import { noPropStateMutationRule } from "./no-prop-state-mutation.js";
import { noRenderMutationRule } from "./no-render-mutation.js";
import { noSetStateInRenderRule } from "./no-set-state-in-render.js";
import type { AnalysisRule } from "./types.js";

export const allRules: AnalysisRule[] = [
  noRenderMutationRule,
  noImpureCallsRule,
  noSetStateInRenderRule,
  noPropStateMutationRule,
  noNestedComponentsRule,
  noDomGlobalsInRenderRule,
];
