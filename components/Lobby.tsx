import React, { useState, useEffect, useRef } from 'react';
import { Video, Mic, MicOff, VideoOff, ArrowRight, Keyboard, User, Plus, Users } from 'lucide-react';

interface LobbyProps {
  onJoin: (code: string, userName: string) => void;
  initialCode?: string;
}

const Lobby: React.FC<LobbyProps> = ({ onJoin, initialCode }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [loading, setLoading] = useState(true);
  const [stream, setStream] = useState<MediaStream | null>(null);
  
  // State for Join Logic
  const [userName, setUserName] = useState("");
  const [meetingCode, setMeetingCode] = useState("");
  const [mode, setMode] = useState<'new' | 'join'>(initialCode ? 'join' : 'new');

  useEffect(() => {
    if (initialCode) {
        setMeetingCode(initialCode);
        setMode('join');
    }
    
    // Load saved name
    const savedName = localStorage.getItem('nexus_username');
    if (savedName) setUserName(savedName);
  }, [initialCode]);

  useEffect(() => {
    const startPreview = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.play();
        }
        setLoading(false);
      } catch (err) {
        console.error("Failed to access media devices", err);
        setLoading(false);
      }
    };
    startPreview();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  const toggleMic = () => {
    if (stream) {
      const track = stream.getAudioTracks()[0];
      if (track) {
        track.enabled = !micOn;
        setMicOn(!micOn);
      }
    }
  };

  const toggleCam = () => {
    if (stream) {
      const track = stream.getVideoTracks()[0];
      if (track) {
        track.enabled = !camOn;
        setCamOn(!camOn);
      }
    }
  };

  const generateCode = () => {
    return Math.random().toString(36).substring(2, 5) + "-" + Math.random().toString(36).substring(2, 5);
  };

  const handleJoin = () => {
    if (!userName.trim()) {
        alert("Please enter your name");
        return;
    }
    if (mode === 'join' && !meetingCode.trim()) {
        alert("Please enter a meeting code");
        return;
    }

    const finalCode = mode === 'new' ? generateCode() : meetingCode;
    
    // Save to LocalStorage
    localStorage.setItem('nexus_username', userName);

    if (stream) stream.getTracks().forEach(t => t.stop());
    onJoin(finalCode, userName);
  };

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-5xl flex flex-col md:flex-row gap-8 items-center">
        
        {/* Left Side: Preview */}
        <div className="w-full md:w-1/2 flex flex-col gap-4">
          <div className="relative aspect-video bg-gray-900 rounded-2xl overflow-hidden shadow-2xl border border-gray-800 ring-1 ring-white/10">
             {loading && (
                <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                    <div className="flex flex-col items-center gap-2">
                        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        <span>Accessing Camera...</span>
                    </div>
                </div>
             )}
             <video 
                ref={videoRef} 
                className={`w-full h-full object-cover transform scale-x-[-1] ${!camOn ? 'opacity-0' : 'opacity-100'} transition-opacity duration-500`} 
                muted 
                playsInline 
             />
             {!camOn && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                    <div className="w-20 h-20 rounded-full bg-gray-800 flex items-center justify-center border border-gray-700">
                        <User size={32} className="text-gray-500" />
                    </div>
                </div>
             )}
             
             {/* Preview Controls Overlay */}
             <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-3 bg-black/50 backdrop-blur-md p-2 rounded-full border border-white/10">
                <button 
                    onClick={toggleMic}
                    className={`p-3 rounded-full transition-all ${micOn ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-red-500 hover:bg-red-600 text-white'}`}
                >
                    {micOn ? <Mic size={20} /> : <MicOff size={20} />}
                </button>
                <button 
                    onClick={toggleCam}
                    className={`p-3 rounded-full transition-all ${camOn ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-red-500 hover:bg-red-600 text-white'}`}
                >
                    {camOn ? <Video size={20} /> : <VideoOff size={20} />}
                </button>
             </div>
          </div>
          
          <div className="flex justify-center text-gray-500 text-sm gap-6">
             <span className={`flex items-center gap-1.5 transition-colors ${micOn ? "text-green-400" : "text-gray-500"}`}>
                <div className={`w-2 h-2 rounded-full ${micOn ? "bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.5)]" : "bg-gray-600"}`} />
                {micOn ? "Microphone Active" : "Microphone Off"}
             </span>
             <span className={`flex items-center gap-1.5 transition-colors ${camOn ? "text-green-400" : "text-gray-500"}`}>
                <div className={`w-2 h-2 rounded-full ${camOn ? "bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.5)]" : "bg-gray-600"}`} />
                {camOn ? "Camera Active" : "Camera Off"}
             </span>
          </div>
        </div>

        {/* Right Side: Info & Join */}
        <div className="w-full md:w-1/2 space-y-8">
            <div className="space-y-2">
                <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white">
                    Nexus Meet
                </h1>
                <p className="text-gray-400 text-lg">
                    Real-time AI collaboration workspace.
                </p>
            </div>

            <div className="space-y-6">
                {/* Name Input */}
                <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-400 ml-1">Your Display Name</label>
                    <div className="relative group">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-blue-400 transition-colors" size={18} />
                        <input 
                            type="text" 
                            placeholder="Enter your name"
                            value={userName}
                            onChange={(e) => setUserName(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-800 rounded-xl py-3.5 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all text-white placeholder-gray-600"
                        />
                    </div>
                </div>

                {/* Tabs */}
                {!initialCode && (
                    <div className="flex p-1 bg-gray-900 rounded-lg border border-gray-800">
                        <button 
                            onClick={() => setMode('new')}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-all ${mode === 'new' ? 'bg-gray-800 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}
                        >
                            <Plus size={16} /> New Meeting
                        </button>
                        <button 
                            onClick={() => setMode('join')}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-all ${mode === 'join' ? 'bg-gray-800 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}
                        >
                            <Users size={16} /> Join with Code
                        </button>
                    </div>
                )}

                {/* Join Input (Conditional) */}
                {mode === 'join' && (
                    <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                        <label className="text-sm font-medium text-gray-400 ml-1">Meeting Code</label>
                        <div className="relative group">
                            <Keyboard className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-purple-400 transition-colors" size={18} />
                            <input 
                                type="text" 
                                placeholder="abc-def-ghi"
                                value={meetingCode}
                                onChange={(e) => setMeetingCode(e.target.value)}
                                disabled={!!initialCode}
                                className={`w-full bg-gray-900 border border-gray-800 rounded-xl py-3.5 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all text-white placeholder-gray-600 ${initialCode ? 'opacity-75 cursor-not-allowed' : ''}`}
                            />
                            {initialCode && (
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs bg-purple-500/20 text-purple-300 px-2 py-1 rounded">
                                    Invite Link
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <div className="pt-2">
                    <button 
                        onClick={handleJoin}
                        disabled={!userName.trim() || (mode === 'join' && !meetingCode.trim())}
                        className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5
                            ${mode === 'new' 
                                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-blue-900/20 text-white' 
                                : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 shadow-purple-900/20 text-white'
                            }
                            disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none
                        `}
                    >
                        {mode === 'new' ? 'Start Instant Meeting' : 'Join Meeting Now'} 
                        <ArrowRight size={20} />
                    </button>
                </div>

                {initialCode && (
                     <p className="text-center text-sm text-gray-500">
                        You are joining a room invited via link.
                     </p>
                )}
            </div>
        </div>

      </div>
    </div>
  );
};

export default Lobby;