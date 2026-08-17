Overview
The React Compiler revolutionizes React application performance by introducing automatic memoization. However, if a component violates the Rules of React—such as mutating local/external variables during the render phase or accessing refs unsafely—the compiler silently bails out. It skips optimizing that component without throwing a runtime error, leaving your app without the expected performance gains.

pure-react-check bridges this visibility gap. By scanning your codebase's Abstract Syntax Tree (AST), it detects impure rendering logic, anti-patterns, and rule violations early in the development cycle. It provides actionable insights to help developers write clean, pure React components, ensuring 100% compatibility with the React Compiler.

Key Features
🔍 Impurity Detection: Instantly flags variable mutations and unsafe side effects inside the render phase.

⚡ Compiler Readiness Index: Gives a precise breakdown of how many components in your project are ready for automatic memoization.

📍 Precision Reporting: Pinpoints the exact file, line number, and component causing a compiler bailout.

🚀 Fast AST Analysis: Lightweight static analysis engine that won't slow down your build or development workflow.

🛡️ CI/CD Ready: Integrates easily into pull request checks to prevent impure code from reaching production.