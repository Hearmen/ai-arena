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
    setTimeout(() => { statusEl.className = 'status'; }, 2000);
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
