import type { NodePath } from '@babel/traverse' with { 'resolution-mode': 'import' };
import type * as t from '@babel/types' with { 'resolution-mode': 'import' };
import type { AnalysisRule } from './types.js';
import { getRenderComponent } from './utils.js';

function getRootIdentifier(node: t.Node): string | null {
  let current = node;
  while (current.type === 'MemberExpression' || current.type === 'OptionalMemberExpression') {
    current = current.object;
  }
  return current.type === 'Identifier' ? current.name : null;
}

/**
 * Collects all identifiers that appear as JSX attribute values or JSX children
 * within a given function scope, returning their names.
 */
function collectJsxBoundNames(funcPath: NodePath<t.Function>): Set<string> {
  const bound = new Set<string>();

  funcPath.traverse({
    JSXAttribute(attrPath) {
      const value = attrPath.node.value;
      if (!value) return;
      if (value.type === 'JSXExpressionContainer') {
        const root = getRootIdentifier(value.expression);
        if (root) bound.add(root);
      }
    },
    JSXSpreadAttribute(spreadPath) {
      const root = getRootIdentifier(spreadPath.node.argument);
      if (root) bound.add(root);
    },
    JSXExpressionContainer(exprPath) {
      const root = getRootIdentifier(exprPath.node.expression);
      if (root) bound.add(root);
    },
  });

  return bound;
}

export const noMutationAfterJsxRule: AnalysisRule = {
  name: 'no-mutation-after-jsx',
  visitors: (context) => ({
    AssignmentExpression(path: NodePath<t.AssignmentExpression>) {
      const renderComp = getRenderComponent(path);
      if (!renderComp) return;

      const left = path.node.left;
      // Only interested in member-expression mutations (e.g. obj.key = ...)
      if (left.type !== 'MemberExpression') return;

      const root = left.object;
      if (root.type !== 'Identifier') return;

      const jsxBound = collectJsxBoundNames(renderComp);
      if (!jsxBound.has(root.name)) return;

      context.report(path, {
        rule: 'no-mutation-after-jsx',
        message: `Mutates '${root.name}' after it was passed into JSX. React Compiler assumes JSX props are immutable after creation.`,
        recommendation:
          'Create a new derived object/array before constructing the JSX element instead of mutating the original.',
      });
    },
  }),
};
