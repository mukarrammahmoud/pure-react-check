import type { NodePath } from '@babel/traverse' with { 'resolution-mode': 'import' };
import type * as t from '@babel/types' with { 'resolution-mode': 'import' };
import type { AnalysisRule } from './types.js';
import { isReactComponent } from './utils.js';

type AsyncFunctionPath =
  | NodePath<t.FunctionDeclaration>
  | NodePath<t.FunctionExpression>
  | NodePath<t.ArrowFunctionExpression>;

function checkAsync(path: AsyncFunctionPath, context: Parameters<AnalysisRule['visitors']>[0]): void {
  if (!path.node.async) return;
  if (!isReactComponent(path)) return;

  const name =
    'id' in path.node && path.node.id?.name
      ? `'${path.node.id.name}'`
      : path.parentPath?.isVariableDeclarator() &&
        path.parentPath.node.id.type === 'Identifier'
        ? `'${path.parentPath.node.id.name}'`
        : 'anonymous';

  context.report(path as NodePath<t.Node>, {
    rule: 'no-async-component',
    message: `Component ${name} is declared as async. Client-side React components cannot be async — this breaks rendering and React Compiler memoization.`,
    recommendation:
      "Remove 'async' from the component. Fetch data with useEffect or a data-fetching library (e.g. SWR, React Query). For Server Components (Next.js App Router), async is allowed — suppress this rule if intentional.",
  });
}

export const noAsyncComponentRule: AnalysisRule = {
  name: 'no-async-component',
  visitors: (context) => ({
    FunctionDeclaration(path: NodePath<t.FunctionDeclaration>) {
      checkAsync(path, context);
    },
    FunctionExpression(path: NodePath<t.FunctionExpression>) {
      checkAsync(path, context);
    },
    ArrowFunctionExpression(path: NodePath<t.ArrowFunctionExpression>) {
      checkAsync(path, context);
    },
  }),
};
