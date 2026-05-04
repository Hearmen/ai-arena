document.addEventListener('DOMContentLoaded', () => {
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  const wsUrlInput = document.getElementById('wsUrl');
  const saveBtn = document.getElementById('saveBtn');

  // Load saved config
  chrome.storage.local.get(['wsUrl'], (result) => {
    if (result.wsUrl) {
      wsUrlInput.value = result.wsUrl;
    }
  });

  // Check connection status
  chrome.runtime.sendMessage({ type: 'get_status' }, (response) => {
    if (chrome.runtime.lastError) {
      statusDot.className = 'status-dot disconnected';
      statusText.textContent = '服务未运行';
      return;
    }
    if (response && response.connected) {
      statusDot.className = 'status-dot connected';
      statusText.textContent = '已连接';
    } else {
      statusDot.className = 'status-dot disconnected';
      statusText.textContent = '未连接';
    }
  });

  // Save config
  saveBtn.addEventListener('click', () => {
    chrome.storage.local.set({ wsUrl: wsUrlInput.value }, () => {
      saveBtn.textContent = '已保存';
      setTimeout(() => {
        saveBtn.textContent = '保存设置';
      }, 1500);
    });
  });
});
