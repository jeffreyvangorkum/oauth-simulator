'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { decodeToken, DecodedToken } from '@/lib/oauth-service';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';

import { validateTokenSignature, ValidationResult } from '@/lib/jwks-validation';
import { ShieldCheck, ShieldAlert, Key } from 'lucide-react';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';

export function TokenViewer({
    token,
    label,
    grantType,
    onRefresh,
    isRefreshing,
    hideDecoded = false,
    jwksUrl
}: {
    token: string;
    label: string;
    grantType?: string;
    onRefresh?: () => void;
    isRefreshing?: boolean;
    hideDecoded?: boolean;
    jwksUrl?: string;
}) {
    const [decoded, setDecoded] = useState<DecodedToken | null>(null);
    const [copied, setCopied] = useState(false);
    const [activeTab, setActiveTab] = useState('decoded');
    const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
    const [isValidating, setIsValidating] = useState(false);

    useEffect(() => {
        if (!hideDecoded) {
            setDecoded(decodeToken(token));
        }
    }, [token, hideDecoded]);

    useEffect(() => {
        if (jwksUrl && token) {
            setIsValidating(true);
            validateTokenSignature(token, jwksUrl)
                .then(setValidationResult)
                .catch(() => setValidationResult({ isValid: false, error: 'Validation error' }))
                .finally(() => setIsValidating(false));
        } else {
            setValidationResult(null);
        }
    }, [token, jwksUrl]);

    const copyToClipboard = () => {
        let textToCopy = token;

        if (!hideDecoded && activeTab === 'decoded' && decoded) {
            textToCopy = JSON.stringify({
                header: decoded.header,
                payload: decoded.payload
            }, null, 2);
        }

        navigator.clipboard.writeText(textToCopy);
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
                        {jwksUrl && (
                            <div className="ml-2">
                                {isValidating ? (
                                    <span className="text-xs text-neutral-400">Validating...</span>
                                ) : validationResult?.isValid ? (
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button variant="ghost" size="sm" className="h-6 px-2 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20">
                                                <ShieldCheck className="h-4 w-4 mr-1" />
                                                <span className="text-xs font-medium">Verified</span>
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-80">
                                            <div className="space-y-2">
                                                <h4 className="font-medium flex items-center gap-2">
                                                    <Key className="h-4 w-4" /> Signature Verified
                                                </h4>
                                                <div className="text-xs space-y-1 text-neutral-500">
                                                    <p>Key ID (kid): <span className="font-mono text-neutral-900 dark:text-neutral-100">{validationResult.kid}</span></p>
                                                    <p>Algorithm: <span className="font-mono text-neutral-900 dark:text-neutral-100">{validationResult.alg}</span></p>
                                                </div>
                                            </div>
                                        </PopoverContent>
                                    </Popover>
                                ) : validationResult && (
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button variant="ghost" size="sm" className="h-6 px-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20">
                                                <ShieldAlert className="h-4 w-4 mr-1" />
                                                <span className="text-xs font-medium">Invalid</span>
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-80">
                                            <div className="space-y-2">
                                                <h4 className="font-medium text-red-600 flex items-center gap-2">
                                                    <ShieldAlert className="h-4 w-4" /> Verification Failed
                                                </h4>
                                                <p className="text-xs text-neutral-500">{validationResult.error}</p>
                                            </div>
                                        </PopoverContent>
                                    </Popover>
                                )}
                            </div>
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
                {hideDecoded ? (
                    <pre className="bg-neutral-100 dark:bg-neutral-900 p-4 rounded-md text-xs break-all whitespace-pre-wrap">
                        {token}
                    </pre>
                ) : (
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
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
                )}
            </CardContent>
        </Card>
    );
}
