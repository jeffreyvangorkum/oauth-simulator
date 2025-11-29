'use server';

import { login, logout, register, loginWithMfa } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { saveClient, deleteClient, OAuthClient } from '@/lib/config';
import { revalidatePath } from 'next/cache';
import { v4 as uuidv4 } from 'uuid';

export async function loginAction(username: string, password: string) {
    const result = await login(username, password);
    if (result.success) {
        redirect('/');
    }

    if (result.mfaRequired) {
        return { success: true, mfaRequired: true, username };
    }

    return { success: false, error: result.error || 'Invalid credentials' };
}

export async function loginWithMfaAction(username: string, token: string) {
    const result = await loginWithMfa(username, token);
    if (result.success) {
        redirect('/');
    }
    return { success: false, error: result.error || 'Invalid MFA code' };
}

export async function registerAction(prevState: any, formData: FormData) {
    const { isRegistrationEnabled } = await import('@/lib/config');
    if (!isRegistrationEnabled()) {
        return { error: 'Registration is currently disabled' };
    }

    const username = formData.get('username') as string;
    const password = formData.get('password') as string;
    const confirmPassword = formData.get('confirmPassword') as string;

    if (password !== confirmPassword) {
        return { error: 'Passwords do not match' };
    }

    const result = await register(username, password);
    if (result.success) {
        redirect('/');
    }
    return { error: result.error || 'Registration failed' };
}

export async function logoutAction() {
    await logout();
    redirect('/login');
}

// MFA Actions
import { generateTotpSecret, verifyTotpAndEnable, getSession } from '@/lib/auth';

export async function generateTotpSecretAction() {
    const session = await getSession();
    if (!session) throw new Error('Unauthorized');

    const { secret, otpauth } = await generateTotpSecret(session.username);
    return { secret, otpauth };
}

export async function verifyTotpAction(secret: string, token: string) {
    const session = await getSession();
    if (!session) throw new Error('Unauthorized');

    const success = await verifyTotpAndEnable(session.id, secret, token);
    return { success };
}

// WebAuthn Actions
import {
    generateWebAuthnRegistrationOptions,
    verifyWebAuthnRegistration,
    generateWebAuthnLoginOptions,
    verifyWebAuthnLogin
} from '@/lib/auth';

export async function generateWebAuthnRegistrationOptionsAction() {
    const session = await getSession();
    if (!session) throw new Error('Unauthorized');
    return generateWebAuthnRegistrationOptions(session.id);
}

export async function verifyWebAuthnRegistrationAction(response: any) {
    const session = await getSession();
    if (!session) throw new Error('Unauthorized');
    return verifyWebAuthnRegistration(session.id, response);
}

export async function generateWebAuthnLoginOptionsAction(username: string) {
    return generateWebAuthnLoginOptions(username);
}

export async function verifyWebAuthnLoginAction(username: string, response: any) {
    const result = await verifyWebAuthnLogin(username, response);
    if (result.success) {
        redirect('/');
    }
    return result;
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

export async function executeRefreshTokenFlow(clientId: string, refreshToken: string) {
    try {
        const { getClient } = await import('@/lib/config');
        const { refreshTokenFlow } = await import('@/lib/oauth-service');

        const client = await getClient(clientId);
        if (!client) return { success: false, error: 'Client not found' };

        const tokens = await refreshTokenFlow(client, refreshToken);
        // Inject grant_type for visualization
        const tokensWithGrantType = { ...tokens, grant_type: 'refresh_token' };
        return { success: true, tokens: tokensWithGrantType };
    } catch (e: any) {
        console.error('Refresh Token Flow Error:', e);
        return { success: false, error: e.message || 'An unexpected error occurred' };
    }
}

export async function executeClientCredentialsFlow(clientId: string) {
    try {
        const { getClient } = await import('@/lib/config');
        const { clientCredentialsFlow } = await import('@/lib/oauth-service');

        const client = await getClient(clientId);
        if (!client) return { success: false, error: 'Client not found' };

        const tokens = await clientCredentialsFlow(client);
        // Inject grant_type for visualization
        const tokensWithGrantType = { ...tokens, grant_type: 'client_credentials' };
        return { success: true, tokens: tokensWithGrantType };
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
            end_session_endpoint: config.end_session_endpoint,
            issuer: config.issuer, // Optional but good to have
        };
    } catch (error: any) {
        console.error('OIDC Discovery failed:', error);
        throw new Error(error.message || 'Failed to discover OIDC configuration');
    }
}

// Admin Actions
import { getAllUsers, deleteUser, updateUserPassword, updateUserStatus } from '@/lib/db';
import bcrypt from 'bcryptjs';

async function requireAdmin() {
    const session = await getSession();
    if (!session || session.username !== 'admin') {
        throw new Error('Unauthorized');
    }
    return session;
}

export async function adminGetUsersAction() {
    try {
        await requireAdmin();
        const users = getAllUsers();
        // Don't return sensitive data like password_hash or secrets
        return users.map(u => ({
            id: u.id,
            username: u.username,
            created_at: u.created_at,
            clientCount: u.clientCount,
            disabled: u.disabled
        }));
    } catch (e) {
        return [];
    }
}

export async function adminDeleteUserAction(userId: string) {
    try {
        const session = await requireAdmin();
        if (userId === session.id) {
            return { success: false, error: 'Cannot delete yourself' };
        }
        deleteUser(userId);
        revalidatePath('/admin');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function adminResetPasswordAction(userId: string, newPassword: string) {
    try {
        await requireAdmin();
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        updateUserPassword(userId, hashedPassword);
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function adminToggleStatusAction(userId: string, disabled: boolean) {
    try {
        const session = await requireAdmin();
        if (userId === session.id) {
            return { success: false, error: 'Cannot disable yourself' };
        }
        updateUserStatus(userId, disabled);
        revalidatePath('/admin');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}
