import chroma from 'chroma-js';

/**
 * 文字列からハッシュ値を生成
 * 同じ文字列は常に同じハッシュを返す
 */
const hashString = (str: string): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
};

/**
 * 拡張子から一意の色を生成
 * chroma-jsを使ってHSL色空間で色相を分散させる
 */
export const getColorForExtension = (filename: string): string => {
  const ext = filename.includes('.') ? filename.split('.').pop()?.toLowerCase() || '' : '';

  if (!ext) {
    // 拡張子なしファイル（Makefile, Dockerfileなど）はファイル名でハッシュ
    const hash = hashString(filename.toLowerCase());
    return chroma.hsl((hash * 137.5) % 360, 0.6, 0.55).hex();
  }

  // 拡張子をハッシュ化して色相を決定
  // 黄金角（137.5度）を使って色相を分散させ、隣り合う拡張子が似た色にならないようにする
  const hash = hashString(ext);
  const hue = (hash * 137.5) % 360;

  // 彩度と明度は固定して視認性を確保
  return chroma.hsl(hue, 0.7, 0.6).hex();
};

/**
 * ディレクトリの深さに応じた色を生成
 * 深くなるほど暗くなる
 */
export const getDirectoryColor = (depth: number): string => {
  const baseColor = chroma('#4a9eff');
  // 深さに応じて明度を下げる（最大深さ10を想定）
  const darkenAmount = Math.min(depth * 0.15, 1.2);
  return baseColor.darken(darkenAmount).hex();
};

/**
 * ファイルサイズに基づいてノードのスケールを計算
 * 対数スケールで極端に大きなファイルも適度なサイズに収める
 */
export const getSizeScale = (sizeInBytes: number | undefined, baseScale: number = 0.3): number => {
  if (!sizeInBytes || sizeInBytes === 0) return baseScale;

  // 1KB = 1024 bytes を基準に対数スケール
  // 最小0.2、最大1.5のスケール範囲
  const logScale = Math.log2(sizeInBytes / 1024 + 1) / 10;
  return Math.max(0.2, Math.min(baseScale + logScale * 0.8, 1.5));
};

/**
 * 警告レベルの色を取得
 * ファイルサイズや深さに応じた警告色
 */
export const getWarningColor = (level: 'normal' | 'warning' | 'danger'): string => {
  const colors = {
    normal: '#4ade80', // 緑
    warning: '#fbbf24', // 黄
    danger: '#f87171', // 赤
  };
  return colors[level];
};

/**
 * ファイルサイズを人間が読みやすい形式に変換
 */
export const formatFileSize = (bytes: number | undefined): string => {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
};

/**
 * 拡張子からファイルカテゴリを判定
 */
export const getFileCategory = (filename: string): string => {
  const ext = filename.includes('.') ? filename.split('.').pop()?.toLowerCase() || '' : '';

  const categories: Record<string, string[]> = {
    code: [
      'ts',
      'tsx',
      'js',
      'jsx',
      'py',
      'rb',
      'go',
      'rs',
      'java',
      'cpp',
      'c',
      'h',
      'cs',
      'php',
      'swift',
      'kt',
    ],
    config: ['json', 'yaml', 'yml', 'toml', 'ini', 'env', 'xml'],
    style: ['css', 'scss', 'sass', 'less', 'styl'],
    doc: ['md', 'mdx', 'txt', 'rst', 'adoc'],
    image: ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico'],
    data: ['sql', 'graphql', 'prisma'],
  };

  for (const [category, extensions] of Object.entries(categories)) {
    if (extensions.includes(ext)) return category;
  }

  return 'other';
};
