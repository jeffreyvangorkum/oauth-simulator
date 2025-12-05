'use client';

import { useState } from 'react';
import { updateSystemSettingsAction } from '@/app/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { AuthSettings } from '@/lib/settings';

export function SystemSettingsForm({ initialSettings }: { initialSettings: AuthSettings }) {
    const [settings, setSettings] = useState<AuthSettings>(initialSettings);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');

    const handleSave = async () => {
        setSaving(true);
        setMessage('');
        try {
            const result = await updateSystemSettingsAction(settings);
            if (result.success) {
                setMessage('Settings saved successfully');
            } else {
                setMessage('Failed to save settings: ' + result.error);
            }
        } catch (error) {
            setMessage('An error occurred');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                        <Label className="text-base">Username & Password Login</Label>
                        <p className="text-sm text-neutral-500">
                            Allow users to log in with a local username and password.
                        </p>
                    </div>
                    <Switch
                        checked={settings.enablePasswordLogin}
                        onCheckedChange={(checked) => setSettings({ ...settings, enablePasswordLogin: checked })}
                    />
                </div>
                <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                        <Label className="text-base">OAuth (SSO) Login</Label>
                        <p className="text-sm text-neutral-500">
                            Allow users to log in with an external OAuth provider.
                        </p>
                    </div>
                    <Switch
                        checked={settings.enableOidcLogin}
                        onCheckedChange={(checked) => setSettings({ ...settings, enableOidcLogin: checked })}
                    />
                </div>
            </div>

            {settings.enableOidcLogin && (
                <div className="space-y-4 border-t pt-4">
                    <h3 className="text-lg font-medium">OIDC Configuration</h3>

                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label className="text-base">Auto-Provision Users</Label>
                            <p className="text-sm text-neutral-500">
                                Automatically create an account when a new user logs in via OIDC.
                            </p>
                        </div>
                        <Switch
                            checked={settings.enableOidcAutoProvision}
                            onCheckedChange={(checked) => setSettings({ ...settings, enableOidcAutoProvision: checked })}
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="oidc-username-claim">Username Claim</Label>
                        <Input
                            id="oidc-username-claim"
                            value={settings.oidcUsernameClaim || 'email'}
                            onChange={(e) => setSettings({ ...settings, oidcUsernameClaim: e.target.value })}
                            placeholder="email"
                        />
                        <p className="text-sm text-neutral-500">
                            The claim from the ID token to use as the username (e.g., 'email', 'sub', 'preferred_username').
                        </p>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="oidc-issuer">Issuer URL</Label>
                        <Input
                            id="oidc-issuer"
                            value={settings.oidcIssuer || ''}
                            onChange={(e) => setSettings({ ...settings, oidcIssuer: e.target.value })}
                            placeholder="https://your-idp.com"
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="oidc-client-id">Client ID</Label>
                        <Input
                            id="oidc-client-id"
                            value={settings.oidcClientId || ''}
                            onChange={(e) => setSettings({ ...settings, oidcClientId: e.target.value })}
                            placeholder="client-id"
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="oidc-client-secret">Client Secret</Label>
                        <Input
                            id="oidc-client-secret"
                            type="password"
                            value={settings.oidcClientSecret || ''}
                            onChange={(e) => setSettings({ ...settings, oidcClientSecret: e.target.value })}
                            placeholder="client-secret"
                        />
                    </div>
                </div>
            )}

            <div className="flex items-center gap-4">
                <Button onClick={handleSave} disabled={saving}>
                    {saving ? 'Saving...' : 'Save Settings'}
                </Button>
                {message && (
                    <p className={`text-sm ${message.includes('success') ? 'text-green-600' : 'text-red-600'}`}>
                        {message}
                    </p>
                )}
            </div>
        </div>
    );
}
