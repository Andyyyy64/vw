import fs from 'fs/promises';
import path from 'path';
import { FileNode } from '../shared/fileNode';

export const scanDirectory = async (dirPath: string): Promise<FileNode> => {
  const stats = await fs.stat(dirPath);
  const name = path.basename(dirPath);

  if (!stats.isDirectory()) {
    return {
      name,
      path: dirPath,
      type: 'file',
      size: stats.size,
    };
  }

  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const children: FileNode[] = [];

  for (const entry of entries) {
    // Skip node_modules and .git for performance and clarity
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') {
      continue;
    }

    const fullPath = path.join(dirPath, entry.name);
    const childNode = await scanDirectory(fullPath);
    children.push(childNode);
  }

  return {
    name,
    path: dirPath,
    type: 'directory',
    children,
  };
};
