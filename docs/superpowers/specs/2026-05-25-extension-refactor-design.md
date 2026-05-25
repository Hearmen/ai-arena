# AI Arena Extension 架构重构设计

## 背景

当前 AI Arena Chrome 扩展支持在 ChatGPT 页面打开 Kimi / 豆包分析面板。随着功能扩展，需要支持：

1. **更多面板模型**：除 Kimi、豆包外，未来可能接入通义千问、DeepSeek 等
2. **更多主页面平台**：除 ChatGPT 外，未来可能支持 Claude、Gemini、文心一言等

当前 `content_chatgpt.js`（777 行）将平台特定逻辑（ChatGPT DOM 提取、按钮注入）与通用框架逻辑（面板管理、Provider 切换）混杂在一起，导致扩展困难。

## 设计目标

1. **面板侧模型适配**与**主交互页面模型适配**在项目结构上是分开的
2. 新增面板模型或主页面平台时，改动范围最小化
3. 零构建步骤，纯文件拆分即可运行

## 架构概览

```
extension/
├── manifest.json                  # 扩展配置
├── popup.html / popup.js          # 弹窗配置
├── icons/                         # 图标资源
├── host/                          # 主交互页面侧
│   ├── _core.js                   # 通用框架：面板管理、Provider 切换、Prompt 构建
│   ├── _ui.js                     # 通用 UI：面板容器、resize 手柄
│   ├── chatgpt.js                 # ChatGPT 平台适配器
│   └── prompt.js                  # Prompt 模板构建（通用）
├── panel/                         # 面板侧适配
│   ├── kimi.js                    # Kimi 面板适配
│   └── doubao.js                  # 豆包面板适配
└── shared/
    ├── registry.js                # 集中注册表：所有平台 + 所有模型的配置
    └── utils.js                   # 共享工具函数
```

## 模块职责

### shared/utils.js

共享工具函数，被 host 和 panel 两侧共同使用：

- `showNotification(message, type)` — 全局通知提示
- `debounce(fn, ms)` — 防抖工具
- `waitForElement(selector, timeout)` — 等待 DOM 元素出现

全局挂载：`window.AIArena.Utils`

### shared/registry.js

集中配置注册表，定义所有支持的平台和模型：

```javascript
window.AIArena.Registry = {
  platforms: {
    chatgpt: {
      name: 'ChatGPT',
      matches: ['https://chatgpt.com/*'],
    },
    // 未来扩展：claude, gemini...
  },
  models: {
    kimi: {
      name: 'Kimi',
      title: '🎯 Kimi 分析面板',
      iframeSrc: 'https://kimi.com',
      btnText: '🎯 让 Kimi 分析',
      fabTitle: 'Kimi 分析面板',
      color: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      shadowColor: 'rgba(102, 126, 234, 0.4)',
    },
    doubao: {
      name: '豆包',
      title: '📦 豆包分析面板',
      iframeSrc: 'https://www.doubao.com/chat',
      btnText: '📦 让豆包分析',
      fabTitle: '豆包分析面板',
      color: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%)',
      shadowColor: 'rgba(238, 90, 36, 0.4)',
    },
    // 未来扩展：deepseek, qianwen...
  },
};
```

**扩展方式**：新增模型时，只需在此文件中添加配置项，无需修改任何逻辑代码。

### host/prompt.js

Prompt 模板构建，与平台无关：

- 定义 `DEFAULT_PROMPT_TEMPLATE`
- `buildPrompt(messages, template)` — 将对话历史填入模板
- `getTemplate()` / `setTemplate(template)` — 模板读写

全局挂载：`window.AIArena.Prompt`

### host/_core.js

通用框架核心，**不假设任何平台特定的 DOM 结构**。

职责：
- Provider（模型）状态管理（当前选中的模型、切换逻辑）
- 面板 iframe 生命周期管理（创建、显示、隐藏、销毁）
- 面板宽度调整、resize 事件处理
- 向 iframe 发送 `postMessage`
- 平台适配器注册接口
- 从 `chrome.storage.sync` 读取/保存用户偏好

全局挂载：`window.AIArena.Host`

**平台注册接口**：

```javascript
window.AIArena.Host.registerPlatform(adapter)

// adapter 契约：
{
  name: string,                    // 平台标识，如 'chatgpt'
  
  // 必需方法
  extractConversation(): Message[], // 提取完整对话
  extractLatestRound(): Message[],  // 提取最新一轮对话
  injectAnalyzeButton(onClick): void,  // 在输入区注入分析按钮
  injectFloatingButton(onClick): void, // 注入右下角浮动按钮
  adjustLayout(panelOpen, width): void, // 面板开关时的页面布局调整
}
```

### host/_ui.js

平台无关的通用 UI 组件：

- `createPanel(modelConfig)` — 创建侧栏面板（iframe 容器 + header + provider 下拉选择器）
- `createFloatingButton(config, onClick)` — 创建浮动按钮（但注入位置由平台决定）
- `createAnalyzeButton(config, onClick)` — 创建分析按钮（但注入位置由平台决定）
- `showNotification(...)` — 通知（委托给 shared/utils.js）

全局挂载：`window.AIArena.UI`

### host/chatgpt.js

ChatGPT 平台适配器，**只包含 ChatGPT 特定的 DOM 操作**。

实现 `registerPlatform` 接口的 5 个方法：

1. `extractConversation()` — 从 `article[data-testid^="conversation-turn-"]` 等策略提取对话
2. `extractLatestRound()` — 提取最后一轮 user + assistant
3. `injectAnalyzeButton(onClick)` — 在 ChatGPT 输入区（send-button 附近）插入分析按钮
4. `injectFloatingButton(onClick)` — 创建并插入右下角浮动按钮
5. `adjustLayout(panelOpen, width)` — 调整 `main[role="main"]` 的 `marginRight`

