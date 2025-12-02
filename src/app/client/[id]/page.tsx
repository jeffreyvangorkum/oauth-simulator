import { getClient } from '@/lib/config';
import ClientView from '@/components/client-view';
import { notFound } from 'next/navigation';

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const client = await getClient(id);

    if (!client) {
        notFound();
    }

    const appUrl = process.env.APP_URL || 'http://localhost:3000';

    return <ClientView client={client} appUrl={appUrl} />;
}
