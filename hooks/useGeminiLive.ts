import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { AUDIO_CONFIG, Message } from '../types';
import { createBlob, decode, decodeAudioData, blobToBase64 } from '../utils/audioUtils';

interface UseGeminiLiveProps {
  onTranscript?: (message: Message) => void;
  videoRef: React.RefObject<HTMLVideoElement>;
}

export const useGeminiLive = ({ onTranscript, videoRef }: UseGeminiLiveProps) => {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [micActive, setMicActive] = useState(true);
  const [cameraActive, setCameraActive] = useState(true);
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [userStream, setUserStream] = useState<MediaStream | null>(null);

  // Audio Contexts
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  
  // Streaming Logic
  const sessionRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const videoIntervalRef = useRef<number | null>(null);

  // Transcript Buffers
  const currentInputTransRef = useRef('');
  const currentOutputTransRef = useRef('');

  const cleanup = useCallback(() => {
    if (sessionRef.current) {
      try {
        sessionRef.current.close();
      } catch (e) {
        console.warn("Error closing session", e);
      }
      sessionRef.current = null;
    }

    if (videoIntervalRef.current) {
      window.clearInterval(videoIntervalRef.current);
      videoIntervalRef.current = null;
    }

    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setUserStream(null);

    if (inputAudioContextRef.current) {
      inputAudioContextRef.current.close();
      inputAudioContextRef.current = null;
    }
    if (outputAudioContextRef.current) {
      outputAudioContextRef.current.close();
      outputAudioContextRef.current = null;
    }

    audioSourcesRef.current.forEach(source => source.stop());
    audioSourcesRef.current.clear();
    
    setIsConnected(false);
  }, []);

  const connect = useCallback(async () => {
    try {
      setError(null);
      console.log('Initializing AudioContexts...');
      inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: AUDIO_CONFIG.inputSampleRate,
      });
      outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: AUDIO_CONFIG.outputSampleRate,
      });

      console.log('Getting User Media...');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }, 
        video: {
          width: { ideal: 640 },
          height: { ideal: 360 }
        } 
      });
      streamRef.current = stream;
      setUserStream(stream);

      // Initialize Gemini Client
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      console.log('Connecting to Gemini Live...');
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: 'You are a helpful, professional, and friendly AI meeting assistant named "Nova". You are participating in a video call. Keep your responses concise and conversational.',
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            console.log('Session Opened');
            setIsConnected(true);
            
            // Setup Audio Input
            if (inputAudioContextRef.current && streamRef.current) {
               sourceRef.current = inputAudioContextRef.current.createMediaStreamSource(streamRef.current);
               processorRef.current = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
               
               processorRef.current.onaudioprocess = (e) => {
                 const inputData = e.inputBuffer.getChannelData(0);
                 
                 // Calculate volume for visualizer
                 let sum = 0;
                 for (let i = 0; i < inputData.length; i++) {
                   sum += inputData[i] * inputData[i];
                 }
                 setVolumeLevel(Math.sqrt(sum / inputData.length));

                 const pcmBlob = createBlob(inputData);
                 sessionPromise.then(session => {
                   session.sendRealtimeInput({ media: pcmBlob });
                 });
               };

               sourceRef.current.connect(processorRef.current);
               processorRef.current.connect(inputAudioContextRef.current.destination);
            }

            // Setup Video Input (Frames)
            if (videoRef.current) {
              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d');
              const videoEl = videoRef.current;
              
              // Ensure video is playing locally (initially camera)
              videoEl.srcObject = streamRef.current;
              videoEl.play().catch(e => console.error("Video play error", e));

              videoIntervalRef.current = window.setInterval(() => {
                if (!ctx || !videoEl.videoWidth || !videoEl.videoHeight) return;
                
                canvas.width = videoEl.videoWidth * 0.5; // Scale down for performance
                canvas.height = videoEl.videoHeight * 0.5;
                ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
                
                canvas.toBlob(async (blob) => {
                  if (blob) {
                    const base64Data = await blobToBase64(blob);
                    sessionPromise.then(session => {
                      session.sendRealtimeInput({
                        media: { data: base64Data, mimeType: 'image/jpeg' }
                      });
                    });
                  }
                }, 'image/jpeg', 0.6);

              }, 1000); 
            }
          },
          onmessage: async (message: LiveServerMessage) => {
            // Handle Transcriptions
            if (message.serverContent?.inputTranscription) {
               currentInputTransRef.current += message.serverContent.inputTranscription.text;
            }
            if (message.serverContent?.outputTranscription) {
               currentOutputTransRef.current += message.serverContent.outputTranscription.text;
            }

            if (message.serverContent?.turnComplete) {
               if (currentInputTransRef.current.trim()) {
                 onTranscript?.({
                   id: Date.now().toString() + '-user',
                   role: 'user',
                   text: currentInputTransRef.current,
                   timestamp: new Date()
                 });
               }
               if (currentOutputTransRef.current.trim()) {
                 onTranscript?.({
                   id: Date.now().toString() + '-model',
                   role: 'model',
                   text: currentOutputTransRef.current,
                   timestamp: new Date()
                 });
               }
               currentInputTransRef.current = '';
               currentOutputTransRef.current = '';
            }

            // Handle Audio Output
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio && outputAudioContextRef.current) {
              const ctx = outputAudioContextRef.current;
              const audioBuffer = await decodeAudioData(
                decode(base64Audio),
                ctx,
                AUDIO_CONFIG.outputSampleRate,
                1
              );
              
              const source = ctx.createBufferSource();
              source.buffer = audioBuffer;
              const gainNode = ctx.createGain(); // For AI volume (optional future feature)
              source.connect(gainNode);
              gainNode.connect(ctx.destination);
              
              // Queueing
              const currentTime = ctx.currentTime;
              if (nextStartTimeRef.current < currentTime) {
                nextStartTimeRef.current = currentTime;
              }
              
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              
              audioSourcesRef.current.add(source);
              source.onended = () => {
                audioSourcesRef.current.delete(source);
              };
            }
          },
          onclose: () => {
            console.log("Session Closed");
            setIsConnected(false);
          },
          onerror: (e) => {
            console.error("Session Error", e);
            setError("Connection error occurred.");
            setIsConnected(false);
          }
        }
      });
      
      // Keep session reference to close later
      sessionRef.current = await sessionPromise;
      
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to connect to Gemini Live.");
      cleanup();
    }
  }, [onTranscript, videoRef, cleanup]);

  const toggleMic = useCallback(() => {
    if (streamRef.current) {
      const audioTrack = streamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setMicActive(audioTrack.enabled);
      }
    }
  }, []);

  const toggleCamera = useCallback(() => {
    if (streamRef.current) {
      const videoTrack = streamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setCameraActive(videoTrack.enabled);
      }
    }
  }, []);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    isConnected,
    error,
    connect,
    disconnect: cleanup,
    micActive,
    cameraActive,
    toggleMic,
    toggleCamera,
    volumeLevel,
    userStream // Expose stream for external use (screen share reverting)
  };
};