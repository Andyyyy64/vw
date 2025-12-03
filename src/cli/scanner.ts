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

  // Check if there's a .gitignore in this directory
  const gitignorePath = path.join(dirPath, '.gitignore');
  let currentIg = ig;

  try {
    const gitignoreContent = await fs.readFile(gitignorePath, 'utf-8');
    // Create a new ignore instance that inherits from parent
    currentIg = ignore().add(ig);
    currentIg.add(gitignoreContent);
  } catch {
    // No .gitignore in this directory, use parent's rules
  }

  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const children: FileNode[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    // Calculate relative path from root for ignore matching
    const relativePath = path.relative(rootPath, fullPath);

    // Check if the entry should be ignored
    if (currentIg.ignores(relativePath)) {
      continue;
    }

    const childNode = await scanDirectoryInternal(fullPath, rootPath, currentIg);
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
  // Initialize with base ignore rules
  const ig = ignore();

  // Always ignore these directories
  ig.add(['node_modules', '.git', 'dist']);

  // Read root .gitignore if it exists
  const gitignorePath = path.join(dirPath, '.gitignore');
  try {
    const gitignoreContent = await fs.readFile(gitignorePath, 'utf-8');
    ig.add(gitignoreContent);
  } catch {
    // .gitignore doesn't exist at root, continue without it
  }

  return scanDirectoryInternal(dirPath, dirPath, ig);
};
