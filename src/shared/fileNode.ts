export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
  size?: number;
}

// import文の種類
export type ImportType = 'default' | 'named' | 'namespace' | 'dynamic' | 'sideEffect';

// 個々のimport情報
export interface ImportInfo {
  // import元ファイル（相対パス or 絶対パス）
  source: string;
  // import先ファイル（解決済みパス）
  target: string;
  // importの種類
  type: ImportType;
  // named importの場合、インポートされた名前のリスト
  names?: string[];
}

// ファイル間の依存関係グラフ
export interface DependencyGraph {
  // ファイルパス → そのファイルからのimport一覧
  imports: Record<string, ImportInfo[]>;
  // ファイルパス → そのファイルへのimport一覧（逆引き）
  importedBy: Record<string, ImportInfo[]>;
}
