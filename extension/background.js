/**
 * AI Arena Bridge — Background Service Worker
 *
 * Manages Socket.IO connection to local backend and routes messages
 * between content scripts and the backend.
 */

// Import Socket.IO client (loaded via importScripts in service worker)
try {
  importScripts('socket.io.min.js');
} catch (e) {
  console.error('[AI Arena] Failed to load Socket.IO client:', e);
}

let WS_URL = 'http://localhost:8000';
let socket = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_BASE_DELAY = 1000;

// Connection status
let isConnected = false;

// Load config on startup
chrome.storage.local.get(['wsUrl'], (result) => {
  if (result.wsUrl) {
    WS_URL = result.wsUrl;
  }
  connectSocket();
});

// Listen for storage changes to update WS_URL dynamically
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.wsUrl) {
    WS_URL = changes.wsUrl.newValue;
    // Reconnect with new URL
    if (socket) {
      socket.close();
    }
    connectSocket();
  }
});

/**
 * Initialize Socket.IO connection
 */
function connectSocket() {
  if (socket && socket.connected) {
    console.log('[AI Arena] Socket.IO already connected');
    return;
  }

  // Clean up old socket
  if (socket) {
    socket.removeAllListeners();
    socket.close();
  }

  console.log('[AI Arena] Connecting to backend via Socket.IO:', WS_URL);

  try {
    socket = io(WS_URL, {
      transports: ['websocket', 'polling'],
      reconnection: false, // We handle reconnection manually
      timeout: 5000,
    });

    socket.on('connect', () => {
      console.log('[AI Arena] Socket.IO connected');
      isConnected = true;
      reconnectAttempts = 0;
      broadcastStatus({ connected: true });
    });

    socket.on('analysis_chunk', (data) => {
      console.log('[AI Arena] Received analysis_chunk:', data);
      routeToKimiTabs('analysis_chunk', data);
    });

    socket.on('analysis_complete', (data) => {
      console.log('[AI Arena] Received analysis_complete:', data);
      console.log('[AI Arena] Prompt preview:', data.full_text ? data.full_text.substring(0, 100) + '...' : 'NO TEXT');
      routeToKimiTabs('analysis_complete', data);
    });

    socket.on('analysis_error', (data) => {
      console.error('[AI Arena] Received analysis_error:', data);
      routeToKimiTabs('analysis_error', data);
    });

    socket.on('disconnect', (reason) => {
      console.log('[AI Arena] Socket.IO disconnected:', reason);
      isConnected = false;
      broadcastStatus({ connected: false });
      attemptReconnect();
    });

    socket.on('connect_error', (error) => {
      console.error('[AI Arena] Socket.IO connection error:', error.message);
      isConnected = false;
      broadcastStatus({ connected: false, error: true });
      attemptReconnect();
    });

  } catch (e) {
    console.error('[AI Arena] Failed to create Socket.IO connection:', e);
    attemptReconnect();
  }
}

/**
 * Route messages to Kimi content script tabs
 */
function routeToKimiTabs(type, payload) {
  console.log('[AI Arena] Routing to Kimi tabs:', type);
  chrome.tabs.query({ url: 'https://*.kimi.com/*' }, (tabs) => {
    console.log('[AI Arena] Found Kimi tabs:', tabs.length);
    if (tabs.length === 0) {
      console.warn('[AI Arena] No Kimi tabs found');
    }
    tabs.forEach((tab) => {
      console.log('[AI Arena] Sending message to tab:', tab.id, tab.url);
      chrome.tabs.sendMessage(tab.id, {
        type: type,
        payload: payload,
      }).then(() => {
        console.log('[AI Arena] Message sent successfully to tab:', tab.id);
      }).catch((err) => {
        console.error('[AI Arena] Failed to send message to tab:', tab.id, err);
      });
    });
  });
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
  setTimeout(connectSocket, delay);
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
 * Send data to backend via Socket.IO
 */
function sendToBackend(event, data) {
  if (!socket || !socket.connected) {
    console.error('[AI Arena] Socket.IO not connected');
    return false;
  }

  socket.emit(event, data);
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

// Keep service worker alive
chrome.alarms.create('keepAlive', { periodInMinutes: 4.9 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'keepAlive') {
    console.log('[AI Arena] Keep alive');
  }
});
