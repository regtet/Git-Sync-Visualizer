# Git Sync Visualizer

一个基于 **Electron + Vue3 + Vite + simple-git** 打造的桌面工具，专注于在多个分支之间同步代码。通过简洁的深色界面、实时日志与多种同步策略，帮助你在多分支、多仓库场景下保持代码一致。

![主界面截图](./image.png)

## 核心功能

- **多分支同步**：选择目标分支，一键串行执行同步。
- **两种同步策略**
  - `精准提交 (Cherry-pick)`：输入提交哈希后，依次在各目标分支执行 `git cherry-pick` 并推送；适合将单个补丁快速同步到多个分支，保持精确一致。
  - `同步储藏 (Stash)`：从当前仓库的 stash 列表中选取记录，自动执行 `stash apply → add → commit → push`，提交信息默认沿用储藏备注；适合把临时修改批量同步到多个分支。
  - `补丁同步 (Patch)`：选择本地 `.patch/.diff` 文件，自动执行 `git apply → add → commit → push`，可借助命名规范（日期+来源分支）快速追溯补丁来源并同步到多分支。
- **多仓库支持**：顶部按钮可切换工作目录，自动刷新仓库、分支与储藏信息。
- **实时日志与通知**：右侧面板滚动展示同步步骤，可一键清空；顶部弹窗提示成功或失败。
- **主题切换**：内置“深空 / 极光”两套主题，可随时切换界面配色。

## 使用说明

### 环境要求

- Node.js `>=16 <20`
- Yarn 1（建议通过 `corepack prepare yarn@1.22.19 --activate` 切换到经典版 Yarn）
- Git 命令行工具

### 安装 & 启动

```bash
yarn install
yarn dev
```

运行 `yarn dev` 后：
- Vite 启动渲染进程开发服务器；
- Electron 自动打开桌面窗口，可实时查看调试输出。

### 补丁同步模式小贴士

- 建议使用 `日期-来源分支-描述.patch` 的命名规范，例如 `20251120-feature-bg-sync-bg.patch`，后续溯源时可以快速定位补丁来自哪一天、哪一个分支。
- 如果只想同步部分改动，可先执行 `git diff HEAD^ HEAD -- path/to/file > temp.patch`，再用文本编辑器保留需要的 diff 片段，避免携带无关修改。
- 在应用补丁前，界面会自动执行 `git apply --check` 预检，通过后才会真正应用并提交；默认提交信息为 `sync: apply patch <文件名>`，也可以在界面手动覆盖。
- 同步完成后会把补丁变更 `add → commit → push` 到每个目标分支，若补丁没有带来新的文件改动，会在日志中提示说明。

### 构建发行版

```bash
yarn build
```

Electron Builder 会产出跨平台的可分发文件，默认输出目录为 `release/`。

### 界面概览

- **顶部工具栏**：主题切换、选择仓库、一键同步按钮。
- **左侧信息卡**：显示仓库路径、当前分支、clean 状态以及 ahead/behind 信息。
- **中间同步策略**：切换模式、输入 commit 哈希、选择储藏、挑选源分支与目标分支。
- **右侧日志**：实时输出每个目标分支的同步步骤及最终结果，支持清空。

## 项目结构

```
src/
├─ main/               # Electron 主进程
│  ├─ main.js          # 窗口生命周期、IPC 注册等
│  └─ gitService.js    # simple-git 封装与同步逻辑
├─ preload.cjs         # 预加载脚本，桥接 IPC 到渲染层
└─ renderer/           # Vue3 前端
   ├─ index.html
   ├─ main.js
   ├─ App.vue          # 主界面布局与状态管理
   └─ components/
      ├─ RepoInfo.vue      # 仓库信息面板
      ├─ BranchSelector.vue# 分支选择与筛选
      └─ LogView.vue       # 实时日志输出
```

## 开发提示

- 同步操作全部在主进程 `gitService` 中串行执行，当前目标失败不会阻塞其他目标的继续。
- 同步完成后会自动切回源分支（分支模式）或先前分支（其他模式），避免打断当前工作流。
- 如果需要扩展更多策略或记录历史，可在 IPC 通道内追加新事件与状态。
- 大体积 UI 库已移除，全部样式均可在 `src/renderer/styles.css` 中自定义。

## 未来可扩展方向

- 分支关系图（GitGraph.js / vis-network）
- 同步任务历史记录与回放
- 多仓库标签页管理
- 更细粒度的冲突提示与处理向导

欢迎根据自身需求继续拓展。祝使用愉快！ 🎯

---

仓库地址：`git@github.com:regtet/Git-Sync-Visualizer.git`
