'use client';

import { useState, useRef, KeyboardEvent } from 'react';
import { supabaseClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { ArrowUp, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface CommandInputProps {
  onRunStart?: () => void;
  className?: string;
}

export function CommandInput({ onRunStart, className }: CommandInputProps) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = async () => {
    if (!input.trim() || loading) return;
    setLoading(true);

    try {
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (!session) {
        toast.error('Please sign in first');
        return;
      }

      const { data: run, error } = await supabaseClient
        .from('agent_runs')
        .insert({
          request: input.trim(),
          status: 'understanding',
          plan: [],
          tools_used: [],
        })
        .select()
        .single();

      if (error) throw error;

      const response = await fetch('/api/agent/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId: run.id, request: input.trim() }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Agent execution failed');
      }

      toast.success('Command submitted to ORBIT');
      setInput('');
      onRunStart?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit command');
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
          disabled={loading}
          className="flex-1 resize-none bg-transparent py-2.5 text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50 max-h-32"
          style={{ minHeight: '40px' }}
        />
        <Button
          size="icon"
          onClick={handleSubmit}
          disabled={!input.trim() || loading}
          className="rounded-xl shrink-0 h-9 w-9"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ArrowUp className="h-4 w-4" />
          )}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground mt-2 px-1">
        Press Enter to send · Shift+Enter for new line
      </p>
    </div>
  );
}
