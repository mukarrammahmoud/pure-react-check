import type { NodePath } from '@babel/traverse' with { 'resolution-mode': 'import' };
import type * as t from '@babel/types' with { 'resolution-mode': 'import' };
import type { AnalysisRule } from './types.js';
import { getRenderComponent } from './utils.js';

const IMPURE_KEY_CALLS: ReadonlySet<string> = new Set([
  'Math.random',
  'Date.now',
  'crypto.randomUUID',
]);

function isImpureCall(node: t.Node): string | null {
  if (node.type !== 'CallExpression') return null;
  const callee = node.callee;
  if (
    callee.type === 'MemberExpression' &&
    !callee.computed &&
    callee.object.type === 'Identifier' &&
    callee.property.type === 'Identifier'
  ) {
    const name = `${callee.object.name}.${callee.property.name}`;
    return IMPURE_KEY_CALLS.has(name) ? name : null;
  }
  return null;
}

function getKeyAttr(jsxOpeningElement: t.JSXOpeningElement): t.JSXAttribute | undefined {
  return jsxOpeningElement.attributes.find(
    (attr): attr is t.JSXAttribute =>
      attr.type === 'JSXAttribute' &&
      attr.name.type === 'JSXIdentifier' &&
      attr.name.name === 'key'
  );
}

function isInsideMapCallback(path: NodePath<t.Node>): boolean {
  let current = path.parentPath;
  while (current) {
    if (
      current.isCallExpression() &&
      current.node.callee.type === 'MemberExpression' &&
      !current.node.callee.computed &&
      current.node.callee.property.type === 'Identifier' &&
      current.node.callee.property.name === 'map'
    ) {
      return true;
    }
    // Stop at the component boundary
    if (current.isFunction()) {
      return false;
    }
    current = current.parentPath;
  }
  return false;
}

export const noUnstableJsxKeyRule: AnalysisRule = {
  name: 'no-unstable-jsx-key',
  visitors: (context) => ({
    JSXOpeningElement(path: NodePath<t.JSXOpeningElement>) {
      if (!getRenderComponent(path)) return;

      // Only check elements that appear inside a .map() callback
      if (!isInsideMapCallback(path)) return;

      const keyAttr = getKeyAttr(path.node);

      // Missing key entirely
      if (!keyAttr) {
        context.report(path, {
          rule: 'no-unstable-jsx-key',
          message: 'JSX element inside .map() is missing a "key" prop. React cannot efficiently reconcile lists without stable keys.',
          recommendation:
            'Add a stable, unique key prop from your data (e.g. key={item.id}). Never use the array index as a key when the list can be reordered or filtered.',
        });
        return;
      }

      // Key present but uses an impure value
      const value = keyAttr.value;
      if (
        value &&
        value.type === 'JSXExpressionContainer' &&
        value.expression.type !== 'JSXEmptyExpression'
      ) {
        const impureName = isImpureCall(value.expression);
        if (impureName) {
          context.report(path, {
            rule: 'no-unstable-jsx-key',
            message: `JSX key uses '${impureName}()', which generates a new value on every render. This forces React to remount the element on every update.`,
            recommendation:
              'Use a stable identifier from your data (e.g. item.id or item.slug) as the key.',
          });
        }
      }
    },
  }),
};
