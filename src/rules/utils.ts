import type { NodePath } from '@babel/traverse' with { 'resolution-mode': 'import' };
import type * as t from '@babel/types' with { 'resolution-mode': 'import' };

export function isReactComponent(funcPath: NodePath<t.Function>): boolean {
  if (funcPath.isFunctionDeclaration()) {
    const name = funcPath.node.id?.name;
    return Boolean(name && /^[A-Z]/.test(name));
  }

  if (funcPath.isArrowFunctionExpression() || funcPath.isFunctionExpression()) {
    const parent = funcPath.parentPath;
    if (!parent?.isVariableDeclarator()) return false;

    const idPath = parent.get('id');
    return idPath.isIdentifier() && /^[A-Z]/.test(idPath.node.name);
  }

  return false;
}

export function getRenderComponent(path: NodePath<t.Node>): NodePath<t.Function> | null {
  const functionPath = path.getFunctionParent();
  return functionPath && isReactComponent(functionPath) ? functionPath : null;
}
