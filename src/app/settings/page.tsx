'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
// ... imports
import {
    generateTotpSecretAction,
    verifyTotpAction,
    generateWebAuthnRegistrationOptionsAction,
    verifyWebAuthnRegistrationAction,
    getLogoutConfigsAction,
    saveLogoutConfigAction,
    deleteLogoutConfigAction
} from '@/app/actions';
import { Plus, Trash, Pencil } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { useEffect } from 'react';

// Logout Config Component
function LogoutConfigDialog({
    config,
    trigger,
    onSave
}: {
    config?: { id: string; name: string; config: Record<string, string> };
    trigger?: React.ReactNode;
    onSave: () => void;
}) {
    const [open, setOpen] = useState(false);
    const [name, setName] = useState(config?.name || '');
    const [params, setParams] = useState<{ key: string; value: string }[]>(
        config?.config
            ? Object.entries(config.config).map(([key, value]) => ({ key, value }))
            : []
    );
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (open) {
            setName(config?.name || '');
            setParams(
                config?.config
                    ? Object.entries(config.config).map(([key, value]) => ({ key, value }))
                    : []
            );
        }
    }, [open, config]);

    const addParam = () => setParams([...params, { key: '', value: '' }]);
    const removeParam = (index: number) => setParams(params.filter((_, i) => i !== index));
    const updateParam = (index: number, field: 'key' | 'value', value: string) => {
        const newParams = [...params];
        newParams[index][field] = value;
        setParams(newParams);
    };

    const handleSave = async () => {
        setLoading(true);
        const configRecord: Record<string, string> = {};
        params.forEach(p => {
            if (p.key.trim()) configRecord[p.key.trim()] = p.value;
        });

        await saveLogoutConfigAction({
            id: config?.id,
            name,
            config: configRecord
        });
        setLoading(false);
        setOpen(false);
        onSave();
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button variant="outline" size="sm">
                        <Plus className="mr-2 h-4 w-4" /> New Config
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{config ? 'Edit Logout Config' : 'New Logout Config'}</DialogTitle>
                    <DialogDescription>
                        Define query parameters to append to the logout URL.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="name" className="text-right">Name</Label>
                        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="col-span-3" />
                    </div>
                    <div className="border-t pt-4">
                        <div className="flex justify-between items-center mb-2">
                            <Label>Parameters</Label>
                            <Button type="button" variant="ghost" size="sm" onClick={addParam}>
                                <Plus className="h-3 w-3 mr-1" /> Add
                            </Button>
                        </div>
                        <div className="space-y-2 max-h-[200px] overflow-y-auto">
                            {params.map((p, i) => (
                                <div key={i} className="flex gap-2">
                                    <Input placeholder="Key" value={p.key} onChange={(e) => updateParam(i, 'key', e.target.value)} className="flex-1" />
                                    <Input placeholder="Value" value={p.value} onChange={(e) => updateParam(i, 'value', e.target.value)} className="flex-1" />
                                    <Button type="button" variant="ghost" size="icon" onClick={() => removeParam(i)} className="text-red-500">
                                        <Trash className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <Button onClick={handleSave} disabled={loading}>
                        {loading ? 'Saving...' : 'Save'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export default function SettingsPage() {
    const [totpSecret, setTotpSecret] = useState<string | null>(null);
    const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
    const [verificationCode, setVerificationCode] = useState('');
    const [message, setMessage] = useState('');

    // Logout Config State
    const [logoutConfigs, setLogoutConfigs] = useState<{ id: string; name: string; config: Record<string, string> }[]>([]);

    const fetchLogoutConfigs = async () => {
        const configs = await getLogoutConfigsAction();
        setLogoutConfigs(configs);
    };

    useEffect(() => {
        fetchLogoutConfigs();
    }, []);

    const handleDeleteConfig = async (id: string) => {
        if (confirm('Delete this configuration?')) {
            await deleteLogoutConfigAction(id);
            fetchLogoutConfigs();
        }
    };

    const handleSetupTotp = async () => {
        const result = await generateTotpSecretAction();
        if (result.secret && result.otpauth) {
            setTotpSecret(result.secret);
            const url = await QRCode.toDataURL(result.otpauth);
            setQrCodeUrl(url);
        }
    };

    const handleVerifyTotp = async () => {
        if (!totpSecret) return;
        const result = await verifyTotpAction(totpSecret, verificationCode);
        if (result.success) {
            setMessage('MFA (TOTP) enabled successfully!');
            setTotpSecret(null);
            setQrCodeUrl(null);
        } else {
            setMessage('Invalid code. Please try again.');
        }
    };

    const handleRegisterPasskey = async () => {
        try {
            const options = await generateWebAuthnRegistrationOptionsAction();
            const attResp = await startRegistration({ optionsJSON: options });
            const verificationResp = await verifyWebAuthnRegistrationAction(attResp);

            if (verificationResp.success) {
                setMessage('Passkey registered successfully!');
            } else {
                setMessage('Passkey registration failed.');
            }
        } catch (error) {
            console.error(error);
            setMessage('Passkey registration failed: ' + (error as Error).message);
        }
    };

    return (
        <div className="container mx-auto py-10 space-y-8">
            <div className="flex items-center gap-4 mb-6">
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/">
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                </Button>
                <h1 className="text-3xl font-bold">Settings</h1>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Multi-Factor Authentication</CardTitle>
                            <CardDescription>Enhance your account security with TOTP.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* ... existing TOTP content ... */}
                            {!totpSecret ? (
                                <Button onClick={handleSetupTotp}>Setup TOTP</Button>
                            ) : (
                                <div className="space-y-4">
                                    <div className="flex justify-center bg-white p-4 rounded-lg">
                                        {qrCodeUrl && <img src={qrCodeUrl} alt="TOTP QR Code" />}
                                    </div>
                                    <p className="text-sm text-muted-foreground text-center">
                                        Scan this QR code with your authenticator app.
                                    </p>
                                    <div className="space-y-2">
                                        <Label htmlFor="code">Verification Code</Label>
                                        <Input
                                            id="code"
                                            value={verificationCode}
                                            onChange={(e) => setVerificationCode(e.target.value)}
                                            placeholder="123456"
                                        />
                                    </div>
                                    <Button onClick={handleVerifyTotp} className="w-full">Verify & Enable</Button>
                                </div>
                            )}
                            {message && (
                                <p className={`text-sm ${message.includes('success') ? 'text-green-500' : 'text-red-500'}`}>
                                    {message}
                                </p>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Passkeys (WebAuthn)</CardTitle>
                            <CardDescription>Login securely with TouchID, FaceID, or a security key.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button onClick={handleRegisterPasskey} variant="outline">Register New Passkey</Button>
                        </CardContent>
                    </Card>
                </div>

                <div className="space-y-6">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <div className="space-y-1">
                                <CardTitle>Logout Configurations</CardTitle>
                                <CardDescription>Manage reusable logout parameter sets.</CardDescription>
                            </div>
                            <LogoutConfigDialog onSave={fetchLogoutConfigs} />
                        </CardHeader>
                        <CardContent>
                            {logoutConfigs.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-4">No configurations found.</p>
                            ) : (
                                <div className="space-y-2">
                                    {logoutConfigs.map(config => (
                                        <div key={config.id} className="flex items-center justify-between p-2 border rounded-md">
                                            <div>
                                                <p className="font-medium text-sm">{config.name}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {Object.keys(config.config).length} parameters
                                                </p>
                                            </div>
                                            <div className="flex gap-1">
                                                <LogoutConfigDialog
                                                    config={config}
                                                    onSave={fetchLogoutConfigs}
                                                    trigger={
                                                        <Button variant="ghost" size="icon">
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                    }
                                                />
                                                <Button variant="ghost" size="icon" onClick={() => handleDeleteConfig(config.id)} className="text-red-500">
                                                    <Trash className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
