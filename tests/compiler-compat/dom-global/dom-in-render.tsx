// Rule: no-dom-globals-in-render
export function DomGlobalInRenderComp() {
  const width = window.innerWidth; // DOM global read during render
  return <div>{width}</div>;
}
