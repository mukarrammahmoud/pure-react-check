/**
 * Dataflow & Alias Tracking Abstraction (v2)
 *
 * Provides bounded alias tracking for local variables within a component render scope.
 * Tracks variable -> variable, variable -> property, and destructured aliases
 * to detect indirect mutations (e.g. `const { user } = props; user.name = 'foo'`).
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
 * Determine the alias kind based on a source name and existing aliases.
 */
function resolveKind(sourceName: string, aliases: AliasMap): AliasKind {
  if (sourceName === 'props') return 'prop';
  if (sourceName === 'state') return 'state';

  const parentAlias = aliases.get(sourceName);
  if (parentAlias) {
    if (parentAlias.kind === 'prop') return 'prop';
    if (parentAlias.kind === 'state') return 'state';
  }

  return 'property';
}

/**
 * Builds a bounded alias map for a component render function.
 *
 * Handles:
 *  - Simple variable aliasing: `const a = b`
 *  - Property aliasing: `const a = props.user`
 *  - Object destructuring: `const { user, settings } = props`
 *  - Nested destructuring: `const { user: { name } } = props`
 *  - Array destructuring: `const [first, second] = items`
 *  - Rest patterns in destructuring: `const { x, ...rest } = props`
 */
export function buildScopeAliasMap(funcPath: NodePath<t.Function>): AliasMap {
  const aliases: AliasMap = new Map();

  funcPath.traverse({
    VariableDeclarator(declaratorPath) {
      const id = declaratorPath.node.id;
      const init = declaratorPath.node.init;

      if (!init) return;

      const line = declaratorPath.node.loc?.start.line ?? 0;

      // Case 1: Simple identifier binding (const a = b)
      if (id.type === 'Identifier') {
        if (init.type === 'Identifier') {
          aliases.set(id.name, {
            sourceName: init.name,
            aliasName: id.name,
            kind: resolveKind(init.name, aliases),
            line,
          });
        }
        // Case 2: Property access (const a = props.user)
        else if (init.type === 'MemberExpression') {
          let objectNode: t.Expression | t.Super = init.object;
          while (objectNode.type === 'MemberExpression') {
            objectNode = objectNode.object;
          }

          if (objectNode.type === 'Identifier') {
            const rawName = objectNode.name;
            const parentAlias = aliases.get(rawName);
            const sourceName = parentAlias ? parentAlias.sourceName : rawName;
            const kind = resolveKind(sourceName, aliases);

            aliases.set(id.name, {
              sourceName,
              aliasName: id.name,
              kind,
              line,
            });
          }
        }
      }
      // Case 3: Object destructuring (const { user, settings } = props)
      else if (id.type === 'ObjectPattern') {
        const sourceName = resolveInitSourceName(init, aliases);
        if (sourceName) {
          collectObjectPatternAliases(id, sourceName, aliases, line);
        }
      }
      // Case 4: Array destructuring (const [first, second] = items)
      else if (id.type === 'ArrayPattern') {
        const sourceName = resolveInitSourceName(init, aliases);
        if (sourceName) {
          collectArrayPatternAliases(id, sourceName, aliases, line);
        }
      }
    },
  });

  return aliases;
}

/**
 * Resolve the source name from an initializer expression.
 */
function resolveInitSourceName(init: t.Expression, aliases: AliasMap): string | null {
  if (init.type === 'Identifier') {
    const existing = aliases.get(init.name);
    return existing ? existing.sourceName : init.name;
  }
  if (init.type === 'MemberExpression') {
    let objectNode: t.Expression | t.Super = init.object;
    while (objectNode.type === 'MemberExpression') {
      objectNode = objectNode.object;
    }
    if (objectNode.type === 'Identifier') {
      const existing = aliases.get(objectNode.name);
      return existing ? existing.sourceName : objectNode.name;
    }
  }
  return null;
}

/**
 * Collect aliases from an ObjectPattern destructuring.
 * Handles nested patterns, rest elements, and computed properties.
 */
function collectObjectPatternAliases(
  pattern: t.ObjectPattern,
  sourceName: string,
  aliases: AliasMap,
  line: number,
): void {
  for (const prop of pattern.properties) {
    if (prop.type === 'RestElement') {
      // const { x, ...rest } = props → rest aliases props
      if (prop.argument.type === 'Identifier') {
        aliases.set(prop.argument.name, {
          sourceName,
          aliasName: prop.argument.name,
          kind: resolveKind(sourceName, aliases),
          line,
        });
      }
      continue;
    }

    // ObjectProperty: { user } or { user: renamed } or { user: { nested } }
    const value = prop.value;

    if (value.type === 'Identifier') {
      aliases.set(value.name, {
        sourceName,
        aliasName: value.name,
        kind: resolveKind(sourceName, aliases),
        line,
      });
    } else if (value.type === 'AssignmentPattern' && value.left.type === 'Identifier') {
      // const { user = defaultUser } = props
      aliases.set(value.left.name, {
        sourceName,
        aliasName: value.left.name,
        kind: resolveKind(sourceName, aliases),
        line,
      });
    } else if (value.type === 'ObjectPattern') {
      // Nested: const { user: { name } } = props
      collectObjectPatternAliases(value, sourceName, aliases, line);
    } else if (value.type === 'ArrayPattern') {
      collectArrayPatternAliases(value, sourceName, aliases, line);
    }
  }
}

/**
 * Collect aliases from an ArrayPattern destructuring.
 */
function collectArrayPatternAliases(
  pattern: t.ArrayPattern,
  sourceName: string,
  aliases: AliasMap,
  line: number,
): void {
  for (const element of pattern.elements) {
    if (!element) continue; // skip holes

    if (element.type === 'Identifier') {
      aliases.set(element.name, {
        sourceName,
        aliasName: element.name,
        kind: resolveKind(sourceName, aliases),
        line,
      });
    } else if (element.type === 'RestElement' && element.argument.type === 'Identifier') {
      aliases.set(element.argument.name, {
        sourceName,
        aliasName: element.argument.name,
        kind: resolveKind(sourceName, aliases),
        line,
      });
    } else if (element.type === 'AssignmentPattern' && element.left.type === 'Identifier') {
      aliases.set(element.left.name, {
        sourceName,
        aliasName: element.left.name,
        kind: resolveKind(sourceName, aliases),
        line,
      });
    } else if (element.type === 'ObjectPattern') {
      collectObjectPatternAliases(element, sourceName, aliases, line);
    } else if (element.type === 'ArrayPattern') {
      collectArrayPatternAliases(element, sourceName, aliases, line);
    }
  }
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
