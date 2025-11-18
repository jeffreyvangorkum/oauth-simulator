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

export function NewClientDialog() {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);

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
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Add OAuth Client</DialogTitle>
                    <DialogDescription>
                        Configure a new OAuth 2.0 client to simulate flows.
                    </DialogDescription>
                </DialogHeader>
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
                            <Input id="authorizeUrl" name="authorizeUrl" placeholder="https://..." className="col-span-3" required />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="tokenUrl" className="text-right">Token URL</Label>
                            <Input id="tokenUrl" name="tokenUrl" placeholder="https://..." className="col-span-3" required />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="redirectUri" className="text-right">Redirect URI</Label>
                            <Input id="redirectUri" name="redirectUri" defaultValue="http://localhost:3000/api/oauth/callback" className="col-span-3" required />
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
