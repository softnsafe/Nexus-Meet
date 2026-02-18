import React, { useState, useEffect } from 'react';
import Lobby from './components/Lobby';
import MeetingRoom from './components/MeetingRoom';
import { MeetingState } from './types';

const App: React.FC = () => {
  const [meetingState, setMeetingState] = useState<MeetingState>('lobby');
  const [meetingId, setMeetingId] = useState<string>("");
  const [userName, setUserName] = useState<string>("You");
  const [initialCode, setInitialCode] = useState<string | undefined>(undefined);

  useEffect(() => {
    // Check URL params for meeting code on initial load
    const params = new URLSearchParams(window.location.search);
    const code = params.get('meetingCode');
    if (code) {
      setMeetingId(code);
      setInitialCode(code);
    }
  }, []);

  return (
    <div className="bg-black min-h-screen text-white font-sans antialiased">
      {meetingState === 'lobby' && (
        <Lobby 
            initialCode={initialCode}
            onJoin={(code, name) => {
                setMeetingId(code);
                setUserName(name);
                setMeetingState('active');
                
                // Update URL without reloading to allow easy sharing immediately
                const newUrl = `${window.location.pathname}?meetingCode=${code}`;
                window.history.pushState({ path: newUrl }, '', newUrl);
            }} 
        />
      )}
      
      {meetingState === 'active' && (
        <MeetingRoom 
            meetingId={meetingId}
            userName={userName}
            onLeave={() => {
                setMeetingState('ended');
                // Clear URL param on leave so they don't auto-rejoin
                window.history.pushState({}, '', window.location.pathname);
            }} 
        />
      )}

      {meetingState === 'ended' && (
        <div className="flex flex-col items-center justify-center h-screen space-y-6 bg-gray-950 p-4 text-center">
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
                Meeting Ended
            </h1>
            <p className="text-gray-400 max-w-md">
                Thank you for using Nexus Meet. You can start a new session or return to the lobby.
            </p>
            <button 
                onClick={() => {
                    setInitialCode(undefined);
                    setMeetingState('lobby');
                }}
                className="px-8 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-xl transition-all font-medium border border-gray-700"
            >
                Return to Lobby
            </button>
        </div>
      )}
    </div>
  );
};

export default App;