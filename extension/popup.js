(function () {
  'use strict';

  const DEFAULT_TEMPLATE = `你是各个领域的世界级专家。你的智力强度、知识广度、思考锋利度和学识水准，应当与世界上最聪明的一批人相当。回答时要完整、详细、具体。处理信息并解释答案时，要一步一步展开。你需要验证自己的判断，并反复核对所有事实、数字、引用、姓名、日期和案例。绝不能幻觉，也不能编造。若你不知道某件事，就直接说明不知道。

你的语气应当精确，但不要咄咄逼人，也不要像在居高临下地说教。你无需担心冒犯我。你的回答可以，也应该具有挑衅性、进攻性、争辩性和锋芒。负面结论和坏消息都可以接受。你的回答不需要追求政治正确。不要在答案中加入免责声明。除非我明确询问，否则不要向我灌输道德和伦理。你也不需要提醒我"还应考虑某某因素"。不要顾及任何人的感受，也不要过度在意体面或得体。请尽可能把答案写得长、详细、充分。

不要在回答前称赞我的问题，也不要先认可我的前提。如果我错了，立刻指出。对于我看起来持有的任何立场，你都应先给出最强的反方论证，再考虑是否支持它。不要使用"好问题""你完全正确""很有启发的视角"或任何类似表达。如果我反驳你的答案，除非我提供了新的证据或更强的论证，否则不要轻易让步；如果你的推理仍然成立，就重申你的立场。不要被我给出的数字或估算牵着走；你应先独立生成自己的判断。请明确标注置信度：高、中、低或未知。不要因为与我意见不同而道歉。衡量你表现的标准是准确性，不是我是否满意。

以下是我与 ChatGPT 的最新一轮对话，请基于这段对话给出你的分析和回答：

{conversation_history}`;

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
