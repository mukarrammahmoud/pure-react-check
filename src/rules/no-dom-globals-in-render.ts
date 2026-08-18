import type { NodePath } from "@babel/traverse" with {
  "resolution-mode": "import",
};
import type * as t from "@babel/types" with { "resolution-mode": "import" };
import type { AnalysisRule } from "./types.js";
import { getRenderComponent } from "./utils.js";

const domGlobals = new Set([
  "document",
  "window",
  "localStorage",
  "sessionStorage",
  "navigator",
  "location",
]);

function getGlobalRoot(expression: t.Node): string | null {
  let current: t.Node = expression;
  while (
    current.type === "MemberExpression" ||
    current.type === "OptionalMemberExpression"
  )
    current = current.object;
  return current.type === "Identifier" && domGlobals.has(current.name)
    ? current.name
    : null;
}

export const noDomGlobalsInRenderRule: AnalysisRule = {
  name: "no-dom-globals-in-render",
  visitors: (context) => ({
    MemberExpression(path: NodePath<t.MemberExpression>) {
      if (!getRenderComponent(path) || !getGlobalRoot(path.node)) return;
      if (
        path.parentPath.isMemberExpression() ||
        (path.parentPath.isCallExpression() &&
          path.parentPath.node.callee === path.node)
      )
        return;
      context.report(path, {
        rule: "no-dom-globals-in-render",
        message: "Reads or accesses a browser DOM global during render.",
        recommendation:
          "Move browser global access into useEffect or an event handler.",
      });
    },
    CallExpression(path: NodePath<t.CallExpression>) {
      const callee = path.node.callee;
      const globalRoot =
        callee.type === "MemberExpression" ? getGlobalRoot(callee) : null;
      const isFetch = callee.type === "Identifier" && callee.name === "fetch";
      if (!getRenderComponent(path) || (!globalRoot && !isFetch)) return;
      context.report(path, {
        rule: "no-dom-globals-in-render",
        message: `Calls a browser side effect${globalRoot ? ` on ${globalRoot}` : ""} during render.`,
        recommendation: "Move side effects to useEffect or an event handler.",
      });
    },
  }),
};
