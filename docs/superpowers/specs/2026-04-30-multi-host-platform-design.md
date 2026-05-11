# AI Arena — 多主对话平台支持设计文档

**日期**: 2026-04-30  
**版本**: v1.0  
**状态**: 已确认

---

## 1. 需求概述

扩展当前仅支持 ChatGPT 作为主对话平台。需要支持多个主对话平台（ChatGPT、Claude、Gemini 等），用户可在 popup 中选择当前使用的主平台。分析面板固定为 Kimi（通过 iframe 嵌入）。

## 2. 设计决策

| 决策 | 选择 | 说明 |
|------|------|------|
| 扩展范围 | 主对话平台 | 分析面板固定为 Kimi |
| 架构模式 | 共享 UI + 平台提取器 | UI 逻辑复用，平台差异隔离在提取器 |
| 平台识别 | 自动识别 + 手动切换 | 根据 URL 自动匹配，popup 可手动覆盖 |
| 分析面板 | 固定 Kimi iframe | 只有 Kimi 允许被 iframe 嵌入 |
| 新增平台成本 | 只需写提取器 | 几十行 DOM 选择器代码 |

## 3. 组件架构

```
extension/
├── hosts/
│   ├── host-registry.js      # 平台注册表
│   ├── chatgpt-extractor.js  # ChatGPT DOM 提取
│   └── claude-extractor.js   # Claude DOM 提取（预留）
├── ui/
│   └── ui-framework.js       # 共享 UI 框架
├── content_host.js           # 通用入口
├── content_kimi.js           # Kimi 分析面板（不变）
├── popup.html/js             # 模型选择器 + prompt 编辑器
└── manifest.json
```

## 4. 组件详情

### 4.1 host-registry.js

定义所有支持的主对话平台：

```javascript
const HOSTS = {
  chatgpt: {
    id: 'chatgpt',
    name: 'ChatGPT',
    matches: ['chatgpt.com'],
    extractorFile: 'hosts/chatgpt-extractor.js'
  },
  claude: {
    id: 'claude',
    name: 'Claude',
    matches: ['claude.ai'],
    extractorFile: 'hosts/claude-extractor.js'
  }
};

function detectHost() {
  const hostname = location.hostname;
  for (const [key, config] of Object.entries(HOSTS)) {
    if (config.matches.some(m => hostname.includes(m))) {
      return config;
    }
  }
  return null;
}
```

### 4.2 提取器接口（每个平台必须实现）

```javascript
// chatgpt-extractor.js
const ChatGPTExtractor = {
  // 提取所有对话消息
  extractConversation() {
    // ChatGPT 特定的 DOM 选择器
    return [{ role: 'user', content: '...' }, { role: 'assistant', content: '...' }];
  },

  // 找到输入区容器（用于注入分析按钮）
  findInputContainer() {
    return document.querySelector('form[data-testid="send-button"]')?.parentElement;
  },

  // 提取最新一轮对话
  extractLatestRound() {
    const all = this.extractConversation();
    // 返回最后 user + assistant 对
  }
};
```

### 4.3 ui-framework.js

共享 UI 逻辑，所有平台通用：

```javascript
const UIFramework = {
  createFloatingButton(onClick) { /* ... */ },
  createSidePanel(url) { /* iframe 加载 kimi.com */ },
  injectAnalyzeButton(container, onClick) { /* ... */ },
  showNotification(message, type) { /* ... */ },
  adjustHostLayout(panelOpen, width) { /* margin-right */ },
  togglePanel() { /* ... */ }
};
```

### 4.4 content_host.js

通用入口，协调提取器和 UI：

```javascript
(function () {
  const host = detectHost();
  if (!host) return;

  // 加载提取器（内联或动态注入）
  const extractor = loadExtractor(host);

  // 初始化 UI
  UIFramework.createFloatingButton(() => UIFramework.togglePanel());
  UIFramework.createSidePanel('https://kimi.com');

  // 注入分析按钮
  setTimeout(() => {
    const container = extractor.findInputContainer();
    if (container) {
      UIFramework.injectAnalyzeButton(container, handleAnalyze);
    }
  }, 2000);

  function handleAnalyze() {
    const messages = extractor.extractLatestRound();
    const prompt = buildPrompt(messages);
    // postMessage 给 Kimi iframe
  }
})();
```

### 4.5 popup.html/js

新增平台选择器：

```
┌─────────────────────────┐
│ 🎯 AI Arena              │
├─────────────────────────┤
│ 主对话平台: [ChatGPT ▼] │
├─────────────────────────┤
│ Kimi 分析 Prompt 模板:   │
│ ┌─────────────────────┐ │
│ │ ...                 │ │
│ └─────────────────────┘ │
│ [恢复默认] [应用到当前页面]│
└─────────────────────────┘
```

## 5. 数据流

```
用户打开 Claude 页面 (claude.ai)
  → content_host.js 注入
  → host-registry.detectHost() → 返回 claude 配置
  → 加载 claude-extractor.js
  → ui-framework.js 初始化面板和按钮
  → 用户点击"让 Kimi 分析"
  → claude-extractor.extractLatestRound()
  → content_host.js buildPrompt()
  → iframe.contentWindow.postMessage()
  → Kimi 面板自动填入并发送
```

## 6. 文件变更清单

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `extension/hosts/host-registry.js` | 新建 | 平台注册表 |
| `extension/hosts/chatgpt-extractor.js` | 新建 | 从 content_chatgpt.js 提取的 ChatGPT DOM 操作 |
| `extension/hosts/claude-extractor.js` | 新建 | Claude DOM 提取（预留） |
| `extension/ui/ui-framework.js` | 新建 | 共享 UI 逻辑（从 content_chatgpt.js 提取） |
| `extension/content_host.js` | 新建 | 通用入口，替换 content_chatgpt.js |
| `extension/content_chatgpt.js` | 删除 | 逻辑拆分到 host-registry + ui-framework + content_host |
| `extension/content_kimi.js` | 不变 | Kimi 分析面板 |
| `extension/popup.html` | 修改 | 添加平台选择器下拉菜单 |
| `extension/popup.js` | 修改 | 平台切换逻辑 |
| `extension/manifest.json` | 修改 | 更新 content_scripts 匹配规则 |

## 7. 边界处理

- **未知平台**: content_host.js 检测到未知 URL 时不初始化，控制台提示
- **平台切换后**: popup 中切换平台后，发送消息给 content_host.js 重新初始化提取器
- **iframe 不变**: 无论主平台是什么，iframe 始终加载 kimi.com
- **提取器加载失败**: 优雅降级，显示通知提示用户
