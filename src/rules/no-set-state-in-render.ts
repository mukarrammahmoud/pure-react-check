import type { NodePath } from "@babel/traverse" with {
  "resolution-mode": "import",
};
import type * as t from "@babel/types" with { "resolution-mode": "import" };
import type { AnalysisRule } from "./types.js";
import { getRenderComponent } from "./utils.js";

function isStateUpdater(path: NodePath<t.CallExpression>): boolean {
  const callee = path.node.callee;
  if (callee.type !== "Identifier") return false;
  if (callee.name === "setTimeout" || callee.name === "setInterval") return false;
  return callee.name === "dispatch" || /^set[A-Z]/.test(callee.name);
}

export const noSetStateInRenderRule: AnalysisRule = {
  name: "no-set-state-in-render",
  visitors: (context) => ({
    CallExpression(path: NodePath<t.CallExpression>) {
      if (!isStateUpdater(path) || !getRenderComponent(path)) return;
      const name =
        path.node.callee.type === "Identifier"
          ? path.node.callee.name
          : "unknown";
      context.report(path, {
        rule: "no-set-state-in-render",
        message: `Calls state updater '${name}' during render.`,
        recommendation:
          "Call state updaters from an event handler or an effect, not during render.",
      });
    },
  }),
};
