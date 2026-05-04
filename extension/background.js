/**
 * AI Arena Bridge — Background Service Worker
 *
 * Manages WebSocket connection to local backend and routes messages
 * between content scripts and the backend.
 */

const WS_URL = 'ws://localhost:8000';
let socket = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_BASE_DELAY = 1000;

// Connection status
let isConnected = false;

/**
 * Initialize WebSocket connection
 */
function connectWebSocket() {
  if (socket && (socket.readyState === WebSocket.CONNECTING || socket.readyState === WebSocket.OPEN)) {
    console.log('[AI Arena] WebSocket already connected or connecting');
    return;
  }

  console.log('[AI Arena] Connecting to backend...');
  socket = new WebSocket(WS_URL);

  socket.onopen = () => {
    console.log('[AI Arena] WebSocket connected');
    isConnected = true;
    reconnectAttempts = 0;
    broadcastStatus({ connected: true });
  };

  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    console.log('[AI Arena] Received from backend:', data);

    // Route analysis results to Kimi content script
    if (data.event === 'analysis_complete' || data.event === 'analysis_chunk') {
      chrome.tabs.query({ url: 'https://moonshot.cn/*' }, (tabs) => {
        tabs.forEach((tab) => {
          chrome.tabs.sendMessage(tab.id, {
            type: data.event,
            payload: data.data,
          }).catch(() => {
            // Tab may not have content script loaded
          });
        });
      });
    }
  };

  socket.onclose = () => {
    console.log('[AI Arena] WebSocket closed');
    isConnected = false;
    broadcastStatus({ connected: false });
    attemptReconnect();
  };

  socket.onerror = (error) => {
    console.error('[AI Arena] WebSocket error:', error);
    isConnected = false;
    broadcastStatus({ connected: false, error: true });
  };
}

/**
 * Attempt reconnection with exponential backoff
 */
function attemptReconnect() {
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.log('[AI Arena] Max reconnection attempts reached');
    return;
  }

  const delay = RECONNECT_BASE_DELAY * Math.pow(2, reconnectAttempts);
  reconnectAttempts++;

  console.log(`[AI Arena] Reconnecting in ${delay}ms (attempt ${reconnectAttempts})`);
  setTimeout(connectWebSocket, delay);
}

/**
 * Broadcast connection status to all tabs
 */
function broadcastStatus(status) {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      chrome.tabs.sendMessage(tab.id, {
        type: 'connection_status',
        payload: status,
      }).catch(() => {
        // Tab may not have content script loaded
      });
    });
  });
}

/**
 * Send data to backend via WebSocket
 */
function sendToBackend(event, data) {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    console.error('[AI Arena] WebSocket not connected');
    return false;
  }

  const message = JSON.stringify([event, data]);
  socket.send(message);
  return true;
}

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[AI Arena] Received from content script:', request);

  if (request.type === 'analyze_conversation') {
    const success = sendToBackend('analyze_conversation', request.payload);
    sendResponse({ success });
  } else if (request.type === 'get_status') {
    sendResponse({ connected: isConnected });
  }

  return true; // Keep message channel open for async response
});

// Initialize connection on startup
connectWebSocket();

// Keep service worker alive
chrome.alarms.create('keepAlive', { periodInMinutes: 4.9 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'keepAlive') {
    console.log('[AI Arena] Keep alive');
  }
});
