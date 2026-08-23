import type { NodePath } from '@babel/traverse' with { 'resolution-mode': 'import' };
import type * as t from '@babel/types' with { 'resolution-mode': 'import' };
import type { AnalysisRule } from './types.js';

const MEMOIZATION_HOOKS: ReadonlySet<string> = new Set([
  'useMemo',
  'useCallback',
  'useEffect',
  'useLayoutEffect',
  'useInsertionEffect',
]);

function getMemoHookName(callExpr: t.CallExpression): string | null {
  const callee = callExpr.callee;
  if (callee.type === 'Identifier' && MEMOIZATION_HOOKS.has(callee.name)) {
    return callee.name;
  }
  if (
    callee.type === 'MemberExpression' &&
    !callee.computed &&
    callee.property.type === 'Identifier' &&
    MEMOIZATION_HOOKS.has(callee.property.name)
  ) {
    return callee.property.name;
  }
  return null;
}

function isDepsArray(callExpr: t.CallExpression, arrayNode: t.ArrayExpression): boolean {
  // The deps array is always the last argument (2nd for useMemo/useCallback, 2nd for useEffect, etc.)
  const args = callExpr.arguments;
  return args.length >= 2 && args[args.length - 1] === arrayNode;
}

function isRefCurrentAccess(node: t.Node): string | null {
  if (
    node.type === 'MemberExpression' &&
    !node.computed &&
    node.property.type === 'Identifier' &&
    node.property.name === 'current' &&
    node.object.type === 'Identifier'
  ) {
    return node.object.name;
  }
  return null;
}

export const noRefAsDependencyRule: AnalysisRule = {
  name: 'no-ref-as-dependency',
  visitors: (context) => ({
    ArrayExpression(path: NodePath<t.ArrayExpression>) {
      // Check if this array is the deps argument of a memoization hook
      const parent = path.parentPath;
      if (!parent.isCallExpression()) return;
      const hookName = getMemoHookName(parent.node);
      if (!hookName) return;
      if (!isDepsArray(parent.node, path.node)) return;

      for (const element of path.node.elements) {
        if (!element || element.type === 'SpreadElement') continue;
        const refName = isRefCurrentAccess(element);
        if (!refName) continue;

        context.report(path, {
          rule: 'no-ref-as-dependency',
          message: `'${refName}.current' is used in the dependency array of '${hookName}'. Ref mutations do not trigger re-renders, so this dependency will never cause the hook to re-run.`,
          recommendation:
            `Remove '${refName}.current' from the dependency array. If you need to react to ref changes, convert it to state with useState instead.`,
        });
      }
    },
  }),
};
