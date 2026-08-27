/**
 * Dataflow & Alias Tracking Abstraction (v1)
 *
 * Provides bounded alias tracking for local variables within a component render scope.
 * Tracks variable -> variable and variable -> property aliases to detect indirect mutations
 * (e.g. `const obj = props.user; obj.name = 'foo'`).
 */

import type { NodePath } from '@babel/traverse' with { 'resolution-mode': 'import' };
import type * as t from '@babel/types' with { 'resolution-mode': 'import' };

export type AliasKind = 'variable' | 'property' | 'prop' | 'state';

export interface AliasBinding {
  sourceName: string;
  aliasName: string;
  kind: AliasKind;
  line: number;
}

export type AliasMap = Map<string, AliasBinding>;

export interface AnalysisScope {
  componentName?: string;
  aliases: AliasMap;
}

/**
 * Builds a bounded alias map for a component render function.
 */
export function buildScopeAliasMap(funcPath: NodePath<t.Function>): AliasMap {
  const aliases: AliasMap = new Map();

  funcPath.traverse({
    VariableDeclarator(declaratorPath) {
      const id = declaratorPath.node.id;
      const init = declaratorPath.node.init;

      if (!init || id.type !== 'Identifier') return;

      const aliasName = id.name;
      const line = declaratorPath.node.loc?.start.line ?? 0;

      // Case 1: Variable aliasing variable (e.g. const a = b)
      if (init.type === 'Identifier') {
        aliases.set(aliasName, {
          sourceName: init.name,
          aliasName,
          kind: 'variable',
          line,
        });
      }
      // Case 2: Variable aliasing property (e.g. const a = props.user or const v = target.settings)
      else if (init.type === 'MemberExpression') {
        let objectNode: t.Expression | t.Super = init.object;
        while (objectNode.type === 'MemberExpression') {
          objectNode = objectNode.object;
        }

        if (objectNode.type === 'Identifier') {
          const rawName = objectNode.name;
          const parentAlias = aliases.get(rawName);
          const sourceName = parentAlias ? parentAlias.sourceName : rawName;
          const kind: AliasKind =
            sourceName === 'props' || parentAlias?.kind === 'prop' ? 'prop' :
            sourceName === 'state' || parentAlias?.kind === 'state' ? 'state' : 'property';

          aliases.set(aliasName, {
            sourceName,
            aliasName,
            kind,
            line,
          });
        }
      }
    },
  });

  return aliases;
}

/**
 * Resolves whether a variable name is an alias of a prop or state reference,
 * walking up chained alias links up to a max depth.
 */
export function resolveAliasSource(
  name: string,
  aliasMap: AliasMap,
  maxDepth = 10,
): AliasBinding | null {
  let currentName = name;
  let currentBinding = aliasMap.get(currentName);
  let depth = 0;

  let resolvedKind: AliasKind | null = null;
  let finalSourceName: string | null = null;
  const initialLine = currentBinding?.line ?? 0;

  while (currentBinding && depth < maxDepth) {
    if (currentBinding.kind === 'prop' || currentBinding.kind === 'state') {
      resolvedKind = currentBinding.kind;
      finalSourceName = currentBinding.sourceName;
    }
    const nextBinding = aliasMap.get(currentBinding.sourceName);
    if (!nextBinding) {
      if (!finalSourceName) finalSourceName = currentBinding.sourceName;
      if (!resolvedKind) resolvedKind = currentBinding.kind;
      break;
    }
    currentName = currentBinding.sourceName;
    currentBinding = nextBinding;
    depth++;
  }

  if (!finalSourceName || !resolvedKind) return null;

  return {
    sourceName: finalSourceName,
    aliasName: name,
    kind: resolvedKind,
    line: initialLine,
  };
}
