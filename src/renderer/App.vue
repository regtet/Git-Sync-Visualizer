<template>
  <div class="app-shell">
    <header class="toolbar">
      <div class="title">Git Sync Visualizer</div>
      <div class="actions">
        <div class="theme-toggle">
          <button
            v-for="theme in themes"
            :key="theme.value"
            :class="['theme-option', { active: currentTheme === theme.value }]"
            @click="setTheme(theme.value)"
          >
            <span class="theme-dot" :style="{ background: theme.preview }"></span>
            {{ theme.label }}
          </button>
        </div>
        <button class="btn ghost" @click="handleSelectRepo">
          选择仓库目录
        </button>
        <button
          class="btn primary"
          :disabled="isSyncDisabled"
          @click="handleStartSync"
        >
          {{ syncing ? '同步中...' : '一键同步' }}
        </button>
      </div>
    </header>

    <transition-group name="toast" tag="div" class="toast-stack">
      <div
        v-for="note in notifications"
        :key="note.id"
        class="toast"
        :class="note.type"
      >
        <span class="dot"></span>
        <span class="text">{{ note.message }}</span>
        <button class="toast-close" @click="dismissNotification(note.id)">×</button>
      </div>
    </transition-group>

    <main class="content">
      <section class="card info-card">
        <repo-info
          :repo-info="repoInfo"
          :loading="loading"
        />
      </section>

      <section class="card mode-card">
        <div class="pane-header">
          <div>
            <h3>同步策略</h3>
            <p class="hint">在不同模式间切换以满足多种同步需求</p>
          </div>
          <div class="mode-toggle">
            <button
              v-for="option in modeOptions"
              :key="option.value"
              :class="['mode-option', { active: syncMode === option.value }]"
              @click="syncMode = option.value"
            >
              {{ option.label }}
            </button>
          </div>
        </div>

        <transition name="fade">
          <div v-if="syncMode === 'commit'" class="mode-extra">
            <label for="commit-hash">提交哈希</label>
            <input
              id="commit-hash"
              v-model.trim="commitHash"
              placeholder="输入单个提交哈希，例如 f6efc42cb115..."
              maxlength="80"
            />
          </div>
        </transition>

        <transition name="fade">
          <div v-if="syncMode === 'stash'" class="mode-extra">
            <label for="stash-select">储藏记录</label>
            <div class="stash-row">
              <select
                id="stash-select"
                v-model="selectedStash"
                :disabled="stashLoading || !stashList.length"
              >
                <option disabled value="">
                  {{ stashLoading ? '加载储藏中...' : '请选择一条储藏记录' }}
                </option>
                <option
                  v-for="stash in stashList"
                  :key="stash.reference"
                  :value="stash.reference"
                >
                  {{ formatStashLabel(stash) }}
                </option>
              </select>
              <button class="btn ghost sm" @click="loadStashList" :disabled="stashLoading">
                {{ stashLoading ? '刷新中...' : '刷新' }}
              </button>
            </div>
          </div>
        </transition>

        <branch-selector
          :branches="branches"
          v-model:source-branch="sourceBranch"
          v-model:target-branches="selectedTargets"
          @clear-targets="selectedTargets = []"
        />
      </section>

      <section class="card log-card">
        <log-view :logs="logs" :syncing="syncing" @clear="clearLogs" />
      </section>
    </main>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import RepoInfo from './components/RepoInfo.vue';
import BranchSelector from './components/BranchSelector.vue';
import LogView from './components/LogView.vue';

const themes = [
  { value: 'abyss', label: '深空', preview: '#3b82f6' },
  { value: 'aurora', label: '极光', preview: '#10b981' }
];

const modeOptions = [
  { value: 'branch', label: '分支合并' },
  { value: 'commit', label: '精准提交' },
  { value: 'stash', label: '同步储藏' }
];

const repoInfo = ref(null);
const branches = reactive({
  list: [],
  current: ''
});

