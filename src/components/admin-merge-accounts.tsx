'use client';

import { useState } from 'react';
import { mergeAccountsAction } from '@/app/actions';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
interface AdminUser {
    id: string;
    username: string;
    clientCount: number;
    disabled: boolean;
}

interface AdminMergeAccountsProps {
    users: AdminUser[];
}

export function AdminMergeAccounts({ users }: AdminMergeAccountsProps) {
    const [sourceUserId, setSourceUserId] = useState<string>('');
    const [targetUserId, setTargetUserId] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');

    const handleMerge = async () => {
        if (!sourceUserId || !targetUserId) {
            setMessage('Please select both source and target accounts.');
            return;
        }

        if (sourceUserId === targetUserId) {
            setMessage('Source and target accounts must be different.');
            return;
        }

        if (!confirm('Are you sure you want to merge these accounts? The source account will be DELETED and all its data moved to the target account. This action cannot be undone.')) {
            return;
        }

        setLoading(true);
        setMessage('');

        try {
            const result = await mergeAccountsAction(sourceUserId, targetUserId);
            if (result.success) {
                setMessage('Accounts merged successfully.');
                setSourceUserId('');
                setTargetUserId('');
            } else {
                setMessage('Failed to merge accounts: ' + result.error);
            }
        } catch (error) {
            setMessage('An error occurred.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>Source Account (will be deleted)</Label>
                    <Select value={sourceUserId} onValueChange={setSourceUserId}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select source user" />
                        </SelectTrigger>
                        <SelectContent>
                            {users.map((user) => (
                                <SelectItem key={user.id} value={user.id}>
                                    {user.username} ({user.clientCount} clients)
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label>Target Account (will receive data)</Label>
                    <Select value={targetUserId} onValueChange={setTargetUserId}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select target user" />
                        </SelectTrigger>
                        <SelectContent>
                            {users.filter(u => u.id !== sourceUserId).map((user) => (
                                <SelectItem key={user.id} value={user.id}>
                                    {user.username} ({user.clientCount} clients)
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="flex items-center gap-4">
                <Button onClick={handleMerge} disabled={loading || !sourceUserId || !targetUserId} variant="destructive">
                    {loading ? 'Merging...' : 'Merge Accounts'}
                </Button>
                {message && (
                    <p className={`text-sm ${message.includes('success') ? 'text-green-600' : 'text-red-600'}`}>
                        {message}
                    </p>
                )}
            </div>
        </div>
    );
}
