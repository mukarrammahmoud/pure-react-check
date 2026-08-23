import type { NodePath } from '@babel/traverse' with { 'resolution-mode': 'import' };
import type * as t from '@babel/types' with { 'resolution-mode': 'import' };
import type { AnalysisRule } from './types.js';
import { getRenderComponent } from './utils.js';

/**
 * Collect all `let` and `var` identifiers declared at module scope
 * (top-level VariableDeclarations that are NOT inside any function/class).
 */
function collectModuleScopeLetVar(programPath: NodePath<t.Program>): Set<string> {
  const names = new Set<string>();
  for (const stmt of programPath.node.body) {
    if (stmt.type !== 'VariableDeclaration') continue;
    if (stmt.kind === 'const') continue; // const cannot be re-assigned
    for (const decl of stmt.declarations) {
      if (decl.id.type === 'Identifier') names.add(decl.id.name);
    }
  }
  return names;
}

export const noGlobalVariableMutationRule: AnalysisRule = {
  name: 'no-global-variable-mutation',
  visitors: (context) => ({
    Program(programPath: NodePath<t.Program>) {
      const moduleScopeVars = collectModuleScopeLetVar(programPath);
      if (moduleScopeVars.size === 0) return;

      programPath.traverse({
        AssignmentExpression(path: NodePath<t.AssignmentExpression>) {
          if (!getRenderComponent(path)) return;
          const left = path.node.left;
          if (left.type !== 'Identifier') return;
          if (!moduleScopeVars.has(left.name)) return;

          context.report(path, {
            rule: 'no-global-variable-mutation',
            message: `Mutates module-level variable '${left.name}' inside a render function. Renders must be pure and free of side effects.`,
            recommendation:
              'Use useState or useReducer to track mutable values inside components instead of module-level variables.',
          });
        },
        UpdateExpression(path: NodePath<t.UpdateExpression>) {
          if (!getRenderComponent(path)) return;
          const arg = path.node.argument;
          if (arg.type !== 'Identifier') return;
          if (!moduleScopeVars.has(arg.name)) return;

          context.report(path, {
            rule: 'no-global-variable-mutation',
            message: `Mutates module-level variable '${arg.name}' (${path.node.operator}) inside a render function.`,
            recommendation:
              'Use useState or useRef inside the component to track mutable counters or flags.',
          });
        },
      });
    },
  }),
};
