import React from 'react';
import Layout from './components/Layout';
import StatusBar from './components/StatusBar';

/**
 * Main App component
 */
export default function App() {
  return (
    <div className="h-full flex flex-col">
      {/* Top navigation */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent">
            AI Arena
          </span>
          <span className="text-xs text-gray-500">AI 竞技场</span>
        </div>
        <div className="text-xs text-gray-500">
          让 AI 互相批判，获得多视角思考
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-hidden">
        <Layout />
      </main>

      {/* Status bar */}
      <StatusBar />
    </div>
  );
}
