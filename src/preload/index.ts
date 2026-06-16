import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS, type GitClientApi } from '../shared/constants/ipc';

const gitApi: GitClientApi = {
  selectRepositoryDirectory: () => {
    return ipcRenderer.invoke(IPC_CHANNELS.GIT_SELECT_REPOSITORY_DIRECTORY);
  },
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
  getIdentity: (worktreePath) => {
    return ipcRenderer.invoke(IPC_CHANNELS.GIT_GET_IDENTITY, { worktreePath });
  },
  getHistory: (worktreePath, limit) => {
    return ipcRenderer.invoke(IPC_CHANNELS.GIT_GET_HISTORY, { worktreePath, limit });
  },
  getCommitFiles: (worktreePath, commitSha) => {
    return ipcRenderer.invoke(IPC_CHANNELS.GIT_GET_COMMIT_FILES, { worktreePath, commitSha });
  },
  getCommitFileDiff: (worktreePath, commitSha, filePath) => {
    return ipcRenderer.invoke(IPC_CHANNELS.GIT_GET_COMMIT_FILE_DIFF, {
      worktreePath,
      commitSha,
      filePath
    });
  },
  getChangedFileDiff: (worktreePath, filePath, diffScope) => {
    return ipcRenderer.invoke(IPC_CHANNELS.GIT_GET_CHANGED_FILE_DIFF, {
      worktreePath,
      filePath,
      diffScope
    });
  },
  listBranches: (worktreePath) => {
    return ipcRenderer.invoke(IPC_CHANNELS.GIT_LIST_BRANCHES, { worktreePath });
  },
  cherryPick: (worktreePath, commitSha) => {
    return ipcRenderer.invoke(IPC_CHANNELS.GIT_CHERRY_PICK, { worktreePath, commitSha });
  },
  abortCherryPick: (worktreePath) => {
    return ipcRenderer.invoke(IPC_CHANNELS.GIT_ABORT_CHERRY_PICK, { worktreePath });
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

contextBridge.exposeInMainWorld('gitClient', {
  git: gitApi
});
