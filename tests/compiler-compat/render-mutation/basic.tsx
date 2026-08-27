// Rule: no-render-mutation
export function RenderMutationComp() {
  let count = 0;
  count = count + 1; // Direct mutation of local variable during render
  return <div>{count}</div>;
}
