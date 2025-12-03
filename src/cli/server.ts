import express from 'express';
import open from 'open';
import cors from 'cors';
import path from 'path';
import { scanDirectory } from './scanner';
import { scanDependencies } from './importScanner';
import { DependencyGraph } from '../shared/fileNode';

// 依存グラフのキャッシュ
let dependencyCache: DependencyGraph | null = null;
let dependencyCacheTime = 0;
const CACHE_TTL = 30000; // 30秒

export const startServer = (rootDir: string, port: number = 5554) => {
  const app = express();

  app.use(cors());
  app.use(express.json());

  // 静的ファイルを配信
  const webDistPath = path.join(__dirname, '../../web');
  app.use(express.static(webDistPath));

  // ディレクトリ構造を取得
  app.get('/api/structure', async (req, res) => {
    try {
      const structure = await scanDirectory(rootDir);
      res.json(structure);
    } catch (error) {
      console.error('Error scanning directory:', error);
      res.status(500).json({ error: 'Failed to scan directory' });
    }
  });

  // 依存グラフを取得（import 関係）
  app.get('/api/dependencies', async (req, res) => {
    try {
      const now = Date.now();

      // キャッシュが有効ならそれを返す
      if (dependencyCache && now - dependencyCacheTime < CACHE_TTL) {
        res.json(dependencyCache);
        return;
      }

      console.log('Scanning dependencies...');
      const dependencies = await scanDependencies(rootDir);
      dependencyCache = dependencies;
      dependencyCacheTime = now;

      console.log(`Found ${Object.keys(dependencies.imports).length} files with imports`);
      res.json(dependencies);
    } catch (error) {
      console.error('Error scanning dependencies:', error);
      res.status(500).json({ error: 'Failed to scan dependencies' });
    }
  });

  // SPA ルーティング用のフォールバック
  app.use((req, res) => {
    res.sendFile(path.join(webDistPath, 'index.html'));
  });

  app.listen(port, async () => {
    const url = `http://localhost:${port}`;
    console.log(`Server running at ${url}`);
    await open(url);
  });
};
