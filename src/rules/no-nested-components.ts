import type { NodePath } from "@babel/traverse" with {
  "resolution-mode": "import",
};
import type * as t from "@babel/types" with { "resolution-mode": "import" };
import type { AnalysisRule } from "./types.js";
import { isReactComponent } from "./utils.js";

export const noNestedComponentsRule: AnalysisRule = {
  name: "no-nested-components",
  visitors: (context) => ({
    FunctionDeclaration(path: NodePath<t.FunctionDeclaration>) {
      const parent = path.getFunctionParent();
      if (!isReactComponent(path) || !parent || !isReactComponent(parent))
        return;
      context.report(path, {
        rule: "no-nested-components",
        message: `Defines component '${path.node.id?.name ?? "anonymous"}' inside another component.`,
        recommendation: "Move the nested component to module scope.",
      });
    },
    ArrowFunctionExpression(path: NodePath<t.ArrowFunctionExpression>) {
      const parent = path.getFunctionParent();
      if (!isReactComponent(path) || !parent || !isReactComponent(parent))
        return;
      context.report(path, {
        rule: "no-nested-components",
        message:
          "Defines an arrow-function component inside another component.",
        recommendation: "Move the nested component to module scope.",
      });
    },
    FunctionExpression(path: NodePath<t.FunctionExpression>) {
      const parent = path.getFunctionParent();
      if (!isReactComponent(path) || !parent || !isReactComponent(parent))
        return;
      context.report(path, {
        rule: "no-nested-components",
        message: "Defines a function component inside another component.",
        recommendation: "Move the nested component to module scope.",
      });
    },
  }),
};
