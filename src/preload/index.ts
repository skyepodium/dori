import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS, type DoriGitApi } from '../shared/constants/ipc';

const gitApi: DoriGitApi = {
  openRepository: (repositoryPath) => {
    return ipcRenderer.invoke(IPC_CHANNELS.GIT_OPEN_REPOSITORY, { repositoryPath });
  },
  listWorktrees: (repositoryPath) => {
    return ipcRenderer.invoke(IPC_CHANNELS.GIT_LIST_WORKTREES, { repositoryPath });
  },
  createWorktree: (repositoryPath, branchName, worktreePath, baseRef) => {
    return ipcRenderer.invoke(IPC_CHANNELS.GIT_CREATE_WORKTREE, {
      repositoryPath,
      branchName,
      worktreePath,
      baseRef
    });
  },
  removeWorktree: (repositoryPath, worktreePath, force) => {
    return ipcRenderer.invoke(IPC_CHANNELS.GIT_REMOVE_WORKTREE, {
      repositoryPath,
      worktreePath,
      force
    });
  },
  getStatus: (worktreePath) => {
    return ipcRenderer.invoke(IPC_CHANNELS.GIT_GET_STATUS, { worktreePath });
  },
  getHistory: (worktreePath, limit) => {
    return ipcRenderer.invoke(IPC_CHANNELS.GIT_GET_HISTORY, { worktreePath, limit });
  },
  commit: (worktreePath, message) => {
    return ipcRenderer.invoke(IPC_CHANNELS.GIT_COMMIT, { worktreePath, message });
  },
  fetch: (repositoryPath) => {
    return ipcRenderer.invoke(IPC_CHANNELS.GIT_FETCH, { repositoryPath });
  },
  pull: (worktreePath) => {
    return ipcRenderer.invoke(IPC_CHANNELS.GIT_PULL, { worktreePath });
  },
  push: (worktreePath) => {
    return ipcRenderer.invoke(IPC_CHANNELS.GIT_PUSH, { worktreePath });
  }
};

contextBridge.exposeInMainWorld('dori', {
  git: gitApi
});
