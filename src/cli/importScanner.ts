import { Project, SourceFile, SyntaxKind } from 'ts-morph';
import path from 'path';
import fs from 'fs';
import { DependencyGraph, ImportInfo, ImportType } from '../shared/fileNode';

// 解析対象の拡張子
const SUPPORTED_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.mts'];

/**
 * import 文を解析して ImportInfo を生成
 */
const analyzeImports = (sourceFile: SourceFile, rootPath: string): ImportInfo[] => {
  const imports: ImportInfo[] = [];
  const sourceFilePath = path.relative(rootPath, sourceFile.getFilePath());

  // 通常の import 文を解析
  for (const importDecl of sourceFile.getImportDeclarations()) {
    const moduleSpecifier = importDecl.getModuleSpecifierValue();

    // node_modules や組み込みモジュールはスキップ
    if (!moduleSpecifier.startsWith('.') && !moduleSpecifier.startsWith('/')) {
      continue;
    }

    const resolvedPath = resolveImportPath(sourceFile.getFilePath(), moduleSpecifier, rootPath);
    if (!resolvedPath) continue;

    const importType = getImportType(importDecl);
    const names = getImportedNames(importDecl);

    imports.push({
      source: sourceFilePath,
      target: resolvedPath,
      type: importType,
      names: names.length > 0 ? names : undefined,
    });
  }

  // dynamic import を解析 (import(...))
  sourceFile.forEachDescendant((node) => {
    if (node.getKind() === SyntaxKind.CallExpression) {
      const callExpr = node.asKind(SyntaxKind.CallExpression);
      if (!callExpr) return;

      const expression = callExpr.getExpression();
      if (expression.getKind() === SyntaxKind.ImportKeyword) {
        const args = callExpr.getArguments();
        if (args.length > 0) {
          const arg = args[0];
          // 文字列リテラルの場合のみ
          if (arg.getKind() === SyntaxKind.StringLiteral) {
            const moduleSpecifier = arg.asKind(SyntaxKind.StringLiteral)?.getLiteralValue();
            if (
              moduleSpecifier &&
              (moduleSpecifier.startsWith('.') || moduleSpecifier.startsWith('/'))
            ) {
              const resolvedPath = resolveImportPath(
                sourceFile.getFilePath(),
                moduleSpecifier,
                rootPath
              );
              if (resolvedPath) {
                imports.push({
                  source: sourceFilePath,
                  target: resolvedPath,
                  type: 'dynamic',
                });
              }
            }
          }
        }
      }
    }
  });

  // re-export を解析 (export * from / export { ... } from)
  for (const exportDecl of sourceFile.getExportDeclarations()) {
    const moduleSpecifier = exportDecl.getModuleSpecifierValue();
    if (!moduleSpecifier) continue;

    if (!moduleSpecifier.startsWith('.') && !moduleSpecifier.startsWith('/')) {
      continue;
    }

    const resolvedPath = resolveImportPath(sourceFile.getFilePath(), moduleSpecifier, rootPath);
    if (!resolvedPath) continue;

    const namedExports = exportDecl.getNamedExports();
    const isNamespace = exportDecl.isNamespaceExport();

    imports.push({
      source: sourceFilePath,
      target: resolvedPath,
      type: isNamespace ? 'namespace' : 'named',
      names: namedExports.length > 0 ? namedExports.map((e) => e.getName()) : undefined,
    });
  }

  return imports;
};

/**
 * import 文の種類を判定
 */
const getImportType = (
  importDecl: ReturnType<SourceFile['getImportDeclarations']>[number]
): ImportType => {
  const defaultImport = importDecl.getDefaultImport();
  const namedImports = importDecl.getNamedImports();
  const namespaceImport = importDecl.getNamespaceImport();

  // import 'module' (副作用のみ)
  if (!defaultImport && namedImports.length === 0 && !namespaceImport) {
    return 'sideEffect';
  }

  // import * as name from 'module'
  if (namespaceImport) {
    return 'namespace';
  }

  // import name from 'module'
  if (defaultImport && namedImports.length === 0) {
    return 'default';
  }

  // import { a, b } from 'module' または import name, { a, b } from 'module'
  return 'named';
};

