import { noDomGlobalsInRenderRule } from "./no-dom-globals-in-render.js";
import { noImpureCallsRule } from "./no-impure-calls.js";
import { noNestedComponentsRule } from "./no-nested-components.js";
import { noPropStateMutationRule } from "./no-prop-state-mutation.js";
import { noRefReadInRenderRule } from "./no-ref-read-in-render.js";
import { noRenderMutationRule } from "./no-render-mutation.js";
import { noSetStateInRenderRule } from "./no-set-state-in-render.js";
// New rules
import { noMutationAfterJsxRule } from "./no-mutation-after-jsx.js";
import { noConditionalHooksRule } from "./no-conditional-hooks.js";
import { noGlobalVariableMutationRule } from "./no-global-variable-mutation.js";
import { noUnstableDefaultPropsRule } from "./no-unstable-default-props.js";
import { noAsyncComponentRule } from "./no-async-component.js";
import { noUnstableJsxKeyRule } from "./no-unstable-jsx-key.js";
import { noTimerInRenderRule } from "./no-timer-in-render.js";
import { noRefAsDependencyRule } from "./no-ref-as-dependency.js";
import type { AnalysisRule } from "./types.js";

export const allRules: AnalysisRule[] = [
  // Existing rules
  noRenderMutationRule,
  noRefReadInRenderRule,
  noImpureCallsRule,
  noSetStateInRenderRule,
  noPropStateMutationRule,
  noNestedComponentsRule,
  noDomGlobalsInRenderRule,
  // New rules
  noMutationAfterJsxRule,
  noConditionalHooksRule,
  noGlobalVariableMutationRule,
  noUnstableDefaultPropsRule,
  noAsyncComponentRule,
  noUnstableJsxKeyRule,
  noTimerInRenderRule,
  noRefAsDependencyRule,
];
