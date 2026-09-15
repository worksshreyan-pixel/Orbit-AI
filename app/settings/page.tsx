'use client';

import { useState, useEffect } from 'react';
import { AppShell } from '@/components/orbit/app-shell';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme-provider';
import { supabaseClient } from '@/lib/supabase/client';
import { useVoice } from '@/lib/voice/context';
import type { Integration } from '@/lib/types/database';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  User, Palette, Bot, Bell, Shield, Database, LogOut,
  Check, X, Github, FileText, MessageSquare, Brain, Cpu, Calendar, Monitor, Mic
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { DevicesTab } from '@/components/settings/devices-tab';

const integrationDefs = [
  { provider: 'notion', name: 'Notion', icon: FileText, description: 'Sync tasks and notes with your Notion workspace' },
  { provider: 'github', name: 'GitHub', icon: Github, description: 'Manage issues and inspect repositories' },
  { provider: 'linear', name: 'Linear', icon: MessageSquare, description: 'Create and track issues in Linear' },
  { provider: 'slack', name: 'Slack', icon: MessageSquare, description: 'Send notifications to Slack channels' },
  { provider: 'google', name: 'Google', icon: Calendar, description: 'Calendar and email integration' },
] as const;

export default function SettingsPage() {
  return (
    <AppShell>
      <SettingsContent />
    </AppShell>
  );
}

