'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { generateTotpSecretAction, verifyTotpAction, generateWebAuthnRegistrationOptionsAction, verifyWebAuthnRegistrationAction, exportClientsAction, importClientsAction } from '@/app/actions';
import QRCode from 'qrcode';
import { startRegistration } from '@simplewebauthn/browser';

import { ArrowLeft, Download, Upload } from 'lucide-react';
import Link from 'next/link';

export default function SettingsPage() {
    const [totpSecret, setTotpSecret] = useState<string | null>(null);
    const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
    const [verificationCode, setVerificationCode] = useState('');
    const [message, setMessage] = useState('');
    const [exportDialogOpen, setExportDialogOpen] = useState(false);
    const [secretDialogOpen, setSecretDialogOpen] = useState(false);
    const [clientsToImport, setClientsToImport] = useState<any[]>([]);
    const [secretInputs, setSecretInputs] = useState<Record<string, string>>({});
    const fileInputRef = useRef<HTMLInputElement>(null);

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

    const performExport = async (includeSecrets: boolean) => {
        try {
            const clients = await exportClientsAction(includeSecrets);
            const json = JSON.stringify(clients, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'clients.json';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            setExportDialogOpen(false);
        } catch (error) {
            console.error('Export failed:', error);
            alert('Failed to export clients');
        }
    };

    const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            const text = await file.text();
            const clients = JSON.parse(text);

            if (!Array.isArray(clients)) {
                alert('Invalid clients.json format');
                return;
            }

            // Check for empty secrets
            const clientsWithEmptySecrets = clients.filter(c => !c.clientSecret || c.clientSecret.trim() === '');

            if (clientsWithEmptySecrets.length > 0) {
                // Show dialog to fill in secrets
                setClientsToImport(clients);
                const initialSecrets: Record<string, string> = {};
                clientsWithEmptySecrets.forEach(c => {
                    initialSecrets[c.id || c.clientId] = '';
                });
                setSecretInputs(initialSecrets);
                setSecretDialogOpen(true);
            } else {
                // Import directly
                await performImport(clients);
            }
        } catch (error) {
            console.error('Import failed:', error);
            alert('Failed to parse clients.json file');
        }

        // Reset file input
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const performImport = async (clients: any[]) => {
        try {
            const result = await importClientsAction(clients);
            alert(`Successfully imported ${result.count} client(s)`);
            setSecretDialogOpen(false);
            setClientsToImport([]);
            setSecretInputs({});
        } catch (error) {
            console.error('Import failed:', error);
            alert('Failed to import clients');
        }
    };

    const handleImportWithSecrets = async () => {
        // Fill in the secrets
        const updatedClients = clientsToImport.map(client => {
            const key = client.id || client.clientId;
            if (secretInputs[key]) {
                return { ...client, clientSecret: secretInputs[key] };
            }
            return client;
        });

        await performImport(updatedClients);
    };

    return (
        <div className="container mx-auto py-10">
            <div className="flex items-center gap-4 mb-6">
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/">
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                </Button>
                <h1 className="text-3xl font-bold">Settings</h1>
            </div>

            <Card className="max-w-md">
                <CardHeader>
                    <CardTitle>Multi-Factor Authentication</CardTitle>
                    <CardDescription>Enhance your account security with TOTP (e.g., Google Authenticator).</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
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

            <Card className="max-w-md mt-6">
                <CardHeader>
                    <CardTitle>Passkeys (WebAuthn)</CardTitle>
                    <CardDescription>Login securely with TouchID, FaceID, or a security key.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Button onClick={handleRegisterPasskey} variant="outline">Register New Passkey</Button>
                </CardContent>
            </Card>

            <Card className="max-w-md mt-6">
                <CardHeader>
                    <CardTitle>Export Clients</CardTitle>
                    <CardDescription>Download all your OAuth clients as a JSON file.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Button onClick={() => setExportDialogOpen(true)} variant="outline">
                        <Download className="mr-2 h-4 w-4" />
                        Export clients.json
                    </Button>
                </CardContent>
            </Card>

            <Card className="max-w-md mt-6">
                <CardHeader>
                    <CardTitle>Import Clients</CardTitle>
                    <CardDescription>Upload a clients.json file to import OAuth clients.</CardDescription>
                </CardHeader>
                <CardContent>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".json"
                        onChange={handleFileSelect}
                        style={{ display: 'none' }}
                    />
                    <Button onClick={() => fileInputRef.current?.click()} variant="outline">
                        <Upload className="mr-2 h-4 w-4" />
                        Import clients.json
                    </Button>
                </CardContent>
            </Card>

            <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Export Clients</DialogTitle>
                        <DialogDescription>
                            Do you want to include client secrets in the export?
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => performExport(false)}>
                            No
                        </Button>
                        <Button onClick={() => performExport(true)}>
                            Yes
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={secretDialogOpen} onOpenChange={setSecretDialogOpen}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Enter Client Secrets</DialogTitle>
                        <DialogDescription>
                            Some clients have empty secrets. Please provide the secrets for the following clients:
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        {Object.keys(secretInputs).map(key => {
                            const client = clientsToImport.find(c => (c.id || c.clientId) === key);
                            return (
                                <div key={key} className="space-y-2">
                                    <Label htmlFor={`secret-${key}`}>
                                        {client?.name || client?.clientId || 'Unknown Client'}
                                    </Label>
                                    <Input
                                        id={`secret-${key}`}
                                        type="password"
                                        placeholder="Enter client secret"
                                        value={secretInputs[key]}
                                        onChange={(e) => setSecretInputs({
                                            ...secretInputs,
                                            [key]: e.target.value
                                        })}
                                    />
                                </div>
                            );
                        })}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setSecretDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleImportWithSecrets}>
                            Import
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
