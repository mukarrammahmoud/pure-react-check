async function main() {
  const fsModule = await import('node:fs');
  const parser = await import('@babel/parser');
  const traverseModule = await import('@babel/traverse');

  const fs = fsModule.default;
  const traverse = traverseModule.default || traverseModule;

  console.log('🔍 [pure-react-check] Running Scope-Aware Scan...\n');

  const code = fs.readFileSync('./sample.jsx', 'utf-8');

  const ast = parser.parse(code, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
  });

  let violationsCount = 0;

/**
 * Helper: Checks if a given function path represents a React Component.
 * React components typically start with a capital letter (e.g., UserProfile).
 */
  function isReactComponent(funcPath) {
    if (!funcPath) return false;

    // Case 1: function UserProfile() {}
    if (funcPath.isFunctionDeclaration()) {
      const name = funcPath.node.id?.name;
      return Boolean(name && /^[A-Z]/.test(name));
    }

    // Case 2: const UserProfile = () => {}
    if (funcPath.isArrowFunctionExpression() || funcPath.isFunctionExpression()) {
      const parent = funcPath.parentPath;
      if (parent && parent.isVariableDeclarator()) {
        const name = parent.node.id?.name;
        return Boolean(name && /^[A-Z]/.test(name));
      }
    }

    return false;
  }

  traverse(ast, {
    AssignmentExpression(path) {
      // 1. Find the closest enclosing function for this assignment
      const enclosingFunction = path.getFunctionParent();

      // 2. Assignments directly inside a component execute during render.
      if (enclosingFunction && isReactComponent(enclosingFunction)) {
        const line = path.node.loc?.start.line;
        const operator = path.node.operator;

        violationsCount++;
        console.log(`  Render-Phase Impurity at Line ${line}:`);
        console.log(`   Found assignment operator '${operator}' directly in component render body.`);
        console.log('   💡 Move this logic into an event handler or useEffect hook.\n');
      }
    },
  });

  if (violationsCount === 0) {
    console.log(' Code is pure and ready for React Compiler optimization!');
  } else {
    console.log(` Found ${violationsCount} render-phase violation(s).`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
