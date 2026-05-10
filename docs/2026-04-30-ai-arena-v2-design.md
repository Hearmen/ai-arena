# AI Arena V2 — 设计文档（无后端版）

**日期**: 2026-04-30  
**版本**: v2.1  
**状态**: 已确认

---

## 1. 产品概述

**AI Arena** 是一个纯浏览器扩展，帮助用户在 ChatGPT 对话时获得 Kimi 的批判性分析。

### 核心场景

1. **展开面板**：用户点击扩展浮动按钮 🎯，在 ChatGPT 页面右侧展开 Kimi 分析面板；同时 ChatGPT 输入区域被注入"让 Kimi 分析"按钮
2. **正常对话**：用户在 ChatGPT 网页版正常对话
3. **手动触发**：ChatGPT 给出回复后，用户点击"让 Kimi 分析"按钮（如果面板处于折叠状态，自动展开）
4. **抓取对话**：扩展抓取**完整对话历史**（从第一轮到当前所有消息）
5. **本地包装**：扩展在本地将对话包装成批判性 prompt
6. **自动发送**：通过 postMessage 将 prompt 发送给 Kimi 面板，自动填入并发送
7. **查看结果**：用户在右侧 Kimi 面板中看到批判性分析

### 关键设计决策

| 决策 | 选择 | 说明 |
|------|------|------|
| 触发时机 | 每轮手动触发 | 用户掌控分析节奏，避免干扰连续对话 |
| 面板状态 | 分析时自动展开 | 如果折叠，点击分析按钮自动展开面板 |
| 分析范围 | 完整对话历史 | 从第一轮到当前全部消息，Kimi 有完整上下文 |
| 目标平台 | ChatGPT + Kimi | MVP 先支持这两个，架构预留扩展能力 |
| 架构 | 纯扩展，无后端 | prompt 包装在本地完成，无需服务器 |

---

## 2. 系统架构

```
浏览器标签页 (chatgpt.com)
├─ ChatGPT 正常对话区域
│   └─ 扩展注入"让 Kimi 分析"按钮
│
├─ 右侧 Kimi 分析面板 (iframe kimi.com)
│   └─ 扩展注入 KimiAdapter，接收 prompt 并自动发送
│
├─ 浮动按钮 🎯 (右下角)
│   └─ 点击展开/折叠 Kimi 面板
│
└─ 扩展核心逻辑 (content script)
    ├─ ChatGPTAdapter: 提取对话
    ├─ PromptBuilder: 本地包装 prompt
    └─ 通过 postMessage 发送给 Kimi iframe
```

---

## 3. 组件设计

### 3.1 扩展文件结构

```
extension/
├── manifest.json              # MV3 配置
├── core/
│   ├── adapter-base.js        # 适配器基类
│   ├── chatgpt-adapter.js     # ChatGPT: 提取对话、注入 UI
│   ├── kimi-adapter.js        # Kimi: 接收 prompt、自动发送
│   └── prompt-builder.js      # 本地 prompt 包装
├── ui/
│   ├── panel.js               # 侧边栏面板
│   ├── floating-button.js     # 浮动按钮
│   └── styles.css             # 样式
└── popup.html/js              # 扩展弹窗
```

### 3.2 PromptBuilder

```javascript
const CRITIC_PROMPT_TEMPLATE = `你是一位批判性思维专家。用户正在与 ChatGPT 讨论一个话题。
请基于以下对话历史，提供批判性分析：

1. 指出 ChatGPT 观点中可能存在的漏洞、偏见或过度简化
2. 提出被忽略的不同视角或反方论据
3. 建议用户进一步思考的方向
4. 保持客观、理性，不要为反对而反对

对话历史：
{conversation_history}

请用中文给出你的分析，结构清晰，分点论述。`;

function buildPrompt(messages) {
  const lines = messages.map(m => 
    `${m.role === 'user' ? '用户' : 'ChatGPT'}: ${m.content}`
  );
  return CRITIC_PROMPT_TEMPLATE.replace('{conversation_history}', lines.join('\n'));
}
```

### 3.3 通信流程

```
ChatGPT 页面 (content script)
    │
    ├─ 用户点击"让 Kimi 分析"
    │
    ├─ ChatGPTAdapter.extractConversation()
    │       ↓
    ├─ PromptBuilder.buildPrompt(messages)
    │       ↓
    └─ iframe.contentWindow.postMessage({prompt}, '*')
                │
                ▼
        Kimi iframe (content script)
            │
            ├─ KimiAdapter.receivePrompt()
            │       ↓
            └─ 填入输入框 → 点击发送
```

---

## 4. 组件详情

### 4.1 ChatGPTAdapter

职责：
- 检测当前是否在 chatgpt.com
- 提取对话历史
- 注入浮动按钮和侧边栏面板
- 注入"让 Kimi 分析"按钮到 ChatGPT 输入区域
- 点击时：提取对话 → 包装 prompt → postMessage 给 Kimi iframe

### 4.2 KimiAdapter

职责：
- 检测当前是否在 kimi.com（包括 iframe 内）
- 监听 window.postMessage
- 接收 prompt 后填入输入框
- 模拟点击发送按钮

### 4.3 SidePanel

职责：
- 创建固定定位的右侧面板
- 内部包含 iframe 加载 kimi.com
- 支持展开/折叠
- 支持拖拽调整宽度

### 4.4 FloatingButton

职责：
- 右下角浮动按钮 🎯
- 点击展开/折叠面板

---

## 5. 可扩展性

新增 AI 平台时：
1. 创建 `xxx-adapter.js` 继承 BaseAdapter
2. 实现 `extractConversation()` 和 `injectUI()`
3. 在 manifest.json 添加 content_scripts 匹配规则

---

## 6. 成功标准

- [ ] 浮动按钮 🎯 显示在 ChatGPT 页面右下角
- [ ] 点击按钮展开右侧 Kimi 面板
- [ ] Kimi 面板内 iframe 正常加载 kimi.com
- [ ] ChatGPT 输入区域注入"让 Kimi 分析"按钮
- [ ] 点击分析按钮抓取完整对话历史
- [ ] 本地包装成批判性 prompt
- [ ] Kimi 面板自动填入 prompt 并发送
- [ ] Kimi 显示批判性分析结果
- [ ] 面板可拖拽调整宽度
- [ ] 面板可折叠/展开
