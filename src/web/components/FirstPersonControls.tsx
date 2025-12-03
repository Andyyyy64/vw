import { useEffect, useRef, useCallback } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface FirstPersonControlsProps {
  /** 移動速度 */
  speed?: number;
  /** ダッシュ時の速度倍率 */
  sprintMultiplier?: number;
  /** マウス感度 */
  sensitivity?: number;
  /** 初期位置 */
  initialPosition?: [number, number, number];
  /** 初期向き（Y軸回転、度数法） */
  initialRotation?: number;
  /** 地面の高さ */
  groundHeight?: number;
  /** 有効かどうか */
  enabled?: boolean;
  /** 飛行モード変更コールバック */
  onFlyModeChange?: (flying: boolean) => void;
  /** 初期飛行モード */
  initialFlyMode?: boolean;
}

/**
 * WASD + マウスルック による一人称視点コントロール
 * クリックでポインターロック、ESCで解除
 * Space: ジャンプ / ダブルSpace: 飛行モード切替
 */
export const FirstPersonControls = ({
  speed = 15,
  sprintMultiplier = 2,
  sensitivity = 0.002,
  initialPosition = [0, 2, 10],
  initialRotation = 0,
  groundHeight = 2,
  enabled = true,
  onFlyModeChange,
  initialFlyMode = false,
}: FirstPersonControlsProps) => {
  const { camera, gl } = useThree();

  // キー入力状態
  const keys = useRef({
    forward: false,
    backward: false,
    left: false,
    right: false,
    sprint: false,
    up: false,
    down: false,
  });

  // 回転状態（オイラー角）
  const euler = useRef(new THREE.Euler(0, initialRotation * (Math.PI / 180), 0, 'YXZ'));

  // ポインターロック状態
  const isLocked = useRef(false);

  // ジャンプ・飛行状態
  const verticalVelocity = useRef(0);
  const isFlying = useRef(initialFlyMode);
  const lastSpaceTime = useRef(0);
  const isOnGround = useRef(!initialFlyMode);

  // 初期位置設定
  useEffect(() => {
    camera.position.set(...initialPosition);
    euler.current.y = initialRotation * (Math.PI / 180);
    camera.rotation.copy(euler.current);
  }, [camera, initialPosition, initialRotation]);

  // マウス移動ハンドラ
  const onMouseMove = useCallback(
    (event: MouseEvent) => {
      if (!isLocked.current || !enabled) return;

      const movementX = event.movementX || 0;
      const movementY = event.movementY || 0;

      euler.current.y -= movementX * sensitivity;
      euler.current.x -= movementY * sensitivity;

      // 上下の視点制限（真上・真下は見えないように）
      euler.current.x = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, euler.current.x));

      camera.rotation.copy(euler.current);
    },
    [camera, sensitivity, enabled]
  );

  // キーダウンハンドラ
  const onKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      switch (event.code) {
        case 'KeyW':
        case 'ArrowUp':
          keys.current.forward = true;
          break;
        case 'KeyS':
        case 'ArrowDown':
          keys.current.backward = true;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          keys.current.left = true;
          break;
        case 'KeyD':
        case 'ArrowRight':
          keys.current.right = true;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          keys.current.sprint = true;
          break;
        case 'Space': {
          event.preventDefault();
          // 飛行中は上昇キーとして扱う
          if (isFlying.current) {
            keys.current.up = true;
          }
          break;
        }
        case 'KeyQ':
        case 'ControlLeft':
        case 'ControlRight':
          // 飛行中は下降
          keys.current.down = true;
          break;
      }
    },
    [enabled, onFlyModeChange]
  );

  // キーアップハンドラ
  const onKeyUp = useCallback(
    (event: KeyboardEvent) => {
      switch (event.code) {
        case 'KeyW':
        case 'ArrowUp':
          keys.current.forward = false;
          break;
        case 'KeyS':
        case 'ArrowDown':
          keys.current.backward = false;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          keys.current.left = false;
          break;
        case 'KeyD':
        case 'ArrowRight':
          keys.current.right = false;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          keys.current.sprint = false;
          break;
        case 'Space': {
          keys.current.up = false;
          const now = Date.now();
          // ダブルタップで飛行モード切替（キーアップ時に判定）
          if (now - lastSpaceTime.current < 300) {
            isFlying.current = !isFlying.current;
            if (onFlyModeChange) onFlyModeChange(isFlying.current);
            verticalVelocity.current = 0;
            lastSpaceTime.current = 0; // リセット
          } else if (!isFlying.current && isOnGround.current) {
            // ジャンプ
            verticalVelocity.current = 12;
            isOnGround.current = false;
          }
          lastSpaceTime.current = now;
          break;
        }
        case 'KeyQ':
        case 'ControlLeft':
        case 'ControlRight':
          keys.current.down = false;
          break;
      }
    },
    [onFlyModeChange]
  );

  // ポインターロック変更ハンドラ
  const onPointerLockChange = useCallback(() => {
    isLocked.current = document.pointerLockElement === gl.domElement;
  }, [gl]);

  // クリックでポインターロック
  const onClick = useCallback(() => {
    if (enabled && !isLocked.current) {
      gl.domElement.requestPointerLock();
    }
  }, [gl, enabled]);

  // イベントリスナー登録
  useEffect(() => {
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    document.addEventListener('pointerlockchange', onPointerLockChange);
    gl.domElement.addEventListener('click', onClick);

    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
      document.removeEventListener('pointerlockchange', onPointerLockChange);
      gl.domElement.removeEventListener('click', onClick);
    };
  }, [onMouseMove, onKeyDown, onKeyUp, onPointerLockChange, onClick, gl]);

  // 毎フレームの移動処理
  useFrame((_, delta) => {
    if (!enabled) return;

    const actualSpeed = speed * (keys.current.sprint ? sprintMultiplier : 1);
    const moveDistance = actualSpeed * delta;

    // カメラの前方向ベクトル
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);

    // 飛行モードでなければ水平移動のみ
    if (!isFlying.current) {
      direction.y = 0;
    }
    direction.normalize();

    // 右方向ベクトル
    const right = new THREE.Vector3();
    right.crossVectors(new THREE.Vector3(0, 1, 0), direction).negate();
    right.normalize();

    // 移動ベクトルを計算
    const velocity = new THREE.Vector3();

    if (keys.current.forward) velocity.add(direction);
    if (keys.current.backward) velocity.sub(direction);
    if (keys.current.right) velocity.add(right);
    if (keys.current.left) velocity.sub(right);

    if (velocity.length() > 0) {
      velocity.normalize();
      velocity.multiplyScalar(moveDistance);
      camera.position.add(velocity);
    }

    // 垂直移動（ジャンプ/飛行）
    if (isFlying.current) {
      // 飛行モード
      let newY = camera.position.y;
      if (keys.current.up) {
        newY += moveDistance;
      }
      if (keys.current.down) {
        newY -= moveDistance;
      }
      // 最低高度制限
      camera.position.setY(Math.max(newY, groundHeight));
    } else {
      // 通常モード（重力あり）
      verticalVelocity.current -= 30 * delta; // 重力
      const newY = camera.position.y + verticalVelocity.current * delta;

      // 地面との衝突
      if (newY <= groundHeight) {
        camera.position.setY(groundHeight);
        verticalVelocity.current = 0;
        isOnGround.current = true;
      } else {
        camera.position.setY(newY);
      }
    }
  });

  return null;
};

