'use client';

import { useState } from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MoreHorizontal, Shield, ShieldAlert, Trash, Key } from 'lucide-react';
import { adminDeleteUserAction, adminResetPasswordAction, adminToggleStatusAction, adminGetClientsForUserAction, adminDeleteClientAction, adminCopyClientAction } from '@/app/actions';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ClientDate } from '@/components/client-date';

interface User {
    id: string;
    username: string;
    created_at: string;
    clientCount: number;
    disabled: boolean;
}

interface ClientSummary {
    id: string;
    name: string;
    clientId: string;
    redirectUri: string;
    created_at: string;
}

export function AdminUserList({ users }: { users: User[] }) {
    const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [newPassword, setNewPassword] = useState('');
    const [loading, setLoading] = useState(false);

    // Client Management State
    const [clientDialogOpen, setClientDialogOpen] = useState(false);
    const [userClients, setUserClients] = useState<ClientSummary[]>([]);
    const [viewingUser, setViewingUser] = useState<User | null>(null);
    const [copyDialogOpen, setCopyDialogOpen] = useState(false);
    const [selectedClient, setSelectedClient] = useState<ClientSummary | null>(null);
    const [targetUserId, setTargetUserId] = useState('');

    const handleDelete = async (userId: string) => {
        if (confirm('Are you sure you want to delete this user? This action cannot be undone and will delete all their clients.')) {
            const result = await adminDeleteUserAction(userId);
            if (!result.success) {
                alert(result.error || 'Failed to delete user');
            }
        }
    };

    const handleToggleStatus = async (user: User) => {
        await adminToggleStatusAction(user.id, !user.disabled);
    };

    const openPasswordDialog = (user: User) => {
        setSelectedUser(user);
        setNewPassword('');
        setPasswordDialogOpen(true);
    };

    const handleResetPassword = async () => {
        if (!selectedUser || !newPassword) return;
        setLoading(true);
        await adminResetPasswordAction(selectedUser.id, newPassword);
        setLoading(false);
        setPasswordDialogOpen(false);
        alert('Password reset successfully');
    };

    const handleViewClients = async (user: User) => {
        setViewingUser(user);
        setLoading(true);
        const clients = await adminGetClientsForUserAction(user.id);
        setUserClients(clients);
        setLoading(false);
        setClientDialogOpen(true);
    };

    const handleDeleteClient = async (clientId: string) => {
        if (confirm('Are you sure you want to delete this client?')) {
            await adminDeleteClientAction(clientId);
            // Refresh list
            if (viewingUser) {
                const clients = await adminGetClientsForUserAction(viewingUser.id);
                setUserClients(clients);
            }
        }
    };

    const openCopyDialog = (client: ClientSummary) => {
        setSelectedClient(client);
        setTargetUserId('');
        setCopyDialogOpen(true);
    };

    const handleCopyClient = async () => {
        if (!selectedClient || !targetUserId) return;
        setLoading(true);
        await adminCopyClientAction(selectedClient.id, targetUserId);
        setLoading(false);
        setCopyDialogOpen(false);
        alert('Client copied successfully');
    };

    return (
        <>
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Username</TableHead>
                            <TableHead>Created At</TableHead>
                            <TableHead>Clients</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {users.map((user) => (
                            <TableRow key={user.id}>
                                <TableCell className="font-medium">{user.username}</TableCell>
                                <TableCell><ClientDate date={user.created_at} /></TableCell>
                                <TableCell>
                                    <Button
                                        variant="link"
                                        className="p-0 h-auto font-normal"
                                        onClick={() => handleViewClients(user)}
                                    >
                                        {user.clientCount}
                                    </Button>
                                </TableCell>
                                <TableCell>
                                    {user.disabled ? (
                                        <Badge variant="destructive">Disabled</Badge>
                                    ) : (
                                        <Badge variant="outline" className="text-green-600 border-green-600">Active</Badge>
                                    )}
                                </TableCell>
                                <TableCell className="text-right">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" className="h-8 w-8 p-0">
                                                <span className="sr-only">Open menu</span>
                                                <MoreHorizontal className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                            <DropdownMenuItem onClick={() => handleToggleStatus(user)}>
                                                {user.disabled ? (
                                                    <>
                                                        <Shield className="mr-2 h-4 w-4" /> Enable Account
                                                    </>
                                                ) : (
                                                    <>
                                                        <ShieldAlert className="mr-2 h-4 w-4" /> Disable Account
                                                    </>
                                                )}
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => openPasswordDialog(user)}>
                                                <Key className="mr-2 h-4 w-4" /> Reset Password
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem onClick={() => handleDelete(user.id)} className="text-red-600">
                                                <Trash className="mr-2 h-4 w-4" /> Delete User
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Reset Password</DialogTitle>
                        <DialogDescription>
                            Enter a new password for user <strong>{selectedUser?.username}</strong>.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="new-password" className="text-right">
                                New Password
                            </Label>
                            <Input
                                id="new-password"
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="col-span-3"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={handleResetPassword} disabled={loading || !newPassword}>
                            {loading ? 'Resetting...' : 'Reset Password'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={clientDialogOpen} onOpenChange={setClientDialogOpen}>
                <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Clients for {viewingUser?.username}</DialogTitle>
                        <DialogDescription>
                            Manage OAuth clients for this user.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="mt-4 space-y-4">
                        {userClients.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground border rounded-md bg-neutral-50 dark:bg-neutral-900">
                                No clients found.
                            </div>
                        ) : (
                            userClients.map((client) => (
                                <div key={client.id} className="border rounded-md p-4 bg-white dark:bg-neutral-900 shadow-sm">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <h3 className="font-semibold text-lg">{client.name}</h3>
                                            <p className="text-xs text-muted-foreground">Created: <ClientDate date={client.created_at} /></p>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button variant="outline" size="sm" onClick={() => openCopyDialog(client)}>
                                                Copy
                                            </Button>
                                            <Button variant="destructive" size="sm" onClick={() => handleDeleteClient(client.id)}>
                                                Delete
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="space-y-2 text-sm">
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-1">
                                            <span className="font-medium text-muted-foreground">Client ID:</span>
                                            <span className="col-span-2 font-mono text-xs break-all">{client.clientId}</span>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-1">
                                            <span className="font-medium text-muted-foreground">Redirect URI:</span>
                                            <span className="col-span-2 font-mono text-xs break-all">{client.redirectUri}</span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={copyDialogOpen} onOpenChange={setCopyDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Copy Client</DialogTitle>
                        <DialogDescription>
                            Copy <strong>{selectedClient?.name}</strong> to another user.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="target-user" className="text-right">
                                Target User
                            </Label>
                            <div className="col-span-3">
                                <Select value={targetUserId} onValueChange={setTargetUserId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a user" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {users
                                            .filter(u => u.id !== viewingUser?.id) // Don't copy to same user
                                            .map(u => (
                                                <SelectItem key={u.id} value={u.id}>
                                                    {u.username}
                                                </SelectItem>
                                            ))
                                        }
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={handleCopyClient} disabled={loading || !targetUserId}>
                            {loading ? 'Copying...' : 'Copy Client'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
