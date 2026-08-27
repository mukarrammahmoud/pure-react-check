// Rule: no-unstable-default-props
export function UnstableDefaultPropsComp({ config = { theme: 'dark' } }: { config?: { theme: string } }) {
  return <div>{config.theme}</div>;
}
