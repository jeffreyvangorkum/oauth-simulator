'use client';

import { useState } from 'react';
import { loginAction, loginWithMfaAction } from '@/app/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import Link from 'next/link';

export function LoginForm({ enableRegistration, authSettings }: { enableRegistration: boolean, authSettings: { enablePasswordLogin: boolean, enableOidcLogin: boolean } }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [mfaRequired, setMfaRequired] = useState(false);
    const [mfaToken, setMfaToken] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (mfaRequired) {
            const result = await loginWithMfaAction(username, mfaToken);
            if (!result.success) {
                setError(result.error || 'Invalid MFA code');
            }
        } else {
            const result = await loginAction(username, password);
            if (result.success) {
                if (result.mfaRequired) {
                    setMfaRequired(true);
                }
                // If success and no MFA, redirect happens in action
            } else {
                setError(result.error || 'Login failed');
            }
        }
    };

    return (
        <Card className="w-[350px]">
            <CardHeader>
                <CardTitle>Login</CardTitle>
                <CardDescription>Enter your credentials to access your account.</CardDescription>
            </CardHeader>
            <CardContent>
                {authSettings.enablePasswordLogin && (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="username">Username</Label>
                            <Input
                                id="username"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                required
                                disabled={mfaRequired}
                            />
                        </div>
                        {!mfaRequired && (
                            <div className="space-y-2">
                                <Label htmlFor="password">Password</Label>
                                <Input
                                    id="password"
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                            </div>
                        )}
                        {mfaRequired && (
                            <div className="space-y-2">
                                <Label htmlFor="mfa">MFA Code</Label>
                                <Input
                                    id="mfa"
                                    value={mfaToken}
                                    onChange={(e) => setMfaToken(e.target.value)}
                                    required
                                    placeholder="123456"
                                />
                            </div>
                        )}
                        {error && <p className="text-sm text-red-500">{error}</p>}
                        <Button type="submit" className="w-full">
                            {mfaRequired ? 'Verify' : 'Login'}
                        </Button>
                    </form>
                )}

                {!mfaRequired && authSettings.enableOidcLogin && (
                    <div className="mt-4">
                        {authSettings.enablePasswordLogin && (
                            <div className="relative">
                                <div className="absolute inset-0 flex items-center">
                                    <span className="w-full border-t" />
                                </div>
                                <div className="relative flex justify-center text-xs uppercase">
                                    <span className="bg-background px-2 text-muted-foreground">
                                        Or continue with
                                    </span>
                                </div>
                            </div>
                        )}

                        <Button
                            variant="outline"
                            type="button"
                            className="w-full mt-4"
                            onClick={() => window.location.href = '/api/auth/oidc/login'}
                        >
                            Login with SSO
                        </Button>
                    </div>
                )}

                {enableRegistration && authSettings.enablePasswordLogin && (
                    <div className="mt-4 text-center text-sm">
                        Don&apos;t have an account?{' '}
                        <Link href="/register" className="underline">
                            Register
                        </Link>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
