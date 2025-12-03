import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Stars, Text } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette, SMAA } from '@react-three/postprocessing';
import * as THREE from 'three';
import { FileNode } from '../../shared/fileNode';
import {
  CityNode,
  generateCityLayout,
  flattenBuildings,
  flattenDistricts,
  getLayoutBounds,
} from '../utils/cityLayout';
import { getColorForExtension } from '../utils/colors';
import { FirstPersonControls, PointerLockOverlay, ColliderBox } from './FirstPersonControls';

// ============================
// 型定義
// ============================

interface BuildingData {
  position: [number, number, number];
  scale: [number, number, number];
  color: string;
  emissive: string;
  node: CityNode;
}

interface DistrictData {
  position: [number, number, number];
  scale: [number, number, number];
  depth: number;
  node: CityNode;
}

// ============================
// 定数
// ============================

const DISTRICT_COLORS = [
  '#2a2a4a',
  '#1e3a5f',
  '#2d3748',
  '#1a365d',
  '#2c3e50',
  '#1f2937',
  '#374151',
  '#1e293b',
];

// ============================
// ビル群（クロスヘア中央でホバー判定）
// ============================

interface BuildingsProps {
  buildings: BuildingData[];
  onHover: (node: CityNode | null) => void;
}

const Buildings = ({ buildings, onHover }: BuildingsProps) => {
  const { camera } = useThree();
  const groupRef = useRef<THREE.Group>(null);
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const hoveredIndexRef = useRef<number | null>(null);
  const meshRefs = useRef<(THREE.Mesh | null)[]>([]);

  // 窓パターンのテクスチャを生成（キャッシュ）
  const windowTextures = useMemo(() => {
    return buildings.map((data) => {
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 128;
      const ctx = canvas.getContext('2d')!;

      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, 64, 128);

      const windowColor = data.emissive;
      for (let y = 8; y < 128; y += 16) {
        for (let x = 8; x < 64; x += 16) {
          const seed = (data.position[0] * 1000 + data.position[2] * 100 + x + y) % 100;
          if (seed > 30) {
            ctx.fillStyle = windowColor;
            ctx.globalAlpha = 0.6 + (seed % 40) / 100;
            ctx.fillRect(x, y, 10, 12);
          }
        }
      }

      const texture = new THREE.CanvasTexture(canvas);
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(1, data.scale[1] / 3);
      return texture;
    });
  }, [buildings]);

  // 画面中央からレイキャストでホバー判定
  useFrame(() => {
    if (!groupRef.current) return;

    // 画面中央（クロスヘア）からレイキャスト
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);

    const meshes = meshRefs.current.filter((m): m is THREE.Mesh => m !== null);
    const intersects = raycaster.intersectObjects(meshes, false);

    let newHoveredIndex: number | null = null;

    if (intersects.length > 0) {
      const hitMesh = intersects[0].object as THREE.Mesh;
      const idx = meshRefs.current.indexOf(hitMesh);
      if (idx !== -1) {
        newHoveredIndex = idx;
      }
    }

    // ホバー状態が変わった時だけコールバック
    if (newHoveredIndex !== hoveredIndexRef.current) {
      // 前のホバー解除
      if (hoveredIndexRef.current !== null) {
        const prevMesh = meshRefs.current[hoveredIndexRef.current];
        if (prevMesh) {
          const mat = prevMesh.material as THREE.MeshStandardMaterial;
          mat.emissiveIntensity = 0.4;
        }
      }

      // 新しいホバー設定
      if (newHoveredIndex !== null) {
        const newMesh = meshRefs.current[newHoveredIndex];
        if (newMesh) {
          const mat = newMesh.material as THREE.MeshStandardMaterial;
          mat.emissiveIntensity = 0.8;
        }
        onHover(buildings[newHoveredIndex].node);
      } else {
        onHover(null);
      }

      hoveredIndexRef.current = newHoveredIndex;
    }
  });

  return (
    <group ref={groupRef}>
      {buildings.map((b, i) => (
        <mesh
          key={i}
          ref={(el) => {
            meshRefs.current[i] = el;
          }}
          position={b.position}
          castShadow
          receiveShadow
        >
          <boxGeometry args={b.scale} />
          <meshStandardMaterial
            map={windowTextures[i]}
            color={b.color}
            emissive={b.emissive}
            emissiveIntensity={0.4}
            roughness={0.5}
            metalness={0.3}
          />
        </mesh>
      ))}
    </group>
  );
};

// ============================
// ディレクトリ区画（地面）+ ラベル
// ============================