function SettingsContent() {
  const { user, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [aiProvider, setAiProvider] = useState('gemini');
  const [notifications, setNotifications] = useState({ agent: true, approvals: true, tasks: true, research: true });
  const { settings: voiceSettings, updateSettings: updateVoiceSettings, voices } = useVoice();

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (!session) return;
      const { data } = await supabaseClient.from('integrations').select('*');
      setIntegrations(data as Integration[] || []);
    })();
  }, []);

  const handleSignOut = async () => {
    await signOut();
    window.location.href = '/login';
  };

  const integrationStatus = (provider: string) => {
    const integ = integrations.find((i) => i.provider === provider);
    return integ?.status === 'connected';
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 md:px-8 md:py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Configure your ORBIT workspace</p>
      </div>

      <Tabs defaultValue="account">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="account" className="gap-1.5"><User className="h-3.5 w-3.5" />Account</TabsTrigger>
          <TabsTrigger value="appearance" className="gap-1.5"><Palette className="h-3.5 w-3.5" />Appearance</TabsTrigger>
          <TabsTrigger value="ai" className="gap-1.5"><Bot className="h-3.5 w-3.5" />AI Provider</TabsTrigger>
          <TabsTrigger value="voice" className="gap-1.5"><Mic className="h-3.5 w-3.5" />Voice</TabsTrigger>
          <TabsTrigger value="devices" className="gap-1.5"><Monitor className="h-3.5 w-3.5" />Devices</TabsTrigger>
          <TabsTrigger value="notifications" className="gap-1.5"><Bell className="h-3.5 w-3.5" />Notifications</TabsTrigger>
          <TabsTrigger value="integrations" className="gap-1.5"><Cpu className="h-3.5 w-3.5" />Integrations</TabsTrigger>
          <TabsTrigger value="security" className="gap-1.5"><Shield className="h-3.5 w-3.5" />Security</TabsTrigger>
        </TabsList>

        {/* Account */}
        <TabsContent value="account" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Profile</CardTitle>
              <CardDescription>Your account information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={user?.email || ''} disabled />
              </div>
              <div className="space-y-2">
                <Label>User ID</Label>
                <Input value={user?.id || ''} disabled className="font-mono text-xs" />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Sign out</p>
                  <p className="text-xs text-muted-foreground">End your current session</p>
                </div>
                <Button variant="outline" onClick={handleSignOut}>
                  <LogOut className="h-4 w-4 mr-2" />Sign out
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Data & Memory</CardTitle>
              <CardDescription>Manage your data</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Export data</p>
                  <p className="text-xs text-muted-foreground">Download all your ORBIT data</p>
                </div>
                <Button variant="outline" size="sm" disabled>
                  <Database className="h-4 w-4 mr-2" />Export
                </Button>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-destructive">Delete all data</p>
                  <p className="text-xs text-muted-foreground">Permanently remove everything. This cannot be undone.</p>
                </div>
                <Button variant="destructive" size="sm" disabled>
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Appearance */}
        <TabsContent value="appearance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Theme</CardTitle>
              <CardDescription>Choose how ORBIT looks</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {(['dark', 'light', 'system'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  className={cn(
                    'w-full flex items-center justify-between p-3 rounded-lg border transition-colors',
                    theme === t ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'w-10 h-10 rounded-lg',
                      t === 'dark' ? 'bg-gray-900' : t === 'light' ? 'bg-gray-100' : 'bg-gradient-to-br from-gray-900 to-gray-100'
                    )} />
                    <div className="text-left">
                      <p className="text-sm font-medium capitalize">{t}</p>
                      <p className="text-xs text-muted-foreground">
                        {t === 'dark' ? 'Dark mode' : t === 'light' ? 'Light mode' : 'Follow system'}
                      </p>
                    </div>
                  </div>
                  {theme === t && <Check className="h-4 w-4 text-primary" />}
                </button>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* AI Provider */}
        <TabsContent value="ai" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">AI Provider</CardTitle>
              <CardDescription>Configure which AI model powers ORBIT</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Provider</Label>
                <Select value={aiProvider} onValueChange={setAiProvider}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gemini">Google Gemini</SelectItem>
                    <SelectItem value="openai">OpenAI</SelectItem>
                    <SelectItem value="anthropic">Anthropic</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  API keys are stored as server-side environment variables and never exposed to the browser.
                </p>
              </div>
              <Separator />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Voice */}
        <TabsContent value="voice" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Voice Assistant</CardTitle>
              <CardDescription>Configure speech recognition and text-to-speech preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Voice Input</p>
                  <p className="text-xs text-muted-foreground">Enable microphone for spoken commands</p>
                </div>
                <Switch 
                  checked={voiceSettings.voiceEnabled} 
                  onCheckedChange={(v) => updateVoiceSettings({ voiceEnabled: v })} 
                />
              </div>
              <Separator />
              <div className="space-y-4 pt-2">
                <p className="text-sm font-medium">Spoken Notifications</p>
                
                <div className="flex items-center justify-between pl-4">
                  <p className="text-sm">Task Completions</p>
                  <Switch checked={voiceSettings.spokenCompletionEnabled} onCheckedChange={(v) => updateVoiceSettings({ spokenCompletionEnabled: v })} />
                </div>
                <div className="flex items-center justify-between pl-4">
                  <p className="text-sm">Approvals Required</p>
                  <Switch checked={voiceSettings.spokenApprovalEnabled} onCheckedChange={(v) => updateVoiceSettings({ spokenApprovalEnabled: v })} />
                </div>
                <div className="flex items-center justify-between pl-4">
                  <p className="text-sm">Reminders & Tasks Due</p>
                  <Switch checked={voiceSettings.spokenRemindersEnabled} onCheckedChange={(v) => updateVoiceSettings({ spokenRemindersEnabled: v })} />
                </div>
                <div className="flex items-center justify-between pl-4">
                  <p className="text-sm">Errors & Warnings</p>
                  <Switch checked={voiceSettings.spokenErrorsEnabled} onCheckedChange={(v) => updateVoiceSettings({ spokenErrorsEnabled: v })} />
                </div>
              </div>

              <Separator />
              <div className="space-y-4 pt-2">
                <p className="text-sm font-medium">Voice Settings</p>
                
                <div className="space-y-2">
                  <Label>Preferred Voice</Label>
                  <Select 
                    value={voiceSettings.preferredVoice || "default"} 
                    onValueChange={(v) => updateVoiceSettings({ preferredVoice: v === "default" ? "" : v })}
                  >
                    <SelectTrigger><SelectValue placeholder="Default System Voice" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">Default System Voice</SelectItem>
                      {voices.map(v => (
                        <SelectItem key={v.voiceURI} value={v.voiceURI}>{v.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2 pt-2">
                  <Label>Volume ({Math.round(voiceSettings.volume * 100)}%)</Label>
                  <input 
                    type="range" min="0" max="1" step="0.1" 
                    value={voiceSettings.volume} 
                    onChange={e => updateVoiceSettings({ volume: parseFloat(e.target.value) })}
                    className="w-full"
                  />
                </div>

                <div className="space-y-2 pt-2">
                  <Label>Speech Rate ({voiceSettings.rate}x)</Label>
                  <input 
                    type="range" min="0.5" max="2" step="0.1" 
                    value={voiceSettings.rate} 
                    onChange={e => updateVoiceSettings({ rate: parseFloat(e.target.value) })}
                    className="w-full"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Devices */}
        <TabsContent value="devices">
          <DevicesTab />
        </TabsContent>

        {/* Notifications */}
        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Notification Preferences</CardTitle>
              <CardDescription>Choose what ORBIT notifies you about</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
              {[
                { key: 'agent', label: 'Agent completed', desc: 'When an agent run finishes' },
                { key: 'approvals', label: 'Approval required', desc: 'When ORBIT needs your permission' },
                { key: 'tasks', label: 'Task due', desc: 'Reminders for upcoming deadlines' },
                { key: 'research', label: 'Research completed', desc: 'When research finishes processing' },
              ].map((item) => (
                <div key={item.key} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                  <Switch
                    checked={notifications[item.key as keyof typeof notifications]}
                    onCheckedChange={(v) => setNotifications({ ...notifications, [item.key]: v })}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
          <Card className="border-dashed">
            <CardContent className="py-3">
              <p className="text-xs text-muted-foreground flex items-center gap-2">
                <Bell className="h-3.5 w-3.5" />
                Web Push notifications require a push service subscription. The architecture is ready — configure a VAPID key pair to enable device delivery.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Integrations */}
        <TabsContent value="integrations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Connected Services</CardTitle>
              <CardDescription>Manage external integrations</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {integrationDefs.map((integ) => {
                const Icon = integ.icon;
                const connected = integrationStatus(integ.provider);
                return (
                  <div key={integ.provider} className="flex items-center justify-between p-3 rounded-lg border border-border">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{integ.name}</p>
                        <p className="text-xs text-muted-foreground">{integ.description}</p>
                      </div>
                    </div>
                    {connected ? (
                      <span className="flex items-center gap-1.5 text-xs text-success">
                        <Check className="h-3.5 w-3.5" />Connected
                      </span>
                    ) : (
                      <Button variant="outline" size="sm" disabled>
                        Connect
                      </Button>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
          <Card className="border-dashed">
            <CardContent className="py-3">
              <p className="text-xs text-muted-foreground">
                Integrations are architecturally scaffolded. OAuth flows and API clients will be connected here once credentials are configured. No integrations are simulated.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security */}
        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Security</CardTitle>
              <CardDescription>Access control and permissions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-success/10 flex items-center justify-center"><Check className="h-3 w-3 text-success" /></span>
                  <p className="text-sm font-medium">Row Level Security enabled</p>
                </div>
                <p className="text-xs text-muted-foreground ml-8">All database tables enforce RLS policies. You can only access your own data.</p>
              </div>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-success/10 flex items-center justify-center"><Check className="h-3 w-3 text-success" /></span>
                  <p className="text-sm font-medium">Server-side API key storage</p>
                </div>
                <p className="text-xs text-muted-foreground ml-8">AI provider and integration keys are never exposed to the browser.</p>
              </div>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-success/10 flex items-center justify-center"><Check className="h-3 w-3 text-success" /></span>
                  <p className="text-sm font-medium">Three-tier permission system</p>
                </div>
                <p className="text-xs text-muted-foreground ml-8">Safe, Approval, and Explicit Confirmation levels protect destructive actions.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
