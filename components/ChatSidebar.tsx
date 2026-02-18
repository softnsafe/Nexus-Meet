import React, { useEffect, useRef, useState } from 'react';
import { Message } from '../types';
import { MessageSquare, User, Bot, Send, Download, FileSpreadsheet } from 'lucide-react';

interface ChatSidebarProps {
  messages: Message[];
  isOpen: boolean;
  onSendMessage: (text: string) => void;
}

const ChatSidebar: React.FC<ChatSidebarProps> = ({ messages, isOpen, onSendMessage }) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [inputValue, setInputValue] = useState("");

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
        onSendMessage(inputValue.trim());
        setInputValue("");
    }
  };

  const handleExportCSV = () => {
    if (messages.length === 0) return;

    // Create CSV Header
    const headers = ['Timestamp,Role,Message'];
    
    // Create CSV Rows
    const rows = messages.map(msg => {
        const time = msg.timestamp.toLocaleTimeString([], { hour12: false });
        // Escape quotes in message text by doubling them, wrap in quotes to handle commas
        const safeText = `"${msg.text.replace(/"/g, '""')}"`;
        return `${time},${msg.role},${safeText}`;
    });

    // Combine and create Blob
    const csvContent = headers.concat(rows).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    
    // Trigger Download
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `meeting-transcript-${new Date().toISOString().slice(0,10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isOpen) return null;

  return (
    <div className="w-80 bg-gray-900 border-l border-gray-800 flex flex-col h-full absolute right-0 top-0 z-20 sm:relative shadow-xl sm:shadow-none transition-all duration-300">
      <div className="p-4 border-b border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
            <MessageSquare size={20} className="text-blue-400" />
            <h2 className="font-semibold text-lg">Meeting Chat</h2>
        </div>
        
        {messages.length > 0 && (
            <button 
                onClick={handleExportCSV}
                className="text-gray-400 hover:text-green-400 transition-colors p-1.5 rounded-lg hover:bg-gray-800"
                title="Export to CSV (Google Sheets)"
            >
                <FileSpreadsheet size={18} />
            </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 space-y-3 opacity-60">
            <MessageSquare size={40} />
            <p className="text-sm">Messages will appear here...</p>
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className="flex flex-col gap-1 group">
            <div className="flex items-center gap-2">
              {msg.role === 'model' ? (
                <Bot size={14} className="text-purple-400" />
              ) : (
                <User size={14} className="text-blue-400" />
              )}
              <span className={`text-xs font-semibold ${msg.role === 'model' ? 'text-purple-400' : 'text-blue-400'}`}>
                {msg.role === 'model' ? 'Nova (AI)' : 'You'}
              </span>
              <span className="text-xs text-gray-600">
                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <p className="text-sm text-gray-300 bg-gray-800 p-2.5 rounded-lg rounded-tl-none leading-relaxed break-words shadow-sm">
              {msg.text}
            </p>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSubmit} className="p-4 border-t border-gray-800 bg-gray-900">
        <div className="relative">
            <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Type a message..."
                className="w-full bg-gray-800 text-white rounded-xl pl-4 pr-10 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm placeholder-gray-500 transition-all border border-transparent focus:border-blue-500/50"
            />
            <button 
                type="submit"
                disabled={!inputValue.trim()}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-blue-400 hover:text-blue-300 disabled:opacity-30 disabled:hover:text-blue-400 transition-colors"
            >
                <Send size={16} />
            </button>
        </div>
      </form>
    </div>
  );
};

export default ChatSidebar;