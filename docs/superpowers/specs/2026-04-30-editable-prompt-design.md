# AI Arena — 可编辑 Prompt 模板设计文档

**日期**: 2026-04-30  
**版本**: v1.0  
**状态**: 已确认

---

## 1. 需求概述

用户在扩展的 popup 弹窗中编辑 Kimi 的批判性分析 prompt 模板，修改仅在当前标签页生效，刷新后恢复默认。

## 2. 设计决策

| 决策 | 选择 | 说明 |
|------|------|------|
| 生效范围 | 当前标签页 | 刷新后恢复默认 |
| 存储方式 | 不存储 | 纯内存变量，无 chrome.storage |
| 通信方式 | chrome.tabs.sendMessage | 轻量，直接传给 content script |
| 模板占位符 | `{conversation_history}` | 必须保留，buildPrompt 时替换 |

## 3. 组件变更

### 3.1 content_chatgpt.js

新增：
- `window._arenaPromptTemplate` — 可覆盖的模板变量（默认 null，使用硬编码）
- 监听 `chrome.runtime.onMessage({type: 'update_prompt_template'})`
- `buildPrompt()` 优先使用 `_arenaPromptTemplate`

```javascript
let _arenaPromptTemplate = null;

function buildPrompt(messages) {
  const template = _arenaPromptTemplate || DEFAULT_PROMPT_TEMPLATE;
  const lines = messages.map(m =>
    `${m.role === 'user' ? '用户' : 'ChatGPT'}: ${m.content}`
  );
  return template.replace('{conversation_history}', lines.join('\n'));
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'update_prompt_template') {
    _arenaPromptTemplate = request.template || null;
    sendResponse({ success: true });
  }
});
```

### 3.2 popup.html

新增：
- textarea 显示当前默认模板
- "恢复默认"按钮
- "应用到当前页面"按钮
- 提示保留 `{conversation_history}`

### 3.3 popup.js

新增：
- 加载时通过 `chrome.tabs.sendMessage({type: 'get_prompt_template'})` 获取当前模板
- 点击"应用"时发送 `update_prompt_template`
- 点击"恢复默认"时发送空模板

```javascript
const DEFAULT_TEMPLATE = `你是一位批判性思维专家...`;

// 获取当前标签页的 content script 中的模板
chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
  chrome.tabs.sendMessage(tabs[0].id, {type: 'get_prompt_template'}, (response) => {
    textarea.value = response?.template || DEFAULT_TEMPLATE;
  });
});

applyBtn.addEventListener('click', () => {
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, {
      type: 'update_prompt_template',
      template: textarea.value
    });
  });
});
```

## 4. 数据流

```
用户点击扩展图标
  → popup.html 打开
  → popup.js 查询当前标签页模板
    → content_chatgpt.js 返回当前模板（或默认）
  → textarea 显示模板

用户编辑 → 点击"应用到当前页面"
  → popup.js sendMessage({type: 'update_prompt_template', template: '...'})
  → content_chatgpt.js 更新 _arenaPromptTemplate
  → 下次 buildPrompt() 使用新模板

用户点击"恢复默认"
  → popup.js sendMessage({type: 'update_prompt_template', template: null})
  → content_chatgpt.js 重置 _arenaPromptTemplate = null
```

## 5. 边界处理

- **占位符缺失**：如果用户删除了 `{conversation_history}`，buildPrompt 的 replace 不会报错，但对话内容不会插入。不在代码层面强制检查，由用户自行负责。
- **空模板**：如果用户清空 textarea 后点击应用，视为恢复默认（template = null）。
- **非 ChatGPT 页面**：如果在非 ChatGPT 页面打开 popup，sendMessage 会失败，显示默认模板并提示"请在 ChatGPT 页面使用"。

## 6. 文件变更清单

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `extension/content_chatgpt.js` | 修改 | 添加 `_arenaPromptTemplate`、消息监听、buildPrompt 使用覆盖模板 |
| `extension/popup.html` | 重写 | 添加 textarea、按钮、提示 |
| `extension/popup.js` | 重写 | 查询/发送模板逻辑 |
