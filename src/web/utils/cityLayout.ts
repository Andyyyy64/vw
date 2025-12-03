import { FileNode } from '../../shared/fileNode';

/**
 * 都市レイアウト用の拡張ノード
 * 2D平面上の位置とサイズを持つ
 */
export interface CityNode {
  // 元のファイルノード情報
  name: string;
  path: string;
  type: 'file' | 'directory';
  size: number;
  depth: number;

  // レイアウト情報（XZ平面）
  x: number;
  z: number;
  width: number;
  depth_z: number; // 'depth'と被るのでdepth_z

  // ビルの高さ（ファイルのみ）
  height: number;

  // 子ノード（ディレクトリのみ）
  children?: CityNode[];

  // 直接の子ファイル（ビル）
  buildings?: CityNode[];
}

/**
 * ファイルノードのサイズを再帰的に計算
 */
const calculateNodeSize = (node: FileNode): number => {
  if (node.type === 'file') {
    return node.size || 100; // 最小サイズ
  }
  if (!node.children || node.children.length === 0) {
    return 100;
  }
  return node.children.reduce((sum, child) => sum + calculateNodeSize(child), 0);
};

/**
 * ファイルサイズからビルの高さを計算（対数スケール）
 */
const calculateBuildingHeight = (sizeInBytes: number): number => {
  if (!sizeInBytes || sizeInBytes === 0) return 0.5;
  // 対数スケールで高さを計算
  // 100B -> 0.5, 1KB -> 1.5, 10KB -> 2.5, 100KB -> 3.5, 1MB -> 4.5, 10MB -> 5.5
  const logSize = Math.log10(sizeInBytes + 1);
  return Math.max(0.5, Math.min(logSize * 1.2, 12));
};

/**
 * Squarified Treemap アルゴリズム
 * できるだけ正方形に近い矩形を生成する
 */
const squarify = (
  items: { node: FileNode; size: number }[],
  x: number,
  z: number,
  width: number,
  depth: number
): { node: FileNode; size: number; x: number; z: number; w: number; d: number }[] => {
  if (items.length === 0) return [];
  if (items.length === 1) {
    return [{ ...items[0], x, z, w: width, d: depth }];
  }

  const totalSize = items.reduce((sum, item) => sum + item.size, 0);
  if (totalSize === 0) return [];

  // 短い辺に沿ってレイアウト
  const isHorizontal = width >= depth;
  const mainDim = isHorizontal ? width : depth;
  const secondaryDim = isHorizontal ? depth : width;

  const results: { node: FileNode; size: number; x: number; z: number; w: number; d: number }[] =
    [];
  let remaining = [...items];
  let currentX = x;
  let currentZ = z;

  while (remaining.length > 0) {
    // 最初の行/列に収まるアイテムを見つける
    const row: typeof remaining = [];
    let rowSize = 0;
    const remainingSize = remaining.reduce((sum, item) => sum + item.size, 0);

    for (const item of remaining) {
      const newRowSize = rowSize + item.size;
      const rowRatio = (newRowSize / remainingSize) * mainDim;

      if (row.length === 0) {
        row.push(item);
        rowSize = newRowSize;
      } else {
        // アスペクト比が悪化するなら追加しない
        const currentWorst = worstAspectRatio(
          row,
          rowRatio,
          secondaryDim,
          rowSize,
          remainingSize,
          mainDim
        );
        const newWorst = worstAspectRatio(
          [...row, item],
          (newRowSize / remainingSize) * mainDim,
          secondaryDim,
          newRowSize,
          remainingSize,
          mainDim
        );

        if (newWorst <= currentWorst) {
          row.push(item);
          rowSize = newRowSize;
        } else {
          break;
        }
      }
    }

    // この行をレイアウト
    const rowDim = (rowSize / remainingSize) * mainDim;
    let offset = 0;

    for (const item of row) {
      const itemDim = (item.size / rowSize) * secondaryDim;

      if (isHorizontal) {
        results.push({
          ...item,
          x: currentX,
          z: currentZ + offset,
          w: rowDim,
          d: itemDim,
        });
      } else {
        results.push({
          ...item,
          x: currentX + offset,
          z: currentZ,
          w: itemDim,
          d: rowDim,
        });
      }

      offset += itemDim;
    }

    // 次の行へ
    if (isHorizontal) {
      currentX += rowDim;
    } else {
      currentZ += rowDim;
    }

    remaining = remaining.filter((item) => !row.includes(item));
  }

  return results;
};

/**
 * 最悪のアスペクト比を計算
 */
const worstAspectRatio = (
  row: { size: number }[],
  rowDim: number,
  secondaryDim: number,
  rowSize: number,
  _totalSize: number,
  _mainDim: number
): number => {
  if (rowDim === 0 || rowSize === 0) return Infinity;

  let worst = 0;
  for (const item of row) {
    const itemDim = (item.size / rowSize) * secondaryDim;
    const ratio = Math.max(rowDim / itemDim, itemDim / rowDim);
    worst = Math.max(worst, ratio);
  }
  return worst;
};

/**
 * 道路の幅（ディレクトリ間のスペース）
 */
const ROAD_WIDTH = 3;
const BUILDING_GAP = 0.5;
const MIN_BLOCK_SIZE = 4;

/**
 * FileNodeツリーをCityNodeツリーに変換
 * Squarified Treemapを使って2D配置を計算
 */
