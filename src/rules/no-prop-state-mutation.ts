import type { NodePath } from "@babel/traverse" with {
  "resolution-mode": "import",
};
import type * as t from "@babel/types" with { "resolution-mode": "import" };
import type { AnalysisRule } from "./types.js";
import { getRenderComponent } from "./utils.js";
import { buildScopeAliasMap, resolveAliasSource } from "./dataflow.js";

const mutatingMethods = new Set([
  "push",
  "pop",
  "splice",
  "sort",
  "reverse",
  "shift",
  "unshift",
]);

function hasPropsOrStateRoot(expression: t.Node, compPath: NodePath<t.Function> | null): boolean {
  let current: t.Node = expression;
  while (
    current.type === "MemberExpression" ||
    current.type === "OptionalMemberExpression"
  )
    current = current.object;

  if (current.type !== "Identifier") return false;

  if (/^(props|state|items)$/.test(current.name)) {
    return true;
  }

  // Use Dataflow Alias Map to check indirect aliases (e.g. const obj = props.user)
  if (compPath) {
    const aliasMap = buildScopeAliasMap(compPath);
    const aliasSource = resolveAliasSource(current.name, aliasMap);
    if (aliasSource && (aliasSource.kind === 'prop' || aliasSource.kind === 'state' || /^(props|state|items)$/.test(aliasSource.sourceName))) {
      return true;
    }
  }

  return false;
}

export const noPropStateMutationRule: AnalysisRule = {
  name: "no-prop-state-mutation",
  visitors: (context) => ({
    AssignmentExpression(path: NodePath<t.AssignmentExpression>) {
      const compPath = getRenderComponent(path);
      if (
        !compPath ||
        path.node.left.type !== "MemberExpression" ||
        !hasPropsOrStateRoot(path.node.left, compPath)
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
      const compPath = getRenderComponent(path);
      if (
        !compPath ||
        callee.type !== "MemberExpression" ||
        callee.property.type !== "Identifier" ||
        !mutatingMethods.has(callee.property.name) ||
        !hasPropsOrStateRoot(callee.object, compPath)
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
      const compPath = getRenderComponent(path);
      if (
        path.node.operator !== "delete" ||
        !compPath ||
        argument.type !== "MemberExpression" ||
        !hasPropsOrStateRoot(argument, compPath)
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
