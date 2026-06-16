import type { GitClientApi } from '../shared/constants/ipc';

declare global {
  interface Window {
    gitClient: {
      git: GitClientApi;
    };
  }
}

export {};
