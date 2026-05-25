# AI Arena — 多 Host 平台适配设计文档

**日期**: 2026-05-25  
**版本**: v1.0  
**状态**: 已确认

---

## 1. 背景与目标

### 当前状态
AI Arena 扩展目前仅支持 **ChatGPT 作为 Host**（当前对话页面），面板（Panel）支持 Kimi 和 Doubao。用户在 ChatGPT 页面可以看到浮动按钮和分析按钮，点击后将对话发送给右侧面板中的 Kimi 或 Doubao 进行批判性分析。

### 目标
新增 **Gemini、Kimi、Doubao 作为 Host 平台**，实现以下效果：
- 用户在 **Gemini** 页面（gemini.google.com）时，扩展自动注入浮动按钮和分析按钮
- 用户在 **Kimi** 页面（kimi.com）时，扩展自动注入按钮
- 用户在 **Doubao** 页面（doubao.com）时，扩展自动注入按钮
- 右侧面板（Panel）保持不变，仍可在 Kimi 和 Doubao 之间切换

---

## 2. 系统架构

### Host / Panel 职责划分

```
Host（当前页面）                    Panel（右侧面板 iframe）
├─ 提取对话历史                     ├─ 接收 postMessage
├─ 注入浮动按钮（展开/折叠面板）     ├─ 自动填入输入框
├─ 注入分析按钮                     └─ 模拟点击发送
├─ 创建右侧面板
└─ 通过 postMessage 发送 prompt
```

### 扩展后的平台矩阵

| 平台 | 作为 Host | 作为 Panel |
|------|:---------:|:----------:|
| ChatGPT | ✅ | ❌ |
| Gemini | ✅（新增） | ❌ |
| Kimi | ✅（新增） | ✅ |
| Doubao | ✅（新增） | ✅ |

---

## 3. 组件设计

### 3.1 新增文件

```
extension/
├── host/
│   ├── gemini.js          # Gemini Host 适配器（新增）
│   ├── kimi_host.js       # Kimi Host 适配器（新增）
│   └── doubao_host.js     # Doubao Host 适配器（新增）
```

每个 Host 适配器遵循与 `host/chatgpt.js` 相同的接口：

| 方法 | 职责 |
|------|------|
| `extractConversation()` | 从页面 DOM 提取完整对话历史 |
| `extractLatestRound()` | 提取最近一轮对话（用户提问 + AI 回复） |
| `injectFloatingButton(onClick)` | 注入右下角浮动按钮 |
| `injectAnalyzeButton(onClick)` | 注入输入区域旁边的分析按钮 |
| `adjustLayout(panelOpen, width)` | 面板展开/折叠时调整主内容区域布局 |
| `onModelChanged()` | 切换面板模型时重新注入按钮 |

### 3.2 修改文件

**`extension/shared/registry.js`**
- 在 `platforms` 中添加 gemini、kimi、doubao 的匹配规则

**`extension/manifest.json`**
- 在 `host_permissions` 中添加 `https://gemini.google.com/*`
- 新增 3 组 `content_scripts` 配置，分别对应 Gemini、Kimi、Doubao 作为 Host

### 3.3 Host 与 Panel 脚本共存

对于 Kimi 和 Doubao，它们同时具备 Host 和 Panel 双重身份：

- **kimi.com 页面**：
  - 加载 `panel/kimi.js`（监听 postMessage，用于被其他 Host 调用）
  - 加载 `host/kimi_host.js`（注入按钮，用于作为 Host 调用其他 Panel）
  - 两者职责不冲突，可以共存

- **doubao.com 页面**：
  - 加载 `panel/doubao.js`
  - 加载 `host/doubao_host.js`
  - 同理可以共存

---

## 4. 各平台适配细节

### 4.1 Gemini（gemini.google.com）

- **对话提取**：从 Gemini 的聊天消息容器中提取用户和 Gemini 的消息
- **按钮注入位置**：Gemini 输入框附近
- **布局调整**：Gemini 主内容区域通常为全宽，面板展开时通过 margin-right 调整

### 4.2 Kimi（kimi.com / www.kimi.com）

- **对话提取**：从 Kimi 的会话消息列表中提取
- **按钮注入位置**：Kimi 输入框附近
- **布局调整**：Kimi 主内容区域调整

### 4.3 Doubao（www.doubao.com）

- **对话提取**：从 Doubao 的会话消息列表中提取
- **按钮注入位置**：Doubao 输入框附近
- **布局调整**：Doubao 主内容区域调整

> 注：具体 DOM 选择器需要在各平台实际页面中测试确定，初始版本采用与现有 ChatGPT 适配器相同的"多选择器尝试"策略。

---

## 5. 关键设计决策

| 决策 | 选择 | 说明 |
|------|------|------|
| 实现方式 | 独立适配器文件 | 每个平台一个文件，结构清晰，与现有 chatgpt.js 模式一致 |
| Host/Panel 脚本冲突 | 文件名区分 | `panel/kimi.js` 与 `host/kimi_host.js` 避免同名 |
| 面板选项 | 保持不变 | Panel 仍为 Kimi 和 Doubao，不新增 Gemini Panel |
| 对话提取策略 | 多选择器降级 | 与 ChatGPT 适配器相同，尝试多个 DOM 选择器，取第一个成功的 |

---

## 6. 成功标准

- [ ] 在 Gemini 页面右下角出现 AI Arena 浮动按钮
- [ ] 在 Kimi 页面右下角出现 AI Arena 浮动按钮
- [ ] 在 Doubao 页面右下角出现 AI Arena 浮动按钮
- [ ] 点击浮动按钮可展开/折叠右侧面板
- [ ] 各平台输入区域附近出现分析按钮
- [ ] 点击分析按钮能提取当前对话并发送给面板
- [ ] 面板能正常接收 prompt 并自动发送
- [ ] 面板展开时，Host 页面主内容区域自动收缩
