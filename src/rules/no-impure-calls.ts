import type { NodePath } from '@babel/traverse' with { 'resolution-mode': 'import' };
import type * as t from '@babel/types' with { 'resolution-mode': 'import' };
import type { AnalysisRule } from './types.js';
import { getRenderComponent } from './utils.js';

function getImpureCallName(path: NodePath<t.CallExpression>): string | null {
  const callee = path.node.callee;
  if (callee.type !== 'MemberExpression' || callee.computed) return null;
  if (callee.object.type !== 'Identifier' || callee.property.type !== 'Identifier') return null;

  if (callee.object.name === 'Math' && callee.property.name === 'random') return 'Math.random()';
  if (callee.object.name === 'Date' && callee.property.name === 'now') return 'Date.now()';
  return null;
}

export const noImpureCallsRule: AnalysisRule = {
  name: 'no-impure-calls',
  visitors: (context) => ({
    CallExpression(path: NodePath<t.CallExpression>) {
      const callName = getImpureCallName(path);
      if (!callName || !getRenderComponent(path)) return;

      context.report(path, {
        rule: 'no-impure-calls',
        message: `Calls ${callName} directly during render.`,
        recommendation: 'Move the call into an event handler or an appropriate effect/memoization boundary.',
      });
    },
  }),
};