const sourceBranch = ref('');
const selectedTargets = ref([]);
const logs = ref([]);
const syncing = ref(false);
const loading = ref(false);
const hasSelectedRepo = computed(() => !!repoInfo.value);
const syncMode = ref('branch');
const commitHash = ref('');
const selectedStash = ref('');
const stashList = ref([]);
const stashLoading = ref(false);

const notifications = ref([]);
const currentTheme = ref(localStorage.getItem('gsv-theme') || themes[0].value);

const baseBranch = computed(
  () => sourceBranch.value || branches.current || repoInfo.value?.currentBranch || ''
);

const isSyncDisabled = computed(() => {
  if (!hasSelectedRepo.value) return true;
  if (syncing.value) return true;
  if (!selectedTargets.value.length) return true;
  const base = baseBranch.value;
  if (syncMode.value === 'branch' && !base) return true;
  if (syncMode.value === 'commit' && !commitHash.value.trim()) return true;
  if (syncMode.value === 'stash' && !selectedStash.value) return true;
  return false;
});

const pushNotification = (type, message) => {
  if (!message) return;
  const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  notifications.value.push({ id, type, message });
  setTimeout(() => {
    dismissNotification(id);
  }, 4000);
};

const dismissNotification = (id) => {
  notifications.value = notifications.value.filter((item) => item.id !== id);
};

const setTheme = (theme) => {
  currentTheme.value = theme;
};

const applyTheme = (theme) => {
  document.documentElement.setAttribute('data-theme', theme);
};

watch(
  currentTheme,
  (theme) => {
    applyTheme(theme);
    localStorage.setItem('gsv-theme', theme);
  },
  { immediate: true }
);

const formatStashLabel = (stash) => {
  if (!stash) return '';
  if (stash.message) {
    return stash.message;
  }
  if (stash.rawMessage) {
    return stash.rawMessage;
  }
  return stash.reference;
};

const resolveModeLabel = (mode) => {
  switch (mode) {
    case 'branch':
      return '分支合并';
    case 'commit':
      return '精准提交';
    case 'stash':
      return '同步储藏';
    default:
      return mode || '未知模式';
  }
};

const loadStashList = async () => {
  if (!window.electronAPI?.listStashes) {
    stashList.value = [];
    return;
  }
  stashLoading.value = true;
  try {
    const response = await window.electronAPI.listStashes();
    if (response?.ok) {
      stashList.value = response.data ?? [];
    } else {
      stashList.value = [];
      if (response?.error) {
        pushNotification('error', response.error);
      }
    }
  } catch (error) {
    pushNotification('error', error?.message || '读取储藏信息失败');
    stashList.value = [];
  } finally {
    stashLoading.value = false;
  }
};

watch(syncMode, (mode) => {
  if (mode !== 'commit') {
    commitHash.value = '';
  }
  if (mode !== 'stash') {
    selectedStash.value = '';
  } else {
    loadStashList();
  }
});

watch(stashList, (list) => {
  if (syncMode.value === 'stash' && selectedStash.value) {
    const exists = list.some((item) => item.reference === selectedStash.value);
    if (!exists) {
      selectedStash.value = '';
    }
  }
});

let disposeLogListener = null;
let disposeStatusListener = null;

const appendLog = (log) => {
  logs.value.push(log);
};

const refreshRepoInfo = async () => {
  if (!window.electronAPI?.getRepositoryInfo) return;
  loading.value = true;
  try {
    const infoResult = await window.electronAPI.getRepositoryInfo();
    if (infoResult?.ok) {
      repoInfo.value = infoResult.data;
    }
    const branchResult = await window.electronAPI.listBranches();
    if (branchResult?.ok) {
      branches.list = branchResult.data.branches;
      branches.current = branchResult.data.current;
      if (!sourceBranch.value) {
        sourceBranch.value = branches.current;
      }
    }
    if (syncMode.value === 'stash') {
      await loadStashList();
    }
  } catch (error) {
    pushNotification('error', error?.message || '读取仓库信息失败');
  } finally {
    loading.value = false;
  }
};

