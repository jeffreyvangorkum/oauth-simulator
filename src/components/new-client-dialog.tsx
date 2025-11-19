'use client';

import { useState } from 'react';
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
import { Plus } from 'lucide-react';

export function NewClientDialog({ defaultDomain = 'http://localhost:3000' }: { defaultDomain?: string }) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [oidcUrl, setOidcUrl] = useState('');
    const [discovering, setDiscovering] = useState(false);
    const [discoveryError, setDiscoveryError] = useState<string | null>(null);
    const [authUrl, setAuthUrl] = useState('');
    const [tokenUrl, setTokenUrl] = useState('');

    async function handleDiscover() {
        if (!oidcUrl) return;
        setDiscovering(true);
        setDiscoveryError(null);
        try {
            const { discoverOidcAction } = await import('@/app/actions');
            const config = await discoverOidcAction(oidcUrl);
            if (config.authorization_endpoint) setAuthUrl(config.authorization_endpoint);
            if (config.token_endpoint) setTokenUrl(config.token_endpoint);
        } catch (e: any) {
            setDiscoveryError(e.message);
        } finally {
            setDiscovering(false);
        }
    }

    async function handleSubmit(formData: FormData) {
        setLoading(true);
        const data = {
            name: formData.get('name') as string,
            clientId: formData.get('clientId') as string,
            clientSecret: formData.get('clientSecret') as string,
            authorizeUrl: formData.get('authorizeUrl') as string,
            tokenUrl: formData.get('tokenUrl') as string,
            scope: formData.get('scope') as string,
            redirectUri: formData.get('redirectUri') as string,
        };

        await saveClientAction(data);
        setLoading(false);
        setOpen(false);
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>
                    <Plus className="mr-2 h-4 w-4" /> New Client
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Add OAuth Client</DialogTitle>
                    <DialogDescription>
                        Configure a new OAuth 2.0 client to simulate flows.
                    </DialogDescription>
                </DialogHeader>

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

                <form action={handleSubmit}>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="name" className="text-right">Name</Label>
                            <Input id="name" name="name" placeholder="My App" className="col-span-3" required />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="clientId" className="text-right">Client ID</Label>
                            <Input id="clientId" name="clientId" className="col-span-3" required />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="clientSecret" className="text-right">Secret</Label>
                            <Input id="clientSecret" name="clientSecret" type="password" className="col-span-3" required />
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
                            <Input id="redirectUri" name="redirectUri" defaultValue={`${defaultDomain}/api/oauth/callback`} className="col-span-3" required />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="scope" className="text-right">Scope</Label>
                            <Input id="scope" name="scope" placeholder="openid profile" className="col-span-3" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={loading}>
                            {loading ? 'Saving...' : 'Save Client'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