interface DistrictsProps {
  districts: DistrictData[];
}

const Districts = ({ districts }: DistrictsProps) => {
  return (
    <group>
      {districts.map((d, i) => (
        <group key={i}>
          {/* 地面 */}
          <mesh position={d.position} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[d.scale[0], d.scale[2]]} />
            <meshStandardMaterial
              color={DISTRICT_COLORS[d.depth % DISTRICT_COLORS.length]}
              roughness={0.8}
              metalness={0.2}
            />
          </mesh>
          {/* ディレクトリ名ラベル（深さ1のみ） */}
          {d.depth === 1 && d.scale[0] > 5 && (
            <Text
              position={[d.position[0], 0.1, d.position[2]]}
              rotation={[-Math.PI / 2, 0, 0]}
              fontSize={Math.min(d.scale[0] / 6, 2)}
              color="#60a5fa"
              anchorX="center"
              anchorY="middle"
              outlineWidth={0.05}
              outlineColor="#000000"
            >
              {d.node.name}
            </Text>
          )}
        </group>
      ))}
    </group>
  );
};

// ============================
// 道路と地面
// ============================

interface RoadsProps {
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
}

const Roads = ({ bounds }: RoadsProps) => {
  const width = bounds.maxX - bounds.minX + 40;
  const depth = bounds.maxZ - bounds.minZ + 40;
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerZ = (bounds.minZ + bounds.maxZ) / 2;

  // 道路のグリッドパターン
  const roadTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    // アスファルト
    ctx.fillStyle = '#1a1a1f';
    ctx.fillRect(0, 0, 256, 256);

    // 道路マーキング（グリッド）
    ctx.strokeStyle = '#2a2a3f';
    ctx.lineWidth = 2;
    for (let i = 0; i <= 256; i += 32) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 256);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(256, i);
      ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(width / 10, depth / 10);
    return texture;
  }, [width, depth]);

  return (
    <mesh position={[centerX, -0.02, centerZ]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[width, depth]} />
      <meshStandardMaterial map={roadTexture} roughness={0.95} metalness={0.05} />
    </mesh>
  );
};

// ============================
// 街灯（シンプル版 - ポイントライトなし）
// ============================

interface StreetLightsProps {
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
}

const StreetLights = ({ bounds }: StreetLightsProps) => {
  const lights = useMemo(() => {
    const result: [number, number, number][] = [];
    const spacing = 25; // より広い間隔

    // ライトの数を制限
    let count = 0;
    const maxLights = 50;

    for (let x = bounds.minX; x <= bounds.maxX && count < maxLights; x += spacing) {
      for (let z = bounds.minZ; z <= bounds.maxZ && count < maxLights; z += spacing) {
        result.push([x, 0, z]);
        count++;
      }
    }
    return result;
  }, [bounds]);

  return (
    <group>
      {lights.map((pos, i) => (
        <group key={i} position={pos}>
          {/* ポール */}
          <mesh position={[0, 3, 0]}>
            <cylinderGeometry args={[0.05, 0.08, 6, 6]} />
            <meshStandardMaterial color="#3a3a4a" metalness={0.8} roughness={0.2} />
          </mesh>
          {/* ライトの光源球（発光するだけ、ポイントライトなし） */}
          <mesh position={[0, 6, 0]}>
            <sphereGeometry args={[0.3, 8, 8]} />
            <meshStandardMaterial color="#fef3c7" emissive="#fef3c7" emissiveIntensity={3} />
          </mesh>
        </group>
      ))}
    </group>
  );
};

// ============================
// 環境（空・ライティング）
// ============================

const Environment = () => {
  return (
    <>
      {/* 夜空（薄暮） */}
      <color attach="background" args={['#1a1a2e']} />
      <Stars radius={300} depth={100} count={2000} factor={4} saturation={0.5} fade speed={0.3} />

      {/* 環境光（明るめ） */}
      <ambientLight intensity={0.8} color="#8892a8" />

      {/* メイン光源（月光風） */}
      <directionalLight
        position={[100, 150, 50]}
        intensity={1.2}
        color="#e0e7ff"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-far={200}
        shadow-camera-left={-100}
        shadow-camera-right={100}
        shadow-camera-top={100}
        shadow-camera-bottom={-100}
      />

      {/* 補助光（青系） */}
      <hemisphereLight color="#93c5fd" groundColor="#312e81" intensity={0.6} />

      {/* フォグ（薄め、遠景をふんわり） */}
      <fog attach="fog" args={['#1a1a2e', 80, 250]} />
    </>
  );
};

// ============================
// ホバー時の情報表示
// ============================

