# Editable Prompt Template Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在扩展 popup 弹窗中编辑 Kimi 批判性分析 prompt 模板，修改仅在当前标签页生效。

**Architecture:** content_chatgpt.js 维护可覆盖的 prompt 模板变量，popup.js 通过 chrome.tabs.sendMessage 进行读写通信，无 storage 持久化。

**Tech Stack:** Chrome Extension MV3, vanilla JavaScript

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `extension/content_chatgpt.js` | Modify | Add `_arenaPromptTemplate` 变量；`buildPrompt()` 使用覆盖模板；监听 `get_prompt_template` / `update_prompt_template` 消息 |
| `extension/popup.html` | Rewrite | textarea + 恢复默认/应用按钮 + 提示文案 |
| `extension/popup.js` | Rewrite | 打开时查询当前模板；按钮点击发送更新/恢复消息 |

---

## Task 1: Modify content_chatgpt.js — 支持模板覆盖

**Files:**
- Modify: `extension/content_chatgpt.js`

- [ ] **Step 1: 提取默认模板为常量，添加可覆盖变量**

  在 IIFE 顶部（`panelVisible` 等变量附近）添加：

  ```javascript
  // ───────────────────────────────────────────────
  // Prompt Template (overridable per tab)
  // ───────────────────────────────────────────────
  const DEFAULT_PROMPT_TEMPLATE = `你是一位批判性思维专家。用户正在与 ChatGPT 讨论一个话题。
  请基于以下对话历史，提供批判性分析：

  1. 指出 ChatGPT 观点中可能存在的漏洞、偏见或过度简化
  2. 提出被忽略的不同视角或反方论据
  3. 建议用户进一步思考的方向
  4. 保持客观、理性，不要为反对而反对

  对话历史：
  {conversation_history}

  请用中文给出你的分析，结构清晰，分点论述。`;

  let _arenaPromptTemplate = null; // null = use default
  ```

  同时删除原来内联定义的 `CRITIC_PROMPT_TEMPLATE` 常量。

- [ ] **Step 2: 修改 buildPrompt 使用覆盖模板**

  将 `buildPrompt` 函数改为：

  ```javascript
  function buildPrompt(messages) {
    const template = _arenaPromptTemplate || DEFAULT_PROMPT_TEMPLATE;
    const lines = messages.map(m =>
      `${m.role === 'user' ? '用户' : 'ChatGPT'}: ${m.content}`
    );
    return template.replace('{conversation_history}', lines.join('\n'));
  }
  ```

- [ ] **Step 3: 添加 chrome.runtime.onMessage 监听**

  在文件底部（cleanup 之前）添加消息监听：

  ```javascript
  // ───────────────────────────────────────────────
  // Listen for prompt template updates from popup
  // ───────────────────────────────────────────────
  if (chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.type === 'get_prompt_template') {
        sendResponse({
          template: _arenaPromptTemplate || DEFAULT_PROMPT_TEMPLATE,
          isDefault: !_arenaPromptTemplate
        });
        return true;
      }
      if (request.type === 'update_prompt_template') {
        _arenaPromptTemplate = request.template || null;
        console.log('[AI Arena] Prompt template updated');
        sendResponse({ success: true });
        return true;
      }
    });
  }
  ```

- [ ] **Step 4: Commit**

  ```bash
  git add extension/content_chatgpt.js
  git commit -m "feat(content_chatgpt): support overridable prompt template

  - Extract DEFAULT_PROMPT_TEMPLATE constant
  - Add _arenaPromptTemplate variable (null = use default)
  - Modify buildPrompt() to use override template
  - Add chrome.runtime.onMessage listener for get/update_prompt_template"
  ```

---

## Task 2: Rewrite popup.html — 编辑界面

**Files:**
- Rewrite: `extension/popup.html`

- [ ] **Step 1: 编写新的 popup.html**

  ```html
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8">
    <style>
      * { box-sizing: border-box; }
      body {
        width: 400px;
        padding: 16px;
        margin: 0;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 13px;
        color: #374151;
      }
      h1 {
        font-size: 16px;
        margin: 0 0 12px 0;
        color: #111827;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      label {
        display: block;
        font-weight: 500;
        margin-bottom: 6px;
        color: #111827;
      }
      textarea {
        width: 100%;
        height: 200px;
        padding: 10px 12px;
        border: 1px solid #d1d5db;
        border-radius: 6px;
        font-size: 13px;
        line-height: 1.5;
        resize: vertical;
        font-family: inherit;
      }
      textarea:focus {
        outline: none;
        border-color: #667eea;
        box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
      }
      .hint {
        margin-top: 6px;
        font-size: 11px;
        color: #6b7280;
      }
      .hint code {
        background: #f3f4f6;
        padding: 1px 4px;
        border-radius: 3px;
        font-family: 'SF Mono', Monaco, monospace;
      }
      .actions {
        display: flex;
        gap: 8px;
        margin-top: 12px;
      }
      button {
        flex: 1;
        padding: 8px 12px;
        border: none;
        border-radius: 6px;
        font-size: 13px;
        cursor: pointer;
        font-family: inherit;
        transition: background 0.15s;
      }
      button.primary {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
      }
      button.primary:hover {
        opacity: 0.9;
      }
      button.secondary {
        background: #f3f4f6;
        color: #374151;
      }
      button.secondary:hover {
        background: #e5e7eb;
      }
      .status {
        margin-top: 10px;
        padding: 8px 10px;
        border-radius: 6px;
        font-size: 12px;
        display: none;
      }
      .status.success {
        display: block;
        background: #d1fae5;
        color: #065f46;
      }
      .status.error {
        display: block;
        background: #fee2e2;
        color: #991b1b;
      }
    </style>
  </head>
  <body>
    <h1>🎯 AI Arena</h1>
    <label for="promptTemplate">Kimi 分析 Prompt 模板</label>
    <textarea id="promptTemplate" placeholder="Loading..."></textarea>
    <div class="hint">
      💡 保留 <code>{conversation_history}</code> 占位符，它会被替换为对话内容
    </div>
    <div class="actions">
      <button id="resetBtn" class="secondary">恢复默认</button>
      <button id="applyBtn" class="primary">应用到当前页面</button>
    </div>
    <div id="status" class="status"></div>
    <script src="popup.js"></script>
  </body>
  </html>
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add extension/popup.html
  git commit -m "feat(popup): redesign popup with editable prompt textarea"
  ```

