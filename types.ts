export interface Message {
  id: string;
  role: 'user' | 'model' | 'system';
  text: string;
  timestamp: Date;
}

export type MeetingState = 'lobby' | 'connecting' | 'active' | 'ended';

export interface Participant {
  id: string;
  name: string;
  role: 'host' | 'guest' | 'ai';
  isMuted: boolean;
  isVideoOff: boolean;
  avatarColor?: string; // For placeholder UI
}

export interface AudioConfig {
  inputSampleRate: number;
  outputSampleRate: number;
}

export const AUDIO_CONFIG: AudioConfig = {
  inputSampleRate: 16000,
  outputSampleRate: 24000,
};