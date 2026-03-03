---
owner: vokey-maintainers
last_reviewed: 2026-03-03
source_of_truth: AGENTS.md
---

# 编码规范

## 应该做

| 实践 | 原因 |
|------|------|
| 删除死代码 | 死代码误导人，会腐烂 |
| 修根因 | 打补丁只会让测试越来越脆弱 |
| 用现有模式 | 一致性比新颖性更重要 |
| 只改相关文件 | 最小化爆炸半径 |
| 函数职责单一 | 一个函数一件事 |
| Provider 无关接口 | 所有 STT/LLM provider 都走 trait |
| 边界解析 | 在 API 边界验证数据格式，不要在内部深处 |
| 用无聊的技术 | 可组合、稳定、文档好 > 炫技 |

## 不应该做

| 反模式 | 原因 |
|--------|------|
| 留注释掉的代码 | 用版本控制 |
| 加投机性抽象 | YAGNI — 需要时再加 |
| 无理由压制 lint 警告 | 修掉或写注释说明 |
| 提交生成文件 | 从源码重新生成 |
| 重构和功能混在一个提交 | 一个提交一件事 |
| 在核心代码写死 provider 逻辑 | 全走 trait |
| YOLO 式数据探测 | 验证边界，用类型化结构 |
| 为简单逻辑引入重依赖 | 范围小就自己实现 |

## Rust 约定

- 错误类型：每个模块定义枚举，实现 `Display` + `Error`
- 配置默认值：用 `Default` trait + `serde(default)`
- 阻塞 HTTP：目前 ok（reqwest::blocking），需要流式时再迁移 async
- 日志：`log` crate，库代码不用 `println!`

## 前端约定

- 状态：目前用 React `useState`，组件树变大后提取到 Zustand
- 样式：CSS 文件，不用 CSS-in-JS
- i18n：所有用户可见文案走 `t()` 函数
- TypeScript 不允许 `any` 类型
