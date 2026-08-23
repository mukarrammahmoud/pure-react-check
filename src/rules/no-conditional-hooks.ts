import type { NodePath } from '@babel/traverse' with { 'resolution-mode': 'import' };
import type * as t from '@babel/types' with { 'resolution-mode': 'import' };
import type { AnalysisRule } from './types.js';
import { isReactComponentOrHook } from './utils.js';

function isHookCall(node: t.CallExpression): string | null {
  const callee = node.callee;
  if (callee.type === 'Identifier' && /^use[A-Z]/.test(callee.name)) {
    return callee.name;
  }
  if (
    callee.type === 'MemberExpression' &&
    !callee.computed &&
    callee.property.type === 'Identifier' &&
    /^use[A-Z]/.test(callee.property.name)
  ) {
    return callee.property.name;
  }
  return null;
}

type ConditionalNodePath =
  | NodePath<t.IfStatement>
  | NodePath<t.ConditionalExpression>
  | NodePath<t.LogicalExpression>
  | NodePath<t.SwitchStatement>
  | NodePath<t.ForStatement>
  | NodePath<t.ForInStatement>
  | NodePath<t.ForOfStatement>
  | NodePath<t.WhileStatement>
  | NodePath<t.DoWhileStatement>;

function getConditionalAncestor(
  path: NodePath<t.CallExpression>
): ConditionalNodePath | null {
  let current: NodePath<t.Node> | null = path.parentPath as NodePath<t.Node> | null;
  while (current) {
    if (
      current.isIfStatement() ||
      current.isConditionalExpression() ||
      current.isLogicalExpression() ||
      current.isSwitchStatement() ||
      current.isForStatement() ||
      current.isForInStatement() ||
      current.isForOfStatement() ||
      current.isWhileStatement() ||
      current.isDoWhileStatement()
    ) {
      return current as ConditionalNodePath;
    }
    // Stop traversal at the nearest React component/hook boundary
    if (current.isFunction() && isReactComponentOrHook(current)) break;
    current = current.parentPath as NodePath<t.Node> | null;
  }
  return null;
}

function isInsideNestedCallback(path: NodePath<t.CallExpression>): boolean {
  let current: NodePath<t.Node> | null = path.parentPath as NodePath<t.Node> | null;
  let depth = 0;
  while (current) {
    if (current.isFunction()) {
      depth++;
      if (depth > 1) return true; // More than one function boundary deep
      if (isReactComponentOrHook(current)) return false;
    }
    current = current.parentPath as NodePath<t.Node> | null;
  }
  return false;
}

function isInsideReactComponent(path: NodePath<t.CallExpression>): boolean {
  let current: NodePath<t.Node> | null = path.parentPath as NodePath<t.Node> | null;
  while (current) {
    if (current.isFunction() && isReactComponentOrHook(current)) return true;
    current = current.parentPath as NodePath<t.Node> | null;
  }
  return false;
}

export const noConditionalHooksRule: AnalysisRule = {
  name: 'no-conditional-hooks',
  visitors: (context) => ({
    CallExpression(path: NodePath<t.CallExpression>) {
      const hookName = isHookCall(path.node);
      if (!hookName) return;
      if (!isInsideReactComponent(path)) return;

      const conditionalAncestor = getConditionalAncestor(path);
      if (conditionalAncestor) {
        const kind = conditionalAncestor.isIfStatement() || conditionalAncestor.isConditionalExpression()
          ? 'conditional branch'
          : conditionalAncestor.isLogicalExpression()
            ? 'logical expression'
            : conditionalAncestor.isSwitchStatement()
              ? 'switch statement'
              : 'loop';

        context.report(path, {
          rule: 'no-conditional-hooks',
          message: `Calls hook '${hookName}' inside a ${kind}. Hooks must be called at the top level of a React component or hook.`,
          recommendation:
            'Move the hook call to the top level of the component. Use conditions inside the hook callback body instead.',
        });
        return;
      }

      if (isInsideNestedCallback(path)) {
        context.report(path, {
          rule: 'no-conditional-hooks',
          message: `Calls hook '${hookName}' inside a nested function. Hooks must be called at the top level of a React component or hook.`,
          recommendation:
            'Move the hook call to the top level of the component, not inside nested callbacks or helper functions.',
        });
      }
    },
  }),
};
