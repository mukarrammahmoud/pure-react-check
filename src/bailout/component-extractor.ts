/**
 * Component Extractor
 *
 * Identifies every React component and custom hook that appears in source files.
 * Correctly distinguishes between components (PascalCase) and hooks (useCamelCase).
 * Captures both start line and end line for accurate line-range violation attribution.
 */

import type { NodePath } from '@babel/traverse' with { 'resolution-mode': 'import' };
import type * as t from '@babel/types' with { 'resolution-mode': 'import' };

export interface DetectedComponent {
  name: string;
  filePath: string;
  /** 1-based start line of the function */
  line: number;
  /** 1-based end line of the function */
  endLine: number;
}

function getFunctionName(node: t.Function, parent: t.Node | null): string | null {
  if ('id' in node && node.id && node.id.type === 'Identifier') {
    return node.id.name;
  }
  if (parent && parent.type === 'VariableDeclarator' && parent.id.type === 'Identifier') {
    return parent.id.name;
  }
  return null;
}

/**
 * A name is a React component or hook when:
 * - Starts with an uppercase letter (component convention)
 * - Starts with "use" followed by an uppercase letter (hook convention)
 */
function isComponentOrHook(name: string): boolean {
  return /^[A-Z]/.test(name) || /^use[A-Z]/.test(name);
}

/**
 * Build Babel visitors that collect all component and hook definitions.
 */
export function buildComponentVisitors(
  filePath: string,
  collected: DetectedComponent[],
) {
  const seen = new Set<string>(); // "name:line" to deduplicate

  function handle(path: NodePath<t.Function>): void {
    const parentNode = path.parentPath?.node ?? null;
    const name = getFunctionName(path.node, parentNode);
    if (!name || !isComponentOrHook(name)) return;

    const line = path.node.loc?.start.line ?? 0;
    const endLine = path.node.loc?.end.line ?? line;
    const key = `${name}:${line}`;
    if (seen.has(key)) return;
    seen.add(key);

    collected.push({ name, filePath, line, endLine });
  }

  return {
    FunctionDeclaration(path: NodePath<t.FunctionDeclaration>) {
      handle(path as NodePath<t.Function>);
    },
    FunctionExpression(path: NodePath<t.FunctionExpression>) {
      handle(path as NodePath<t.Function>);
    },
    ArrowFunctionExpression(path: NodePath<t.ArrowFunctionExpression>) {
      handle(path as NodePath<t.Function>);
    },
  };
}
