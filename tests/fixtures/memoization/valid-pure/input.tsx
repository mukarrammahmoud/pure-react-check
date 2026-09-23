export function ValidPureComponent({ title, count }: { title: string; count: number }) {
  const formatted = `${title.toUpperCase()}: ${count * 2}`;
  return <div className="card"><span>{formatted}</span></div>;
}
