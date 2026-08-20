import type { NodePath } from '@babel/traverse' with { 'resolution-mode': 'import' };
import type * as t from '@babel/types' with { 'resolution-mode': 'import' };
import type { AnalysisRule } from './types.js';
import { getRenderComponent, isLazyRefInit } from './utils.js';

function isRefCurrentAssignment(path: NodePath<t.AssignmentExpression>): boolean {
  const left = path.node.left;
  return (
    left.type === 'MemberExpression' &&
    !left.computed &&
    left.property.type === 'Identifier' &&
    left.property.name === 'current'
  );
}

export const noRenderMutationRule: AnalysisRule = {
  name: 'no-render-mutation',
  visitors: (context) => ({
    AssignmentExpression(path: NodePath<t.AssignmentExpression>) {
      if (!getRenderComponent(path)) return;
      if (isLazyRefInit(path)) return;

      const refMutation = isRefCurrentAssignment(path);
      context.report(path, {
        rule: 'no-render-mutation',
        message: refMutation
          ? `Mutates ref.current with '${path.node.operator}' during render.`
          : `Mutates a value with '${path.node.operator}' directly during render.`,
        recommendation: refMutation
          ? 'Move the ref mutation into an event handler or effect.'
          : 'Move the mutation into an event handler or effect.',
      });
    },
  }),
};

