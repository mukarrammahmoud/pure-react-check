// Rule: no-global-variable-mutation
let globalCounter = 0;

export function GlobalMutationComp() {
  globalCounter += 1; // Mutation of module-level variable during render
  return <div>{globalCounter}</div>;
}
