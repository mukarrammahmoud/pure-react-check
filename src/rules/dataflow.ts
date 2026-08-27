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
      // Case 2: Variable aliasing property (e.g. const a = props.user)
      else if (init.type === 'MemberExpression') {
        const objectNode = init.object;
        if (objectNode.type === 'Identifier') {
          const sourceName = objectNode.name;
          const kind: AliasKind =
            sourceName === 'props' ? 'prop' :
            sourceName === 'state' ? 'state' : 'property';

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
 * Resolves whether a variable name is an alias of a prop or state reference.
 */
export function resolveAliasSource(name: string, aliasMap: AliasMap): AliasBinding | null {
  const direct = aliasMap.get(name);
  if (!direct) return null;

  // Resolve chained aliases (e.g. const a = props; const b = a;)
  const parent = aliasMap.get(direct.sourceName);
  if (parent) {
    return {
      sourceName: parent.sourceName,
      aliasName: name,
      kind: parent.kind,
      line: direct.line,
    };
  }

  return direct;
}
