import React, { useEffect, useState } from 'react';
import { TreeScene } from './components/TreeScene';
import { StatsPanel } from './components/StatsPanel';
import { FileNode } from '../shared/fileNode';

/**
 * メインアプリケーションコンポーネント
 * ディレクトリ構造をフェッチして3Dで可視化
 */
const App = () => {
  const [data, setData] = useState<FileNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/structure')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch structure');
        return res.json();
      })
      .then((payload: FileNode) => {
        setData(payload);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  // ローディング画面
  if (loading) {
    return (
      <div
        style={{
          width: '100vw',
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(180deg, #0a0a1a 0%, #1a1a2e 50%, #0f0f23 100%)',
          color: 'white',
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        }}
      >
        <div
          style={{
            width: '60px',
            height: '60px',
            border: '3px solid rgba(59, 130, 246, 0.3)',
            borderTop: '3px solid #3b82f6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            marginBottom: '20px',
          }}
        />
        <style>
          {`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}
        </style>
        <div style={{ fontSize: '18px', color: '#60a5fa' }}>Scanning directory...</div>
        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '8px' }}>
          Building visualization
        </div>
      </div>
    );
  }

  // エラー画面
  if (error || !data) {
    return (
      <div
        style={{
          width: '100vw',
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(180deg, #0a0a1a 0%, #1a1a2e 50%, #0f0f23 100%)',
          color: 'white',
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        }}
      >
        <div style={{ fontSize: '48px', marginBottom: '20px' }}>⚠️</div>
        <div style={{ fontSize: '18px', color: '#f87171' }}>Failed to load directory</div>
        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '8px' }}>{error}</div>
      </div>
    );
  }

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <TreeScene data={data} />
      <StatsPanel data={data} />

      {/* 操作ヒント */}
      <div
        style={{
          position: 'absolute',
          bottom: '20px',
          right: '20px',
          background: 'rgba(15, 23, 42, 0.8)',
          padding: '12px 16px',
          borderRadius: '8px',
          color: '#64748b',
          fontSize: '11px',
          fontFamily: "'JetBrains Mono', monospace",
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(100, 116, 139, 0.2)',
        }}
      >
        <div style={{ marginBottom: '4px' }}>
          <span style={{ color: '#94a3b8' }}>🖱️ Drag</span> to rotate
        </div>
        <div style={{ marginBottom: '4px' }}>
          <span style={{ color: '#94a3b8' }}>⚙️ Scroll</span> to zoom
        </div>
        <div>
          <span style={{ color: '#94a3b8' }}>👆 Hover</span> for details
        </div>
      </div>

      {/* プロジェクト名表示 */}
      <div
        style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          background: 'rgba(15, 23, 42, 0.8)',
          padding: '12px 20px',
          borderRadius: '8px',
          fontFamily: "'JetBrains Mono', monospace",
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(100, 116, 139, 0.2)',
        }}
      >
        <div
          style={{
            color: '#64748b',
            fontSize: '10px',
            textTransform: 'uppercase',
            marginBottom: '4px',
          }}
        >
          Project
        </div>
        <div style={{ color: '#60a5fa', fontSize: '16px', fontWeight: 'bold' }}>{data.name}</div>
      </div>
    </div>
  );
};

export default App;
