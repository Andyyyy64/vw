import { Command } from 'commander';
import { startServer } from './server';

const program = new Command();

program.name('vw').description('Visualize your project directory structure in 3D').version('0.0.1');

program
  .command('open')
  .description('Open the 3D visualization in your browser')
  .action(() => {
    const rootDir = process.cwd();
    console.log(`Starting vw for ${rootDir}...`);
    startServer(rootDir);
  });

program.parse();