/**
 * ポインターロックの状態を表示するオーバーレイ
 */
export const PointerLockOverlay = ({ isLocked }: { isLocked: boolean }) => {
  if (isLocked) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        background: 'rgba(0, 0, 0, 0.85)',
        padding: '40px 60px',
        borderRadius: '20px',
        textAlign: 'center',
        color: 'white',
        fontFamily: "'JetBrains Mono', monospace",
        border: '2px solid rgba(96, 165, 250, 0.5)',
        boxShadow: '0 0 60px rgba(96, 165, 250, 0.3)',
        backdropFilter: 'blur(10px)',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          fontSize: '32px',
          marginBottom: '10px',
          background: 'linear-gradient(135deg, #60a5fa, #a78bfa)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          fontWeight: 'bold',
        }}
      >
        🏙️ Code City
      </div>
      <div style={{ fontSize: '16px', opacity: 0.8, marginBottom: '25px' }}>
        Click anywhere to explore
      </div>
      <div style={{ fontSize: '13px', opacity: 0.7, lineHeight: 2 }}>
        <div>
          <kbd style={kbdStyle}>W</kbd>
          <kbd style={kbdStyle}>A</kbd>
          <kbd style={kbdStyle}>S</kbd>
          <kbd style={kbdStyle}>D</kbd> Move
        </div>
        <div>
          <kbd style={kbdStyle}>Mouse</kbd> Look around
        </div>
        <div>
          <kbd style={kbdStyle}>Space</kbd> Jump
          <span style={{ margin: '0 8px', opacity: 0.5 }}>|</span>
          <kbd style={kbdStyle}>Space</kbd>
          <kbd style={kbdStyle}>Space</kbd> Fly
        </div>
        <div>
          <kbd style={kbdStyle}>Q</kbd> Descend (flying)
          <span style={{ margin: '0 8px', opacity: 0.5 }}>|</span>
          <kbd style={kbdStyle}>Shift</kbd> Sprint
        </div>
      </div>
    </div>
  );
};

const kbdStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '4px 10px',
  margin: '2px',
  background: 'rgba(96, 165, 250, 0.2)',
  borderRadius: '6px',
  border: '1px solid rgba(96, 165, 250, 0.4)',
  fontSize: '12px',
};
