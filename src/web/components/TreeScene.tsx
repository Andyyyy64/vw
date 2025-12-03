import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Text, Billboard, Html, QuadraticBezierLine } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { FileNode } from '../../shared/fileNode';
import {
  getColorForExtension,
  getDirectoryColor,
  getSizeScale,
  formatFileSize,
} from '../utils/colors';

interface NodeProps {
  node: FileNode;
  position: [number, number, number];
  depth: number;
  onHover: (node: FileNode | null, position: [number, number, number] | null) => void;
}

/**
 * ファイル/ディレクトリを表現する3Dノード
 * ホバー時にハイライトし、サイズはファイルサイズに比例
 */
const Node = ({ node, position, depth, onHover }: NodeProps) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const isDir = node.type === 'directory';

  // ファイルタイプに応じた色（ディレクトリは深さで変化）
  const color = isDir ? getDirectoryColor(depth) : getColorForExtension(node.name);

  // ファイルサイズに応じたスケール（ディレクトリは大きめ）
  const scale = isDir ? 0.5 : getSizeScale(node.size, 0.35);

  // ホバー判定用の大きめのヒットエリア
  const hitAreaScale = scale;

  // ホバー時のアニメーション
  useFrame(() => {
    if (meshRef.current) {
      const targetScale = hovered ? scale * 1.3 : scale;
      meshRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.1);
    }
  });

  const handlePointerOver = useCallback(
    (e: { stopPropagation: () => void }) => {
      e.stopPropagation();
      setHovered(true);
      onHover(node, position);
      document.body.style.cursor = 'pointer';
    },
    [node, position, onHover]
  );

  const handlePointerOut = useCallback(() => {
    setHovered(false);
    onHover(null, null);
    document.body.style.cursor = 'auto';
  }, [onHover]);

  return (
    <group position={position}>
      {/* ホバー判定用の透明な大きめスフィア */}
      <mesh onPointerOver={handlePointerOver} onPointerOut={handlePointerOut} visible={false}>
        <sphereGeometry args={[hitAreaScale, 8, 8]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      {/* 表示用のメッシュ */}
      <mesh ref={meshRef} scale={scale}>
        {isDir ? <dodecahedronGeometry args={[1, 0]} /> : <octahedronGeometry args={[1, 0]} />}
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={hovered ? 0.8 : 0.3}
          metalness={0.3}
          roughness={0.4}
        />
      </mesh>

      {/* ノード名ラベル（大きめのフォントで視認性向上） */}
      <Billboard>
        <Text
          position={[0, -scale - 0.5, 0]}
          fontSize={0.35}
          color={hovered ? '#ffffff' : '#c0c0c0'}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.03}
          outlineColor="#000000"
        >
          {node.name}
        </Text>
      </Billboard>
    </group>
  );
};

interface ConnectionProps {
  start: [number, number, number];
  end: [number, number, number];
}

/**
 * ノード間の接続線（ベジェ曲線）
 */
const Connection = ({ start, end }: ConnectionProps) => {
  // 中間点を計算してカーブを作成
  const midX = (start[0] + end[0]) / 2;
  const mid: [number, number, number] = [midX, (start[1] + end[1]) / 2, (start[2] + end[2]) / 2];

  return (
    <QuadraticBezierLine
      start={start}
      end={end}
      mid={mid}
      color="#3b82f6"
      lineWidth={1}
      transparent
      opacity={0.4}
      dashed
      dashScale={50}
      dashSize={0.5}
      gapSize={0.3}
    />
  );
};

interface HoverInfoProps {
  node: FileNode;
  position: [number, number, number];
}

/**
 * ホバー時に表示される詳細情報パネル
 */
const HoverInfo = ({ node, position }: HoverInfoProps) => {
  const childCount = node.children?.length || 0;
  const isDir = node.type === 'directory';

  return (
    <Html position={[position[0], position[1] + 1.2, position[2]]} center>
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.9))',
          padding: '12px 16px',
          borderRadius: '8px',
          color: 'white',
          fontSize: '12px',
          minWidth: '200px',
          maxWidth: '320px',
          border: '1px solid rgba(59, 130, 246, 0.5)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
          backdropFilter: 'blur(8px)',
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        }}
      >
        <div
          style={{ fontWeight: 'bold', marginBottom: '8px', color: '#60a5fa', fontSize: '14px' }}
        >
          {node.name}
        </div>
        <div
          style={{
            color: '#94a3b8',
            fontSize: '11px',
            marginBottom: '6px',
            wordBreak: 'break-all',
          }}
        >
          {node.path}
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'auto 1fr',
            gap: '4px 12px',
            fontSize: '11px',
          }}
        >
          <span style={{ color: '#64748b' }}>Type:</span>
          <span style={{ color: isDir ? '#4ade80' : '#f472b6' }}>
            {isDir ? 'Directory' : 'File'}
          </span>

          {!isDir && node.size !== undefined && (
            <>
              <span style={{ color: '#64748b' }}>Size:</span>
              <span style={{ color: '#fbbf24' }}>{formatFileSize(node.size)}</span>
            </>
          )}

          {isDir && (
            <>
              <span style={{ color: '#64748b' }}>Children:</span>
              <span style={{ color: '#22d3ee' }}>{childCount} items</span>
            </>
          )}
        </div>
      </div>
    </Html>
  );
};

