/**
 * Rule → Compiler Bailout Mapping (v2)
 *
 * Maps each pure-react-check rule to:
 *  - The tool's stable bailout category
 *  - A tool-authored reason (stable across compiler versions)
 *  - An optional compilerNote (informational, NOT stable API)
 *  - Bailout likelihood (predicted compiler behaviour)
 *  - Detection confidence (how reliable the AST detection is)
 *  - Which optimisation is blocked
 *
 * IMPORTANT: `reason` uses pure-react-check's own language.
 * `compilerNote` is supplementary context and should not be treated
 * as a formal compiler diagnostic — it will not be kept in sync with
 * compiler releases and is intentionally not part of the JSON schema.
 */

import type {
  BailoutCategory,
  BailoutLikelihood,
  DetectionConfidence,
} from './types.js';

export interface BailoutMapping {
  /** The pure-react-check rule name */
  rule: string;
  /** Stable category (pure-react-check taxonomy, not compiler internals) */
  category: BailoutCategory;
  /**
   * Tool-authored explanation of why this pattern is problematic.
   * Written in terms of React semantics — decoupled from compiler internals.
   */
  reason: string;
  /**
   * Optional supplementary note about how this relates to React Compiler
   * behaviour. Informational only — NOT a stable API contract.
   */
  compilerNote?: string;
  /** Predicted likelihood that the compiler will bail out */
  bailoutLikelihood: BailoutLikelihood;
  /**
   * Confidence that the AST detection correctly identified the pattern.
   * Distinct from bailoutLikelihood — see types.ts for explanation.
   */
  detectionConfidence: DetectionConfidence;
  /** Which optimisation category this violation blocks */
  blockedOptimization: string;
}

