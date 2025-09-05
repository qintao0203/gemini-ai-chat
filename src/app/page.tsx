'use client';

import { useState } from 'react';
import ChatClient from "@/components/ChatClient";
import PromptingGuide from "@/components/PromptingGuide";

export default function Home() {
  const [activeTab, setActiveTab] = useState('chat');

  const renderContent = () => {
    switch (activeTab) {
      case 'chat':
        return <ChatClient />;
      case 'guide':
        return <PromptingGuide />;
      default:
        return <ChatClient />;
    }
  };

  return (
    <main className="flex flex-col h-screen">
      <div className="bg-gray-100 border-b border-gray-200">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('chat')}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'chat'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}>
              聊天 (Chat)
            </button>
            <button
              onClick={() => setActiveTab('guide')}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'guide'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}>
              练功场 (Guide)
            </button>
          </div>
        </nav>
      </div>
      <div className="flex flex-col flex-1 h-full">
        {renderContent()}
      </div>
    </main>
  );
}
