import { useState, useEffect } from 'react';

/**
 * Status bar showing backend connection status
 */
export default function StatusBar() {
  const [status, setStatus] = useState('checking');

  useEffect(() => {
    let isMounted = true;

    const checkBackend = async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      try {
        const response = await fetch('http://localhost:8000/health', {
          method: 'GET',
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (!isMounted) return;
        if (response.ok) {
          setStatus('connected');
        } else {
          setStatus('error');
        }
      } catch {
        clearTimeout(timeoutId);
        if (!isMounted) return;
        setStatus('disconnected');
      }
    };

    checkBackend();
    const interval = setInterval(checkBackend, 5000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const statusConfig = {
    checking: { color: 'bg-yellow-400', text: '检查中...' },
    connected: { color: 'bg-green-500', text: '后端已连接' },
    disconnected: { color: 'bg-red-500', text: '后端未连接' },
    error: { color: 'bg-orange-500', text: '后端异常' },
  };

  const config = statusConfig[status];

  return (
    <div className="bg-white border-t border-gray-200 px-4 py-2 flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full ${config.color}`} />
      <span className="text-xs text-gray-600">{config.text}</span>
      <span className="text-xs text-gray-400 ml-auto">
        AI Arena v1.0 — 在 ChatGPT 页面点击"让 Kimi 分析"按钮触发
      </span>
    </div>
  );
}
