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
  if (!sizeInBytes || sizeInBytes === 0) return 1;
  // 緩やかなログスケール（小〜中サイズの過剰な伸びを抑制）
  // 1B ≈1.2階, 1KB ≈9階, 10KB ≈15階, 100KB ≈21階, 1MB ≈28階, 100MB ≈42階
  const logSize = Math.log10(sizeInBytes + 10);
  const height = (logSize - 1) * 7 + 2;
  return Math.max(1, Math.min(height, 80));
};

// 足元が極小のとき高さを自動的に抑える（棒線防止）
const applyFootprintHeightScale = (height: number, width: number, depth: number): number => {
  const area = Math.max(width * depth, 0.0001);
  // 2x2=4 を基準。面積が小さいほど係数を下げ、0.35〜1にクランプ。
  const factor = Math.min(1, Math.max(0.25, Math.sqrt(area) / 3));
  return height * factor;
};

// 足元の最小/最大サイズとアスペクト比制御（横に長い「コンテナ」化を防ぐ）
const MIN_FOOTPRINT = 1.2;
const MIN_VISUAL_FOOTPRINT = 0.8; // これ未満にはしない（棒線防止）
const MAX_FOOTPRINT = 10;
const MIN_ASPECT = 0.6; // width/depth の下限
const MAX_ASPECT = 1.8; // width/depth の上限
const SAFETY_INSET = 0.2; // セル内にさらに余白を作る（オーバーラップ保険）
const CELL_PADDING = 0.4; // セル中央に寄せる際の基準余白

const shapeFootprint = (width: number, depth: number): { width: number; depth: number } => {
  if (width <= 0 || depth <= 0) return { width, depth };

  // もとのセルより大きくならないよう上限を保持
  const maxW = width;
  const maxD = depth;

  let w = width;
  let d = depth;

  // アスペクト比補正: 長い辺を削るだけで短い辺は伸ばさない
  const aspect = w / d;
  if (aspect > MAX_ASPECT) {
    w = Math.min(maxW, d * MAX_ASPECT);
  } else if (aspect < MIN_ASPECT) {
    d = Math.min(maxD, w / MIN_ASPECT);
  }

  // ここで再度ガード（上の式で max 制限しているが保険）
  w = Math.min(w, maxW);
  d = Math.min(d, maxD);

  // 大きすぎる場合だけ全体を縮める。小さすぎても拡大しない。
  const overScale = Math.max(w / MAX_FOOTPRINT, d / MAX_FOOTPRINT, 1);
  if (overScale > 1) {
    const scale = 1 / overScale;
    w *= scale;
    d *= scale;
  }

  // 最低サイズを確保（セルの空きがある範囲で均等拡大）
  const usableW = Math.max(0.2, maxW - SAFETY_INSET * 2);
  const usableD = Math.max(0.2, maxD - SAFETY_INSET * 2);
  if (w < MIN_FOOTPRINT || d < MIN_FOOTPRINT) {
    const scaleUp = Math.min(usableW / w, usableD / d, MIN_FOOTPRINT / Math.min(w, d));
    w = Math.min(usableW, w * scaleUp);
    d = Math.min(usableD, d * scaleUp);
  }

  // 追加のインセットで必ず隣と離す
  w = Math.max(0.2, Math.min(w, usableW) - SAFETY_INSET);
  d = Math.max(0.2, Math.min(d, usableD) - SAFETY_INSET);

  // 最終的な見た目の最小足元を保証（棒線防止）
  w = Math.max(MIN_VISUAL_FOOTPRINT, Math.min(w, usableW));
  d = Math.max(MIN_VISUAL_FOOTPRINT, Math.min(d, usableD));

  return { width: w, depth: d };
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
        ...(() => {
          // ギャップ適用後のセルに収まるよう中央寄せで縮める
          const rawW = Math.max(item.w - gap * 2, 0.2);
          const rawD = Math.max(item.d - gap * 2, 0.2);
          const shaped = shapeFootprint(rawW, rawD);
          // 小さい建物では余白を減らし、足元を確保
          const dynamicPadding = Math.min(CELL_PADDING, shaped.width * 0.25, shaped.depth * 0.25);
          const finalW = Math.max(MIN_VISUAL_FOOTPRINT, shaped.width - dynamicPadding * 2);
          const finalD = Math.max(MIN_VISUAL_FOOTPRINT, shaped.depth - dynamicPadding * 2);

          const marginX = Math.max(0, (rawW - finalW) / 2);
          const marginZ = Math.max(0, (rawD - finalD) / 2);

          const baseHeight = calculateBuildingHeight(item.node.size || 0);
          const adjustedHeight = applyFootprintHeightScale(baseHeight, finalW, finalD);

          return {
            x: item.x + gap + marginX,
            z: item.z + gap + marginZ,
            width: finalW,
            depth_z: finalD,
            height: adjustedHeight,
          };
        })(),
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
