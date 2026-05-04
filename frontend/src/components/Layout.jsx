/**
 * Main layout component — side-by-side iframes for ChatGPT and Kimi
 */
export default function Layout() {
  return (
    <div className="flex h-full w-full">
      {/* Left panel — ChatGPT */}
      <div className="flex-1 flex flex-col border-r border-gray-300">
        <div className="bg-white px-4 py-2 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">ChatGPT</h2>
          <span className="text-xs text-gray-500">左侧对话，右侧分析</span>
        </div>
        <div className="flex-1">
          <iframe
            src="https://chatgpt.com"
            title="ChatGPT"
            className="w-full h-full"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          />
        </div>
      </div>

      {/* Right panel — Kimi */}
      <div className="flex-1 flex flex-col">
        <div className="bg-white px-4 py-2 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Kimi — 批判性分析</h2>
          <span className="text-xs text-gray-500">基于左侧对话的审视</span>
        </div>
        <div className="flex-1">
          <iframe
            src="https://moonshot.cn"
            title="Kimi"
            className="w-full h-full"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          />
        </div>
      </div>
    </div>
  );
}
