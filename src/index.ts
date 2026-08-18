import { scanDirectory } from './scanner.js';

async function main(): Promise<void> {
  const target = process.argv[2] ?? './';
  const result = await scanDirectory(target);

  for (const violation of result.violations) {
    console.log(`${violation.filePath}:${violation.line} [${violation.rule}]`);
    console.log(`  ${violation.message}`);
    console.log(`  Fix: ${violation.recommendation}\n`);
  }

  for (const error of result.errors) {
    console.error(`${error.filePath}: Could not parse file`);
    console.error(`  ${error.message}\n`);
  }

  console.log(`Scanned files: ${result.files.length}`);
  console.log(`Total violations: ${result.violations.length}`);

  if (result.errors.length > 0) {
    console.log(`Parse errors: ${result.errors.length}`);
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
