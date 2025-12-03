import React, { useEffect, useState, useMemo } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Text, Line, Billboard } from '@react-three/drei';
import * as THREE from 'three';

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
  size?: number;
}

const Node = ({ node, position }: { node: FileNode; position: [number, number, number] }) => {
  const isDir = node.type === 'directory';
  const color = isDir ? '#4a9eff' : '#ff6b6b';

  return (
    <group position={position}>
      <mesh>
        {isDir ? <sphereGeometry args={[0.4, 32, 32]} /> : <boxGeometry args={[0.3, 0.3, 0.3]} />}
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.2} />
      </mesh>
      <Billboard>
        <Text
          position={[0, -0.6, 0]}
          fontSize={0.2}
          color="white"
          anchorX="center"
          anchorY="middle"
        >
          {node.name}
        </Text>
      </Billboard>
    </group>
  );
};

const Connection = ({
  start,
  end,
}: {
  start: [number, number, number];
  end: [number, number, number];
}) => {
  const direction = new THREE.Vector3()
    .subVectors(new THREE.Vector3(...end), new THREE.Vector3(...start))
    .normalize();

  // Shorten the line slightly so the arrowhead doesn't bury inside the node
  const lineEnd = new THREE.Vector3(...end).sub(direction.clone().multiplyScalar(0.4)); // Stop before target node

  return (
    <group>
      <Line
        points={[start, lineEnd.toArray()]}
        color="white"
        lineWidth={1}
        opacity={0.3}
        transparent
      />
      <mesh
        position={lineEnd.toArray()}
        quaternion={new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          direction
        )}
      >
        <coneGeometry args={[0.08, 0.2, 8]} />
        <meshBasicMaterial color="white" opacity={0.5} transparent />
      </mesh>
    </group>
  );
};

const CameraController = ({
  center,
  size,
}: {
  center: [number, number, number];
  size: [number, number, number];
}) => {
  const { camera, controls } = useThree();

  useEffect(() => {
    if (controls) {
      const orbitControls = controls as unknown as { target: THREE.Vector3; update: () => void };
      orbitControls.target.set(...center);
      orbitControls.update();
    }

    // Fit view
    const maxDim = Math.max(...size);
    const distance = maxDim * 1.5; // Zoom factor

    // Position camera relative to center
    camera.position.set(center[0], center[1], center[2] + distance);
    camera.lookAt(...center);
    camera.updateProjectionMatrix();
  }, [center, size, camera, controls]);

  return null;
};

const Tree = ({
  data,
  onLayout,
}: {
  data: FileNode;
  onLayout: (center: [number, number, number], size: [number, number, number]) => void;
}) => {
  const { nodes, connections, center, size } = useMemo(() => {
    const generatedNodes: React.ReactElement[] = [];
    const generatedConnections: React.ReactElement[] = [];

    // First pass: assign layout positions
    const layoutMap = new Map<string, { x: number; y: number; z: number }>();
    let currentLeafY = 0;
    const xSpacing = 4;
    const ySpacing = 1.5;

    const computeLayout = (node: FileNode, level: number) => {
      if (!node.children || node.children.length === 0) {
        layoutMap.set(node.path, { x: level * xSpacing, y: -currentLeafY * ySpacing, z: 0 });
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
      layoutMap.set(node.path, { x: level * xSpacing, y, z: 0 });
    };

    computeLayout(data, 0);

    // Calculate bounds
    let minX = Infinity,
      maxX = -Infinity;
    let minY = Infinity,
      maxY = -Infinity;
    let minZ = Infinity,
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

    const sizeX = maxX - minX;
    const sizeY = maxY - minY;
    const sizeZ = maxZ - minZ;

    // Second pass: generate elements
    const generateElements = (node: FileNode) => {
      const pos = layoutMap.get(node.path)!;
      generatedNodes.push(<Node key={node.path} node={node} position={[pos.x, pos.y, pos.z]} />);

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
      size: [sizeX, sizeY, sizeZ] as [number, number, number],
    };
  }, [data]);

  useEffect(() => {
    onLayout(center, size);
  }, [center, size, onLayout]);

  return (
    <>
      {nodes}
      {connections}
    </>
  );
};

const Scene = ({ data }: { data: FileNode }) => {
  const [layoutInfo, setLayoutInfo] = useState<{
    center: [number, number, number];
    size: [number, number, number];
  } | null>(null);

  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} />
      <OrbitControls makeDefault />
      <Tree data={data} onLayout={(center, size) => setLayoutInfo({ center, size })} />
      {layoutInfo && <CameraController center={layoutInfo.center} size={layoutInfo.size} />}
    </>
  );
};

const App = () => {
  const [data, setData] = useState<FileNode | null>(null);

  useEffect(() => {
    fetch('/api/structure')
      .then((res) => res.json())
      .then((data) => setData(data))
      .catch((err) => console.error(err));
  }, []);

  if (!data) return <div>Loading...</div>;

  return (
    <Canvas camera={{ position: [0, 0, 20], fov: 60 }}>
      <Scene data={data} />
    </Canvas>
  );
};

export default App;
