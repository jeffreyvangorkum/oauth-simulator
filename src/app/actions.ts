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
    try {
        const { getClient } = await import('@/lib/config');
        const { clientCredentialsFlow } = await import('@/lib/oauth-service');

        const client = await getClient(clientId);
        if (!client) return { success: false, error: 'Client not found' };

        const tokens = await clientCredentialsFlow(client);
        return { success: true, tokens };
    } catch (e: any) {
        console.error('Client Credentials Flow Error:', e);
        return { success: false, error: e.message || 'An unexpected error occurred' };
    }
}

export async function discoverOidcAction(url: string) {
    // Ensure we have a valid URL to start with
    let targetUrl = url;
    if (!targetUrl.startsWith('http')) {
        targetUrl = `https://${targetUrl}`;
    }

    // If it doesn't end with the config path, try appending it
    // Common pattern: issuer URL provided -> append /.well-known/openid-configuration
    if (!targetUrl.includes('/.well-known/openid-configuration')) {
        // Handle trailing slash
        const baseUrl = targetUrl.endsWith('/') ? targetUrl.slice(0, -1) : targetUrl;
        targetUrl = `${baseUrl}/.well-known/openid-configuration`;
    }

    try {
        const response = await fetch(targetUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch OIDC config: ${response.statusText}`);
        }
        const config = await response.json();

        return {
            authorization_endpoint: config.authorization_endpoint,
            token_endpoint: config.token_endpoint,
            issuer: config.issuer, // Optional but good to have
        };
    } catch (error: any) {
        console.error('OIDC Discovery failed:', error);
        throw new Error(error.message || 'Failed to discover OIDC configuration');
    }
}