const handleSelectRepo = async () => {
  if (!window.electronAPI?.selectRepository) {
    pushNotification('error', '当前运行环境不支持选择仓库');
    return;
  }
  logs.value = [];
  syncMode.value = 'branch';
  commitHash.value = '';
  selectedStash.value = '';
  const result = await window.electronAPI?.selectRepository();
  if (result?.canceled) return;
  if (result?.error) {
    pushNotification('error', result.error);
    return;
  }
  if (result?.repo) {
    repoInfo.value = result.repo;
  }
  if (result?.branches) {
    branches.list = result.branches.branches;
    branches.current = result.branches.current;
    sourceBranch.value = branches.current;
    selectedTargets.value = [];
  }
  await loadStashList();
  pushNotification('success', '仓库选择成功');
};

const clearLogs = () => {
  logs.value = [];
};

const summarizeResults = (results, modeLabel) => {
  if (!Array.isArray(results) || results.length === 0) {
    appendLog({
      message: `同步任务已完成（${modeLabel}）：无有效目标分支`,
      level: 'warn',
      timestamp: new Date().toISOString()
    });
    return;
  }

  const oks = results.filter((item) => item.success);
  const fails = results.filter((item) => !item.success);

  appendLog({
    message: `同步任务总结（${modeLabel}）：成功 ${oks.length} 个，失败 ${fails.length} 个`,
    level: fails.length ? 'warn' : 'info',
    timestamp: new Date().toISOString()
  });

  if (oks.length) {
    appendLog({
      message: `成功分支：${oks.map((item) => item.branch).join('，')}`,
      level: 'info',
      timestamp: new Date().toISOString()
    });
  }

  if (fails.length) {
    appendLog({
      message: `失败分支：${fails
        .map((item) => `${item.branch}（${item.error || '未知原因'}）`)
        .join('，')}`,
      level: 'error',
      timestamp: new Date().toISOString()
    });
    pushNotification('error', `同步失败 ${fails.length} 个分支，请检查日志`);
  } else {
    pushNotification('success', `同步完成：成功 ${oks.length} 个分支`);
  }
};

const handleStartSync = async () => {
  if (selectedTargets.value.length === 0) return;
  const base = baseBranch.value;
  if (syncMode.value === 'branch' && !base) return;
  if (!window.electronAPI?.startSync) {
    pushNotification('error', '当前运行环境不支持同步操作');
    return;
  }

  logs.value = [];
  syncing.value = true;
  const targets = [...selectedTargets.value];
  try {
    const payload = {
      mode: syncMode.value,
      targetBranches: targets
    };

    if (syncMode.value === 'branch') {
      payload.sourceBranch = base;
    }

    if (syncMode.value === 'commit') {
      payload.commitHash = commitHash.value.trim();
    }

    if (syncMode.value === 'stash') {
      if (!selectedStash.value) {
        pushNotification('error', '请先选择一条储藏记录');
        return;
      }
      payload.stashRef = selectedStash.value;
      const selected = stashList.value.find((item) => item.reference === selectedStash.value);
      if (selected) {
        payload.stashMessage = selected.message || selected.rawMessage || '';
      }
    }
    const response = await window.electronAPI.startSync(payload);
    if (!response?.ok) {
      pushNotification('error', response?.error || '同步失败');
    }
  } catch (error) {
    pushNotification('error', error?.message || '同步出现异常');
  } finally {
    syncing.value = false;
  }
};

onMounted(() => {
  disposeLogListener = window.electronAPI?.onSyncLog((log) => {
    appendLog(log);
  });
  disposeStatusListener = window.electronAPI?.onSyncStatus((status) => {
    if (!status) return;
    const now = new Date().toISOString();
    const modeLabel = resolveModeLabel(status.mode);
    switch (status.status) {
      case 'running':
        syncing.value = true;
        appendLog({
          message: `同步任务已启动（${modeLabel}）`,
          level: 'info',
          timestamp: now
        });
        break;
      case 'completed':
        syncing.value = false;
        summarizeResults(status.results, modeLabel);
        refreshRepoInfo();
        if (status.mode === 'stash') {
          loadStashList();
        }
        break;
      case 'failed':
        syncing.value = false;
        appendLog({
          message: `同步任务失败（${modeLabel}）: ${status.message || '未知错误'}`,
          level: 'error',
          timestamp: now
        });
        pushNotification('error', status.message || '同步失败');
        break;
      default:
        syncing.value = false;
    }
  });
  refreshRepoInfo();
});

