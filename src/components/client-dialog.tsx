'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { saveClientAction } from '@/app/actions';
import { Plus, Pencil } from 'lucide-react';
import { OAuthClient } from '@/lib/config';

interface ClientDialogProps {
    client?: OAuthClient;
    trigger?: React.ReactNode;
    defaultDomain?: string;
}

export function ClientDialog({ client, trigger, defaultDomain = 'http://localhost:3000' }: ClientDialogProps) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [oidcUrl, setOidcUrl] = useState('');
    const [discovering, setDiscovering] = useState(false);
    const [discoveryError, setDiscoveryError] = useState<string | null>(null);

    // Form state
    const [authUrl, setAuthUrl] = useState(client?.authorizeUrl || '');
    const [tokenUrl, setTokenUrl] = useState(client?.tokenUrl || '');
    const [endSessionEndpoint, setEndSessionEndpoint] = useState(client?.endSessionEndpoint || '');
    const [redirectUri, setRedirectUri] = useState(
        client?.redirectUri || `${defaultDomain}/api/oauth/callback`
    );
    const [postLogoutRedirectUri, setPostLogoutRedirectUri] = useState(
        client?.postLogoutRedirectUri || defaultDomain
    );
    const [customAttributes, setCustomAttributes] = useState<{ key: string; value: string }[]>(
        client?.customAttributes
            ? Object.entries(client.customAttributes).map(([key, value]) => ({ key, value }))
            : []
    );

    // Reset state when client prop changes or dialog opens
    useEffect(() => {
        if (open) {
            setAuthUrl(client?.authorizeUrl || '');
            setTokenUrl(client?.tokenUrl || '');
            setEndSessionEndpoint(client?.endSessionEndpoint || '');
            // If editing, use client's URI. If new, try to use window.location.origin, fallback to defaultDomain
            if (client) {
                setRedirectUri(client.redirectUri);
                setPostLogoutRedirectUri(client.postLogoutRedirectUri || defaultDomain);
            } else if (typeof window !== 'undefined') {
                setRedirectUri(`${window.location.origin}/api/oauth/callback`);
                setPostLogoutRedirectUri(defaultDomain);
            } else {
                setRedirectUri(`${defaultDomain}/api/oauth/callback`);
                setPostLogoutRedirectUri(defaultDomain);
            }

            setCustomAttributes(
                client?.customAttributes
                    ? Object.entries(client.customAttributes).map(([key, value]) => ({ key, value }))
                    : []
            );
        }
    }, [open, client, defaultDomain]);

    async function handleDiscover() {
        if (!oidcUrl) return;
        setDiscovering(true);
        setDiscoveryError(null);
        try {
            const { discoverOidcAction } = await import('@/app/actions');
            const config = await discoverOidcAction(oidcUrl);
            if (config.authorization_endpoint) setAuthUrl(config.authorization_endpoint);
            if (config.token_endpoint) setTokenUrl(config.token_endpoint);
            if (config.end_session_endpoint) setEndSessionEndpoint(config.end_session_endpoint);
        } catch (e: any) {
            setDiscoveryError(e.message);
        } finally {
            setDiscovering(false);
        }
    }

    function addAttribute() {
        setCustomAttributes([...customAttributes, { key: '', value: '' }]);
    }

    function removeAttribute(index: number) {
        setCustomAttributes(customAttributes.filter((_, i) => i !== index));
    }

    function updateAttribute(index: number, field: 'key' | 'value', value: string) {
        const newAttributes = [...customAttributes];
        newAttributes[index][field] = value;
        setCustomAttributes(newAttributes);
    }

    async function handleSubmit(formData: FormData) {
        setLoading(true);

        const attributesRecord: Record<string, string> = {};
        customAttributes.forEach(attr => {
            if (attr.key.trim()) {
                attributesRecord[attr.key.trim()] = attr.value;
            }
        });

        const data = {
            id: client?.id, // Include ID if editing
            name: formData.get('name') as string,
            clientId: formData.get('clientId') as string,
            clientSecret: formData.get('clientSecret') as string,
            authorizeUrl: formData.get('authorizeUrl') as string,
            tokenUrl: formData.get('tokenUrl') as string,
            scope: formData.get('scope') as string,
            redirectUri: formData.get('redirectUri') as string,
            endSessionEndpoint: formData.get('endSessionEndpoint') as string,
            postLogoutRedirectUri: formData.get('postLogoutRedirectUri') as string,
            customAttributes: attributesRecord,
        };

        await saveClientAction(data);
        setLoading(false);
        setOpen(false);
        if (!client) {
            setCustomAttributes([]); // Reset attributes only if creating new
            setAuthUrl('');
            setTokenUrl('');
            setEndSessionEndpoint('');
            // Reset redirect URI to current origin
            if (typeof window !== 'undefined') {
                setRedirectUri(`${window.location.origin}/api/oauth/callback`);
                setPostLogoutRedirectUri(defaultDomain);
            }
        }
    }

    const isEditing = !!client;

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button>
                        <Plus className="mr-2 h-4 w-4" /> New Client
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{isEditing ? 'Edit OAuth Client' : 'Add OAuth Client'}</DialogTitle>
                    <DialogDescription>
                        {isEditing
                            ? 'Update the configuration for this OAuth 2.0 client.'
                            : 'Configure a new OAuth 2.0 client to simulate flows.'}
                    </DialogDescription>
                </DialogHeader>

                {!isEditing && (
                    <div className="bg-neutral-100 dark:bg-neutral-900 p-4 rounded-md mb-4">
                        <Label htmlFor="oidcUrl" className="text-xs font-semibold uppercase text-neutral-500 mb-2 block">
                            Auto-configure from OIDC
                        </Label>
                        <div className="flex gap-2">
                            <Input
                                id="oidcUrl"
                                placeholder="e.g. https://accounts.google.com"
                                value={oidcUrl}
                                onChange={(e) => setOidcUrl(e.target.value)}
                                className="flex-1"
                            />
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={handleDiscover}
                                disabled={discovering || !oidcUrl}
                            >
                                {discovering ? '...' : 'Fetch'}
                            </Button>
                        </div>
                        {discoveryError && (
                            <p className="text-xs text-red-500 mt-2">{discoveryError}</p>
                        )}
                    </div>
                )}

                <form action={handleSubmit}>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="name" className="text-right">Name</Label>
                            <Input id="name" name="name" placeholder="My App" className="col-span-3" required defaultValue={client?.name} />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="clientId" className="text-right">Client ID</Label>
                            <Input id="clientId" name="clientId" className="col-span-3" required defaultValue={client?.clientId} />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="clientSecret" className="text-right">Secret</Label>
                            <Input id="clientSecret" name="clientSecret" type="password" className="col-span-3" required defaultValue={client?.clientSecret} />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="authorizeUrl" className="text-right">Auth URL</Label>
                            <Input
                                id="authorizeUrl"
                                name="authorizeUrl"
                                placeholder="https://..."
                                className="col-span-3"
                                required
                                value={authUrl}
                                onChange={(e) => setAuthUrl(e.target.value)}
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="tokenUrl" className="text-right">Token URL</Label>
                            <Input
                                id="tokenUrl"
                                name="tokenUrl"
                                placeholder="https://..."
                                className="col-span-3"
                                required
                                value={tokenUrl}
                                onChange={(e) => setTokenUrl(e.target.value)}
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="redirectUri" className="text-right">Redirect URI</Label>
                            <Input
                                id="redirectUri"
                                name="redirectUri"
                                className="col-span-3"
                                required
                                value={redirectUri}
                                onChange={(e) => setRedirectUri(e.target.value)}
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="endSessionEndpoint" className="text-right">End Session</Label>
                            <Input
                                id="endSessionEndpoint"
                                name="endSessionEndpoint"
                                placeholder="https://..."
                                className="col-span-3"
                                value={endSessionEndpoint}
                                onChange={(e) => setEndSessionEndpoint(e.target.value)}
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="postLogoutRedirectUri" className="text-right">Post Logout</Label>
                            <Input
                                id="postLogoutRedirectUri"
                                name="postLogoutRedirectUri"
                                className="col-span-3"
                                value={postLogoutRedirectUri}
                                onChange={(e) => setPostLogoutRedirectUri(e.target.value)}
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="scope" className="text-right">Scope</Label>
                            <Input id="scope" name="scope" placeholder="openid profile" className="col-span-3" defaultValue={client?.scope} />
                        </div>

                        <div className="border-t pt-4 mt-2">
                            <div className="flex justify-between items-center mb-2">
                                <Label className="text-sm font-semibold">Custom Attributes</Label>
                                <Button type="button" variant="outline" size="sm" onClick={addAttribute}>
                                    <Plus className="h-3 w-3 mr-1" /> Add
                                </Button>
                            </div>
                            <div className="space-y-2">
                                {customAttributes.map((attr, index) => (
                                    <div key={index} className="flex gap-2">
                                        <Input
                                            placeholder="Key"
                                            value={attr.key}
                                            onChange={(e) => updateAttribute(index, 'key', e.target.value)}
                                            className="flex-1"
                                        />
                                        <Input
                                            placeholder="Value"
                                            value={attr.value}
                                            onChange={(e) => updateAttribute(index, 'value', e.target.value)}
                                            className="flex-1"
                                        />
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => removeAttribute(index)}
                                            className="text-red-500 hover:text-red-600"
                                        >
                                            &times;
                                        </Button>
                                    </div>
                                ))}
                                {customAttributes.length === 0 && (
                                    <p className="text-xs text-muted-foreground text-center py-2">
                                        No custom attributes added.
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={loading}>
                            {loading ? 'Saving...' : (isEditing ? 'Save Changes' : 'Save Client')}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
