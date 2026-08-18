import type { NodePath } from "@babel/traverse" with {
  "resolution-mode": "import",
};
import type * as t from "@babel/types" with { "resolution-mode": "import" };
import type { AnalysisRule } from "./types.js";
import { getRenderComponent } from "./utils.js";

const mutatingMethods = new Set([
  "push",
  "pop",
  "splice",
  "sort",
  "reverse",
  "shift",
  "unshift",
]);

function hasPropsOrStateRoot(expression: t.Node): boolean {
  let current: t.Node = expression;
  while (
    current.type === "MemberExpression" ||
    current.type === "OptionalMemberExpression"
  )
    current = current.object;
  return (
    current.type === "Identifier" && /^(props|state|items)$/.test(current.name)
  );
}

export const noPropStateMutationRule: AnalysisRule = {
  name: "no-prop-state-mutation",
  visitors: (context) => ({
    AssignmentExpression(path: NodePath<t.AssignmentExpression>) {
      if (
        !getRenderComponent(path) ||
        path.node.left.type !== "MemberExpression" ||
        !hasPropsOrStateRoot(path.node.left)
      )
        return;
      context.report(path, {
        rule: "no-prop-state-mutation",
        message: "Mutates a prop or state object during render.",
        recommendation:
          "Create a new shallow copy before changing the object or array.",
      });
    },
    CallExpression(path: NodePath<t.CallExpression>) {
      const callee = path.node.callee;
      if (
        !getRenderComponent(path) ||
        callee.type !== "MemberExpression" ||
        callee.property.type !== "Identifier" ||
        !mutatingMethods.has(callee.property.name) ||
        !hasPropsOrStateRoot(callee.object)
      )
        return;
      context.report(path, {
        rule: "no-prop-state-mutation",
        message: "Mutates a prop or state collection during render.",
        recommendation:
          "Create a new shallow copy before changing the object or array.",
      });
    },
    UnaryExpression(path: NodePath<t.UnaryExpression>) {
      const argument = path.node.argument;
      if (
        path.node.operator !== "delete" ||
        !getRenderComponent(path) ||
        argument.type !== "MemberExpression" ||
        !hasPropsOrStateRoot(argument)
      )
        return;
      context.report(path, {
        rule: "no-prop-state-mutation",
        message: "Deletes a prop or state property during render.",
        recommendation:
          "Create a new shallow copy and omit the property instead.",
      });
    },
  }),
};
