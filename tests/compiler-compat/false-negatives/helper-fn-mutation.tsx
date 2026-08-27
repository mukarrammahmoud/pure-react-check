// False Negative Case: Synchronous helper function mutating outer variable
let globalState = 0;

function mutateGlobal() {
  globalState += 1;
}

export function HelperFnMutationComp() {
  mutateGlobal(); // Helper called synchronously in render
  return <div>{globalState}</div>;
}
