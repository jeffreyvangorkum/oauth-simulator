'use client';

import { OAuthClient } from '@/lib/config';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Trash2, ExternalLink, Pencil } from 'lucide-react';
import { deleteClientAction } from '@/app/actions';
import { ClientDialog } from '@/components/client-dialog';

export function ClientList({ clients }: { clients: OAuthClient[] }) {
    if (clients.length === 0) {
        return (
            <div className="text-center py-12 border-2 border-dashed rounded-lg border-neutral-200 dark:border-neutral-800">
                <h3 className="text-lg font-medium">No clients configured</h3>
                <p className="text-neutral-500 dark:text-neutral-400">Add a new OAuth client to get started.</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {clients.map((client) => (
                <Card key={client.id} className="flex flex-col">
                    <CardHeader>
                        <div className="flex justify-between items-start">
                            <CardTitle className="truncate pr-4" title={client.name}>{client.name}</CardTitle>
                            <Badge variant="secondary" className="shrink-0">OAuth 2.0</Badge>
                        </div>
                        <CardDescription className="truncate" title={client.clientId}>
                            ID: {client.clientId}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 space-y-2 text-sm text-neutral-500 dark:text-neutral-400">
                        <div>
                            <span className="font-medium text-foreground">Authorize URL:</span>
                            <div className="truncate" title={client.authorizeUrl}>{client.authorizeUrl}</div>
                        </div>
                        <div>
                            <span className="font-medium text-foreground">Token URL:</span>
                            <div className="truncate" title={client.tokenUrl}>{client.tokenUrl}</div>
                        </div>
                    </CardContent>
                    <CardFooter className="flex justify-between gap-2">
                        <ClientDialog
                            client={client}
                            trigger={
                                <Button variant="outline" size="icon">
                                    <Pencil className="h-4 w-4" />
                                </Button>
                            }
                        />
                        <Button variant="destructive" size="icon" onClick={() => deleteClientAction(client.id)}>
                            <Trash2 className="h-4 w-4" />
                        </Button>
                        <Button asChild className="flex-1">
                            <Link href={`/client/${client.id}`}>
                                Simulate Flow <ExternalLink className="ml-2 h-4 w-4" />
                            </Link>
                        </Button>
                    </CardFooter>
                </Card>
            ))}
        </div>
    );
}
