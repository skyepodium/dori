import type { DoriGitApi } from '../shared/constants/ipc';

declare global {
  interface Window {
    dori: {
      git: DoriGitApi;
    };
  }
}

export {};
