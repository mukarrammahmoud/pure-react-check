import type { NodePath } from '@babel/traverse' with { 'resolution-mode': 'import' };
import type * as t from '@babel/types' with { 'resolution-mode': 'import' };
import type { AnalysisRule } from './types.js';
import { isReactComponent } from './utils.js';

type FunctionLikePath =
  | NodePath<t.FunctionDeclaration>
  | NodePath<t.FunctionExpression>
  | NodePath<t.ArrowFunctionExpression>;

function checkParams(path: FunctionLikePath, context: Parameters<AnalysisRule['visitors']>[0]): void {
  if (!isReactComponent(path)) return;

  const params = path.node.params;
  // Only look at the first param — props destructuring
  if (params.length === 0) return;
  const firstParam = params[0];

  if (firstParam.type !== 'ObjectPattern' && firstParam.type !== 'AssignmentPattern') return;

  // Collect destructured properties
  const properties: t.ObjectProperty[] = [];

  if (firstParam.type === 'ObjectPattern') {
    for (const prop of firstParam.properties) {
      if (prop.type === 'ObjectProperty') properties.push(prop);
    }
  } else if (
    firstParam.type === 'AssignmentPattern' &&
    firstParam.left.type === 'ObjectPattern'
  ) {
    for (const prop of firstParam.left.properties) {
      if (prop.type === 'ObjectProperty') properties.push(prop);
    }
  }

  for (const prop of properties) {
    if (prop.value.type !== 'AssignmentPattern') continue;
    const defaultValue = prop.value.right;

    const isUnstable =
      defaultValue.type === 'ArrayExpression' ||
      defaultValue.type === 'ObjectExpression' ||
      defaultValue.type === 'ArrowFunctionExpression' ||
      defaultValue.type === 'FunctionExpression' ||
      defaultValue.type === 'NewExpression';

    if (!isUnstable) continue;

    const propName =
      prop.key.type === 'Identifier'
        ? prop.key.name
        : prop.key.type === 'StringLiteral'
          ? prop.key.value
          : '(unknown)';

    const kind =
      defaultValue.type === 'ArrayExpression'
        ? 'array literal []'
        : defaultValue.type === 'ObjectExpression'
          ? 'object literal {}'
          : defaultValue.type === 'NewExpression'
            ? 'new expression'
            : 'function/arrow literal';

    context.report(path as NodePath<t.Node>, {
      rule: 'no-unstable-default-props',
      message: `Prop '${propName}' has an unstable ${kind} as a default value. A new reference is created on every render, defeating React Compiler memoization.`,
      recommendation: `Extract the default value to a module-level constant (e.g. const DEFAULT_${propName.toUpperCase()} = ...) and reference it as the default.`,
    });
  }
}

export const noUnstableDefaultPropsRule: AnalysisRule = {
  name: 'no-unstable-default-props',
  visitors: (context) => ({
    FunctionDeclaration(path: NodePath<t.FunctionDeclaration>) {
      checkParams(path, context);
    },
    FunctionExpression(path: NodePath<t.FunctionExpression>) {
      checkParams(path, context);
    },
    ArrowFunctionExpression(path: NodePath<t.ArrowFunctionExpression>) {
      checkParams(path, context);
    },
  }),
};
