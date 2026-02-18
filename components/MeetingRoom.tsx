import React, { useRef, useEffect, useState, useMemo } from 'react';
import { useGeminiLive } from '../hooks/useGeminiLive';
import ControlBar from './ControlBar';
import ChatSidebar from './ChatSidebar';
import ParticipantList from './ParticipantList';
import { Message, Participant } from '../types';
import { Sparkles, LayoutGrid, UserPlus, X, Copy, Check, Users, MonitorUp, User, MicOff, Info, Zap } from 'lucide-react';
import Visualizer from './Visualizer';
import { GoogleGenAI, Chat } from '@google/genai';

interface MeetingRoomProps {
  onLeave: () => void;
  meetingId: string;
  userName: string;
}

// Define broadcast message types
type BroadcastEvent = 
  | { type: 'JOIN'; participant: Participant }
  | { type: 'LEAVE'; id: string }
  | { type: 'REQUEST_STATE' }
  | { type: 'I_AM_HERE'; participant: Participant }
  | { type: 'SIM_USER_ADDED'; participant: Participant };

const MeetingRoom: React.FC<MeetingRoomProps> = ({ onLeave, meetingId, userName }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  
  // Generate a unique ID for this specific session/tab
  const myId = useMemo(() => `user-${Math.random().toString(36).substr(2, 9)}`, []);
  
  // UI State
  const [activeSidebar, setActiveSidebar] = useState<'chat' | 'participants' | null>('chat');
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Screen Share State
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);

  // Chat State
  const [chatClient, setChatClient] = useState<Chat | null>(null);

  // Participant Management
  const [participants, setParticipants] = useState<Participant[]>([
      { id: myId, name: userName, role: 'host', isMuted: false, isVideoOff: false },
      { id: 'nova-ai', name: 'Nova', role: 'ai', isMuted: false, isVideoOff: false },
  ]);

  // Broadcast Channel for Local Sync
  useEffect(() => {
    const channel = new BroadcastChannel(`nexus_meet_${meetingId}`);
    
    // Listen for messages from other tabs
    channel.onmessage = (event) => {
        const msg = event.data as BroadcastEvent;
        
        if (msg.type === 'JOIN' || msg.type === 'I_AM_HERE') {
            setParticipants(prev => {
                if (prev.find(p => p.id === msg.participant.id)) return prev;
                return [...prev, msg.participant];
            });
            
            // If someone joined, tell them I am here too
            if (msg.type === 'JOIN') {
                 channel.postMessage({ 
                    type: 'I_AM_HERE', 
                    participant: { 
                        id: myId, 
                        name: `${userName} (Tab)`, 
                        role: 'guest', 
                        isMuted: true, 
                        isVideoOff: true 
                    } 
                });
            }
        } else if (msg.type === 'LEAVE') {
            setParticipants(prev => prev.filter(p => p.id !== msg.id));
        } else if (msg.type === 'REQUEST_STATE') {
             // Announce presence to new tab
             const me = participants.find(p => p.id === myId);
             if (me) {
                 channel.postMessage({ 
                    type: 'I_AM_HERE', 
                    participant: { ...me, name: `${userName} (Tab)`, role: 'guest', isVideoOff: true } 
                });
             }
        } else if (msg.type === 'SIM_USER_ADDED') {
            setParticipants(prev => {
                if (prev.find(p => p.id === msg.participant.id)) return prev;
                return [...prev, msg.participant];
            });
        }
    };

    // Announce Join
    channel.postMessage({ 
        type: 'JOIN', 
        participant: { 
            id: myId, 
            name: `${userName} (Tab)`, 
            role: 'guest', 
            isMuted: false, 
            isVideoOff: false 
        } 
    });

    // Ask who else is here
    channel.postMessage({ type: 'REQUEST_STATE' });

    return () => {
        channel.postMessage({ type: 'LEAVE', id: myId });
        channel.close();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetingId, myId, userName]);

  // Initialize Chat Client (Text)
  useEffect(() => {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const chat = ai.chats.create({ 
          model: 'gemini-2.5-flash',
          config: {
              systemInstruction: `You are Nova, an AI assistant in a video meeting with ${userName}. Respond to user chat messages concisely.`
          }
      });
      setChatClient(chat);
  }, [userName]);

  const handleTranscript = (msg: Message) => {
    setMessages(prev => [...prev, msg]);
  };

  const {
    isConnected,
    error,
    connect,
    disconnect,
    micActive,
    cameraActive,
    toggleMic,
    toggleCamera,
    volumeLevel,
    userStream
  } = useGeminiLive({ onTranscript: handleTranscript, videoRef });

  // Sync local controls with participant state
  useEffect(() => {
      setParticipants(prev => prev.map(p => 
          p.id === myId 
              ? { ...p, isMuted: !micActive, isVideoOff: !cameraActive }
              : p
      ));
  }, [micActive, cameraActive, myId]);

  // Auto connect on mount
  useEffect(() => {
    connect();
    return () => {
        // Disconnect handled by hook cleanup
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleEndCall = () => {
    if (screenStream) {
        screenStream.getTracks().forEach(t => t.stop());
    }
    disconnect();
    onLeave();
  };

  const handleSendMessage = async (text: string) => {
    if (!chatClient) return;

    // Add user message
    const userMsg: Message = {
        id: Date.now().toString() + '-user-chat',
        role: 'user',
        text: text,
        timestamp: new Date()
    };
    setMessages(prev => [...prev, userMsg]);

    try {
        const response = await chatClient.sendMessage({ message: text });
        const modelMsg: Message = {
            id: Date.now().toString() + '-model-chat',
            role: 'model',
            text: response.text || "",
            timestamp: new Date()
        };
        setMessages(prev => [...prev, modelMsg]);
    } catch (e) {
        console.error("Chat Error", e);
    }
  };

  const toggleScreenShare = async () => {
    if (isScreenSharing) {
        // Stop Sharing
        if (screenStream) {
            screenStream.getTracks().forEach(track => track.stop());
            setScreenStream(null);
        }
        setIsScreenSharing(false);
        // Revert to camera
        if (videoRef.current && userStream) {
            videoRef.current.srcObject = userStream;
        }
    } else {
        // Start Sharing
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
            setScreenStream(stream);
            setIsScreenSharing(true);
            
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }

            // Handle system "Stop sharing" bar
            stream.getVideoTracks()[0].onended = () => {
                setIsScreenSharing(false);
                setScreenStream(null);
                if (videoRef.current && userStream) {
                    videoRef.current.srcObject = userStream;
                }
            };
        } catch (err) {
            console.error("Error sharing screen:", err);
            // If user cancels, we just don't start sharing
        }
    }
  };

  const copyToClipboard = async () => {
      const link = `${window.location.origin}?meetingCode=${meetingId}`;
      try {
        await navigator.clipboard.writeText(link);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error("Failed to copy link", err);
        prompt("Copy this link:", link);
      }
  };

  // Demo: Simulate adding a user
  const simulateAddUser = () => {
      const names = ["Sarah Chen", "Marcus Johnson", "Elena Rodriguez", "David Kim", "Priya Patel"];
      const randomName = names[Math.floor(Math.random() * names.length)];
      const newId = `user-${Date.now()}`;
      const colors = ["bg-emerald-700", "bg-rose-700", "bg-amber-700", "bg-cyan-700", "bg-indigo-700"];
      const randomColor = colors[Math.floor(Math.random() * colors.length)];
      
      const newParticipant: Participant = {
          id: newId,
          name: randomName,
          role: 'guest',
          isMuted: Math.random() > 0.5,
          isVideoOff: Math.random() > 0.7, 
          avatarColor: randomColor
      };

      setParticipants(prev => [...prev, newParticipant]);

      // Broadcast simulation to other tabs
      const channel = new BroadcastChannel(`nexus_meet_${meetingId}`);
      channel.postMessage({ type: 'SIM_USER_ADDED', participant: newParticipant });
      channel.close();
  };

  // Grid Logic - Exclude AI from the grid count and rendering
  const gridParticipants = participants.filter(p => p.role !== 'ai');
  
  const getGridClass = (count: number) => {
      if (count === 1) return 'grid-cols-1';
      if (count === 2) return 'grid-cols-1 md:grid-cols-2';
      if (count <= 4) return 'grid-cols-2';
      if (count <= 9) return 'grid-cols-2 md:grid-cols-3';
      return 'grid-cols-3 md:grid-cols-4';
  };

  return (
    <div className="flex h-screen bg-black text-white overflow-hidden relative">
      {/* Main Content */}
      <div className="flex-1 flex flex-col relative transition-all duration-300">
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 p-4 z-20 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
          <div className="flex items-center gap-2 pointer-events-auto">
             <div className="flex items-center gap-2 bg-gray-800/80 backdrop-blur-md px-3 py-1.5 rounded-lg">
                <Sparkles size={16} className="text-purple-400" />
                <span className="font-medium text-sm">Nexus Meet</span>
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'}`} />
             </div>
             
             <div className="bg-gray-800/50 backdrop-blur-md px-3 py-1.5 rounded-lg flex items-center gap-2 border border-gray-700/50">
                <span className="text-xs text-gray-400">CODE:</span>
                <span className="text-xs font-mono font-bold tracking-wider">{meetingId}</span>
             </div>
          </div>

          <div className="pointer-events-auto flex items-center gap-2">
            {/* Demo Button */}
            <button 
                onClick={simulateAddUser}
                className="bg-gray-800/80 hover:bg-gray-700 text-xs px-2 py-1.5 rounded text-gray-300 border border-gray-700 mr-2"
                title="Add fake user to test grid"
            >
                + Sim User
            </button>

             <button 
                onClick={() => setInviteModalOpen(true)}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors shadow-lg shadow-blue-900/20"
             >
                <UserPlus size={18} />
                <span className="hidden sm:inline">Invite</span>
             </button>
             
             <div className="bg-gray-800/80 backdrop-blur-md rounded-full p-1 flex gap-1 border border-gray-700">
                <button 
                    onClick={() => setActiveSidebar(activeSidebar === 'participants' ? null : 'participants')}
                    className={`p-2 rounded-full transition-colors relative ${activeSidebar === 'participants' ? 'bg-gray-700 text-white' : 'hover:bg-gray-700/50 text-gray-400'}`}
                    title="Participants"
                >
                    <Users size={20} />
                    <span className="absolute top-0 right-0 -mt-1 -mr-1 bg-red-500 text-[10px] w-4 h-4 flex items-center justify-center rounded-full text-white">
                        {participants.length}
                    </span>
                </button>
                <button 
                    onClick={() => setActiveSidebar(activeSidebar === 'chat' ? null : 'chat')}
                    className={`p-2 rounded-full transition-colors ${activeSidebar === 'chat' ? 'bg-gray-700 text-white' : 'hover:bg-gray-700/50 text-gray-400'}`}
                    title="Chat"
                >
                    <LayoutGrid size={20} />
                </button>
             </div>
          </div>
        </div>

        {/* Video Grid - Render only Human Participants */}
        <div className="flex-1 p-4 pt-20 pb-24 overflow-y-auto relative">
            <div className={`grid gap-4 h-full content-center ${getGridClass(gridParticipants.length)} auto-rows-fr`}>
                
                {gridParticipants.map((participant) => (
                    <div 
                        key={participant.id} 
                        className={`relative rounded-xl overflow-hidden bg-gray-900 border border-gray-800 shadow-xl flex flex-col items-center justify-center min-h-[200px] transition-all duration-300`}
                    >
                        {/* 1. LOCAL USER (ME) */}
                        {participant.id === myId && (
                            <>
                                <video 
                                    ref={videoRef} 
                                    className={`w-full h-full object-cover ${!cameraActive && !isScreenSharing ? 'hidden' : ''} ${!isScreenSharing ? 'transform scale-x-[-1]' : ''}`}
                                    muted 
                                    playsInline 
                                />
                                {(!cameraActive && !isScreenSharing) && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                                        <div className="w-24 h-24 rounded-full bg-gray-700 flex items-center justify-center">
                                            <span className="text-2xl font-bold text-gray-400">YOU</span>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}

                        {/* 3. GUESTS (Remote Tabs or Fake) */}
                        {participant.role === 'guest' && (
                            <div className={`w-full h-full flex items-center justify-center ${participant.avatarColor || 'bg-gray-800'}`}>
                                {participant.isVideoOff ? (
                                    <div className="w-20 h-20 rounded-full bg-black/20 flex items-center justify-center text-xl font-bold">
                                        {participant.name.charAt(0)}
                                    </div>
                                ) : (
                                    <div className="relative w-full h-full">
                                        <div className="absolute inset-0 flex items-center justify-center text-gray-500 bg-gray-900">
                                            {participant.name.includes("Tab") ? (
                                                <div className="text-center">
                                                    <MonitorUp className="mx-auto mb-2 opacity-50" size={32} />
                                                    <span className="text-xs uppercase tracking-widest opacity-50">Local Stream</span>
                                                </div>
                                            ) : (
                                                <img 
                                                    src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${participant.id}`} 
                                                    alt={participant.name} 
                                                    className="w-full h-full object-cover opacity-80"
                                                />
                                            )}
                                        </div>
                                        <div className="absolute inset-0 bg-black/10"></div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Nametag & Status Icons */}
                        <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md px-2 py-1 rounded flex items-center gap-2 max-w-[80%] z-20">
                            <span className="text-xs font-semibold truncate text-white shadow-sm">
                                {participant.name} {participant.id === myId && '(You)'}
                            </span>
                            
                            {/* Icons */}
                            {participant.isMuted && <MicOff size={12} className="text-red-500" />}
                            {participant.id === myId && micActive && <Visualizer volume={volumeLevel} isActive={true} />}
                            {participant.id === myId && isScreenSharing && <MonitorUp size={12} className="text-green-400" />}
                        </div>
                        
                        {/* Mute Overlay */}
                        {participant.isMuted && participant.role !== 'ai' && (
                            <div className="absolute top-3 right-3 bg-red-500/80 p-1.5 rounded-full">
                                <MicOff size={12} className="text-white" />
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Nova AI Floating Assistant (Replaces Grid Tile) */}
            <div className="absolute bottom-6 right-6 z-40 group pointer-events-auto">
                 <div className="relative flex items-center justify-end">
                     
                     {/* Popover Content (Revealed on Hover) */}
                     <div className="absolute bottom-16 right-0 w-64 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-4 group-hover:translate-y-0 pointer-events-none group-hover:pointer-events-auto origin-bottom-right">
                         <div className="bg-gray-900/95 backdrop-blur-xl border border-gray-700 rounded-2xl p-4 shadow-2xl flex flex-col gap-3">
                             <div className="flex items-start justify-between">
                                 <div className="flex items-center gap-3">
                                     <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
                                         <Sparkles size={18} className="text-white" />
                                     </div>
                                     <div>
                                         <h3 className="font-bold text-white text-sm">Nova</h3>
                                         <p className="text-[10px] text-purple-300 font-medium tracking-wide">AI ASSISTANT</p>
                                     </div>
                                 </div>
                                 <div className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${isConnected ? 'bg-green-500/20 text-green-400' : 'bg-gray-700 text-gray-400'}`}>
                                     {isConnected ? 'Active' : 'Offline'}
                                 </div>
                             </div>
                             
                             <div className="bg-black/40 rounded-lg p-3 border border-white/5">
                                 <div className="text-[10px] text-gray-500 mb-2 uppercase tracking-wider flex justify-between">
                                    <span>Voice Activity</span>
                                    <span>{Math.round(volumeLevel * 100)}%</span>
                                 </div>
                                 <div className="h-8 flex items-center justify-center">
                                     {isConnected ? (
                                         <Visualizer volume={volumeLevel} isActive={true} />
                                     ) : (
                                         <div className="flex gap-1 h-1 w-full justify-center">
                                             <div className="w-8 h-full bg-gray-700 rounded-full"></div>
                                         </div>
                                     )}
                                 </div>
                             </div>
                             
                             <div className="text-[10px] text-gray-400 leading-relaxed italic border-t border-gray-800 pt-2">
                                "I'm listening and ready to help. Just speak to me."
                             </div>
                         </div>
                     </div>

                     {/* The Trigger Icon */}
                     <div className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg shadow-black/50 transition-all duration-300 border border-gray-700/50 backdrop-blur-md
                        ${isConnected 
                            ? 'bg-gray-800/80 hover:bg-gray-700 text-purple-400 border-purple-500/30' 
                            : 'bg-gray-900/50 text-gray-600 grayscale'}
                        opacity-60 hover:opacity-100 hover:scale-110 hover:shadow-purple-900/30 cursor-pointer
                     `}>
                        <Sparkles size={24} className={isConnected ? "animate-pulse" : ""} />
                        
                        {/* Status Dot */}
                        <div className={`absolute top-0 right-0 w-3 h-3 rounded-full border-2 border-gray-900 ${isConnected ? 'bg-green-500' : 'bg-gray-600'}`}></div>
                     </div>

                 </div>
            </div>
        </div>

        {error && (
            <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-red-500/90 text-white px-4 py-2 rounded-lg shadow-lg text-sm z-50">
                {error}
            </div>
        )}

        <ControlBar 
            micActive={micActive}
            cameraActive={cameraActive}
            isScreenSharing={isScreenSharing}
            onToggleMic={toggleMic}
            onToggleCamera={toggleCamera}
            onToggleScreenShare={toggleScreenShare}
            onEndCall={handleEndCall}
        />
      </div>

      {/* Sidebars */}
      <div className="relative z-30">
          <ChatSidebar 
            messages={messages} 
            isOpen={activeSidebar === 'chat'} 
            onSendMessage={handleSendMessage}
          />
          <ParticipantList 
            participants={participants}
            isOpen={activeSidebar === 'participants'}
            onClose={() => setActiveSidebar(null)}
          />
      </div>

      {/* Invite Modal */}
      {inviteModalOpen && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="text-xl font-bold">Add others</h3>
                      <button onClick={() => setInviteModalOpen(false)} className="text-gray-400 hover:text-white">
                          <X size={24} />
                      </button>
                  </div>
                  
                  <div className="space-y-6">
                      <div className="bg-blue-900/20 border border-blue-900/50 p-4 rounded-xl flex items-start gap-3">
                          <Info className="text-blue-400 shrink-0 mt-0.5" size={18} />
                          <div className="text-sm text-blue-200">
                             <p className="font-semibold mb-1">How Sharing Works</p>
                             <ul className="list-disc pl-4 space-y-1 opacity-80 text-xs">
                                <li><strong>Local Testing:</strong> Open this link in a new tab to see yourself as a guest.</li>
                                <li><strong>Remote Users:</strong> To invite friends on other devices, you must <u>deploy this app</u> to a public server (e.g. Vercel).</li>
                             </ul>
                          </div>
                      </div>

                      <div>
                          <label className="block text-sm text-gray-400 mb-2">Meeting Link</label>
                          <div className="flex gap-2">
                              <div className="flex-1 bg-gray-800 rounded-lg px-3 py-2 text-sm text-gray-300 truncate font-mono">
                                  {`${window.location.origin}?meetingCode=${meetingId}`}
                              </div>
                              <button 
                                onClick={copyToClipboard}
                                className="bg-gray-800 hover:bg-gray-700 p-2 rounded-lg text-blue-400 transition-colors"
                              >
                                  {copied ? <Check size={20} /> : <Copy size={20} />}
                              </button>
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default MeetingRoom;