// Rule: no-nested-components
export function OuterComp() {
  function InnerChildComp() {
    return <span>inner</span>;
  }
  return <div><InnerChildComp /></div>;
}
