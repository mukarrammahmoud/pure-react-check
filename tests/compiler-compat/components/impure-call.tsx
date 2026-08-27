// Rule: no-impure-calls
export function ImpureCallInRenderComp() {
  const randomId = Math.random(); // Impure call during render
  return <div id={String(randomId)}>impure</div>;
}
