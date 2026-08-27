/**
 * Compiler Adapter Layer
 *
 * Provides a unified interface to run or simulate the React Compiler.
 * If `babel-plugin-react-compiler` is installed, it can delegate to it.
 * Otherwise, it uses a reference adapter based on React Compiler documented behavior.
 */

import { parse } from '@babel/parser';
import _traverse from '@babel/traverse';
import type { NodePath } from '@babel/traverse' with { 'resolution-mode': 'import' };
import type * as t from '@babel/types' with { 'resolution-mode': 'import' };
import type { CompilerObservation } from './types.js';
import { isLazyRefInit } from '../rules/utils.js';

// Workaround ESM/CJS interop for traverse
const traverse = (typeof _traverse === 'function' ? _traverse : (_traverse as { default: typeof _traverse }).default);

export interface CompilerAdapter {
  name: string;
  version: string;
  isRealCompiler: boolean;
  analyse(source: string, filePath?: string): Promise<CompilerObservation[]>;
}

const DOM_GLOBALS = new Set([
  'window',
  'document',
  'localStorage',
  'sessionStorage',
  'navigator',
  'location',
]);

const IMPURE_GLOBALS = new Set(['Math', 'Date']);
const MUTATING_METHODS = new Set(['push', 'pop', 'splice', 'sort', 'reverse', 'shift', 'unshift']);

// ─── Reference Compiler Adapter ───────────────────────────────────────────────

/**
 * Reference implementation modeling documented React Compiler optimization rules.
 * Used when the compiler package is not installed or available locally.
 *
 * IMPORTANT: Observations produced here carry observationSource = "reference-model".
 * They must NOT be represented as official React Compiler ground truth.
 */
export class ReferenceCompilerAdapter implements CompilerAdapter {
  name = 'Reference Compiler Model';
  version = '19.0.0-reference';
  isRealCompiler = false;

  async analyse(source: string, _filePath = 'inline.tsx'): Promise<CompilerObservation[]> {
    const observations: CompilerObservation[] = [];

    try {
      const ast = parse(source, {
        sourceType: 'unambiguous',
        plugins: ['jsx', 'typescript'],
      });

      const isModuleOptedOut = source.includes('"use no memo"') || source.includes("'use no memo'");

      traverse(ast, {
        Function(path: NodePath<t.Function>) {
          let name: string | null = null;
          if ('id' in path.node && path.node.id && 'name' in path.node.id) {
            name = path.node.id.name;
          } else if (path.parentPath?.isVariableDeclarator()) {
            const id = path.parentPath.node.id;
            if (id.type === 'Identifier') name = id.name;
          }

          if (!name || (!/^[A-Z]/.test(name) && !/^use[A-Z]/.test(name))) {
            return;
          }

          // Directives check inside function body
          const fnBodyText = source.slice(path.node.start ?? 0, path.node.end ?? 0);
          const isFnOptedOut =
            isModuleOptedOut ||
            fnBodyText.includes('"use no memo"') ||
            fnBodyText.includes("'use no memo'");

          if (isFnOptedOut) {
            observations.push({
              componentName: name,
              outcome: 'skipped',
              observationSource: 'reference-model',
              reason: 'Skipped due to "use no memo" directive.',
              compilerVersion: '19.0.0-reference',
            });
            return;
          }

          let bailedOut = false;
          let bailoutReason = '';

          const isAsync = path.node.async;
          if (isAsync) {
            bailedOut = true;
            bailoutReason = 'Async component functions are not supported by the compiler.';
          }

          // Inner AST inspections according to React Compiler specification
          path.traverse({
            Function(innerPath: NodePath<t.Function>) {
              if (innerPath === path) return;
              let innerName: string | null = null;
              if ('id' in innerPath.node && innerPath.node.id && 'name' in innerPath.node.id) {
                innerName = innerPath.node.id.name;
              } else if (innerPath.parentPath?.isVariableDeclarator()) {
                const id = innerPath.parentPath.node.id;
                if (id.type === 'Identifier') innerName = id.name;
              }
              if (innerName && (/^[A-Z]/.test(innerName) || /^use[A-Z]/.test(innerName))) {
                bailedOut = true;
                bailoutReason = `Nested component definition '${innerName}' in render body.`;
              }
            },

            CallExpression(callPath: NodePath<t.CallExpression>) {
              const funcParent = callPath.getFunctionParent();
              if (funcParent !== path) return;

              const callee = callPath.node.callee;

              // 1. Conditional hooks check
              if (callee.type === 'Identifier' && /^use[A-Z]/.test(callee.name)) {
                const ifParent = callPath.findParent((p) => p.isIfStatement() || p.isLoop() || p.isSwitchStatement());
                if (ifParent) {
                  bailedOut = true;
                  bailoutReason = `Conditional call of hook '${callee.name}'.`;
                }
              }

              // 2. Unconditional setState call
              if (callee.type === 'Identifier') {
                if (callee.name === 'setState' || callee.name === 'setCount' || /^set[A-Z]/.test(callee.name)) {
                  bailedOut = true;
                  bailoutReason = `Unconditional state update '${callee.name}' called during render.`;
                }
              }

              // 3. Impure global function calls (Math.random, Date.now)
              if (
                callee.type === 'MemberExpression' &&
                callee.object.type === 'Identifier' &&
                IMPURE_GLOBALS.has(callee.object.name)
              ) {
                bailedOut = true;
                bailoutReason = `Impure call '${callee.object.name}.${callee.property.type === 'Identifier' ? callee.property.name : 'fn'}' during render.`;
              }

              // 4. Prop/State array mutation methods (.push, .splice)
              if (
                callee.type === 'MemberExpression' &&
                callee.property.type === 'Identifier' &&
                MUTATING_METHODS.has(callee.property.name)
              ) {
                bailedOut = true;
                bailoutReason = `Mutating method '${callee.property.name}' called during render.`;
              }
            },

            MemberExpression(memPath: NodePath<t.MemberExpression>) {
              const funcParent = memPath.getFunctionParent();
              if (funcParent !== path) return;

              // DOM Globals read
              if (memPath.node.object.type === 'Identifier' && DOM_GLOBALS.has(memPath.node.object.name)) {
                bailedOut = true;
                bailoutReason = `Access to browser DOM global '${memPath.node.object.name}' during render.`;
              }

              // Ref read in render
              if (
                !memPath.node.computed &&
                memPath.node.property.type === 'Identifier' &&
                memPath.node.property.name === 'current'
              ) {
                // Ignore lazy ref init
                if (!isLazyRefInit(memPath)) {
                  bailedOut = true;
                  bailoutReason = 'Read of ref.current during render.';
                }
              }
            },

            AssignmentExpression(assignPath: NodePath<t.AssignmentExpression>) {
              const funcParent = assignPath.getFunctionParent();
              if (funcParent !== path) return;

              // Ignore lazy ref init
              if (isLazyRefInit(assignPath)) {
                return;
              }

              const left = assignPath.node.left;
              if (left.type === 'Identifier') {
                bailedOut = true;
                bailoutReason = `Render-phase mutation of local variable '${left.name}'.`;
              } else if (left.type === 'MemberExpression') {
                bailedOut = true;
                bailoutReason = 'Render-phase mutation of property/object.';
              }
            },
          });

          if (bailedOut) {
            observations.push({
              componentName: name,
              outcome: 'bailed-out',
              observationSource: 'reference-model',
              reason: bailoutReason,
              compilerVersion: '19.0.0-reference',
            });
          } else {
            observations.push({
              componentName: name,
              outcome: 'optimized',
              observationSource: 'reference-model',
              reason: 'Successfully compiled and reactive scopes auto-memoized.',
              compilerVersion: '19.0.0-reference',
            });
          }
        },
      });
    } catch {
      // Parse error or non-code file
    }

    return observations;
  }
}

