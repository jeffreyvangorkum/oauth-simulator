'use client';

import { useActionState } from 'react';
import { loginAction } from '@/app/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import Link from 'next/link';

export default function LoginPage() {
    const [state, action, isPending] = useActionState(loginAction, null);

    return (
        <div className="min-h-screen flex items-center justify-center bg-neutral-100 dark:bg-neutral-900 p-4">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle>OAuth Simulator Login</CardTitle>
                    <CardDescription>
                        {state?.mfaRequired
                            ? 'Enter your MFA code to continue.'
                            : 'Enter your credentials to continue.'}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form action={action} className="space-y-4">
                        {state?.mfaRequired ? (
                            <>
                                <input type="hidden" name="username" value={state.username} />
                                <div className="space-y-2">
                                    <Label htmlFor="token">MFA Code</Label>
                                    <Input
                                        id="token"
                                        name="token"
                                        placeholder="Enter 6-digit code"
                                        required
                                        autoFocus
                                    />
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="space-y-2">
                                    <Label htmlFor="username">Username</Label>
                                    <Input
                                        id="username"
                                        name="username"
                                        placeholder="Enter username"
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="password">Password</Label>
                                    <Input
                                        id="password"
                                        name="password"
                                        type="password"
                                        placeholder="Enter password"
                                        required
                                    />
                                </div>
                            </>
                        )}
                        {state?.error && (
                            <p className="text-sm text-red-500">{state.error}</p>
                        )}
                        <Button type="submit" className="w-full" disabled={isPending}>
                            {isPending ? 'Verifying...' : (state?.mfaRequired ? 'Verify' : 'Login')}
                        </Button>
                        {!state?.mfaRequired && (
                            <p className="text-sm text-center text-muted-foreground">
                                Don&apos;t have an account?{' '}
                                <Link href="/register" className="text-primary hover:underline">
                                    Register
                                </Link>
                            </p>
                        )}
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
