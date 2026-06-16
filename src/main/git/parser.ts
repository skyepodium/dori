import type { GitCommit, GitFileChange, GitStatus, Worktree } from '../../shared/types';

const EMPTY_STATUS: GitStatus = {
  currentBranch: '',
  ahead: 0,
  behind: 0,
  staged: [],
  unstaged: [],
  untracked: [],
  conflicts: []
};

const parseBranchName = (line: string): string => {
  if (line === 'detached') {
    return '(detached)';
  }

  const prefix = 'branch refs/heads/';
  if (line.startsWith(prefix)) {
    return line.slice(prefix.length);
  }

  return '';
};

const parseAheadBehind = (branchLine: string): Pick<GitStatus, 'ahead' | 'behind'> => {
  const counts = { ahead: 0, behind: 0 };
  const bracketStart = branchLine.indexOf('[');
  const bracketEnd = branchLine.indexOf(']', bracketStart);

  if (bracketStart === -1 || bracketEnd === -1) {
    return counts;
  }

  const metadata = branchLine.slice(bracketStart + 1, bracketEnd).split(',');
  for (const entry of metadata) {
    const trimmedEntry = entry.trim();
    const [label, value] = trimmedEntry.split(' ');
    const parsedValue = Number(value);

    if ((label === 'ahead' || label === 'behind') && Number.isInteger(parsedValue)) {
      counts[label] = parsedValue;
    }
  }

  return counts;
};

const parseCurrentBranch = (branchLine: string): string => {
  const branchName = branchLine.slice('## '.length).split('...')[0]?.split(' ')[0] ?? '';
  return branchName === 'HEAD' ? '(detached)' : branchName;
};

const parseChangePath = (line: string): string => {
  const path = line.slice(3);
  const renameSeparator = ' -> ';
  const renameIndex = path.indexOf(renameSeparator);
  return renameIndex === -1 ? path : path.slice(renameIndex + renameSeparator.length);
};

const isConflictStatus = (status: string): boolean =>
  ['DD', 'AU', 'UD', 'UA', 'DU', 'AA', 'UU'].includes(status);

const addFileChange = (status: GitStatus, line: string): void => {
  const indexStatus = line[0] ?? ' ';
  const worktreeStatus = line[1] ?? ' ';
  const combinedStatus = `${indexStatus}${worktreeStatus}`;
  const fileChange: GitFileChange = {
    path: parseChangePath(line),
    status: combinedStatus.trim() === '??' ? '??' : combinedStatus.trim()
  };

  if (combinedStatus === '??') {
    status.untracked.push(fileChange);
    return;
  }

  if (isConflictStatus(combinedStatus)) {
    status.conflicts.push(fileChange);
    return;
  }

  if (indexStatus !== ' ') {
    status.staged.push({ ...fileChange, status: indexStatus });
  }

  if (worktreeStatus !== ' ') {
    status.unstaged.push({ ...fileChange, status: worktreeStatus });
  }
};

export const parseWorktreeList = (output: string): Worktree[] => {
  const blocks = output
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0);
  const mainPath = blocks[0]?.split('\n')[0]?.replace('worktree ', '') ?? '';

  return blocks.map((block) => {
    const lines = block.split('\n');
    const worktreeLine = lines.find((line) => line.startsWith('worktree ')) ?? '';
    const headLine = lines.find((line) => line.startsWith('HEAD ')) ?? '';
    const branchLine = lines.find((line) => line.startsWith('branch ') || line === 'detached') ?? '';
    const path = worktreeLine.slice('worktree '.length);

    return {
      id: path,
      repoId: mainPath,
      path,
      branch: parseBranchName(branchLine),
      headSha: headLine.slice('HEAD '.length),
      isMainWorktree: path === mainPath,
      hasChanges: false,
      isLocked: lines.some((line) => line.startsWith('locked'))
    };
  });
};

export const parseStatus = (output: string): GitStatus => {
  const status: GitStatus = {
    ...EMPTY_STATUS,
    staged: [],
    unstaged: [],
    untracked: [],
    conflicts: []
  };
  const lines = output.split('\n').filter((line) => line.length > 0);
  const branchLine = lines.find((line) => line.startsWith('## '));

  if (branchLine !== undefined) {
    status.currentBranch = parseCurrentBranch(branchLine);
    const counts = parseAheadBehind(branchLine);
    status.ahead = counts.ahead;
    status.behind = counts.behind;
  }

  for (const line of lines) {
    if (!line.startsWith('## ')) {
      addFileChange(status, line);
    }
  }

  return status;
};

export const parseHistory = (output: string): GitCommit[] =>
  output
    .split('\n')
    .filter((line) => line.length > 0)
    .map((line) => {
      const [sha = '', shortSha = '', authorName = '', authorEmail = '', authoredAt = '', subject = ''] =
        line.split('\x1f');

      return {
        sha,
        shortSha,
        authorName,
        authorEmail,
        authoredAt,
        subject
      };
    });
