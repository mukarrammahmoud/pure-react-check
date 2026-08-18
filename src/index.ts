import { runCli } from './cli.js';

runCli().then(
  (exitCode) => {
    process.exit(exitCode);
  },
  (error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  },
);