interface CameraControllerProps {
  center: [number, number, number];
  size: [number, number, number];
}

/**
 * シーン全体が見えるようにカメラ位置を自動調整
 */
const CameraController = ({ center, size }: CameraControllerProps) => {
  const { camera, controls } = useThree();

  useEffect(() => {
    if (controls) {
      const orbitControls = controls as unknown as { target: THREE.Vector3; update: () => void };
      orbitControls.target.set(...center);
      orbitControls.update();
    }

    // ズームイン気味の距離で全体が程よく見える位置にカメラを配置
    const maxDim = Math.max(...size);
    const distance = maxDim * 0.6;
    camera.position.set(
      center[0] - distance * 0.3,
      center[1] + distance * 0.2,
      center[2] + distance
    );
    camera.lookAt(...center);
    camera.updateProjectionMatrix();
  }, [center, size, camera, controls]);

  return null;
};

/**
 * 背景のグリッドプレーン（サイバーパンク風）
 * ツリーノードが常にグリッドより上に表示されるよう十分下に配置
 */
const BackgroundGrid = () => {
  const gridRef = useRef<THREE.GridHelper>(null);

  useFrame(({ clock }) => {
    if (gridRef.current) {
      gridRef.current.position.z = (clock.getElapsedTime() * 0.5) % 2;
    }
  });

  return (
    <group position={[0, -80, 0]} rotation={[0, 0, 0]}>
      <gridHelper ref={gridRef} args={[400, 150, '#1e3a5f', '#0f172a']} />
    </group>
  );
};

/**
 * シンプルな疑似乱数生成器（シードベースで決定論的）
 */
const seededRandom = (seed: number): number => {
  const x = Math.sin(seed * 9999) * 10000;
  return x - Math.floor(x);
};

/**
 * 浮遊するパーティクル（背景演出）
 */
const Particles = () => {
  const count = 200;
  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      // シードベースの乱数で決定論的にパーティクル位置を生成
      pos[i * 3] = (seededRandom(i * 3) - 0.5) * 100;
      pos[i * 3 + 1] = (seededRandom(i * 3 + 1) - 0.5) * 100;
      pos[i * 3 + 2] = (seededRandom(i * 3 + 2) - 0.5) * 100;
    }
    return pos;
  }, []);

  const pointsRef = useRef<THREE.Points>(null);

  useFrame(({ clock }) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y = clock.getElapsedTime() * 0.02;
      pointsRef.current.rotation.x = clock.getElapsedTime() * 0.01;
    }
  });

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geo;
  }, [positions]);

  return (
    <points ref={pointsRef} geometry={geometry}>
      <pointsMaterial size={0.15} color="#3b82f6" transparent opacity={0.6} sizeAttenuation />
    </points>
  );
};

interface TreeProps {
  data: FileNode;
  onLayout: (center: [number, number, number], size: [number, number, number]) => void;
  onHover: (node: FileNode | null, position: [number, number, number] | null) => void;
}

/**
 * ファイルツリーの3D表現
 */
