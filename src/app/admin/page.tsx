import { adminGetUsersAction } from '@/app/actions';
import { AdminUserList } from '@/components/admin-user-list';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default async function AdminPage() {
    const session = await getSession();
    if (!session || session.username !== 'admin') {
        redirect('/');
    }

    const users = await adminGetUsersAction();

    return (
        <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 p-8">
            <div className="max-w-5xl mx-auto space-y-8">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" asChild>
                        <Link href="/">
                            <ArrowLeft className="h-4 w-4" />
                        </Link>
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
                        <p className="text-neutral-500 dark:text-neutral-400 mt-2">
                            Manage users and system settings.
                        </p>
                    </div>
                </div>

                <div className="bg-white dark:bg-neutral-900 rounded-lg shadow p-6">
                    <h2 className="text-xl font-semibold mb-4">Registered Users</h2>
                    <AdminUserList users={users} />
                </div>
            </div>
        </div>
    );
}
