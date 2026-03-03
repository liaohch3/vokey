---
owner: vokey-maintainers
last_reviewed: 2026-03-04
source_of_truth: AGENTS.md
---

# 调试标准

## 调试前检查清单

在派 agent 或跑自动重试循环之前：

1. **先读代码路径**（最多 5 分钟）。从入口点追踪到出错的操作。
   找硬编码的值、跳过的参数、分岔的路径。

2. **对比正常和异常。** 如果功能 A 正常但功能 B 不行，
   写下它们代码路径的差异。Bug 就在差异里。

3. **检查显而易见的东西。** 配置项、环境变量、端口号、feature flag。
   大多数 bug 是配置问题，不是逻辑问题。

## 调试过程中

4. **2-strike 规则。** 如果同一个方法（重跑测试、换参数）失败两次，**停下来**。
   换策略：
   - 加针对性的日志/print
   - 读出错的库的源码
   - 缩小到最小复现
   - 问自己："我做了什么假设可能是错的？"

5. **不要无限循环。** Cron 监控是用来盯已知正常的进程的，
   不是调试工具。如果 cron 循环连续 2 轮没有进展，禁用它，手动调试。

6. **记录你的假设。** 每次尝试前写下：
   - 你认为问题是什么
   - 什么证据能确认/否定它
   - 你打算试什么
   防止循环论证和重复尝试。

## 音频/STT/LLM 管线调试专项

7. **检查实际的 API 调用参数。** 调试 STT/LLM 问题时，找到发请求的那一行，确认：
   - API key 传了吗？是正确的吗？
   - model 参数对吗？
   - base_url 对吗？
   - 音频格式/采样率对吗？（WAV 16kHz mono）

8. **用最简单的测试。** 在跑复杂 E2E 之前：
   ```bash
   # STT 能通吗？
   curl -X POST https://api.groq.com/openai/v1/audio/transcriptions \
     -H "Authorization: Bearer $API_KEY" \
     -F file=@test.wav -F model=whisper-large-v3-turbo

   # LLM 能通吗？
   curl https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=$API_KEY \
     -H "Content-Type: application/json" \
     -d '{"contents":[{"parts":[{"text":"hello"}]}]}'
   ```

9. **检查 provider 选择逻辑。** `config.rs` 里的 `create_provider` match 分支，
   确认 provider 字符串和配置文件里的一致。

## 调试之后

10. **写经验文档。** 每次非平凡的调试都要产出一篇：
    `docs/error-experience/YYYY-MM-DD-<slug>.md`，包含：
    - 什么坏了
    - 试了什么（以及为什么没用）
    - 什么真正修好了它
    - 给未来调试的教训
