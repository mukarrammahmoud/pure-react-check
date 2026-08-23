import type { NodePath } from '@babel/traverse' with { 'resolution-mode': 'import' };
import type * as t from '@babel/types' with { 'resolution-mode': 'import' };
import type { AnalysisRule } from './types.js';
import { isLazyRefInit, isRenderPhase } from './utils.js';

function isRefCurrentRead(path: NodePath<t.MemberExpression>): boolean {
  const node = path.node;
  if (node.computed) {
    if (node.property.type !== 'StringLiteral' || node.property.value !== 'current') {
      return false;
    }
  } else {
    if (node.property.type !== 'Identifier' || node.property.name !== 'current') {
      return false;
    }
  }

  // Exclude writes: left side of assignment expression
  const parentPath = path.parentPath;
  if (parentPath.isAssignmentExpression() && parentPath.node.left === node) {
    return false;
  }

  // Exclude update expressions (e.g. ref.current++)
  if (parentPath.isUpdateExpression()) {
    return false;
  }

  return true;
}



export const noRefReadInRenderRule: AnalysisRule = {
  name: 'no-ref-read-in-render',
  visitors: (context) => ({
    MemberExpression(path: NodePath<t.MemberExpression>) {
      if (!isRefCurrentRead(path)) return;
      if (!isRenderPhase(path)) return;
      if (isLazyRefInit(path)) return;

      context.report(path, {
        rule: 'no-ref-read-in-render',
        message: "Reads 'ref.current' during render. Component render must be pure and deterministic.",
        recommendation:
          'Move ref access to an effect (useEffect), an event handler, or use state (useState) instead if you need to trigger a re-render.',
      });
    },
  }),
};
