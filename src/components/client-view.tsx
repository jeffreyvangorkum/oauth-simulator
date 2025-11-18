'use client';

import { useEffect, useState, use } from 'react';
import { OAuthClient, getClient } from '@/lib/config';
import { generateAuthorizeUrl, TokenResponse } from '@/lib/oauth-service';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TokenViewer } from '@/components/token-viewer';
import { executeClientCredentialsFlow } from '@/app/actions';
import { useSearchParams, useRouter } from 'next/navigation';
import { ArrowLeft, Play, Loader2 } from 'lucide-react';
import Link from 'next/link';

// Since this is a client component (due to useSearchParams), we need to fetch client data differently or pass it down.
// But we can't make the page async if it's a client component in the way we want to use server actions easily mixed in?
// Actually, we can make the page a server component and pass data to a client component wrapper.
// Let's do that. This file will be the client wrapper.
// Wait, I'll rename this to `client-view.tsx` and make `page.tsx` the server component.

// Placeholder for now, I will write the server component in the next step.
// This file will be the ClientView component.

export default function ClientView({ client }: { client: OAuthClient }) {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [tokens, setTokens] = useState<TokenResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const success = searchParams.get('success');
        const tokensParam = searchParams.get('tokens');
        const errorParam = searchParams.get('error');

        if (success === 'true' && tokensParam) {
            try {
                setTokens(JSON.parse(tokensParam));
                // Clean up URL
                router.replace(`/client/${client.id}`);
            } catch (e) {
                setError('Failed to parse tokens from URL');
            }
        } else if (errorParam) {
            setError(errorParam);
        }
    }, [searchParams, client.id, router]);

    const handleAuthCodeFlow = () => {
        const state = client.id; // Simple state
        const url = generateAuthorizeUrl(client, state);
        window.location.href = url;
    };

    const handleClientCredentialsFlow = async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await executeClientCredentialsFlow(client.id);
            setTokens(result);
        } catch (e: any) {
            setError(e.message || 'Flow failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 p-8">
            <div className="max-w-4xl mx-auto space-y-8">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" asChild>
                        <Link href="/">
                            <ArrowLeft className="h-4 w-4" />
                        </Link>
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold">{client.name}</h1>
                        <p className="text-neutral-500 dark:text-neutral-400">{client.clientId}</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Authorization Code Flow</CardTitle>
                            <CardDescription>User-interactive flow for web apps.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button onClick={handleAuthCodeFlow} className="w-full">
                                <Play className="mr-2 h-4 w-4" /> Start Flow
                            </Button>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Client Credentials Flow</CardTitle>
                            <CardDescription>Machine-to-machine flow.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button onClick={handleClientCredentialsFlow} variant="secondary" className="w-full" disabled={loading}>
                                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                                Get Token
                            </Button>
                        </CardContent>
                    </Card>
                </div>

                {error && (
                    <div className="bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-4 rounded-md">
                        Error: {error}
                    </div>
                )}

                {tokens && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <h2 className="text-xl font-semibold">Tokens</h2>
                        {tokens.access_token && (
                            <TokenViewer token={tokens.access_token} label="Access Token" />
                        )}
                        {tokens.id_token && (
                            <TokenViewer token={tokens.id_token} label="ID Token" />
                        )}
                        {tokens.refresh_token && (
                            <TokenViewer token={tokens.refresh_token} label="Refresh Token" />
                        )}
                        <div className="bg-neutral-100 dark:bg-neutral-900 p-4 rounded-md overflow-auto">
                            <h4 className="text-xs font-semibold text-neutral-500 uppercase mb-2">Full Response</h4>
                            <pre className="text-xs">{JSON.stringify(tokens, null, 2)}</pre>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