const Tree = ({ data, onLayout, onHover }: TreeProps) => {
  const { nodes, connections, center, size } = useMemo(() => {
    const generatedNodes: React.ReactElement[] = [];
    const generatedConnections: React.ReactElement[] = [];

    // ツリーレイアウト計算
    const layoutMap = new Map<string, { x: number; y: number; z: number; depth: number }>();
    let currentLeafY = 0;
    const xSpacing = 5;
    const ySpacing = 1.8;

    const computeLayout = (node: FileNode, level: number) => {
      if (!node.children || node.children.length === 0) {
        layoutMap.set(node.path, {
          x: level * xSpacing,
          y: -currentLeafY * ySpacing,
          z: 0,
          depth: level,
        });
        currentLeafY++;
        return;
      }

      let minChildY = Infinity;
      let maxChildY = -Infinity;

      node.children.forEach((child) => {
        computeLayout(child, level + 1);
        const childPos = layoutMap.get(child.path)!;
        minChildY = Math.min(minChildY, childPos.y);
        maxChildY = Math.max(maxChildY, childPos.y);
      });

      const y = (minChildY + maxChildY) / 2;
      layoutMap.set(node.path, { x: level * xSpacing, y, z: 0, depth: level });
    };

    computeLayout(data, 0);

    // バウンディングボックス計算
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity,
      minZ = Infinity,
      maxZ = -Infinity;

    layoutMap.forEach((pos) => {
      minX = Math.min(minX, pos.x);
      maxX = Math.max(maxX, pos.x);
      minY = Math.min(minY, pos.y);
      maxY = Math.max(maxY, pos.y);
      minZ = Math.min(minZ, pos.z);
      maxZ = Math.max(maxZ, pos.z);
    });

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const centerZ = (minZ + maxZ) / 2;

    // ノードと接続線の生成
    const generateElements = (node: FileNode) => {
      const pos = layoutMap.get(node.path)!;
      generatedNodes.push(
        <Node
          key={node.path}
          node={node}
          position={[pos.x, pos.y, pos.z]}
          depth={pos.depth}
          onHover={onHover}
        />
      );

      if (node.children) {
        node.children.forEach((child) => {
          const childPos = layoutMap.get(child.path)!;
          generatedConnections.push(
            <Connection
              key={`${node.path}-${child.path}`}
              start={[pos.x, pos.y, pos.z]}
              end={[childPos.x, childPos.y, childPos.z]}
            />
          );
          generateElements(child);
        });
      }
    };

    generateElements(data);

    return {
      nodes: generatedNodes,
      connections: generatedConnections,
      center: [centerX, centerY, centerZ] as [number, number, number],
      size: [maxX - minX, maxY - minY, maxZ - minZ] as [number, number, number],
    };
  }, [data, onHover]);

  useEffect(() => {
    onLayout(center, size);
  }, [center, size, onLayout]);

  return (
    <>
      {connections}
      {nodes}
    </>
  );
};

interface SceneProps {
  data: FileNode;
}

/**
 * メインシーンコンポーネント
 */
const Scene = ({ data }: SceneProps) => {
  const [layoutInfo, setLayoutInfo] = useState<{
    center: [number, number, number];
    size: [number, number, number];
  } | null>(null);

  const [hoveredNode, setHoveredNode] = useState<{
    node: FileNode;
    position: [number, number, number];
  } | null>(null);

  const handleHover = useCallback(
    (node: FileNode | null, position: [number, number, number] | null) => {
      if (node && position) {
        setHoveredNode({ node, position });
      } else {
        setHoveredNode(null);
      }
    },
    []
  );

  return (
    <>
      {/* ライティング */}
      <ambientLight intensity={0.3} />
      <pointLight position={[20, 20, 20]} intensity={1} color="#ffffff" />
      <pointLight position={[-20, -20, 20]} intensity={0.5} color="#3b82f6" />

      {/* 背景演出 */}
      <BackgroundGrid />
      <Particles />
      <fog attach="fog" args={['#0a0a1a', 50, 200]} />

      {/* コントロール */}
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.05}
        minDistance={5}
        maxDistance={200}
      />

      {/* ファイルツリー */}
      <Tree
        data={data}
        onLayout={(center, size) => setLayoutInfo({ center, size })}
        onHover={handleHover}
      />

      {/* ホバー情報表示 */}
      {hoveredNode && <HoverInfo node={hoveredNode.node} position={hoveredNode.position} />}

      {/* カメラ自動調整 */}
      {layoutInfo && <CameraController center={layoutInfo.center} size={layoutInfo.size} />}

      {/* ポストプロセス効果 */}
      <EffectComposer>
        <Bloom luminanceThreshold={0.2} luminanceSmoothing={0.9} intensity={0.8} />
        <Vignette eskil={false} offset={0.1} darkness={0.8} />
      </EffectComposer>
    </>
  );
};

interface TreeSceneProps {
  data: FileNode;
}

export const TreeScene = ({ data }: TreeSceneProps) => (
  <Canvas
    camera={{ position: [0, 0, 30], fov: 60 }}
    gl={{ antialias: true, alpha: false }}
    style={{ background: 'linear-gradient(180deg, #0a0a1a 0%, #1a1a2e 50%, #0f0f23 100%)' }}
  >
    <Scene data={data} />
  </Canvas>
);
