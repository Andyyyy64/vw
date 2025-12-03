import { FileNode } from '../../shared/fileNode';

/**
 * ディレクトリ構造の統計情報
 */
export interface DirectoryStats {
  totalFiles: number;
  totalDirectories: number;
  maxDepth: number;
  largestFile: { name: string; path: string; size: number } | null;
  extensionCounts: Map<string, number>;
  totalSize: number;
}

/**
 * ファイルツリーから統計情報を計算
 */
export const calculateStats = (root: FileNode): DirectoryStats => {
  const stats: DirectoryStats = {
    totalFiles: 0,
    totalDirectories: 0,
    maxDepth: 0,
    largestFile: null,
    extensionCounts: new Map(),
    totalSize: 0,
  };

  const traverse = (node: FileNode, depth: number) => {
    stats.maxDepth = Math.max(stats.maxDepth, depth);

    if (node.type === 'directory') {
      stats.totalDirectories++;
      node.children?.forEach((child) => traverse(child, depth + 1));
    } else {
      stats.totalFiles++;

      // 拡張子カウント
      const ext = node.name.includes('.')
        ? node.name.split('.').pop()?.toLowerCase() || 'other'
        : 'no-ext';
      stats.extensionCounts.set(ext, (stats.extensionCounts.get(ext) || 0) + 1);

      // ファイルサイズ集計
      if (node.size) {
        stats.totalSize += node.size;
        if (!stats.largestFile || node.size > stats.largestFile.size) {
          stats.largestFile = { name: node.name, path: node.path, size: node.size };
        }
      }
    }
  };

  traverse(root, 0);
  return stats;
};

/**
 * 拡張子カウントを配列に変換してソート
 */
export const getSortedExtensions = (
  counts: Map<string, number>
): Array<{ ext: string; count: number }> => {
  return Array.from(counts.entries())
    .map(([ext, count]) => ({ ext, count }))
    .sort((a, b) => b.count - a.count);
};