// ─── Real React Compiler Adapter (Dynamic) ───────────────────────────────────

export class ReactCompilerAdapter implements CompilerAdapter {
  name = 'babel-plugin-react-compiler';
  version = 'unknown';
  isRealCompiler = true;

  constructor(version: string) {
    this.version = version;
  }

  async analyse(source: string, filePath = 'inline.tsx'): Promise<CompilerObservation[]> {
    try {
      const babelCore: any = await import('@babel/core' as string);
      const reactCompilerPlugin: any = await import('babel-plugin-react-compiler' as string);

      const result = await babelCore.transformAsync(source, {
        filename: filePath,
        presets: ['@babel/preset-typescript', '@babel/preset-react'],
        plugins: [reactCompilerPlugin.default ?? reactCompilerPlugin],
      });

      const compiledCode = result?.code ?? '';
      const observations: CompilerObservation[] = [];

      const ast = parse(source, { sourceType: 'unambiguous', plugins: ['jsx', 'typescript'] });
      traverse(ast, {
        Function(path: NodePath<t.Function>) {
          let name: string | null = null;
          if ('id' in path.node && path.node.id && 'name' in path.node.id) name = path.node.id.name;
          else if (path.parentPath?.isVariableDeclarator() && path.parentPath.node.id.type === 'Identifier') {
            name = path.parentPath.node.id.name;
          }

          if (!name || (!/^[A-Z]/.test(name) && !/^use[A-Z]/.test(name))) return;

          const isMemoizedInOutput = compiledCode.includes(`_c(`) || compiledCode.includes(`useMemoCache`);
          observations.push({
            componentName: name,
            outcome: isMemoizedInOutput ? 'optimized' : 'bailed-out',
            observationSource: 'react-compiler',
            compilerVersion: this.version,
          });
        },
      });

      return observations;
    } catch {
      const fallback = new ReferenceCompilerAdapter();
      return fallback.analyse(source, filePath);
    }
  }
}

/**
 * Factory function to create the best available CompilerAdapter.
 */
export async function createCompilerAdapter(): Promise<CompilerAdapter> {
  try {
    const pkg: any = await import('babel-plugin-react-compiler/package.json' as string, {
      with: { type: 'json' },
    }).catch(() => null);

    if (pkg && pkg.default?.version) {
      return new ReactCompilerAdapter(pkg.default.version);
    }
  } catch {
    // Ignore dynamic import error
  }

  return new ReferenceCompilerAdapter();
}
