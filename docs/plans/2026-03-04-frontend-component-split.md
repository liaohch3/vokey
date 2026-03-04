---
status: active
priority: P1
estimated_effort: M
---

# 前端组件拆分（App.tsx → 独立组件）

## 目标

将 `frontend/src/App.tsx` 拆分为独立页面组件和共享组件，为后续功能开发（Settings Tab、Dictionary、Onboarding）打好基础。

## 上下文

- 当前所有 UI 逻辑都在 `App.tsx` 一个文件里（1000+ 行），不可维护
- 设计文档 `docs/design/DESIGN.md` §4 规划了 Home/History/Settings/Dictionary 四个页面
- 后续 #5 (Settings Tab)、#8 (Dictionary)、#9 (Onboarding) 都依赖组件拆分
- 关联 issue: #19

## 任务

### 提取页面组件
- [ ] 1. 创建 `frontend/src/pages/` 目录
- [ ] 2. 提取 `frontend/src/pages/Home.tsx` — 首页（录音按钮、状态展示、管线状态）
- [ ] 3. 提取 `frontend/src/pages/History.tsx` — 历史记录页面
- [ ] 4. 提取 `frontend/src/pages/Settings.tsx` — 设置页面（包含所有 STT/LLM 配置逻辑）

### 提取共享组件
- [ ] 5. 创建 `frontend/src/components/` 目录
- [ ] 6. 提取 `frontend/src/components/Sidebar.tsx` — 侧边栏导航

### 状态管理
- [ ] 7. 将共享状态（config、locale、page）提升到 App.tsx，通过 props 传递给子组件
- [ ] 8. 确保 Tauri event listeners 正确绑定（pipeline-status-changed、recording-state-changed）

### 精简 App.tsx
- [ ] 9. App.tsx 只负责：页面路由、全局状态管理、Tauri event 注册
- [ ] 10. 删除 App.tsx 中已迁移的代码

### 质量
- [ ] 11. `npm run lint` 通过
- [ ] 12. `npm run build` 通过
- [ ] 13. 截图：拆分后 Home/History/Settings 页面 UI 与拆分前一致
- [ ] 14. 跑完整 gate check

## 验收标准

- [ ] App.tsx < 150 行
- [ ] 每个页面组件独立文件
- [ ] UI 和功能与拆分前完全一致（视觉回归测试：截图对比）
- [ ] 所有 gate check 通过
- [ ] 没有引入新依赖

## 决策记录

（执行过程中填写）
