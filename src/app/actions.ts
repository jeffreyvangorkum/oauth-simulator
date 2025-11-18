'use server';

import { login, logout } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { saveClient, deleteClient, OAuthClient } from '@/lib/config';
import { revalidatePath } from 'next/cache';
import { v4 as uuidv4 } from 'uuid';

export async function loginAction(prevState: any, formData: FormData) {
    const password = formData.get('password') as string;
    const success = await login(password);
    if (success) {
        redirect('/');
    }
    return { error: 'Invalid password' };
}

export async function logoutAction() {
    await logout();
    redirect('/login');
}

export async function saveClientAction(data: Omit<OAuthClient, 'id'> & { id?: string }) {
    const client: OAuthClient = {
        ...data,
        id: data.id || uuidv4(),
    };
    await saveClient(client);
    revalidatePath('/');
    return client;
}

export async function deleteClientAction(id: string) {
    await deleteClient(id);
    revalidatePath('/');
}

export async function executeClientCredentialsFlow(clientId: string) {
    const { getClient } = await import('@/lib/config');
    const { clientCredentialsFlow } = await import('@/lib/oauth-service');

    const client = await getClient(clientId);
    if (!client) throw new Error('Client not found');
    return await clientCredentialsFlow(client);
}
