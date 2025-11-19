'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { generateTotpSecretAction, verifyTotpAction } from '@/app/actions';
import QRCode from 'qrcode';

export default function SettingsPage() {
    const [totpSecret, setTotpSecret] = useState<string | null>(null);
    const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
    const [verificationCode, setVerificationCode] = useState('');
    const [message, setMessage] = useState('');

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
            setMessage('MFA enabled successfully!');
            setTotpSecret(null);
            setQrCodeUrl(null);
        } else {
            setMessage('Invalid code. Please try again.');
        }
    };

    return (
        <div className="container mx-auto py-10">
            <h1 className="text-3xl font-bold mb-6">Settings</h1>

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
        </div>
    );
}