export const generateCityLayout = (
  root: FileNode,
  x: number = 0,
  z: number = 0,
  width: number = 100,
  depth_z: number = 100,
  nodeDepth: number = 0
): CityNode => {
  const totalSize = calculateNodeSize(root);

  if (root.type === 'file') {
    // ファイルはビルとして返す
    return {
      name: root.name,
      path: root.path,
      type: 'file',
      size: root.size || 100,
      depth: nodeDepth,
      x,
      z,
      width: Math.max(width - BUILDING_GAP * 2, 0.5),
      depth_z: Math.max(depth_z - BUILDING_GAP * 2, 0.5),
      height: calculateBuildingHeight(root.size || 0),
    };
  }

  // ディレクトリの場合
  const children = root.children || [];
  const files = children.filter((c) => c.type === 'file');
  const directories = children.filter((c) => c.type === 'directory');

  // ディレクトリ用のエリアとファイル用のエリアを分ける
  // ファイルは手前（z大きい側）、ディレクトリは奥
  const fileAreaRatio =
    files.length > 0 ? Math.min(0.4, files.length / (files.length + directories.length * 3)) : 0;
  const fileAreaDepth = depth_z * fileAreaRatio;
  const dirAreaDepth =
    depth_z - fileAreaDepth - (files.length > 0 && directories.length > 0 ? ROAD_WIDTH : 0);

  // ファイル（ビル）を配置
  const buildings: CityNode[] = [];
  if (files.length > 0) {
    const fileItems = files.map((f) => ({
      node: f,
      size: calculateNodeSize(f),
    }));

    // ファイルエリア内にビルを配置
    const fileAreaX = x + BUILDING_GAP;
    const fileAreaZ = z + dirAreaDepth + ROAD_WIDTH;
    const fileAreaW = width - BUILDING_GAP * 2;
    const fileAreaD = Math.max(fileAreaDepth - BUILDING_GAP * 2, 1);

    const fileLayout = squarify(fileItems, fileAreaX, fileAreaZ, fileAreaW, fileAreaD);

    for (const item of fileLayout) {
      // 各ビルにギャップを適用（重なり防止）
      const gap = BUILDING_GAP;
      buildings.push({
        name: item.node.name,
        path: item.node.path,
        type: 'file',
        size: item.node.size || 100,
        depth: nodeDepth + 1,
        x: item.x + gap,
        z: item.z + gap,
        width: Math.max(item.w - gap * 2, 0.2),
        depth_z: Math.max(item.d - gap * 2, 0.2),
        height: calculateBuildingHeight(item.node.size || 0),
      });
    }
  }

  // サブディレクトリを配置
  const childNodes: CityNode[] = [];
  if (directories.length > 0) {
    const dirItems = directories.map((d) => ({
      node: d,
      size: Math.max(calculateNodeSize(d), MIN_BLOCK_SIZE * MIN_BLOCK_SIZE),
    }));

    const dirLayout = squarify(dirItems, x, z, width, dirAreaDepth);

    for (const item of dirLayout) {
      // 道路分の余白を確保
      const innerX = item.x + ROAD_WIDTH / 2;
      const innerZ = item.z + ROAD_WIDTH / 2;
      const innerW = Math.max(item.w - ROAD_WIDTH, MIN_BLOCK_SIZE);
      const innerD = Math.max(item.d - ROAD_WIDTH, MIN_BLOCK_SIZE);

      const childNode = generateCityLayout(
        item.node,
        innerX,
        innerZ,
        innerW,
        innerD,
        nodeDepth + 1
      );
      childNodes.push(childNode);
    }
  }

  return {
    name: root.name,
    path: root.path,
    type: 'directory',
    size: totalSize,
    depth: nodeDepth,
    x,
    z,
    width,
    depth_z,
    height: 0,
    children: childNodes,
    buildings,
  };
};

/**
 * CityNodeツリーをフラットなビル配列に変換
 */
export const flattenBuildings = (node: CityNode): CityNode[] => {
  const buildings: CityNode[] = [];

  if (node.type === 'file') {
    buildings.push(node);
  } else {
    // このディレクトリ直下のビル
    if (node.buildings) {
      buildings.push(...node.buildings);
    }
    // 子ディレクトリのビル
    if (node.children) {
      for (const child of node.children) {
        buildings.push(...flattenBuildings(child));
      }
    }
  }

  return buildings;
};

/**
 * CityNodeツリーをフラットなディレクトリ配列に変換
 */
export const flattenDistricts = (node: CityNode): CityNode[] => {
  const districts: CityNode[] = [];

  if (node.type === 'directory') {
    districts.push(node);
    if (node.children) {
      for (const child of node.children) {
        districts.push(...flattenDistricts(child));
      }
    }
  }

  return districts;
};

/**
 * レイアウトの境界を計算
 */
export const getLayoutBounds = (
  node: CityNode
): {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  maxHeight: number;
} => {
  const buildings = flattenBuildings(node);
  const districts = flattenDistricts(node);

  let minX = Infinity,
    maxX = -Infinity,
    minZ = Infinity,
    maxZ = -Infinity,
    maxHeight = 0;

  for (const b of buildings) {
    minX = Math.min(minX, b.x);
    maxX = Math.max(maxX, b.x + b.width);
    minZ = Math.min(minZ, b.z);
    maxZ = Math.max(maxZ, b.z + b.depth_z);
    maxHeight = Math.max(maxHeight, b.height);
  }

  for (const d of districts) {
    minX = Math.min(minX, d.x);
    maxX = Math.max(maxX, d.x + d.width);
    minZ = Math.min(minZ, d.z);
    maxZ = Math.max(maxZ, d.z + d.depth_z);
  }

  return { minX, maxX, minZ, maxZ, maxHeight };
};