/**
 * import された名前のリストを取得
 */
const getImportedNames = (
  importDecl: ReturnType<SourceFile['getImportDeclarations']>[number]
): string[] => {
  const names: string[] = [];

  const defaultImport = importDecl.getDefaultImport();
  if (defaultImport) {
    names.push(defaultImport.getText());
  }

  for (const namedImport of importDecl.getNamedImports()) {
    names.push(namedImport.getName());
  }

  const namespaceImport = importDecl.getNamespaceImport();
  if (namespaceImport) {
    names.push(`* as ${namespaceImport.getText()}`);
  }

  return names;
};

/**
 * import パスを解決して相対パスに変換
 */
const resolveImportPath = (
  sourcePath: string,
  moduleSpecifier: string,
  rootPath: string
): string | null => {
  const sourceDir = path.dirname(sourcePath);
  let targetPath = path.resolve(sourceDir, moduleSpecifier);

  // 拡張子がない場合、可能な拡張子を試す
  if (!path.extname(targetPath)) {
    for (const ext of SUPPORTED_EXTENSIONS) {
      const withExt = targetPath + ext;
      if (fs.existsSync(withExt)) {
        targetPath = withExt;
        break;
      }
      // index.ts などをチェック
      const indexPath = path.join(targetPath, 'index' + ext);
      if (fs.existsSync(indexPath)) {
        targetPath = indexPath;
        break;
      }
    }
  }

  // ファイルが存在しない場合はスキップ
  if (!fs.existsSync(targetPath)) {
    return null;
  }

  return path.relative(rootPath, targetPath);
};

/**
 * プロジェクト内の全ファイルを解析して依存グラフを構築
 */
export const scanDependencies = async (
  rootPath: string,
  tsconfigPath?: string
): Promise<DependencyGraph> => {
  // tsconfig.json を探す
  const configPath = tsconfigPath || findTsConfig(rootPath);

  const project = new Project({
    tsConfigFilePath: configPath,
    skipAddingFilesFromTsConfig: !configPath,
  });

  // tsconfig がない場合、手動でファイルを追加
  if (!configPath) {
    const files = await findSourceFiles(rootPath);
    project.addSourceFilesAtPaths(files);
  }

  const imports: Record<string, ImportInfo[]> = {};
  const importedBy: Record<string, ImportInfo[]> = {};

  // 各ソースファイルを解析
  for (const sourceFile of project.getSourceFiles()) {
    const filePath = sourceFile.getFilePath();

    // node_modules 内のファイルはスキップ
    if (filePath.includes('node_modules')) continue;

    const fileImports = analyzeImports(sourceFile, rootPath);
    const relativePath = path.relative(rootPath, filePath);

    if (fileImports.length > 0) {
      imports[relativePath] = fileImports;
    }

    // 逆引きインデックスを構築
    for (const imp of fileImports) {
      if (!importedBy[imp.target]) {
        importedBy[imp.target] = [];
      }
      importedBy[imp.target].push(imp);
    }
  }

  return { imports, importedBy };
};

/**
 * tsconfig.json を探す
 */
const findTsConfig = (rootPath: string): string | undefined => {
  const candidates = ['tsconfig.json', 'tsconfig.app.json', 'jsconfig.json'];

  for (const candidate of candidates) {
    const configPath = path.join(rootPath, candidate);
    if (fs.existsSync(configPath)) {
      return configPath;
    }
  }

  return undefined;
};

/**
 * ディレクトリ内のソースファイルを再帰的に検索
 */
const findSourceFiles = async (dir: string): Promise<string[]> => {
  const files: string[] = [];

  const entries = await fs.promises.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    // 除外ディレクトリ
    if (entry.isDirectory()) {
      if (['node_modules', '.git', 'dist', 'build', '.next'].includes(entry.name)) {
        continue;
      }
      files.push(...(await findSourceFiles(fullPath)));
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name);
      if (SUPPORTED_EXTENSIONS.includes(ext)) {
        files.push(fullPath);
      }
    }
  }

  return files;
};
