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
import { adminDeleteUserAction, adminResetPasswordAction, adminToggleStatusAction } from '@/app/actions';
import { Badge } from '@/components/ui/badge';

interface User {
    id: string;
    username: string;
    created_at: string;
    clientCount: number;
    disabled: boolean;
}

export function AdminUserList({ users }: { users: User[] }) {
    const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [newPassword, setNewPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleDelete = async (userId: string) => {
        if (confirm('Are you sure you want to delete this user? This action cannot be undone and will delete all their clients.')) {
            await adminDeleteUserAction(userId);
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
                                <TableCell>{new Date(user.created_at).toLocaleDateString()}</TableCell>
                                <TableCell>{user.clientCount}</TableCell>
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
        </>
    );
}