onBeforeUnmount(() => {
  disposeLogListener?.();
  disposeStatusListener?.();
});
</script>

<style scoped>
.app-shell {
  display: flex;
  flex-direction: column;
  height: 100vh;
  color: #f5f5f5;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 18px 28px;
  background: rgba(27, 27, 27, 0.9);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.title {
  font-size: 22px;
  font-weight: 700;
  letter-spacing: 0.6px;
}

.actions {
  display: inline-flex;
  gap: 12px;
  align-items: center;
}

.theme-toggle {
  display: inline-flex;
  gap: 6px;
  padding: 4px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.65);
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.theme-option {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 999px;
  border: none;
  background: transparent;
  color: rgba(226, 232, 240, 0.7);
  font-size: 12px;
  cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease;
}

.theme-option.active {
  background: rgba(148, 163, 184, 0.18);
  color: #e2e8f0;
}

.theme-option:hover {
  color: #f8fafc;
}

.theme-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  box-shadow: 0 0 8px rgba(148, 163, 184, 0.4);
}

.toast-stack {
  position: fixed;
  top: 24px;
  right: 28px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  z-index: 1000;
}

.toast {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 12px;
  background: rgba(30, 41, 59, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.35);
  min-width: 240px;
}

.toast.success {
  border-color: rgba(52, 211, 153, 0.35);
}

.toast.error {
  border-color: rgba(248, 113, 113, 0.35);
}

.toast .dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(148, 163, 184, 0.6);
}

.toast.success .dot {
  background: #34d399;
}

.toast.error .dot {
  background: #f87171;
}

.toast .text {
  flex: 1;
  font-size: 14px;
  color: rgba(241, 245, 249, 0.92);
}

.toast-close {
  background: none;
  border: none;
  color: rgba(148, 163, 184, 0.8);
  font-size: 18px;
  cursor: pointer;
  padding: 0;
  line-height: 1;
}

.toast-close:hover {
  color: rgba(226, 232, 240, 0.95);
}

.content {
  flex: 1;
  display: grid;
  grid-template-columns: 1.1fr 1.1fr 1.5fr;
  gap: 18px;
  padding: 20px 28px 28px;
  overflow: hidden;
}

.card {
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-height: 0;
}

.info-card {
  gap: 12px;
}

.mode-card {
  min-height: 0;
}

.log-card {
  min-height: 0;
}

.log-card :deep(.log-view) {
  flex: 1;
  min-height: 0;
}

.pane-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
}

.pane-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.pane-header .hint {
  margin: 6px 0 0;
  font-size: 12px;
  color: rgba(148, 163, 184, 0.7);
}

.mode-toggle {
  display: inline-flex;
  padding: 4px;
  border-radius: 14px;
  background: rgba(15, 23, 42, 0.65);
  border: 1px solid rgba(255, 255, 255, 0.06);
  gap: 4px;
}

.mode-option {
  border: none;
  background: transparent;
  color: rgba(226, 232, 240, 0.68);
  padding: 8px 14px;
  border-radius: 10px;
  font-size: 13px;
  min-width: 92px;
  transition: background 0.2s ease, color 0.2s ease;
}

.mode-option.active {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: #f8fafc;
  box-shadow: 0 10px 20px rgba(37, 99, 235, 0.3);
}

.mode-option:not(.active):hover {
  color: rgba(226, 232, 240, 0.95);
}

.mode-extra {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.stash-row {
  display: flex;
  gap: 10px;
  align-items: center;
}

.btn.sm {
  padding: 8px 14px;
  font-size: 13px;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.toast-enter-active,
.toast-leave-active {
  transition: all 0.25s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(-12px);
}
</style>
