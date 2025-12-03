import React, { useMemo } from 'react';
import { FileNode } from '../../shared/fileNode';
import { calculateStats, getSortedExtensions } from '../utils/stats';
import { formatFileSize, getColorForExtension } from '../utils/colors';

interface StatsPanelProps {
  data: FileNode;
}

/**
 * ディレクトリ構造の統計情報を表示するHUDパネル
 */
export const StatsPanel = ({ data }: StatsPanelProps) => {
  const stats = useMemo(() => calculateStats(data), [data]);
  const topExtensions = useMemo(
    () => getSortedExtensions(stats.extensionCounts).slice(0, 8),
    [stats]
  );

  return (
    <div
      style={{
        position: 'absolute',
        top: '20px',
        left: '20px',
        background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.9), rgba(30, 41, 59, 0.85))',
        padding: '20px',
        borderRadius: '12px',
        color: 'white',
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        fontSize: '13px',
        minWidth: '260px',
        border: '1px solid rgba(59, 130, 246, 0.3)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        backdropFilter: 'blur(12px)',
        zIndex: 1000,
      }}
    >
      {/* タイトル */}
      <div
        style={{
          fontSize: '16px',
          fontWeight: 'bold',
          marginBottom: '16px',
          color: '#60a5fa',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <span style={{ fontSize: '20px' }}>🏙️</span>
        City Stats
      </div>

      {/* 概要統計 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '12px',
          marginBottom: '20px',
        }}
      >
        <StatCard label="Buildings" value={stats.totalFiles} color="#f472b6" icon="🏢" />
        <StatCard label="Districts" value={stats.totalDirectories} color="#4ade80" icon="🏘️" />
        <StatCard label="Max Depth" value={stats.maxDepth} color="#fbbf24" icon="📏" />
        <StatCard
          label="Total Size"
          value={formatFileSize(stats.totalSize)}
          color="#22d3ee"
          icon="💾"
        />
      </div>

      {/* 最大ファイル */}
      {stats.largestFile && (
        <div style={{ marginBottom: '20px' }}>
          <div
            style={{
              color: '#94a3b8',
              fontSize: '11px',
              marginBottom: '6px',
              textTransform: 'uppercase',
            }}
          >
            Largest File
          </div>
          <div
            style={{
              background: 'rgba(248, 113, 113, 0.1)',
              padding: '10px 12px',
              borderRadius: '8px',
              border: '1px solid rgba(248, 113, 113, 0.3)',
            }}
          >
            <div style={{ color: '#f87171', fontWeight: 'bold', marginBottom: '4px' }}>
              {stats.largestFile.name}
            </div>
            <div style={{ color: '#fbbf24', fontSize: '12px' }}>
              {formatFileSize(stats.largestFile.size)}
            </div>
          </div>
        </div>
      )}

      {/* ファイルタイプ内訳 */}
      <div>
        <div
          style={{
            color: '#94a3b8',
            fontSize: '11px',
            marginBottom: '10px',
            textTransform: 'uppercase',
          }}
        >
          File Types
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {topExtensions.map(({ ext, count }) => (
            <ExtensionBar key={ext} extension={ext} count={count} total={stats.totalFiles} />
          ))}
        </div>
      </div>
    </div>
  );
};

interface StatCardProps {
  label: string;
  value: string | number;
  color: string;
  icon: string;
}

/**
 * 統計値を表示するカードコンポーネント
 */
const StatCard = ({ label, value, color, icon }: StatCardProps) => (
  <div
    style={{
      background: 'rgba(30, 41, 59, 0.5)',
      padding: '10px 12px',
      borderRadius: '8px',
      border: '1px solid rgba(100, 116, 139, 0.2)',
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
      <span style={{ fontSize: '14px' }}>{icon}</span>
      <span style={{ color: '#64748b', fontSize: '10px', textTransform: 'uppercase' }}>
        {label}
      </span>
    </div>
    <div style={{ color, fontSize: '18px', fontWeight: 'bold' }}>{value}</div>
  </div>
);

interface ExtensionBarProps {
  extension: string;
  count: number;
  total: number;
}

/**
 * 拡張子ごとのファイル数を棒グラフで表示
 */
const ExtensionBar = ({ extension, count, total }: ExtensionBarProps) => {
  const percentage = (count / total) * 100;
  const color = getColorForExtension(`file.${extension}`);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div
        style={{
          width: '50px',
          fontSize: '11px',
          color: '#94a3b8',
          textAlign: 'right',
          fontFamily: 'monospace',
        }}
      >
        .{extension}
      </div>
      <div
        style={{
          flex: 1,
          height: '16px',
          background: 'rgba(30, 41, 59, 0.5)',
          borderRadius: '4px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${percentage}%`,
            height: '100%',
            background: `linear-gradient(90deg, ${color}, ${color}88)`,
            borderRadius: '4px',
            transition: 'width 0.3s ease',
          }}
        />
      </div>
      <div style={{ width: '30px', fontSize: '11px', color: '#64748b', textAlign: 'right' }}>
        {count}
      </div>
    </div>
  );
};
