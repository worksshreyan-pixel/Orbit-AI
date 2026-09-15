'use client';

import { useEffect, useRef } from 'react';
import { supabaseClient } from '@/lib/supabase/client';
import { useVoice } from './context';
import { useAuth } from '@/lib/auth-context';

export function VoiceNotificationListener() {
  const { user } = useAuth();
  const { settings, speak } = useVoice();

  // Keep latest settings/speak in refs so the Supabase callback always
  // reads current values without forcing the effect to re-run (which
  // would call .on() on an already-subscribed channel).
  const settingsRef = useRef(settings);
  const speakRef = useRef(speak);
  useEffect(() => { settingsRef.current = settings; }, [settings]);
  useEffect(() => { speakRef.current = speak; }, [speak]);

  useEffect(() => {
    if (!user) return;

    const channelName = `voice-notifications-${user.id}`;

    // Remove any existing channel with this name first to ensure we
    // never call .on() on an already-subscribed channel (can happen
    // with React Strict Mode double-invoke in development).
    const existing = supabaseClient.getChannels().find(
      (ch) => ch.topic === `realtime:${channelName}`
    );
    if (existing) {
      supabaseClient.removeChannel(existing);
    }

    const channel = supabaseClient
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          const notification = payload.new;
          if (!notification) return;

          if (notification.speak) {
            let shouldSpeak = true;
            const currentSettings = settingsRef.current;

            // Check settings based on type
            switch (notification.type) {
              case 'agent_completed':
              case 'research_completed':
                shouldSpeak = currentSettings.spokenCompletionEnabled;
                break;
              case 'approval_required':
                shouldSpeak = currentSettings.spokenApprovalEnabled;
                break;
              case 'task_due':
                shouldSpeak = currentSettings.spokenRemindersEnabled;
                break;
              case 'system':
                if (notification.priority === 'critical' || notification.priority === 'high') {
                  shouldSpeak = currentSettings.spokenErrorsEnabled;
                }
                break;
            }

            if (shouldSpeak && notification.body) {
              speakRef.current(notification.body);
            } else if (shouldSpeak && notification.title) {
              speakRef.current(notification.title);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabaseClient.removeChannel(channel);
    };
  }, [user]);

  return null;
}
