import type { NodePath } from '@babel/traverse' with { 'resolution-mode': 'import' };
import type * as t from '@babel/types' with { 'resolution-mode': 'import' };
import type { AnalysisRule } from './types.js';
import { getRenderComponent } from './utils.js';

const TIMER_GLOBALS: ReadonlySet<string> = new Set([
  'setTimeout',
  'setInterval',
  'clearTimeout',
  'clearInterval',
  'requestAnimationFrame',
  'cancelAnimationFrame',
]);

function getTimerName(node: t.CallExpression): string | null {
  const callee = node.callee;
  if (callee.type === 'Identifier' && TIMER_GLOBALS.has(callee.name)) {
    return callee.name;
  }
  if (
    callee.type === 'MemberExpression' &&
    !callee.computed &&
    callee.object.type === 'Identifier' &&
    callee.object.name === 'window' &&
    callee.property.type === 'Identifier' &&
    TIMER_GLOBALS.has(callee.property.name)
  ) {
    return `window.${callee.property.name}`;
  }
  return null;
}

export const noTimerInRenderRule: AnalysisRule = {
  name: 'no-timer-in-render',
  visitors: (context) => ({
    CallExpression(path: NodePath<t.CallExpression>) {
      const timerName = getTimerName(path.node);
      if (!timerName) return;
      if (!getRenderComponent(path)) return;

      context.report(path, {
        rule: 'no-timer-in-render',
        message: `Calls '${timerName}' directly during render. Timer side effects run on every render and cannot be cleaned up, causing memory leaks.`,
        recommendation: `Move '${timerName}' inside a useEffect with a cleanup return function (clearTimeout / clearInterval).`,
      });
    },
  }),
};
