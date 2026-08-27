// Definite bailout: browser global access in render
export function AccessesDomInRender() {
  const title = document.title; // DOM global during render
  return <div>{title}</div>;
}