interface BuildingInfoProps {
  node: CityNode | null;
}

const BuildingInfo = ({ node }: BuildingInfoProps) => {
  if (!node) return null;

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '100px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'linear-gradient(135deg, rgba(15, 15, 30, 0.95), rgba(30, 41, 59, 0.9))',
        padding: '20px 30px',
        borderRadius: '16px',
        color: 'white',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '14px',
        border: '1px solid rgba(96, 165, 250, 0.4)',
        boxShadow: '0 0 30px rgba(96, 165, 250, 0.2)',
        backdropFilter: 'blur(10px)',
        zIndex: 100,
        maxWidth: '600px',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          fontWeight: 'bold',
          fontSize: '18px',
          color: getColorForExtension(node.name),
          marginBottom: '8px',
          textShadow: `0 0 10px ${getColorForExtension(node.name)}40`,
        }}
      >
        🏢 {node.name}
      </div>
      <div style={{ opacity: 0.6, fontSize: '12px', marginBottom: '8px' }}>{node.path}</div>
      {node.size > 0 && (
        <div
          style={{
            display: 'flex',
            gap: '20px',
            justifyContent: 'center',
            marginTop: '10px',
            padding: '10px',
            background: 'rgba(0,0,0,0.3)',
            borderRadius: '8px',
          }}
        >
          <div>
            <span style={{ opacity: 0.6 }}>Size:</span>{' '}
            <span style={{ color: '#60a5fa' }}>{formatSize(node.size)}</span>
          </div>
          <div>
            <span style={{ opacity: 0.6 }}>Height:</span>{' '}
            <span style={{ color: '#a78bfa' }}>{node.height.toFixed(1)} floors</span>
          </div>
        </div>
      )}
    </div>
  );
};

const formatSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// ============================
// クロスヘア（照準）
// ============================

const Crosshair = () => (
  <div
    style={{
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: '24px',
      height: '24px',
      pointerEvents: 'none',
      zIndex: 50,
    }}
  >
    <div
      style={{
        position: 'absolute',
        top: '50%',
        left: '0',
        right: '0',
        height: '2px',
        background: 'rgba(255, 255, 255, 0.7)',
        transform: 'translateY(-50%)',
        boxShadow: '0 0 4px rgba(96, 165, 250, 0.5)',
      }}
    />
    <div
      style={{
        position: 'absolute',
        left: '50%',
        top: '0',
        bottom: '0',
        width: '2px',
        background: 'rgba(255, 255, 255, 0.7)',
        transform: 'translateX(-50%)',
        boxShadow: '0 0 4px rgba(96, 165, 250, 0.5)',
      }}
    />
  </div>
);

// ============================
// 操作説明HUD
// ============================

interface ControlsHUDProps {
  isFlying: boolean;
}

const ControlsHUD = ({ isFlying }: ControlsHUDProps) => (
  <div
    style={{
      position: 'absolute',
      bottom: '20px',
      right: '20px',
      background: 'rgba(15, 15, 30, 0.85)',
      padding: '15px 20px',
      borderRadius: '12px',
      color: 'rgba(255, 255, 255, 0.7)',
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: '11px',
      border: '1px solid rgba(96, 165, 250, 0.3)',
      zIndex: 100,
    }}
  >
    {isFlying && (
      <div
        style={{
          color: '#a78bfa',
          marginBottom: '8px',
          fontWeight: 'bold',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}
      >
        ✈️ Flying Mode
      </div>
    )}
    <div>
      <kbd style={kbdStyle}>W</kbd>
      <kbd style={kbdStyle}>A</kbd>
      <kbd style={kbdStyle}>S</kbd>
      <kbd style={kbdStyle}>D</kbd> Move
    </div>
    <div style={{ marginTop: '4px' }}>
      <kbd style={kbdStyle}>Space</kbd> {isFlying ? 'Up' : 'Jump'}
    </div>
    {isFlying && (
      <div style={{ marginTop: '4px' }}>
        <kbd style={kbdStyle}>Q</kbd> Down
      </div>
    )}
    <div style={{ marginTop: '4px' }}>
      <kbd style={kbdStyle}>Shift</kbd> Sprint
    </div>
    <div style={{ marginTop: '4px', opacity: 0.6 }}>
      <kbd style={kbdStyle}>Space</kbd>×2 Toggle fly
    </div>
  </div>
);

const kbdStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '2px 6px',
  margin: '1px',
  background: 'rgba(96, 165, 250, 0.2)',
  borderRadius: '4px',
  fontSize: '10px',
  border: '1px solid rgba(96, 165, 250, 0.3)',
};

