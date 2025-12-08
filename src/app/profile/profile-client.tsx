'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { updateProfileEmailAction, changePasswordAction } from '@/app/actions';
import { ArrowLeft, User as UserIcon } from 'lucide-react';
import Link from 'next/link';
import { getGravatarUrl } from '@/lib/gravatar';

interface ProfilePageProps {
    user: {
        username: string;
        email?: string | null;
    };
}

export default function ProfilePage({ user }: ProfilePageProps) {
    const [email, setEmail] = useState(user.email || '');
    const [emailMessage, setEmailMessage] = useState('');
    const [emailLoading, setEmailLoading] = useState(false);

    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordMessage, setPasswordMessage] = useState('');
    const [passwordLoading, setPasswordLoading] = useState(false);

    const [gravatarUrl, setGravatarUrl] = useState('');

    useEffect(() => {
        setGravatarUrl(getGravatarUrl(email, 200));
    }, [email]);

    const handleEmailUpdate = async () => {
        setEmailLoading(true);
        setEmailMessage('');

        const result = await updateProfileEmailAction(email);

        if (result.success) {
            setEmailMessage('Email updated successfully!');
        } else {
            setEmailMessage(result.error || 'Failed to update email');
        }

        setEmailLoading(false);
    };

    const handlePasswordChange = async () => {
        setPasswordLoading(true);
        setPasswordMessage('');

        // Validate passwords match
        if (newPassword !== confirmPassword) {
            setPasswordMessage('New passwords do not match');
            setPasswordLoading(false);
            return;
        }

        const result = await changePasswordAction(currentPassword, newPassword);

        if (result.success) {
            setPasswordMessage('Password changed successfully!');
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } else {
            setPasswordMessage(result.error || 'Failed to change password');
        }

        setPasswordLoading(false);
    };

    return (
        <div className="container mx-auto py-10">
            <div className="flex items-center gap-4 mb-6">
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/">
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                </Button>
                <h1 className="text-3xl font-bold">Profile</h1>
            </div>

            <div className="max-w-2xl space-y-6">
                {/* Profile Picture Section */}
                <Card>
                    <CardHeader>
                        <CardTitle>Profile Picture</CardTitle>
                        <CardDescription>
                            Your profile picture is provided by <a href="https://gravatar.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Gravatar</a> based on your email address.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col items-center space-y-4">
                        <div className="relative">
                            <img
                                src={gravatarUrl}
                                alt="Profile"
                                className="w-32 h-32 rounded-full border-4 border-neutral-200 dark:border-neutral-800"
                            />
                            <div className="absolute bottom-0 right-0 bg-neutral-100 dark:bg-neutral-900 rounded-full p-2 border-2 border-white dark:border-neutral-950">
                                <UserIcon className="h-4 w-4 text-neutral-600 dark:text-neutral-400" />
                            </div>
                        </div>
                        <div className="text-center">
                            <p className="font-semibold text-lg">{user.username}</p>
                            {email && <p className="text-sm text-muted-foreground">{email}</p>}
                        </div>
                    </CardContent>
                </Card>

                {/* Email Section */}
                <Card>
                    <CardHeader>
                        <CardTitle>Email Address</CardTitle>
                        <CardDescription>
                            Update your email address. This will be used for your Gravatar profile picture.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="your.email@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>
                        <Button onClick={handleEmailUpdate} disabled={emailLoading}>
                            {emailLoading ? 'Saving...' : 'Save Email'}
                        </Button>
                        {emailMessage && (
                            <p className={`text-sm ${emailMessage.includes('success') ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500'}`}>
                                {emailMessage}
                            </p>
                        )}
                    </CardContent>
                </Card>

                {/* Password Section */}
                <Card>
                    <CardHeader>
                        <CardTitle>Change Password</CardTitle>
                        <CardDescription>
                            Update your password. Password must be at least 8 characters.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="currentPassword">Current Password</Label>
                            <Input
                                id="currentPassword"
                                type="password"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="newPassword">New Password</Label>
                            <Input
                                id="newPassword"
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="confirmPassword">Confirm New Password</Label>
                            <Input
                                id="confirmPassword"
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                            />
                        </div>
                        <Button onClick={handlePasswordChange} disabled={passwordLoading}>
                            {passwordLoading ? 'Changing...' : 'Change Password'}
                        </Button>
                        {passwordMessage && (
                            <p className={`text-sm ${passwordMessage.includes('success') ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500'}`}>
                                {passwordMessage}
                            </p>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
