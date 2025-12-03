import React, { useEffect, useState } from 'react';
import { CityScene } from './components/CityScene';
import { StatsPanel } from './components/StatsPanel';
import { FileNode } from '../shared/fileNode';

/**
 * メインアプリケーションコンポーネント
 * ディレクトリ構造をフェッチして Code City として可視化
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
        {/* 都市アイコンアニメーション */}
        <div
          style={{
            fontSize: '64px',
            marginBottom: '20px',
            animation: 'pulse 2s ease-in-out infinite',
          }}
        >
          🏙️
        </div>
        <style>
          {`
            @keyframes pulse {
              0%, 100% { transform: scale(1); opacity: 1; }
              50% { transform: scale(1.1); opacity: 0.8; }
            }
            @keyframes slideUp {
              from { transform: translateY(10px); opacity: 0; }
              to { transform: translateY(0); opacity: 1; }
            }
          `}
        </style>
        <div
          style={{
            fontSize: '24px',
            fontWeight: 'bold',
            background: 'linear-gradient(135deg, #60a5fa, #a78bfa)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            marginBottom: '8px',
          }}
        >
          Code City
        </div>
        <div style={{ fontSize: '14px', color: '#64748b', animation: 'slideUp 0.5s ease-out' }}>
          Building your project...
        </div>
        <div
          style={{
            marginTop: '30px',
            display: 'flex',
            gap: '8px',
          }}
        >
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              style={{
                width: '8px',
                height: '30px',
                background: `linear-gradient(180deg, #3b82f6, #1e3a5f)`,
                borderRadius: '2px',
                animation: `building 1s ease-in-out ${i * 0.1}s infinite`,
              }}
            />
          ))}
        </div>
        <style>
          {`
            @keyframes building {
              0%, 100% { height: 30px; }
              50% { height: 50px; }
            }
          `}
        </style>
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
        <div style={{ fontSize: '48px', marginBottom: '20px' }}>🏚️</div>
        <div style={{ fontSize: '18px', color: '#f87171' }}>Failed to build city</div>
        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '8px' }}>{error}</div>
      </div>
    );
  }

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <CityScene data={data} />
      <StatsPanel data={data} />

      {/* プロジェクト名表示 */}
      <div
        style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          background: 'rgba(10, 10, 26, 0.9)',
          padding: '12px 20px',
          borderRadius: '8px',
          fontFamily: "'JetBrains Mono', monospace",
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          zIndex: 100,
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
          🏙️ Code City
        </div>
        <div style={{ color: '#60a5fa', fontSize: '16px', fontWeight: 'bold' }}>{data.name}</div>
      </div>
    </div>
  );
};

export default App;
