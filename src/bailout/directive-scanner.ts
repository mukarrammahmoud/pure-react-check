/**
 * Directive Scanner
 *
 * Detects "use no memo" and "use memo" string directives in source files.
 * These are React Compiler opt-in / opt-out markers that the compiler
 * recognises natively.
 *
 * This module runs as a *separate* AST pass over the same files the main
 * scanner has already processed, so it never interferes with the main rules.
 */

import type { NodePath } from '@babel/traverse' with { 'resolution-mode': 'import' };
import type * as t from '@babel/types' with { 'resolution-mode': 'import' };
import type { CompilerDirective, DirectiveKind } from './types.js';

const DIRECTIVE_VALUES: ReadonlyMap<string, DirectiveKind> = new Map([
  ['use no memo', 'use-no-memo'],
  ['use memo', 'use-memo'],
]);

/**
 * Try to extract a compiler directive from a node that might be a string
 * literal directive (e.g. `"use no memo"` at the top of a function body).
 */
function getDirectiveKind(node: t.Node): DirectiveKind | null {
  // Babel represents directives inside BlockStatements as `Directive` nodes
  if (node.type === 'Directive' && node.value.type === 'DirectiveLiteral') {
    return DIRECTIVE_VALUES.get(node.value.value) ?? null;
  }
  // Also handle plain ExpressionStatement with a StringLiteral (older transforms)
  if (
    node.type === 'ExpressionStatement' &&
    node.expression.type === 'StringLiteral'
  ) {
    return DIRECTIVE_VALUES.get(node.expression.value) ?? null;
  }
  return null;
}

/** Walk up the AST to find the enclosing function name, if any. */
function getEnclosingFunctionName(path: NodePath<t.Node>): string | null {
  let current: NodePath<t.Node> | null = path.parentPath;
  while (current) {
    if (current.isFunction()) {
      const fn = current.node;
      if ('id' in fn && fn.id && fn.id.type === 'Identifier') {
        return fn.id.name;
      }
      if (current.parentPath?.isVariableDeclarator()) {
        const id = current.parentPath.node.id;
        if (id.type === 'Identifier') return id.name;
      }
    }
    current = current.parentPath;
  }
  return null;
}

/**
 * Build the Babel visitors needed to collect compiler directives from an AST.
 *
 * @param filePath   – relative path of the file being traversed
 * @param collected  – mutable array to push found directives into
 */
export function buildDirectiveVisitors(
  filePath: string,
  collected: CompilerDirective[],
) {
  function handleNode(path: NodePath<t.Node>): void {
    const kind = getDirectiveKind(path.node);
    if (!kind) return;

    const line = path.node.loc?.start.line ?? 0;

    // A directive is module-level when its immediate parent is the Program body
    const isModuleLevel =
      (path.parentPath?.isProgram() ||
        (path.parentPath?.isExpressionStatement()
          ? path.parentPath.parentPath?.isProgram()
          : false)) ??
      false;

    const componentName = isModuleLevel
      ? null
      : getEnclosingFunctionName(path);

    collected.push({
      kind,
      filePath,
      line,
      componentName,
      isModuleLevel: Boolean(isModuleLevel),
    });
  }

  return {
    Directive(path: NodePath<t.Directive>) {
      handleNode(path as NodePath<t.Node>);
    },
    ExpressionStatement(path: NodePath<t.ExpressionStatement>) {
      // Only match string literal expressions (directive-style)
      if (path.node.expression.type === 'StringLiteral') {
        handleNode(path as NodePath<t.Node>);
      }
    },
  };
}