export const RULE_TO_BAILOUT_MAP: ReadonlyMap<string, BailoutMapping> = new Map([

  // ─── Render mutations ──────────────────────────────────────────────────────

  ['no-render-mutation', {
    rule: 'no-render-mutation',
    category: 'mutation-during-render',
    reason:
      'A value is mutated inside the render body. React requires render to ' +
      'be a pure function: calling it twice with the same inputs must produce ' +
      'the same output. Mutations break this guarantee and prevent the ' +
      'compiler from safely skipping re-renders.',
    compilerNote: 'Compiler cannot create a stable reactive scope around a mutated value.',
    bailoutLikelihood: 'definite',
    detectionConfidence: 'high',
    blockedOptimization: 'Reactive-scope memoization',
  }],

  ['no-prop-state-mutation', {
    rule: 'no-prop-state-mutation',
    category: 'mutation-during-render',
    reason:
      'A prop or state value is mutated during render. Props and state must ' +
      'be treated as read-only. Mutating them during render violates the ' +
      'Rules of React and prevents the compiler from relying on referential ' +
      'stability to decide when to skip re-renders.',
    compilerNote: 'Compiler relies on referential equality of props/state to drive skip decisions.',
    bailoutLikelihood: 'definite',
    detectionConfidence: 'high',
    blockedOptimization: 'Auto-memoization of component output',
  }],

  ['no-global-variable-mutation', {
    rule: 'no-global-variable-mutation',
    category: 'global-mutation',
    reason:
      'A module-level (shared) variable is mutated during render. Render must ' +
      'not produce side effects on values shared across component instances. ' +
      'The compiler cannot safely memoize a component whose output depends on ' +
      'externally-mutated shared state.',
    bailoutLikelihood: 'definite',
    detectionConfidence: 'high',
    blockedOptimization: 'Full-component memoization',
  }],

  ['no-mutation-after-jsx', {
    rule: 'no-mutation-after-jsx',
    category: 'mutation-during-render',
    reason:
      'A value is mutated after being used in a JSX expression. The compiler ' +
      'attempts to hoist JSX into stable cached outputs, but a post-capture ' +
      'mutation means the cached output may be stale by the end of the render.',
    compilerNote: 'Compiler tracks the last write to a value; post-JSX mutations create ordering hazards.',
    bailoutLikelihood: 'definite',
    detectionConfidence: 'high',
    blockedOptimization: 'JSX reactive-scope memoization',
  }],

  // ─── Ref access in render ──────────────────────────────────────────────────

  ['no-ref-read-in-render', {
    rule: 'no-ref-read-in-render',
    category: 'ref-access-in-render',
    reason:
      'ref.current is read during the render phase. Refs are intentionally ' +
      'excluded from React\'s reactivity system — their value changes without ' +
      'triggering re-renders. The compiler cannot include ref values in ' +
      'reactive scopes, making memoized output based on ref.current unreliable.',
    compilerNote: 'Ref values are opaque to the compiler\'s dataflow graph.',
    bailoutLikelihood: 'likely',
    detectionConfidence: 'medium',
    // 'medium' because we may have false positives (e.g. lazy ref init patterns)
    // and refs-in-render aren't always a compiler bailout — depends on scope.
    blockedOptimization: 'Reactive-scope dependency tracking',
  }],

  ['no-ref-as-dependency', {
    rule: 'no-ref-as-dependency',
    category: 'ref-access-in-render',
    reason:
      'A ref object is listed as a hook dependency. Ref objects are stable ' +
      'references (same object every render) but their .current value changes ' +
      'imperatively without notifying React. Using a ref as a dependency ' +
      'creates a stale-closure hazard that the compiler cannot reason about.',
    bailoutLikelihood: 'likely',
    detectionConfidence: 'high',
    blockedOptimization: 'Hook dependency memoization',
  }],

  // ─── Impure calls ──────────────────────────────────────────────────────────

  ['no-impure-calls', {
    rule: 'no-impure-calls',
    category: 'impure-call-in-render',
    reason:
      'An impure function (e.g. Math.random, Date.now) is called during render. ' +
      'Render must be deterministic. Impure calls produce a different value on ' +
      'every call, so the compiler cannot safely cache a render whose output ' +
      'depends on their return value.',
    bailoutLikelihood: 'definite',
    detectionConfidence: 'high',
    blockedOptimization: 'Deterministic reactive-scope memoization',
  }],

  // ─── DOM globals ───────────────────────────────────────────────────────────

  ['no-dom-globals-in-render', {
    rule: 'no-dom-globals-in-render',
    category: 'dom-access-during-render',
    reason:
      'A browser global (window, document, localStorage, etc.) is accessed ' +
      'during render. Browser globals are not part of React\'s reactive model ' +
      'and are unavailable in server-rendering environments. The compiler ' +
      'cannot track them as reactive inputs or outputs.',
    compilerNote: 'Accessing DOM APIs during render also breaks server components.',
    bailoutLikelihood: 'definite',
    detectionConfidence: 'high',
    blockedOptimization: 'Isomorphic reactive-scope generation',
  }],

  // ─── Timers ────────────────────────────────────────────────────────────────

  ['no-timer-in-render', {
    rule: 'no-timer-in-render',
    category: 'timer-in-render',
    reason:
      'setTimeout or setInterval is called during the render phase. Timer ' +
      'registration is a side effect. Calling it in render means a new timer ' +
      'is registered on every render — a correctness bug that the compiler ' +
      'cannot resolve through memoization.',
    bailoutLikelihood: 'definite',
    detectionConfidence: 'high',
    blockedOptimization: 'Render-phase memoization',
  }],

  // ─── State updates in render ───────────────────────────────────────────────

  ['no-set-state-in-render', {
    rule: 'no-set-state-in-render',
    category: 'state-update-during-render',
    reason:
      'A state updater (setState or useReducer dispatch) is called ' +
      'unconditionally during the render phase. This creates an infinite ' +
      're-render loop. The compiler cannot and will not attempt to memoize ' +
      'a component with this pattern.',
    bailoutLikelihood: 'definite',
    detectionConfidence: 'high',
    blockedOptimization: 'Full-component memoization',
  }],

  // ─── Conditional hooks ─────────────────────────────────────────────────────

  ['no-conditional-hooks', {
    rule: 'no-conditional-hooks',
    category: 'conditional-hook',
    reason:
      'A hook is called inside a conditional branch or loop, violating the ' +
      'Rules of Hooks. The compiler requires a stable, unconditional hook-call ' +
      'order to build its reactive scope graph. Conditional hooks make this ' +
      'order unpredictable.',
    bailoutLikelihood: 'definite',
    detectionConfidence: 'high',
    blockedOptimization: 'Reactive-scope graph construction',
  }],

  // ─── Async components ──────────────────────────────────────────────────────

  ['no-async-component', {
    rule: 'no-async-component',
    category: 'async-component',
    reason:
      'The component function is declared async. The compiler only processes ' +
      'synchronous components. An async component returns a Promise instead ' +
      'of a React element, which the compiler cannot model.',
    compilerNote: 'Server Components (Next.js App Router) intentionally use async — suppress this rule if appropriate.',
    bailoutLikelihood: 'definite',
    detectionConfidence: 'high',
    blockedOptimization: 'Full-component compilation',
  }],

  // ─── Nested components ─────────────────────────────────────────────────────

  ['no-nested-components', {
    rule: 'no-nested-components',
    category: 'nested-component-definition',
    reason:
      'A React component or hook is defined inside another component\'s render ' +
      'body. This creates a new function reference on every render, which ' +
      'prevents the inner component from ever receiving stable props and defeats ' +
      'any memoization applied to it.',
    compilerNote: 'The compiler may bail out of both the inner and outer component.',
    bailoutLikelihood: 'definite',
    detectionConfidence: 'high',
    blockedOptimization: 'Inner-component memoization',
  }],

  // ─── Unstable values ───────────────────────────────────────────────────────

  ['no-unstable-default-props', {
    rule: 'no-unstable-default-props',
    category: 'unstable-value',
    reason:
      'An object or array literal is used as a prop default value inside the ' +
      'function signature. Each render creates a new reference for that default ' +
      'value, making prop-equality comparisons always fail and causing ' +
      'unnecessary downstream re-renders.',
    bailoutLikelihood: 'likely',
    detectionConfidence: 'high',
    blockedOptimization: 'Prop-dependency reactive-scope stability',
  }],

  ['no-unstable-jsx-key', {
    rule: 'no-unstable-jsx-key',
    category: 'unstable-value',
    reason:
      'A JSX element inside a list is missing a stable key, or uses an impure ' +
      'expression as the key. Keys identify list items across renders. Without ' +
      'stable keys, React and the compiler cannot correctly match memoized ' +
      'outputs to their corresponding DOM nodes.',
    bailoutLikelihood: 'likely',
    detectionConfidence: 'high',
    blockedOptimization: 'List-item reactive-scope memoization',
  }],

]);

/**
 * Look up the bailout mapping for a rule name.
 * Returns a safe "unknown" mapping when no specific entry exists.
 */
export function getBailoutMapping(ruleName: string): BailoutMapping {
  return (
    RULE_TO_BAILOUT_MAP.get(ruleName) ?? {
      rule: ruleName,
      category: 'unknown',
      reason:
        `Rule "${ruleName}" is not yet classified in the compiler-analysis map. ` +
        'The pattern may or may not affect compiler optimisation.',
      bailoutLikelihood: 'possible',
      detectionConfidence: 'low',
      blockedOptimization: 'Unknown',
    }
  );
}
