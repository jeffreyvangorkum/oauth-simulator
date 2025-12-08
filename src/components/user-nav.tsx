'use client';

import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { logoutAction } from '@/app/actions';
import Link from 'next/link';
import { User } from 'lucide-react';

interface UserNavProps {
    user: { username: string } | null;
}

export function UserNav({ user }: UserNavProps) {
    if (!user) return null;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                    <User className="h-5 w-5" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1 px-2 py-1.5">
                        <p className="text-sm font-semibold leading-none text-foreground">{user.username}</p>
                        <p className="text-xs leading-none text-muted-foreground">Signed in</p>
                    </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {user.username === 'admin' && (
                    <>
                        <DropdownMenuItem asChild>
                            <Link href="/admin">Admin Dashboard</Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                    </>
                )}
                <DropdownMenuItem asChild>
                    <Link href="/settings">Settings</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => logoutAction()}>
                    Log out
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
