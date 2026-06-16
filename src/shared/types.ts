export interface Repository {
  id: string;
  path: string;
  name: string;
  currentBranch: string;
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

export interface GitStatus {
  currentBranch: string;
  ahead: number;
  behind: number;
  staged: GitFileChange[];
  unstaged: GitFileChange[];
  untracked: GitFileChange[];
  conflicts: GitFileChange[];
}

export interface GitCommit {
  sha: string;
  shortSha: string;
  authorName: string;
  authorEmail: string;
  authoredAt: string;
  subject: string;
}
