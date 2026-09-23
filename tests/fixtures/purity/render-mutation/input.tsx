let renderCount = 0;

export function RenderMutationComponent({ label }: { label: string }) {
  renderCount++;
  return <div>{label}: {renderCount}</div>;
}
