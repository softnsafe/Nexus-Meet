import React from 'react';
import { Participant } from '../types';
import { Mic, MicOff, Video, VideoOff, Sparkles, User } from 'lucide-react';

interface ParticipantListProps {
  participants: Participant[];
  isOpen: boolean;
  onClose: () => void;
}

const ParticipantList: React.FC<ParticipantListProps> = ({ participants, isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="w-80 bg-gray-900 border-l border-gray-800 flex flex-col h-full absolute right-0 top-0 z-30 shadow-2xl">
      <div className="p-4 border-b border-gray-800 flex items-center justify-between">
        <h2 className="font-semibold text-lg flex items-center gap-2">
            Participants <span className="text-sm bg-gray-800 px-2 py-0.5 rounded-full text-gray-400">{participants.length}</span>
        </h2>
        <button onClick={onClose} className="text-gray-400 hover:text-white">
            Close
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {participants.map((p) => (
          <div key={p.id} className="flex items-center justify-between p-3 hover:bg-gray-800 rounded-lg transition-colors group">
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${p.role === 'ai' ? 'bg-gradient-to-tr from-blue-600 to-purple-600' : 'bg-gray-700'}`}>
                {p.role === 'ai' ? <Sparkles size={14} className="text-white" /> : <User size={14} className="text-gray-300" />}
              </div>
              <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">{p.name}</span>
                    {p.role === 'host' && <span className="text-[10px] bg-blue-900 text-blue-200 px-1.5 rounded">Host</span>}
                  </div>
                  <div className="text-xs text-gray-500 capitalize">{p.role === 'ai' ? 'AI Assistant' : 'Attendee'}</div>
              </div>
            </div>
            
            <div className="flex gap-2">
                {p.isMuted ? <MicOff size={14} className="text-red-400" /> : <Mic size={14} className="text-gray-500" />}
                {p.isVideoOff ? <VideoOff size={14} className="text-red-400" /> : <Video size={14} className="text-gray-500" />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ParticipantList;