import type { NodePath } from '@babel/traverse' with { 'resolution-mode': 'import' };
import type * as t from '@babel/types' with { 'resolution-mode': 'import' };

function getFunctionName(path: NodePath<t.Function>): string | null {
  if ('id' in path.node && path.node.id && 'name' in path.node.id) {
    return path.node.id.name;
  }
  if (path.parentPath?.isVariableDeclarator()) {
    const id = path.parentPath.node.id;
    if (id.type === 'Identifier') return id.name;
  }
  if (path.parentPath?.isAssignmentExpression()) {
    const left = path.parentPath.node.left;
    if (left.type === 'Identifier') return left.name;
    if (left.type === 'MemberExpression' && left.property.type === 'Identifier') {
      return left.property.name;
    }
  }
  return null;
}

export function isReactComponent(funcPath: NodePath<t.Function>): boolean {
  const name = getFunctionName(funcPath);
  if (name && /^[A-Z]/.test(name)) return true;

  if (funcPath.parentPath?.isCallExpression()) {
    const callee = funcPath.parentPath.node.callee;
    let calleeName = '';
    if (callee.type === 'Identifier') calleeName = callee.name;
    else if (callee.type === 'MemberExpression' && callee.property.type === 'Identifier') {
      calleeName = callee.property.name;
    }
    if (['memo', 'forwardRef'].includes(calleeName)) return true;
  }

  return false;
}

export function isReactComponentOrHook(funcPath: NodePath<t.Function>): boolean {
  const name = getFunctionName(funcPath);
  if (name && (/^[A-Z]/.test(name) || /^use[A-Z]/.test(name))) {
    return true;
  }

  if (funcPath.parentPath?.isCallExpression()) {
    const callee = funcPath.parentPath.node.callee;
    let calleeName = '';
    if (callee.type === 'Identifier') calleeName = callee.name;
    else if (callee.type === 'MemberExpression' && callee.property.type === 'Identifier') {
      calleeName = callee.property.name;
    }
    if (['memo', 'forwardRef'].includes(calleeName)) return true;
  }

  return false;
}

const DEFERRED_HOOKS = new Set([
  'useEffect',
  'useLayoutEffect',
  'useInsertionEffect',
  'useCallback',
]);

/**
 * Determines whether an AST node is executed synchronously during the render phase
 * of a React component or hook.
 *
 * Rules:
 *  1. Inside JSX event attributes (e.g. onClick={() => ...}) -> FALSE
 *  2. Inside deferred hook callbacks (useEffect, useCallback, etc.) -> FALSE
 *  3. Inside nested helper / callback functions (not a component or hook) -> FALSE
 *  4. Directly in the body of a React component or hook -> TRUE
 */
export function isRenderPhase(path: NodePath<t.Node>): boolean {
  let current: NodePath<t.Node> | null = path.parentPath;

  while (current) {
    if (current.isJSXAttribute()) {
      const name = current.node.name;
      if (name.type === 'JSXIdentifier' && /^on[A-Z]/.test(name.name)) {
        return false;
      }
    }

    if (current.isCallExpression()) {
      const callee = current.node.callee;
      let hookName = '';
      if (callee.type === 'Identifier') hookName = callee.name;
      else if (callee.type === 'MemberExpression' && callee.property.type === 'Identifier') {
        hookName = callee.property.name;
      }
      if (DEFERRED_HOOKS.has(hookName)) {
        return false;
      }
    }

    if (current.isFunction()) {
      // The first (innermost) function node we encounter determines execution scope:
      // If it's a React Component or Hook, path is directly in its render body.
      // If it's any other nested function (callback, helper, event handler), it's deferred!
      return isReactComponentOrHook(current);
    }

    current = current.parentPath;
  }

  return false;
}

export function getRenderComponent(path: NodePath<t.Node>): NodePath<t.Function> | null {
  if (!isRenderPhase(path)) return null;

  let current: NodePath<t.Node> | null = path;
  while (current) {
    if (current.isFunction() && isReactComponentOrHook(current)) {
      return current;
    }
    current = current.parentPath;
  }

  return null;
}

export function isLazyRefInit(path: NodePath<t.Node>): boolean {
  const ifStmt = path.findParent((p) => p.isIfStatement());
  if (!ifStmt || !ifStmt.isIfStatement()) return false;

  const testPath = ifStmt.get('test');
  const consequentPath = ifStmt.get('consequent');

  let testChecksRef = false;
  testPath.traverse({
    MemberExpression(memberPath) {
      if (
        !memberPath.node.computed &&
        memberPath.node.property.type === 'Identifier' &&
        memberPath.node.property.name === 'current'
      ) {
        testChecksRef = true;
      }
    },
  });

  let consequentAssignsRef = false;
  consequentPath.traverse({
    AssignmentExpression(assignPath) {
      const left = assignPath.node.left;
      if (
        left.type === 'MemberExpression' &&
        !left.computed &&
        left.property.type === 'Identifier' &&
        left.property.name === 'current'
      ) {
        consequentAssignsRef = true;
      }
    },
  });

  return testChecksRef && consequentAssignsRef;
}
