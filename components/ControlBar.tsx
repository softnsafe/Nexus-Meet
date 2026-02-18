import React from 'react';
import { Mic, MicOff, Video, VideoOff, PhoneOff, MonitorUp, MonitorOff } from 'lucide-react';

interface ControlBarProps {
  micActive: boolean;
  cameraActive: boolean;
  isScreenSharing: boolean;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onToggleScreenShare: () => void;
  onEndCall: () => void;
}

const ControlBar: React.FC<ControlBarProps> = ({
  micActive,
  cameraActive,
  isScreenSharing,
  onToggleMic,
  onToggleCamera,
  onToggleScreenShare,
  onEndCall,
}) => {
  return (
    <div className="h-20 bg-gray-900 border-t border-gray-800 flex items-center justify-center gap-6 px-4">
      <button
        onClick={onToggleMic}
        className={`p-4 rounded-full transition-colors ${
          micActive ? 'bg-gray-800 hover:bg-gray-700 text-white' : 'bg-red-500 hover:bg-red-600 text-white'
        }`}
        title={micActive ? "Mute Microphone" : "Unmute Microphone"}
      >
        {micActive ? <Mic size={24} /> : <MicOff size={24} />}
      </button>

      <button
        onClick={onToggleCamera}
        className={`p-4 rounded-full transition-colors ${
          cameraActive ? 'bg-gray-800 hover:bg-gray-700 text-white' : 'bg-red-500 hover:bg-red-600 text-white'
        }`}
        title={cameraActive ? "Turn Off Camera" : "Turn On Camera"}
      >
        {cameraActive ? <Video size={24} /> : <VideoOff size={24} />}
      </button>

      <button 
        onClick={onToggleScreenShare}
        className={`p-4 rounded-full transition-colors ${
            isScreenSharing ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-gray-800 hover:bg-gray-700 text-white'
        }`}
        title={isScreenSharing ? "Stop Sharing" : "Share Screen"}
      >
        {isScreenSharing ? <MonitorOff size={24} /> : <MonitorUp size={24} />}
      </button>

      <button
        onClick={onEndCall}
        className="p-4 rounded-full bg-red-500 hover:bg-red-600 text-white px-8 flex items-center gap-2"
        title="End Call"
      >
        <PhoneOff size={24} />
        <span className="font-semibold hidden sm:inline">End</span>
      </button>
    </div>
  );
};

export default ControlBar;