'use client';

import { useState, useRef, KeyboardEvent } from 'react';
import { supabaseClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { ArrowUp, Loader2, Sparkles, Mic, Square, Volume2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useVoice } from '@/lib/voice/context';

  interface CommandInputProps {
  onRunStart?: (runId: string) => void;
  className?: string;
}

export function CommandInput({ onRunStart, className }: CommandInputProps) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const { state, startListening, stopListening, cancelListening, stopSpeaking, settings } = useVoice();

  const handleVoiceToggle = () => {
    if (state === 'listening') {
      stopListening();
    } else if (state === 'speaking') {
      stopSpeaking();
    } else {
      startListening(
        (finalTranscript) => {
          setInput(finalTranscript);
          // Auto submit on final transcript
          setTimeout(() => handleSubmit(finalTranscript), 100);
        },
        (interimTranscript) => {
          setInput(interimTranscript);
        }
      );
    }
  };

  const handleSubmit = async (overrideInput?: string) => {
    const textToSubmit = overrideInput ?? input;
    if (!textToSubmit.trim() || loading) return;
    setLoading(true);

    try {
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (!session) {
        toast.error('Please sign in first');
        return;
      }

      const response = await fetch('/api/agent/execute', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ request: textToSubmit.trim() }),
      });

      let data: any = {};
      try { data = await response.json(); } catch(e) {}

      if (!response.ok) {
        throw new Error(data.error || 'Agent execution failed');
      }

      setInput('');
      onRunStart?.(data.runId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : (err as any)?.message || 'Failed to submit command');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className={cn('relative', className)}>
      <div className="relative flex items-end gap-2 rounded-2xl border border-border bg-card p-2 pl-4 shadow-sm focus-within:border-primary/50 transition-colors">
        <Sparkles className="h-4 w-4 text-muted-foreground shrink-0 mb-3" />
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="What do you want ORBIT to do?"
          rows={1}
          disabled={loading || state === 'listening' || state === 'processing'}
          className={cn(
            "flex-1 resize-none bg-transparent py-2.5 text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50 max-h-32",
            state === 'listening' ? "text-primary/70 animate-pulse" : ""
          )}
          style={{ minHeight: '40px' }}
        />
        <div className="flex items-center gap-1 shrink-0">
          {settings.voiceEnabled && (
            <Button
              size="icon"
              variant="ghost"
              onClick={handleVoiceToggle}
              className={cn("rounded-xl shrink-0 h-9 w-9", state === 'listening' && "text-destructive hover:text-destructive", state === 'speaking' && "text-primary")}
            >
              {state === 'listening' ? <Square className="h-4 w-4" /> : state === 'speaking' ? <Volume2 className="h-4 w-4 animate-pulse" /> : <Mic className="h-4 w-4" />}
            </Button>
          )}
          <Button
            size="icon"
            onClick={() => handleSubmit()}
            disabled={!input.trim() || loading}
            className="rounded-xl shrink-0 h-9 w-9"
          >
            {loading || state === 'processing' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowUp className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground mt-2 px-1">
        Press Enter to send · Shift+Enter for new line
      </p>
    </div>
  );
}
