import { EventEmitter } from 'node:events';
import path from 'node:path';
import { existsSync } from 'node:fs';
import simpleGit from 'simple-git';

class GitService extends EventEmitter {
  constructor() {
    super();
    this.repoPath = null;
    this.git = null;
  }

  async setRepository(repoPath) {
    if (!repoPath) {
      throw new Error('未提供仓库路径');
    }

    const gitDir = path.join(repoPath, '.git');
    if (!existsSync(gitDir)) {
      throw new Error('选择的目录不是一个 Git 仓库');
    }

    this.repoPath = repoPath;
    this.git = simpleGit({ baseDir: repoPath });
    return this.getRepositoryInfo();
  }

  ensureGitReady() {
    if (!this.git) {
      throw new Error('请先选择 Git 仓库');
    }
  }

  async getRepositoryInfo() {
    this.ensureGitReady();
    const status = await this.git.status();
    return {
      path: this.repoPath,
      currentBranch: status.current,
      isClean: status.isClean(),
      ahead: status.ahead,
      behind: status.behind
    };
  }

  async getBranches() {
    this.ensureGitReady();
    const { all, current } = await this.git.branch();
    return { branches: all, current };
  }

  async getStashList() {
    this.ensureGitReady();
    const list = await this.git.stashList();
    return list.all.map((item, idx) => {
      const stashRef = item.stash ?? `stash@{${typeof item.index === 'number' ? item.index : idx}}`;
      const rawMessage = item.message ?? '';
      const message = this.extractStashMessage(rawMessage);
      return {
        index: typeof item.index === 'number' ? item.index : idx,
        hash: item.hash,
        message,
        rawMessage,
        reference: stashRef
      };
    });
  }

  extractStashMessage(rawMessage = '') {
    const trimmed = rawMessage.trim();
    if (!trimmed) return '';

    const standardPrefixes = ['WIP on', 'On', 'No local changes to save'];
    const hasPrefix = standardPrefixes.some((prefix) => trimmed.startsWith(prefix));
    if (hasPrefix && trimmed.includes(':')) {
      const suffix = trimmed.split(':').slice(1).join(':').trim();
      if (suffix) {
        return suffix;
      }
    }
    return trimmed;
  }

  async syncBranches(options = {}, onLog) {
    this.ensureGitReady();

    const {
      mode = 'branch',
      sourceBranch,
      targetBranches,
      commitHash,
      stashRef,
      stashMessage
    } = options;

    if (!targetBranches?.length) {
      throw new Error('至少选择一个目标分支');
    }

    if (mode === 'branch' && !sourceBranch) {
      throw new Error('请先选择源分支');
    }

    if (mode === 'commit' && !commitHash) {
      throw new Error('请填写需要同步的提交哈希');
    }

    if (mode === 'stash' && !stashRef) {
      throw new Error('请选择需要同步的储藏记录');
    }

    const branchInfo = await this.git.branch();
    const fallbackBranch = branchInfo.current;
    const branchToRestore = sourceBranch || fallbackBranch;

    const log = (message, level = 'info') => {
      const payload = { message, level, timestamp: new Date().toISOString() };
      if (typeof onLog === 'function') {
        onLog(payload);
      } else {
        this.emit('log', payload);
      }
    };

    const results = [];

    for (const target of targetBranches) {
      const result = { branch: target, success: true, error: null };
      try {
        log(`开始同步到分支 ${target}（模式：${mode}）`);
        await this.git.fetch();
        log(`[${target}] git fetch 完成`);

        await this.git.checkout(target);
        log(`[${target}] 已切换到目标分支`);

        if (mode === 'branch') {
          await this.git.merge([sourceBranch, '--no-edit']);
          log(`[${target}] 合并 ${sourceBranch} 成功`);
          await this.git.push();
          log(`[${target}] 推送成功`);
        } else if (mode === 'commit') {
          await this.git.raw(['cherry-pick', commitHash]);
          log(`[${target}] 已应用提交 ${commitHash}`);
          await this.git.push();
          log(`[${target}] 推送成功`);
        } else if (mode === 'stash') {
          await this.git.raw(['stash', 'apply', stashRef]);
          log(`[${target}] 已应用储藏 ${stashRef}`);
          const status = await this.git.status();
          if (!status.isClean()) {
            await this.git.add(['-A']);
            const message =
              stashMessage?.trim().length > 0
                ? stashMessage.trim()
                : `chore: sync stash ${stashRef}`;
            await this.git.commit(message);
            log(`[${target}] 已提交储藏变更`);
            await this.git.push();
            log(`[${target}] 推送成功`);
          } else {
            log(`[${target}] 储藏未引入新增变更`, 'warn');
          }
        } else {
          throw new Error(`未知同步模式：${mode}`);
        }
      } catch (error) {
        result.success = false;
        result.error = error?.message ?? String(error);
        log(`[${target}] 同步失败: ${result.error}`, 'error');
        if (mode === 'commit') {
          try {
            await this.git.raw(['cherry-pick', '--abort']);
            log(`[${target}] 已回滚 cherry-pick 操作`, 'warn');
          } catch (abortError) {
            log(`[${target}] 回滚 cherry-pick 失败: ${abortError?.message ?? abortError}`, 'error');
          }
        }
      } finally {
        results.push(result);
      }
    }

    // 切回源分支，保持状态
    try {
      await this.git.checkout(branchToRestore);
      log(`已切回分支 ${branchToRestore}`);
    } catch (error) {
      log(`切回源分支失败: ${error?.message ?? error}`, 'warn');
    }

    return results;
  }
}

export const gitService = new GitService();