---

## Task 3: Rewrite popup.js — 通信逻辑

**Files:**
- Rewrite: `extension/popup.js`

- [ ] **Step 1: 编写新的 popup.js**

  ```javascript
  (function () {
    'use strict';

    const DEFAULT_TEMPLATE = `你是一位批判性思维专家。用户正在与 ChatGPT 讨论一个话题。
请基于以下对话历史，提供批判性分析：

1. 指出 ChatGPT 观点中可能存在的漏洞、偏见或过度简化
2. 提出被忽略的不同视角或反方论据
3. 建议用户进一步思考的方向
4. 保持客观、理性，不要为反对而反对

对话历史：
{conversation_history}

请用中文给出你的分析，结构清晰，分点论述。`;

    const textarea = document.getElementById('promptTemplate');
    const applyBtn = document.getElementById('applyBtn');
    const resetBtn = document.getElementById('resetBtn');
    const statusEl = document.getElementById('status');

    function showStatus(message, type) {
      statusEl.textContent = message;
      statusEl.className = 'status ' + type;
      setTimeout(() => {
        statusEl.className = 'status';
      }, 2000);
    }

    function sendToActiveTab(message, callback) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs || !tabs[0]) {
          showStatus('无法获取当前标签页', 'error');
          return;
        }
        chrome.tabs.sendMessage(tabs[0].id, message, (response) => {
          if (chrome.runtime.lastError) {
            showStatus('请在 ChatGPT 页面使用', 'error');
            if (callback) callback(null);
            return;
          }
          if (callback) callback(response);
        });
      });
    }

    // Load current template from content script
    sendToActiveTab({ type: 'get_prompt_template' }, (response) => {
      if (response && response.template) {
        textarea.value = response.template;
      } else {
        textarea.value = DEFAULT_TEMPLATE;
      }
    });

    // Apply button
    applyBtn.addEventListener('click', () => {
      const template = textarea.value.trim();
      if (!template) {
        showStatus('模板不能为空', 'error');
        return;
      }
      sendToActiveTab({ type: 'update_prompt_template', template }, (response) => {
        if (response && response.success) {
          showStatus('已应用到当前页面', 'success');
        }
      });
    });

    // Reset button
    resetBtn.addEventListener('click', () => {
      textarea.value = DEFAULT_TEMPLATE;
      sendToActiveTab({ type: 'update_prompt_template', template: null }, (response) => {
        if (response && response.success) {
          showStatus('已恢复默认', 'success');
        }
      });
    });
  })();
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add extension/popup.js
  git commit -m "feat(popup): implement prompt template read/write via sendMessage

  - Load current template from content script on open
  - Apply button sends update_prompt_template to active tab
  - Reset button restores default template
  - Show status feedback for all operations"
  ```

---

## Task 4: 清理 prompt-builder.js

**Files:**
- Delete: `extension/core/prompt-builder.js`

- [ ] **Step 1: 删除文件**

  ```bash
  rm extension/core/prompt-builder.js
  rmdir extension/core 2>/dev/null || true
  ```

  原因：模板逻辑已内联到 content_chatgpt.js 和 popup.js 中，此文件不再被引用。

- [ ] **Step 2: Commit**

  ```bash
  git add -A
  git commit -m "chore: remove unused prompt-builder.js

  Template logic is now inline in content_chatgpt.js and popup.js"
  ```

---

## Self-Review

**1. Spec coverage:**
- ✅ 用户在 popup 中编辑 prompt — Task 2 (UI) + Task 3 (apply logic)
- ✅ 修改仅在当前标签页生效 — Task 1 `_arenaPromptTemplate` 是内存变量
- ✅ 刷新后恢复默认 — Task 1 不持久化，刷新后变量重置为 null
- ✅ 无需 storage — 全程使用 sendMessage，无 chrome.storage
- ✅ 恢复默认按钮 — Task 3 resetBtn 发送 template: null
- ✅ 保留 `{conversation_history}` 提示 — Task 2 hint 文案

**2. Placeholder scan:**
- ✅ 无 TBD/TODO
- ✅ 所有步骤含完整代码
- ✅ 所有步骤含 exact commands

**3. Type consistency:**
- ✅ `get_prompt_template` / `update_prompt_template` 消息类型在 Task 1 和 Task 3 中一致
- ✅ `_arenaPromptTemplate` 在 Task 1 定义为 `let`，Task 3 通过 sendMessage 更新
