/**
 * Rule → Compiler Bailout Mapping (v2)
 *
 * Maps each pure-react-check rule to:
 *  - Stable category
 *  - Rule impact classification (compiler-bailout | compiler-risk | react-pattern | best-practice)
 *  - Tool-authored reason
 *  - Optional compilerNote
 *  - Bailout likelihood
 *  - Detection confidence
 *  - Blocked optimization
 */

import type {
  BailoutCategory,
  BailoutLikelihood,
  DetectionConfidence,
  RuleImpact,
} from './types.js';

export interface BailoutMapping {
  /** The pure-react-check rule name */
  rule: string;
  /** Stable category */
  category: BailoutCategory;
  /** Rule impact classification */
  impact: RuleImpact;
  /** Tool-authored explanation of why this pattern is problematic */
  reason: string;
  /** Supplementary note about React Compiler behaviour */
  compilerNote?: string;
  /** Predicted likelihood that the compiler will bail out */
  bailoutLikelihood: BailoutLikelihood;
  /** Confidence that the AST detection correctly identified the pattern */
  detectionConfidence: DetectionConfidence;
  /** Which optimisation category this violation blocks */
  blockedOptimization: string;
}

export const RULE_TO_BAILOUT_MAP: ReadonlyMap<string, BailoutMapping> = new Map([

  // ─── Render mutations (Definite Compiler Bailouts) ─────────────────────────

  ['no-render-mutation', {
    rule: 'no-render-mutation',
    category: 'mutation-during-render',
    impact: 'compiler-bailout',
    reason:
      'A value is mutated inside the render body. React requires render to ' +
      'be a pure function: calling it twice with the same inputs must produce ' +
      'the same output. Mutations break this guarantee and force compiler bailout.',
    compilerNote: 'Compiler cannot create a stable reactive scope around a mutated value.',
    bailoutLikelihood: 'definite',
    detectionConfidence: 'high',
    blockedOptimization: 'Reactive-scope memoization',
  }],

  ['no-prop-state-mutation', {
    rule: 'no-prop-state-mutation',
    category: 'mutation-during-render',
    impact: 'compiler-bailout',
    reason:
      'A prop or state value is mutated during render. Props and state must ' +
      'be treated as read-only. Mutating them during render violates the ' +
      'Rules of React and forces compiler bailout.',
    compilerNote: 'Compiler relies on referential equality of props/state to drive skip decisions.',
    bailoutLikelihood: 'definite',
    detectionConfidence: 'high',
    blockedOptimization: 'Auto-memoization of component output',
  }],

  ['no-global-variable-mutation', {
    rule: 'no-global-variable-mutation',
    category: 'global-mutation',
    impact: 'compiler-bailout',
    reason:
      'A module-level (shared) variable is mutated during render. Render must ' +
      'not produce side effects on values shared across component instances. ' +
      'The compiler cannot safely memoize a component with external side effects.',
    bailoutLikelihood: 'definite',
    detectionConfidence: 'high',
    blockedOptimization: 'Full-component memoization',
  }],

  ['no-mutation-after-jsx', {
    rule: 'no-mutation-after-jsx',
    category: 'mutation-during-render',
    impact: 'compiler-bailout',
    reason:
      'A value is mutated after being used in a JSX expression. The compiler ' +
      'hoists JSX into stable cached outputs, but post-capture mutations create ' +
      'ordering hazards that cause compiler bailout.',
    compilerNote: 'Compiler tracks writes to values; post-JSX mutations create ordering hazards.',
    bailoutLikelihood: 'definite',
    detectionConfidence: 'high',
    blockedOptimization: 'JSX reactive-scope memoization',
  }],

  // ─── Ref access in render (Compiler Risk) ──────────────────────────────────

  ['no-ref-read-in-render', {
    rule: 'no-ref-read-in-render',
    category: 'ref-access-in-render',
    impact: 'compiler-risk',
    reason:
      'ref.current is read during render. Refs are intentionally excluded from ' +
      'React\'s reactivity system — their value changes without triggering re-renders. ' +
      'The compiler cannot include ref values in reactive scopes, creating optimization risks.',
    compilerNote: 'Ref values are opaque to the compiler\'s dataflow graph.',
    bailoutLikelihood: 'likely',
    detectionConfidence: 'medium',
    blockedOptimization: 'Reactive-scope dependency tracking',
  }],

  ['no-ref-as-dependency', {
    rule: 'no-ref-as-dependency',
    category: 'ref-access-in-render',
    impact: 'compiler-risk',
    reason:
      'A ref object is listed as a hook dependency. Ref objects are stable ' +
      'references but their .current value changes imperatively without notifying React. ' +
      'Using a ref as a dependency creates a stale-closure hazard.',
    bailoutLikelihood: 'likely',
    detectionConfidence: 'high',
    blockedOptimization: 'Hook dependency memoization',
  }],

  // ─── Impure calls (Definite Compiler Bailout) ──────────────────────────────

  ['no-impure-calls', {
    rule: 'no-impure-calls',
    category: 'impure-call-in-render',
    impact: 'compiler-bailout',
    reason:
      'An impure function (Math.random, Date.now) is called during render. ' +
      'Render must be deterministic. Impure calls produce a different value on ' +
      'every call, forcing compiler bailout.',
    bailoutLikelihood: 'definite',
    detectionConfidence: 'high',
    blockedOptimization: 'Deterministic reactive-scope memoization',
  }],

  // ─── DOM globals (Definite Compiler Bailout) ───────────────────────────────

  ['no-dom-globals-in-render', {
    rule: 'no-dom-globals-in-render',
    category: 'dom-access-during-render',
    impact: 'compiler-bailout',
    reason:
      'A browser global (window, document, localStorage) is accessed during render. ' +
      'Browser globals are not part of React\'s reactive model, causing compiler bailout.',
    compilerNote: 'Accessing DOM APIs during render also breaks server components.',
    bailoutLikelihood: 'definite',
    detectionConfidence: 'high',
    blockedOptimization: 'Isomorphic reactive-scope generation',
  }],

  // ─── Timers (Definite Compiler Bailout) ────────────────────────────────────

  ['no-timer-in-render', {
    rule: 'no-timer-in-render',
    category: 'timer-in-render',
    impact: 'compiler-bailout',
    reason:
      'setTimeout or setInterval is called during the render phase. Timer ' +
      'registration is a side effect that forces compiler bailout.',
    bailoutLikelihood: 'definite',
    detectionConfidence: 'high',
    blockedOptimization: 'Render-phase memoization',
  }],

  // ─── State updates in render (Definite Compiler Bailout) ───────────────────

  ['no-set-state-in-render', {
    rule: 'no-set-state-in-render',
    category: 'state-update-during-render',
    impact: 'compiler-bailout',
    reason:
      'A state updater (setState or dispatch) is called unconditionally during ' +
      'render. This creates an infinite re-render loop and forces compiler bailout.',
    bailoutLikelihood: 'definite',
    detectionConfidence: 'high',
    blockedOptimization: 'Full-component memoization',
  }],

  // ─── Conditional hooks (Definite Compiler Bailout) ─────────────────────────

  ['no-conditional-hooks', {
    rule: 'no-conditional-hooks',
    category: 'conditional-hook',
    impact: 'compiler-bailout',
    reason:
      'A hook is called inside a conditional branch or loop, violating the ' +
      'Rules of Hooks. The compiler requires a stable, unconditional hook-call ' +
      'order to build its reactive scope graph.',
    bailoutLikelihood: 'definite',
    detectionConfidence: 'high',
    blockedOptimization: 'Reactive-scope graph construction',
  }],

  // ─── Async components (Definite Compiler Bailout) ──────────────────────────

  ['no-async-component', {
    rule: 'no-async-component',
    category: 'async-component',
    impact: 'compiler-bailout',
    reason:
      'The client component function is declared async. The React Compiler only ' +
      'processes synchronous client components.',
    compilerNote: 'Server Components intentionally use async — suppress if appropriate.',
    bailoutLikelihood: 'definite',
    detectionConfidence: 'high',
    blockedOptimization: 'Full-component compilation',
  }],

  // ─── Nested components (React Pattern Concern) ─────────────────────────────

  ['no-nested-components', {
    rule: 'no-nested-components',
    category: 'nested-component-definition',
    impact: 'react-pattern',
    reason:
      'A component or hook function is defined inside another component\'s render body. ' +
      'This creates a new function reference every render, defeating prop stability. ' +
      'While the compiler may still optimize inner expressions, it is a severe React anti-pattern.',
    compilerNote: 'Compiler bailout is NOT guaranteed; the compiler may optimize inner function expressions.',
    bailoutLikelihood: 'possible',
    detectionConfidence: 'high',
    blockedOptimization: 'Prop reference stability across outer renders',
  }],

  // ─── Unstable values (Compiler Risk) ───────────────────────────────────────

  ['no-unstable-default-props', {
    rule: 'no-unstable-default-props',
    category: 'unstable-value',
    impact: 'compiler-risk',
    reason:
      'An object or array literal is used as a prop default value inside the function signature. ' +
      'Each fallback render creates a new reference, creating referential stability risks for downstream memoization.',
    compilerNote: 'Compiler bailout is NOT guaranteed when explicit props are provided at call sites.',
    bailoutLikelihood: 'possible',
    detectionConfidence: 'high',
    blockedOptimization: 'Prop-dependency reactive-scope stability',
  }],

  ['no-unstable-jsx-key', {
    rule: 'no-unstable-jsx-key',
    category: 'unstable-value',
    impact: 'compiler-risk',
    reason:
      'A JSX element inside a list is missing a stable key or uses an impure key. ' +
      'Without stable keys, memoized outputs cannot be matched reliably across list updates.',
    bailoutLikelihood: 'likely',
    detectionConfidence: 'high',
    blockedOptimization: 'List-item reactive-scope memoization',
  }],

]);

/**
 * Look up the bailout mapping for a rule name.
 * Returns a safe "best-practice" mapping when no specific entry exists.
 */
export function getBailoutMapping(ruleName: string): BailoutMapping {
  return (
    RULE_TO_BAILOUT_MAP.get(ruleName) ?? {
      rule: ruleName,
      category: 'unknown',
      impact: 'best-practice',
      reason:
        `Rule "${ruleName}" is not yet classified in the compiler-analysis map. ` +
        'The pattern may or may not affect compiler optimisation.',
      bailoutLikelihood: 'possible',
      detectionConfidence: 'low',
      blockedOptimization: 'Unknown',
    }
  );
}
