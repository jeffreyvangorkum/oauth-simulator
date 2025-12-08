import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getUser } from '@/lib/db';
import ProfilePage from './profile-client';

export default async function ProfilePageServer() {
    const session = await getSession();
    if (!session) {
        redirect('/login');
    }

    const user = getUser(session.id);
    if (!user) {
        redirect('/login');
    }

    return <ProfilePage user={{ username: user.username, email: user.email }} />;
}
