import fs from 'fs/promises';
import path from 'path';
import ignore from 'ignore';
import { FileNode } from '../shared/fileNode';

const scanDirectoryInternal = async (
  dirPath: string,
  rootPath: string,
  ig: ReturnType<typeof ignore>
): Promise<FileNode> => {
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
    const fullPath = path.join(dirPath, entry.name);
    // Calculate relative path from root for ignore matching
    const relativePath = path.relative(rootPath, fullPath);

    // Check if the entry should be ignored
    if (ig.ignores(relativePath)) {
      continue;
    }

    const childNode = await scanDirectoryInternal(fullPath, rootPath, ig);
    children.push(childNode);
  }

  return {
    name,
    path: dirPath,
    type: 'directory',
    children,
  };
};

export const scanDirectory = async (dirPath: string): Promise<FileNode> => {
  // Read .gitignore from the root directory
  const gitignorePath = path.join(dirPath, '.gitignore');
  let ig = ignore();

  try {
    const gitignoreContent = await fs.readFile(gitignorePath, 'utf-8');
    ig = ignore().add(gitignoreContent);
  } catch {
    // .gitignore doesn't exist, continue without it
  }

  // Always ignore these directories
  ig.add(['node_modules', '.git', 'dist']);

  return scanDirectoryInternal(dirPath, dirPath, ig);
};
