'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Send, Loader2, Copy, Check } from 'lucide-react';
import { executeHttpRequestAction } from '@/app/actions';

interface HttpRequestDialogProps {
    token: string;
    trigger: React.ReactNode;
}

interface HttpResponse {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body: string;
}

export function HttpRequestDialog({ token, trigger }: HttpRequestDialogProps) {
    const [open, setOpen] = useState(false);
    const [method, setMethod] = useState<'GET' | 'POST'>('POST');
    const [url, setUrl] = useState(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/endpoint`);
    const [jsonBody, setJsonBody] = useState('{\n  "name": "jeffrey",\n  "email": "dev@van-gorkum.com"\n}');
    const [customHeaders, setCustomHeaders] = useState('');
    const [loading, setLoading] = useState(false);
    const [response, setResponse] = useState<HttpResponse | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [authHeaderCopied, setAuthHeaderCopied] = useState(false);
    const [responseCopied, setResponseCopied] = useState(false);

    const handleSend = async () => {
        setLoading(true);
        setError(null);
        setResponse(null);

        try {
            // Parse custom headers
            let headers: Record<string, string> = {};
            if (customHeaders.trim()) {
                try {
                    headers = JSON.parse(customHeaders);
                } catch (e) {
                    throw new Error('Invalid JSON in custom headers');
                }
            }

            // Parse JSON body for POST
            let body: any = undefined;
            if (method === 'POST' && jsonBody.trim()) {
                try {
                    body = JSON.parse(jsonBody);
                } catch (e) {
                    throw new Error('Invalid JSON in request body');
                }
            }

            const result = await executeHttpRequestAction({
                method,
                url,
                token,
                headers,
                body,
            });

            if (result.success && result.response) {
                setResponse(result.response);
            } else {
                setError(result.error || 'Request failed');
            }
        } catch (e: any) {
            setError(e.message || 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    const formatResponseBody = (body: string) => {
        try {
            const parsed = JSON.parse(body);
            return JSON.stringify(parsed, null, 2);
        } catch {
            return body;
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger}
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Test HTTP Request</DialogTitle>
                    <DialogDescription>
                        Make HTTP requests using your access token as a bearer token
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Method and URL */}
                    <div className="flex gap-2">
                        <div className="w-32">
                            <Select value={method} onValueChange={(v) => setMethod(v as 'GET' | 'POST')}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="GET">GET</SelectItem>
                                    <SelectItem value="POST">POST</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <Input
                            placeholder="https://api.example.com/endpoint"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            className="flex-1"
                        />
                    </div>

                    {/* Request Configuration */}
                    <Tabs defaultValue="body" className="w-full">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="body">Body</TabsTrigger>
                            <TabsTrigger value="headers">Headers</TabsTrigger>
                        </TabsList>
                        <TabsContent value="body" className="space-y-2">
                            <Label>JSON Body {method === 'GET' && '(not used for GET requests)'}</Label>
                            <textarea
                                className="w-full h-32 p-2 border rounded-md font-mono text-xs bg-neutral-50 dark:bg-neutral-900"
                                value={jsonBody}
                                onChange={(e) => setJsonBody(e.target.value)}
                                disabled={method === 'GET'}
                                placeholder='{\n  "key": "value"\n}'
                            />
                        </TabsContent>
                        <TabsContent value="headers" className="space-y-2">
                            <div className="space-y-2">
                                <Label>Authorization Header (automatically included)</Label>
                                <div
                                    className="p-2 bg-neutral-100 dark:bg-neutral-900 rounded-md font-mono text-xs break-all cursor-pointer hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors"
                                    title={`Authorization: Bearer ${token}`}
                                    onClick={() => {
                                        navigator.clipboard.writeText(`Bearer ${token}`);
                                        setAuthHeaderCopied(true);
                                        setTimeout(() => setAuthHeaderCopied(false), 2000);
                                    }}
                                >
                                    {authHeaderCopied ? (
                                        <span className="text-green-600 dark:text-green-400">✓ Copied to clipboard</span>
                                    ) : (
                                        <>Authorization: Bearer {token.substring(0, 50)}... (click to copy, hover to see full)</>
                                    )}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Custom Headers (JSON format)</Label>
                                <textarea
                                    className="w-full h-24 p-2 border rounded-md font-mono text-xs bg-neutral-50 dark:bg-neutral-900"
                                    value={customHeaders}
                                    onChange={(e) => setCustomHeaders(e.target.value)}
                                    placeholder='{\n  "X-Custom-Header": "value"\n}'
                                />
                            </div>
                        </TabsContent>
                    </Tabs>

                    {/* Send Button */}
                    <Button onClick={handleSend} disabled={loading || !url} className="w-full">
                        {loading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Sending...
                            </>
                        ) : (
                            <>
                                <Send className="mr-2 h-4 w-4" />
                                Send Request
                            </>
                        )}
                    </Button>

                    {/* Error Display */}
                    {error && (
                        <div className="bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-3 rounded-md text-sm">
                            {error}
                        </div>
                    )}

                    {/* Response Display */}
                    {response && (
                        <div className="space-y-3 border-t pt-4">
                            <div className="flex items-center justify-between">
                                <h4 className="font-semibold">Response</h4>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        navigator.clipboard.writeText(response.body);
                                        setResponseCopied(true);
                                        setTimeout(() => setResponseCopied(false), 2000);
                                    }}
                                >
                                    {responseCopied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                                </Button>
                            </div>

                            {/* Status */}
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">Status:</span>
                                <span className={`text-sm font-mono px-2 py-1 rounded ${response.status >= 200 && response.status < 300
                                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                    }`}>
                                    {response.status} {response.statusText}
                                </span>
                            </div>

                            {/* Response Tabs */}
                            <Tabs defaultValue="body" className="w-full">
                                <TabsList className="grid w-full grid-cols-2">
                                    <TabsTrigger value="body">Body</TabsTrigger>
                                    <TabsTrigger value="headers">Headers</TabsTrigger>
                                </TabsList>
                                <TabsContent value="body">
                                    <pre className="bg-neutral-100 dark:bg-neutral-900 p-4 rounded-md text-xs overflow-auto max-h-96">
                                        {formatResponseBody(response.body)}
                                    </pre>
                                </TabsContent>
                                <TabsContent value="headers">
                                    <pre className="bg-neutral-100 dark:bg-neutral-900 p-4 rounded-md text-xs overflow-auto max-h-96">
                                        {JSON.stringify(response.headers, null, 2)}
                                    </pre>
                                </TabsContent>
                            </Tabs>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