// ============================
// メインシーンコンテンツ
// ============================

interface CityContentProps {
  layout: CityNode;
  onHover: (node: CityNode | null) => void;
  onFlyModeChange: (flying: boolean) => void;
}

const CityContent = ({ layout, onHover, onFlyModeChange }: CityContentProps) => {
  // ビルとディストリクトをフラット化
  const buildings = useMemo(() => {
    const flattened = flattenBuildings(layout);
    return flattened.map((b): BuildingData => {
      const color = getColorForExtension(b.name);
      return {
        position: [b.x + b.width / 2, b.height / 2, b.z + b.depth_z / 2],
        scale: [b.width, b.height, b.depth_z],
        color: color,
        emissive: color,
        node: b,
      };
    });
  }, [layout]);

  const colliders = useMemo<ColliderBox[]>(() => {
    const padding = 0.3; // 壁から少し離して当たり判定
    return buildings.map((b) => {
      const halfW = b.scale[0] / 2 + padding;
      const halfD = b.scale[2] / 2 + padding;
      return {
        minX: b.position[0] - halfW,
        maxX: b.position[0] + halfW,
        minZ: b.position[2] - halfD,
        maxZ: b.position[2] + halfD,
        maxY: b.scale[1],
      };
    });
  }, [buildings]);

  const districts = useMemo(() => {
    const flattened = flattenDistricts(layout);
    return flattened.map(
      (d): DistrictData => ({
        position: [d.x + d.width / 2, 0.02 + d.depth * 0.02, d.z + d.depth_z / 2],
        scale: [d.width, 1, d.depth_z],
        depth: d.depth,
        node: d,
      })
    );
  }, [layout]);

  const bounds = useMemo(() => getLayoutBounds(layout), [layout]);

  // 初期カメラ位置（都市の中心、高めから見下ろす）
  const initialPosition = useMemo((): [number, number, number] => {
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerZ = (bounds.minZ + bounds.maxZ) / 2;
    // 高い位置から俯瞰できるように
    return [centerX, 30, centerZ + 20];
  }, [bounds]);

  return (
    <>
      <Environment />
      <Roads bounds={bounds} />
      <Districts districts={districts} />
      <Buildings buildings={buildings} onHover={onHover} />
      <StreetLights bounds={bounds} />
      <FirstPersonControls
        initialPosition={initialPosition}
        speed={8}
        sprintMultiplier={1.5}
        groundHeight={2}
        onFlyModeChange={onFlyModeChange}
        initialFlyMode={true}
        colliders={colliders}
        colliderRadius={0.9}
      />
    </>
  );
};

// ============================
// メインコンポーネント
// ============================

interface CitySceneProps {
  data: FileNode;
}

export const CityScene = ({ data }: CitySceneProps) => {
  const [hoveredNode, setHoveredNode] = useState<CityNode | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [isFlying, setIsFlying] = useState(true);

  // レイアウト計算（メモ化）
  // 都市サイズを固定して、大規模プロジェクトでもコンパクトに
  const layout = useMemo(() => {
    return generateCityLayout(data, 0, 0, 80, 80);
  }, [data]);

  // ポインターロック状態の監視
  useEffect(() => {
    const handleChange = () => {
      setIsLocked(document.pointerLockElement !== null);
    };
    document.addEventListener('pointerlockchange', handleChange);
    return () => document.removeEventListener('pointerlockchange', handleChange);
  }, []);

  const handleHover = useCallback((node: CityNode | null) => {
    setHoveredNode(node);
  }, []);

  const handleFlyModeChange = useCallback((flying: boolean) => {
    setIsFlying(flying);
  }, []);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <Canvas
        camera={{ fov: 75, near: 0.1, far: 1000 }}
        shadows
        gl={{ antialias: true, alpha: false }}
      >
        <CityContent layout={layout} onHover={handleHover} onFlyModeChange={handleFlyModeChange} />
        <EffectComposer>
          <Bloom intensity={0.5} luminanceThreshold={0.4} luminanceSmoothing={0.9} />
          <Vignette eskil={false} offset={0.1} darkness={0.5} />
          <SMAA />
        </EffectComposer>
      </Canvas>

      {/* UI オーバーレイ */}
      {!isLocked && <PointerLockOverlay isLocked={isLocked} />}
      {isLocked && <Crosshair />}
      {isLocked && <ControlsHUD isFlying={isFlying} />}
      {isLocked && <BuildingInfo node={hoveredNode} />}
    </div>
  );
};

export default CityScene;
