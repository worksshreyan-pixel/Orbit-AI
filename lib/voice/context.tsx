'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { VoiceSettings, defaultVoiceSettings, VoiceState } from './types';
import { BrowserSpeechProvider, SpeechToTextProvider } from './stt';
import { BrowserTTSProvider, TextToSpeechProvider } from './tts';
import { toast } from 'sonner';

interface VoiceContextValue {
  settings: VoiceSettings;
  updateSettings: (newSettings: Partial<VoiceSettings>) => void;
  state: VoiceState;
  startListening: (onFinalTranscript: (text: string) => void, onInterimTranscript?: (text: string) => void) => void;
  stopListening: () => void;
  cancelListening: () => void;
  speak: (text: string, onEnd?: () => void) => void;
  stopSpeaking: () => void;
  voices: any[];
}

const VoiceContext = createContext<VoiceContextValue | undefined>(undefined);

export function VoiceProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<VoiceSettings>(defaultVoiceSettings);
  const [state, setState] = useState<VoiceState>('idle');
  const [voices, setVoices] = useState<any[]>([]);

  const [stt] = useState<SpeechToTextProvider>(new BrowserSpeechProvider());
  const [tts] = useState<TextToSpeechProvider>(new BrowserTTSProvider());

  useEffect(() => {
    // Load from local storage
    const stored = localStorage.getItem('orbit_voice_settings');
    if (stored) {
      try {
        setSettings({ ...defaultVoiceSettings, ...JSON.parse(stored) });
      } catch (e) {
        // ignore
      }
    }

    // Load voices
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const loadVoices = () => {
        setVoices(window.speechSynthesis.getVoices());
      };
      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  const updateSettings = useCallback((newSettings: Partial<VoiceSettings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings };
      localStorage.setItem('orbit_voice_settings', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const startListening = useCallback((onFinalTranscript: (text: string) => void, onInterimTranscript?: (text: string) => void) => {
    if (!settings.voiceEnabled) {
      toast.error('Voice input is disabled in settings');
      return;
    }

    setState('listening');
    stt.startListening(
      (transcript, isFinal) => {
        if (isFinal) {
          setState('idle');
          onFinalTranscript(transcript);
        } else {
          onInterimTranscript?.(transcript);
        }
      },
      (error) => {
        setState('error');
        toast.error(`Microphone error: ${error}`);
        setTimeout(() => setState('idle'), 2000);
      },
      () => {
        setState(prev => prev === 'listening' ? 'idle' : prev);
      }
    );
  }, [settings.voiceEnabled, stt]);

  const stopListening = useCallback(() => {
    stt.stopListening();
    setState('idle');
  }, [stt]);

  const cancelListening = useCallback(() => {
    stt.cancelListening();
    setState('idle');
  }, [stt]);

  const speak = useCallback((text: string, onEnd?: () => void) => {
    if (!text.trim()) return;
    
    // Stop any current speech
    tts.stop();
    setState('speaking');

    tts.speak(text, {
      volume: settings.volume,
      rate: settings.rate,
      pitch: settings.pitch,
      voiceURI: settings.preferredVoice,
      onEnd: () => {
        setState('idle');
        onEnd?.();
      },
      onError: (err) => {
        setState('error');
        toast.error(`TTS error: ${err}`);
        setTimeout(() => setState('idle'), 2000);
        onEnd?.();
      }
    });
  }, [settings, tts]);

  const stopSpeaking = useCallback(() => {
    tts.stop();
    setState('idle');
  }, [tts]);

  return (
    <VoiceContext.Provider value={{
      settings,
      updateSettings,
      state,
      startListening,
      stopListening,
      cancelListening,
      speak,
      stopSpeaking,
      voices
    }}>
      {children}
    </VoiceContext.Provider>
  );
}

export function useVoice() {
  const ctx = useContext(VoiceContext);
  if (!ctx) throw new Error('useVoice must be used within VoiceProvider');
  return ctx;
}
