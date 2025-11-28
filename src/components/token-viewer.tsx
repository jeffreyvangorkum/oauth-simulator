'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { decodeToken, DecodedToken } from '@/lib/oauth-service';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function TokenViewer({
    token,
    label,
    grantType,
    onRefresh,
    isRefreshing
}: {
    token: string;
    label: string;
    grantType?: string;
    onRefresh?: () => void;
    isRefreshing?: boolean;
}) {
    const [decoded, setDecoded] = useState<DecodedToken | null>(null);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        setDecoded(decodeToken(token));
    }, [token]);

    const copyToClipboard = () => {
        navigator.clipboard.writeText(token);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <Card className="mt-4">
            <CardHeader className="pb-2">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <CardTitle className="text-sm font-medium uppercase tracking-wider text-neutral-500">{label}</CardTitle>
                        {grantType && (
                            <Badge variant="outline" className="text-xs font-normal lowercase">
                                {grantType}
                            </Badge>
                        )}
                    </div>
                    <div className="flex gap-2">
                        {onRefresh && (
                            <Button variant="ghost" size="sm" onClick={onRefresh} disabled={isRefreshing}>
                                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                            </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={copyToClipboard}>
                            {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <Tabs defaultValue="decoded" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="decoded">Decoded</TabsTrigger>
                        <TabsTrigger value="raw">Raw</TabsTrigger>
                    </TabsList>
                    <TabsContent value="decoded" className="mt-4 space-y-4">
                        {decoded ? (
                            <>
                                <div className="space-y-2">
                                    <h4 className="text-xs font-semibold text-neutral-500 uppercase">Header</h4>
                                    <pre className="bg-neutral-100 dark:bg-neutral-900 p-4 rounded-md text-xs overflow-auto max-h-40">
                                        {JSON.stringify(decoded.header, null, 2)}
                                    </pre>
                                </div>
                                <div className="space-y-2">
                                    <h4 className="text-xs font-semibold text-neutral-500 uppercase">Payload</h4>
                                    <pre className="bg-neutral-100 dark:bg-neutral-900 p-4 rounded-md text-xs overflow-auto max-h-96">
                                        {JSON.stringify(decoded.payload, null, 2)}
                                    </pre>
                                </div>
                            </>
                        ) : (
                            <div className="text-center py-8 text-neutral-500">
                                Not a valid JWT or opaque token
                            </div>
                        )}
                    </TabsContent>
                    <TabsContent value="raw">
                        <pre className="bg-neutral-100 dark:bg-neutral-900 p-4 rounded-md text-xs break-all whitespace-pre-wrap">
                            {token}
                        </pre>
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    );
}
