'use client';

import { useState, useEffect } from 'react';
import { supabaseClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Monitor, RefreshCcw, XCircle, CheckCircle, Trash2, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';

export function DevicesTab() {
  const [devices, setDevices] = useState<any[]>([]);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>('');

  const fetchDevices = async () => {
    const { data } = await supabaseClient
      .from('devices')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setDevices(data);
  };

  useEffect(() => {
    fetchDevices();
  }, []);

  useEffect(() => {
    if (!expiresAt || !sessionId) return;

    const interval = setInterval(() => {
      const remaining = new Date(expiresAt).getTime() - Date.now();
      if (remaining <= 0) {
        setTimeLeft('Expired');
        setPairingCode(null);
        setSessionId(null);
        clearInterval(interval);
      } else {
        const mins = Math.floor(remaining / 60000);
        const secs = Math.floor((remaining % 60000) / 1000);
        setTimeLeft(`${mins}:${secs.toString().padStart(2, '0')}`);
      }
    }, 1000);

    const pollInterval = setInterval(async () => {
      if (sessionId) {
        const res = await fetch('/api/agent/devices/pair/poll', {
          method: 'POST',
          body: JSON.stringify({ sessionId })
        });
        const data = await res.json();
        if (data.status === 'completed') {
          toast.success('Device paired successfully!');
          setPairingCode(null);
          setSessionId(null);
          fetchDevices();
        }
      }
    }, 3000);

    return () => {
      clearInterval(interval);
      clearInterval(pollInterval);
    };
  }, [expiresAt, sessionId]);

  const initPairing = async () => {
    const res = await fetch('/api/agent/devices/pair/init', { method: 'POST' });
    const data = await res.json();
    if (data.error) {
      toast.error(data.error);
    } else {
      setPairingCode(data.code);
      setSessionId(data.sessionId);
      setExpiresAt(data.expiresAt);
    }
  };

  const revokeDevice = async (id: string) => {
    if (!confirm('Are you sure you want to revoke this device? It will be immediately disconnected.')) return;
    
    const res = await fetch(`/api/agent/devices/${id}/revoke`, { method: 'POST' });
    const data = await res.json();
    if (data.error) {
      toast.error(data.error);
    } else {
      toast.success('Device revoked.');
      fetchDevices();
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Windows Local Agents</CardTitle>
              <CardDescription>Securely connect your local machine to ORBIT</CardDescription>
            </div>
            <Button onClick={initPairing} disabled={!!pairingCode}>
              Add Windows Device
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          
          {pairingCode && (
            <div className="bg-primary/10 border border-primary/20 p-6 rounded-lg text-center space-y-3">
              <h3 className="text-sm font-medium">Enter this code in your Local Agent CLI:</h3>
              <div className="text-4xl font-mono font-bold tracking-widest">{pairingCode}</div>
              <p className="text-xs text-muted-foreground">
                Run: <code className="bg-background px-1 py-0.5 rounded">orbit-local-agent pair {pairingCode}</code>
              </p>
              <p className="text-xs font-medium text-destructive">
                {timeLeft === 'Expired' ? 'Pairing code expired.' : `Expires in ${timeLeft}`}
              </p>
            </div>
          )}

          {devices.length === 0 && !pairingCode ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <Monitor className="h-8 w-8 mx-auto mb-3 opacity-20" />
              <p>No Windows devices connected.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {devices.map((device) => (
                <div key={device.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${device.status === 'active' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                      {device.status === 'active' ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{device.name}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-2">
                        <span className="capitalize">{device.status}</span>
                        {device.status === 'active' && device.last_seen_at && (
                          <>• Last seen: {new Date(device.last_seen_at).toLocaleDateString()}</>
                        )}
                      </p>
                    </div>
                  </div>
                  <div>
                    {device.status === 'active' ? (
                      <Button variant="ghost" size="sm" onClick={() => revokeDevice(device.id)} className="text-destructive hover:text-destructive hover:bg-destructive/10">
                        <ShieldAlert className="h-4 w-4 mr-2" /> Revoke
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground px-3">Revoked</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
