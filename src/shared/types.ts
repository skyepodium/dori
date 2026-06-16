export interface Repository {
  id: string;
  path: string;
  name: string;
  currentBranch: string;
  ownerAvatarUrl: string | null;
}

export interface Worktree {
  id: string;
  repoId: string;
  path: string;
  branch: string;
  headSha: string;
  isMainWorktree: boolean;
  hasChanges: boolean;
  isLocked: boolean;
}

export interface GitFileChange {
  path: string;
  status: string;
}

export interface GitChangedFile {
  path: string;
  previousPath?: string;
  status: string;
}

export type GitCommitFile = GitChangedFile;

export interface GitFileDiff {
  commitSha: string;
  filePath: string;
  output: string;
}

export type GitDiffScope = 'staged' | 'unstaged' | 'untracked' | 'conflicts';

export interface GitWorkingTreeDiff {
  diffScope: GitDiffScope;
  filePath: string;
  output: string;
}

export interface GitBranch {
  name: string;
}

export interface GitStatus {
  currentBranch: string;
  ahead: number;
  behind: number;
  staged: GitFileChange[];
  unstaged: GitFileChange[];
  untracked: GitFileChange[];
  conflicts: GitFileChange[];
}

export interface GitIdentity {
  name: string;
  email: string;
}

export interface GitCommit {
  sha: string;
  shortSha: string;
  authorName: string;
  authorEmail: string;
  authoredAt: string;
  subject: string;
}
