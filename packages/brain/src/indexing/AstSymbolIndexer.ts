import ts from 'typescript';
import path from 'node:path';
import fs from 'node:fs';
import type { SymbolRecord, DependencyRecord } from '../persistence/BrainStore.js';

export interface ParseResult {
  symbols: Omit<SymbolRecord, 'filePath'>[];
  dependencies: Omit<DependencyRecord, 'sourcePath'>[];
}

export class AstSymbolIndexer {
  /**
   * Parse a file and extract its symbols and imports/dependencies.
   */
  parseFile(filePath: string, projectRoot: string): ParseResult {
    const extension = path.extname(filePath).toLowerCase();
    
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      
      if (['.ts', '.tsx', '.js', '.jsx'].includes(extension)) {
        return this.parseTypeScript(filePath, content, projectRoot);
      } else if (extension === '.py') {
        return this.parsePythonHeuristics(content);
      } else if (extension === '.go') {
        return this.parseGoHeuristics(content);
      } else if (extension === '.rs') {
        return this.parseRustHeuristics(content);
      }
    } catch (error) {
      // Return empty index on read/parse failures defensively
    }

    return { symbols: [], dependencies: [] };
  }

  // ─── TypeScript/JavaScript Parsing ──────────────────────────

  private parseTypeScript(filePath: string, content: string, projectRoot: string): ParseResult {
    const symbols: Omit<SymbolRecord, 'filePath'>[] = [];
    const dependencies: Omit<DependencyRecord, 'sourcePath'>[] = [];

    const sourceFile = ts.createSourceFile(
      filePath,
      content,
      ts.ScriptTarget.Latest,
      true // setParentNodes
    );

    const getLineNumber = (position: number): number => {
      const { line } = sourceFile.getLineAndCharacterOfPosition(position);
      return line + 1; // 1-indexed
    };

    const isExportedNode = (node: ts.Node): boolean => {
      const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
      return modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ?? false;
    };

    const visit = (node: ts.Node) => {
      // 1. Class declarations
      if (ts.isClassDeclaration(node) && node.name) {
        symbols.push({
          name: node.name.text,
          type: 'class',
          startLine: getLineNumber(node.getStart()),
          endLine: getLineNumber(node.getEnd()),
          isExported: isExportedNode(node),
        });
      }
      
      // 2. Interface declarations
      else if (ts.isInterfaceDeclaration(node) && node.name) {
        symbols.push({
          name: node.name.text,
          type: 'interface',
          startLine: getLineNumber(node.getStart()),
          endLine: getLineNumber(node.getEnd()),
          isExported: isExportedNode(node),
        });
      }

      // 3. Function declarations
      else if (ts.isFunctionDeclaration(node) && node.name) {
        symbols.push({
          name: node.name.text,
          type: 'function',
          startLine: getLineNumber(node.getStart()),
          endLine: getLineNumber(node.getEnd()),
          isExported: isExportedNode(node),
        });
      }

      // 4. Type aliases
      else if (ts.isTypeAliasDeclaration(node) && node.name) {
        symbols.push({
          name: node.name.text,
          type: 'type',
          startLine: getLineNumber(node.getStart()),
          endLine: getLineNumber(node.getEnd()),
          isExported: isExportedNode(node),
        });
      }

      // 5. Variables (const/let exports, including Arrow functions)
      else if (ts.isVariableStatement(node)) {
        const isExported = isExportedNode(node);
        for (const declaration of node.declarationList.declarations) {
          if (ts.isIdentifier(declaration.name)) {
            const name = declaration.name.text;
            let type = 'variable';
            
            // Check if arrow function
            if (declaration.initializer && ts.isArrowFunction(declaration.initializer)) {
              type = 'function';
            }

            symbols.push({
              name,
              type,
              startLine: getLineNumber(declaration.getStart()),
              endLine: getLineNumber(declaration.getEnd()),
              isExported,
            });
          }
        }
      }

      // 6. Import declarations (dependencies)
      else if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
        const importPath = node.moduleSpecifier.text;
        
        // Resolve relative imports to absolute-like paths in workspace
        if (importPath.startsWith('.') || importPath.startsWith('/')) {
          const resolved = this.resolveRelativeImport(filePath, importPath, projectRoot);
          if (resolved) {
            dependencies.push({
              targetPath: resolved,
              type: 'import',
            });
          }
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return { symbols, dependencies };
  }

  /**
   * Helper to resolve relative imports to standard workspace paths.
   */
  private resolveRelativeImport(sourceFile: string, importPath: string, projectRoot: string): string | null {
    const dir = path.dirname(sourceFile);
    const absolutePath = path.resolve(dir, importPath);
    const relativeToRoot = path.relative(projectRoot, absolutePath);

    // Check extensions
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.js'];
    for (const ext of extensions) {
      const candidatePath = absolutePath + ext;
      if (fs.existsSync(candidatePath) && !fs.statSync(candidatePath).isDirectory()) {
        return path.relative(projectRoot, candidatePath);
      }
    }

    // Direct exist check (e.g. extension was included)
    if (fs.existsSync(absolutePath) && !fs.statSync(absolutePath).isDirectory()) {
      return relativeToRoot;
    }

    return null;
  }

  // ─── Python Heuristic Parser ────────────────────────────────

  private parsePythonHeuristics(content: string): ParseResult {
    const symbols: Omit<SymbolRecord, 'filePath'>[] = [];
    const dependencies: Omit<DependencyRecord, 'sourcePath'>[] = [];
    const lines = content.split('\n');

    // Regex definitions
    const classRegex = /^\s*class\s+([a-zA-Z0-9_]+)/;
    const defRegex = /^\s*def\s+([a-zA-Z0-9_]+)/;
    const importRegex = /^\s*(?:import\s+([a-zA-Z0-9_.,\s]+)|from\s+([a-zA-Z0-9_.]+)\s+import)/;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      // Class
      const classMatch = line.match(classRegex);
      if (classMatch) {
        symbols.push({
          name: classMatch[1],
          type: 'class',
          startLine: lineNum,
          endLine: lineNum + 2, // approximation
          isExported: !classMatch[1].startsWith('_'),
        });
        continue;
      }

      // Function
      const defMatch = line.match(defRegex);
      if (defMatch) {
        symbols.push({
          name: defMatch[1],
          type: 'function',
          startLine: lineNum,
          endLine: lineNum + 2, // approximation
          isExported: !defMatch[1].startsWith('_'),
        });
        continue;
      }

      // Basic Import
      const importMatch = line.match(importRegex);
      if (importMatch) {
        const importTarget = importMatch[1] || importMatch[2];
        if (importTarget) {
          dependencies.push({
            targetPath: importTarget.trim(),
            type: 'import',
          });
        }
      }
    }

    return { symbols, dependencies };
  }

  // ─── Go Heuristic Parser ───────────────────────────────────

  private parseGoHeuristics(content: string): ParseResult {
    const symbols: Omit<SymbolRecord, 'filePath'>[] = [];
    const dependencies: Omit<DependencyRecord, 'sourcePath'>[] = [];
    const lines = content.split('\n');

    const funcRegex = /^func\s+(?:\([^)]+\)\s+)?([a-zA-Z0-9_]+)/;
    const structRegex = /^type\s+([a-zA-Z0-9_]+)\s+(?:struct|interface)/;
    const importRegex = /^\s*import\s+["']([^"']+)["']/;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      // Function / Method
      const funcMatch = line.match(funcRegex);
      if (funcMatch) {
        const name = funcMatch[1];
        symbols.push({
          name,
          type: 'function',
          startLine: lineNum,
          endLine: lineNum + 2,
          isExported: name.charCodeAt(0) >= 65 && name.charCodeAt(0) <= 90, // Capitalized = Exported in Go
        });
        continue;
      }

      // Struct / Interface
      const structMatch = line.match(structRegex);
      if (structMatch) {
        const name = structMatch[1];
        symbols.push({
          name,
          type: 'class',
          startLine: lineNum,
          endLine: lineNum + 2,
          isExported: name.charCodeAt(0) >= 65 && name.charCodeAt(0) <= 90,
        });
        continue;
      }

      // Go Import
      const importMatch = line.match(importRegex);
      if (importMatch) {
        dependencies.push({
          targetPath: importMatch[1],
          type: 'import',
        });
      }
    }

    return { symbols, dependencies };
  }

  // ─── Rust Heuristic Parser ─────────────────────────────────

  private parseRustHeuristics(content: string): ParseResult {
    const symbols: Omit<SymbolRecord, 'filePath'>[] = [];
    const dependencies: Omit<DependencyRecord, 'sourcePath'>[] = [];
    const lines = content.split('\n');

    const fnRegex = /^\s*(?:pub\s+(?:\([^)]+\)\s+)?)?fn\s+([a-zA-Z0-9_]+)/;
    const structRegex = /^\s*(?:pub\s+(?:\([^)]+\)\s+)?)?(?:struct|enum|trait|union)\s+([a-zA-Z0-9_]+)/;
    const useRegex = /^\s*use\s+([a-zA-Z0-9_:]+)/;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;
      const isPub = line.includes('pub ');

      // Function
      const fnMatch = line.match(fnRegex);
      if (fnMatch) {
        symbols.push({
          name: fnMatch[1],
          type: 'function',
          startLine: lineNum,
          endLine: lineNum + 2,
          isExported: isPub,
        });
        continue;
      }

      // Struct / Trait / Enum
      const structMatch = line.match(structRegex);
      if (structMatch) {
        symbols.push({
          name: structMatch[1],
          type: 'class',
          startLine: lineNum,
          endLine: lineNum + 2,
          isExported: isPub,
        });
        continue;
      }

      // Rust use dependency
      const useMatch = line.match(useRegex);
      if (useMatch) {
        dependencies.push({
          targetPath: useMatch[1],
          type: 'import',
        });
      }
    }

    return { symbols, dependencies };
  }
}
