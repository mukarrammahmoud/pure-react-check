import { allRules } from './rules/index.js';
import type { AnalysisRule, Violation } from './rules/types.js';

export interface ScanError {
  filePath: string;
  message: string;
}

export interface ScanResult {
  files: string[];
  violations: Violation[];
  errors: ScanError[];
}

const SOURCE_PATTERN = '**/*.{js,jsx,ts,tsx}';
const rules: AnalysisRule[] = allRules;

function normalizePath(filePath: string): string {
  return filePath.replaceAll('\\', '/');
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function scanDirectory(targetDir: string): Promise<ScanResult> {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const parser = await import('@babel/parser');
  const traverseModule = await import('@babel/traverse');
  const fastGlobModule = await import('fast-glob');

  const traverse = traverseModule.default;
  const fastGlob = fastGlobModule.default;
  const absoluteTarget = path.resolve(targetDir);
  const targetStats = fs.existsSync(absoluteTarget) ? fs.statSync(absoluteTarget) : null;

  let absoluteFiles: string[];
  if (targetStats?.isFile()) {
    absoluteFiles = [absoluteTarget];
  } else if (targetStats?.isDirectory()) {
    absoluteFiles = await fastGlob(SOURCE_PATTERN, {
      absolute: true,
      cwd: absoluteTarget,
      ignore: ['**/node_modules/**'],
      onlyFiles: true,
    });
  } else {
    absoluteFiles = await fastGlob(targetDir, {
      absolute: true,
      cwd: process.cwd(),
      ignore: ['**/node_modules/**'],
      onlyFiles: true,
    });
  }

  absoluteFiles.sort((left, right) => left.localeCompare(right));
  const files = absoluteFiles.map((filePath) => normalizePath(path.relative(process.cwd(), filePath)));
  const violations: Violation[] = [];
  const errors: ScanError[] = [];

  for (const [index, absoluteFile] of absoluteFiles.entries()) {
    const filePath = files[index];

    try {
      const code = fs.readFileSync(absoluteFile, 'utf-8');
      const ast = parser.parse(code, {
        sourceType: 'unambiguous',
        plugins: ['jsx', 'typescript'],
      });

      for (const rule of rules) {
        traverse(ast, rule.visitors({
          filePath,
          report(nodePath, violation) {
            violations.push({
              ...violation,
              filePath,
              line: nodePath.node.loc?.start.line ?? 0,
            });
          },
        }));
      }
    } catch (error: unknown) {
      errors.push({ filePath, message: getErrorMessage(error) });
    }
  }

  return { files, violations, errors };
}
