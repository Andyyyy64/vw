import express from 'express';
import open from 'open';
import cors from 'cors';
import path from 'path';
import { scanDirectory } from './scanner';

export const startServer = (rootDir: string, port: number = 5554) => {
  const app = express();

  app.use(cors());
  app.use(express.json());

  // Serve static files from the web app build
  // Assuming the web app is built to dist/web
  const webDistPath = path.join(__dirname, '../../web');
  app.use(express.static(webDistPath));

  // API to get directory structure
  app.get('/api/structure', async (req, res) => {
    try {
      const structure = await scanDirectory(rootDir);
      res.json(structure);
    } catch (error) {
      console.error('Error scanning directory:', error);
      res.status(500).json({ error: 'Failed to scan directory' });
    }
  });

  // Fallback for SPA routing
  app.use((req, res) => {
    res.sendFile(path.join(webDistPath, 'index.html'));
  });

  app.listen(port, async () => {
    const url = `http://localhost:${port}`;
    console.log(`Server running at ${url}`);
    await open(url);
  });
};