注入顺序上，`_core.js` 先于 `chatgpt.js` 加载，因此 `chatgpt.js` 可以直接调用 `window.AIArena.Host.registerPlatform(...)` 完成注册。

### panel/kimi.js

Kimi 面板适配，注入 `kimi.com`：

- 监听 `window.message` 事件
- `findInputElement()` — 查找输入框（支持多种 selector 回退）
- `findSendButton()` — 查找发送按钮
- `setInputText(element, text)` — 设置输入文本（支持 contenteditable 和 textarea）
- `submitToKimi(text)` — 填充并提交

独立运行，不依赖任何 host 侧代码。

### panel/doubao.js

豆包面板适配，注入 `doubao.com`：

- 监听 `window.message` 事件
- `findInputElement()` — 查找 `textarea.semi-input-textarea`
- `findSendButton()` — 通过 SVG path 特征识别发送按钮
- `simulateTyping(element, text)` — 逐字模拟输入（适配 React/Semi Design）
- `submitToDoubao(text)` — 填充并提交

独立运行，不依赖任何 host 侧代码。

## manifest.json 注入顺序

Manifest V3 的 `content_scripts.js` 数组按顺序加载执行：

```json
{
  "content_scripts": [
    {
      "matches": ["https://chatgpt.com/*"],
      "js": [
        "shared/utils.js",
        "shared/registry.js",
        "host/prompt.js",
        "host/_core.js",
        "host/_ui.js",
        "host/chatgpt.js"
      ],
      "run_at": "document_idle"
    },
    {
      "matches": ["https://kimi.com/*", "https://www.kimi.com/*"],
      "js": ["shared/utils.js", "panel/kimi.js"],
      "run_at": "document_idle"
    },
    {
      "matches": ["https://www.doubao.com/*"],
      "js": ["shared/utils.js", "panel/doubao.js"],
      "run_at": "document_idle"
    }
  ]
}
```

## 扩展指南

### 新增面板模型（如 DeepSeek）

1. 创建 `panel/deepseek.js`，参考 `panel/kimi.js` 的结构：
   - 监听 `message` 事件
   - 实现 `findInputElement()`、`findSendButton()`、`submitToDeepSeek(text)`
2. 在 `shared/registry.js` 的 `models` 中添加 DeepSeek 配置
3. 在 `manifest.json` 中新增 `content_scripts` 项，匹配 DeepSeek 域名

**改动文件数：2（新增 1 个，修改 2 个配置）**

### 新增主页面平台（如 Claude）

1. 创建 `host/claude.js`，实现平台适配器接口：
   - `extractConversation()` — Claude 特定 DOM 提取
   - `injectAnalyzeButton(onClick)` — Claude 输入区按钮注入
   - `injectFloatingButton(onClick)` — 浮动按钮
   - `adjustLayout(panelOpen, width)` — Claude 布局调整
2. 在 `shared/registry.js` 的 `platforms` 中添加 Claude 配置
3. 在 `manifest.json` 中新增 `content_scripts` 项，匹配 Claude 域名，注入顺序与 ChatGPT 相同

**改动文件数：2（新增 1 个，修改 2 个配置）**

### 同时新增平台和模型

两个维度完全独立，互不影响。可以并行开发。

## 接口契约详情

### host/_core.js → host/platform.js 的调用关系

`_core.js` 在初始化时会：
1. 调用 `adapter.injectFloatingButton(togglePanel)`
2. 调用 `adapter.injectAnalyzeButton(handleAnalyze)`
3. 面板打开时调用 `adapter.adjustLayout(true, width)`
4. 点击分析按钮时调用 `adapter.extractLatestRound()`

### host/_core.js → panel/*.js 的通信

通过 `iframe.contentWindow.postMessage` 发送统一格式的消息：

```javascript
{
  source: 'ai-arena',
  type: 'analyze_conversation',
  payload: { prompt: string }
}
```

面板侧的 `panel/*.js` 只需监听此消息格式，无需知道消息来自哪个平台。

### popup.js → host/_core.js 的通信

通过 `chrome.tabs.sendMessage` 发送：

```javascript
{ type: 'switch_provider', provider: 'doubao' }
{ type: 'update_prompt_template', template: string }
{ type: 'get_provider' }
{ type: 'get_prompt_template' }
```

由 `_core.js` 中的 `chrome.runtime.onMessage` 监听器统一处理。

## 零构建约束下的注意事项

1. **无模块系统**：所有文件通过全局变量 `window.AIArena` 通信，加载顺序由 manifest 控制
2. **无 Tree Shaking**：每个文件需要自包含，不依赖未加载的文件
3. **命名空间隔离**：`window.AIArena.{Host, UI, Prompt, Utils, Registry, PanelXxx}` 避免全局污染
4. **文件大小控制**：拆分后单个文件不超过 300 行，便于维护

## 文件行数预估（重构后）

| 文件 | 预估行数 | 当前行数 |
|------|---------|---------|
| `shared/utils.js` | ~80 | — |
| `shared/registry.js` | ~60 | — |
| `host/prompt.js` | ~50 | 内嵌于 content_chatgpt.js |
| `host/_core.js` | ~250 | 内嵌于 content_chatgpt.js |
| `host/_ui.js` | ~200 | 内嵌于 content_chatgpt.js |
| `host/chatgpt.js` | ~200 | 内嵌于 content_chatgpt.js |
| `panel/kimi.js` | ~190 | ~190（已有）|
| `panel/doubao.js` | ~210 | ~210（已有）|

合计约 1240 行（当前 4 个文件合计 1272 行），总代码量基本不变，但职责边界清晰。
