'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
    updateProfileEmailAction,
    changePasswordAction,
    generateRegistrationOptionsAction,
    verifyRegistrationAction,
    getUserAuthenticatorsAction,
    deleteAuthenticatorAction,
    generateTotpSecretAction,
    verifyTotpAction,
    exportClientsAction,
    importClientsAction
} from '@/app/actions';
import { ArrowLeft, User as UserIcon, Key, Fingerprint, Trash2, Download, Upload } from 'lucide-react';
import Link from 'next/link';
import { getGravatarUrl } from '@/lib/gravatar';
import { startRegistration } from '@simplewebauthn/browser';
import QRCode from 'qrcode';

interface ProfilePageProps {
    user: {
        username: string;
        email?: string | null;
    };
}

export default function ProfilePage({ user }: ProfilePageProps) {
    const [email, setEmail] = useState(user.email || '');
    const [emailMessage, setEmailMessage] = useState('');
    const [emailLoading, setEmailLoading] = useState(false);

    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordMessage, setPasswordMessage] = useState('');
    const [passwordLoading, setPasswordLoading] = useState(false);

    const [gravatarUrl, setGravatarUrl] = useState('');
    const [authenticators, setAuthenticators] = useState<any[]>([]);
    const [passkeyLoading, setPasskeyLoading] = useState(false);
    const [passkeyMessage, setPasskeyMessage] = useState('');

    // TOTP State
    const [totpSecret, setTotpSecret] = useState<string | null>(null);
    const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
    const [verificationCode, setVerificationCode] = useState('');
    const [totpMessage, setTotpMessage] = useState('');

    // Export/Import State
    const [exportDialogOpen, setExportDialogOpen] = useState(false);
    const [secretDialogOpen, setSecretDialogOpen] = useState(false);
    const [clientsToImport, setClientsToImport] = useState<any[]>([]);
    const [secretInputs, setSecretInputs] = useState<Record<string, string>>({});
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setGravatarUrl(getGravatarUrl(email, 200));
        loadAuthenticators();
    }, [email]);

    const loadAuthenticators = async () => {
        const result = await getUserAuthenticatorsAction();
        setAuthenticators(result);
    };

    const handleEmailUpdate = async () => {
        setEmailLoading(true);
        setEmailMessage('');

        const result = await updateProfileEmailAction(email);

        if (result.success) {
            setEmailMessage('Email updated successfully!');
        } else {
            setEmailMessage(result.error || 'Failed to update email');
        }

        setEmailLoading(false);
    };

    const handlePasswordChange = async () => {
        setPasswordLoading(true);
        setPasswordMessage('');

        // Validate passwords match
        if (newPassword !== confirmPassword) {
            setPasswordMessage('New passwords do not match');
            setPasswordLoading(false);
            return;
        }

        const result = await changePasswordAction(currentPassword, newPassword);

        if (result.success) {
            setPasswordMessage('Password changed successfully!');
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } else {
            setPasswordMessage(result.error || 'Failed to change password');
        }

        setPasswordLoading(false);
    };

    const handleRegisterPasskey = async () => {
        setPasskeyLoading(true);
        setPasskeyMessage('');

        try {
            const options = await generateRegistrationOptionsAction();
            const attResp = await startRegistration(options as any);
            const result = await verifyRegistrationAction(attResp);

            if (result.success) {
                setPasskeyMessage('Passkey registered successfully!');
                loadAuthenticators();
            } else {
                setPasskeyMessage('Failed to verify passkey');
            }
        } catch (error: any) {
            setPasskeyMessage(error.message || 'Passkey registration failed');
        }

        setPasskeyLoading(false);
    };

    const handleDeleteAuthenticator = async (id: string) => {
        if (confirm('Are you sure you want to delete this passkey?')) {
            await deleteAuthenticatorAction(id);
            loadAuthenticators();
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
            setTotpMessage('MFA (TOTP) enabled successfully!');
            setTotpSecret(null);
            setQrCodeUrl(null);
            setVerificationCode('');
        } else {
            setTotpMessage('Invalid code. Please try again.');
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

            const clientsWithEmptySecrets = clients.filter(c => !c.clientSecret || c.clientSecret.trim() === '');

            if (clientsWithEmptySecrets.length > 0) {
                setClientsToImport(clients);
                const initialSecrets: Record<string, string> = {};
                clientsWithEmptySecrets.forEach(c => {
                    initialSecrets[c.id || c.clientId] = '';
                });
                setSecretInputs(initialSecrets);
                setSecretDialogOpen(true);
            } else {
                await performImport(clients);
            }
        } catch (error) {
            console.error('Import failed:', error);
            alert('Failed to parse clients.json file');
        }

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
                <h1 className="text-3xl font-bold">Profile</h1>
            </div>

            <div className="max-w-2xl space-y-6">
                {/* Profile Picture Section */}
                <Card>
                    <CardHeader>
                        <CardTitle>Profile Picture</CardTitle>
                        <CardDescription>
                            Your profile picture is provided by <a href="https://gravatar.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Gravatar</a> based on your email address.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col items-center space-y-4">
                        <div className="relative">
                            <img
                                src={gravatarUrl}
                                alt="Profile"
                                className="w-32 h-32 rounded-full border-4 border-neutral-200 dark:border-neutral-800"
                            />
                            <div className="absolute bottom-0 right-0 bg-neutral-100 dark:bg-neutral-900 rounded-full p-2 border-2 border-white dark:border-neutral-950">
                                <UserIcon className="h-4 w-4 text-neutral-600 dark:text-neutral-400" />
                            </div>
                        </div>
                        <div className="text-center">
                            <p className="font-semibold text-lg">{user.username}</p>
                            {email && <p className="text-sm text-muted-foreground">{email}</p>}
                        </div>
                    </CardContent>
                </Card>

                {/* Email Section */}
                <Card>
                    <CardHeader>
                        <CardTitle>Email Address</CardTitle>
                        <CardDescription>
                            Update your email address. This will be used for your Gravatar profile picture.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="your.email@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>
                        <Button onClick={handleEmailUpdate} disabled={emailLoading}>
                            {emailLoading ? 'Saving...' : 'Save Email'}
                        </Button>
                        {emailMessage && (
                            <p className={`text-sm ${emailMessage.includes('success') ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500'}`}>
                                {emailMessage}
                            </p>
                        )}
                    </CardContent>
                </Card>

                {/* Password Section */}
                <Card>
                    <CardHeader>
                        <CardTitle>Change Password</CardTitle>
                        <CardDescription>
                            Update your password. Password must be at least 8 characters.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="currentPassword">Current Password</Label>
                            <Input
                                id="currentPassword"
                                type="password"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="newPassword">New Password</Label>
                            <Input
                                id="newPassword"
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="confirmPassword">Confirm New Password</Label>
                            <Input
                                id="confirmPassword"
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                            />
                        </div>
                        <Button onClick={handlePasswordChange} disabled={passwordLoading}>
                            {passwordLoading ? 'Changing...' : 'Change Password'}
                        </Button>
                        {passwordMessage && (
                            <p className={`text-sm ${passwordMessage.includes('success') ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500'}`}>
                                {passwordMessage}
                            </p>
                        )}
                    </CardContent>
                </Card>

                {/* Passkeys Section */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Fingerprint className="h-5 w-5" />
                            Passkeys
                        </CardTitle>
                        <CardDescription>
                            Passkeys provide a secure, passwordless way to sign in using your device's biometrics or a security key.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {authenticators.length > 0 ? (
                            <div className="space-y-3">
                                {authenticators.map((auth) => (
                                    <div key={auth.credentialID} className="flex items-center justify-between p-3 border rounded-lg bg-neutral-50 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-full">
                                                <Key className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium">Passkey ({auth.credentialDeviceType})</p>
                                                <p className="text-xs text-muted-foreground">
                                                    ID: ...{auth.credentialID.slice(-8)}
                                                </p>
                                            </div>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                                            onClick={() => handleDeleteAuthenticator(auth.credentialID)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-center text-muted-foreground py-4">
                                No passkeys registered yet.
                            </p>
                        )}

                        <Button
                            variant="outline"
                            className="w-full flex items-center justify-center gap-2"
                            onClick={handleRegisterPasskey}
                            disabled={passkeyLoading}
                        >
                            <Fingerprint className="h-4 w-4" />
                            {passkeyLoading ? 'Registering...' : 'Add a Passkey'}
                        </Button>

                        {passkeyMessage && (
                            <p className={`text-sm text-center ${passkeyMessage.includes('success') ? 'text-green-600' : 'text-red-600'}`}>
                                {passkeyMessage}
                            </p>
                        )}
                    </CardContent>
                </Card>

                {/* TOTP Section */}
                <Card>
                    <CardHeader>
                        <CardTitle>Multi-Factor Authentication (TOTP)</CardTitle>
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
                                <p className="text-sm text-neutral-500 text-center">
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
                        {totpMessage && (
                            <p className={`text-sm ${totpMessage.includes('success') ? 'text-green-600' : 'text-red-600'}`}>
                                {totpMessage}
                            </p>
                        )}
                    </CardContent>
                </Card>

                {/* Client Data Section */}
                <Card>
                    <CardHeader>
                        <CardTitle>Client Data Management</CardTitle>
                        <CardDescription>Export your configured OAuth clients or import them from a JSON file.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex flex-col sm:flex-row gap-3">
                            <Button onClick={() => setExportDialogOpen(true)} variant="outline" className="flex-1">
                                <Download className="mr-2 h-4 w-4" />
                                Export Clients
                            </Button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".json"
                                onChange={handleFileSelect}
                                style={{ display: 'none' }}
                            />
                            <Button onClick={() => fileInputRef.current?.click()} variant="outline" className="flex-1">
                                <Upload className="mr-2 h-4 w-4" />
                                Import Clients
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Dialogs */}
            <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Export Clients</DialogTitle>
                        <DialogDescription>
                            Do you want to include client secrets in the export?
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2 sm:gap-0">
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
