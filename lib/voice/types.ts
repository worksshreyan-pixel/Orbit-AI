export type VoiceState = 'idle' | 'listening' | 'processing' | 'speaking' | 'error';

export interface VoiceSettings {
  voiceEnabled: boolean;
  spokenCompletionEnabled: boolean;
  spokenRemindersEnabled: boolean;
  spokenApprovalEnabled: boolean;
  spokenErrorsEnabled: boolean;
  volume: number;
  rate: number;
  pitch: number;
  preferredVoice: string;
}

export const defaultVoiceSettings: VoiceSettings = {
  voiceEnabled: false,
  spokenCompletionEnabled: true,
  spokenRemindersEnabled: true,
  spokenApprovalEnabled: true,
  spokenErrorsEnabled: true,
  volume: 1,
  rate: 1,
  pitch: 1,
  preferredVoice: '',
};
