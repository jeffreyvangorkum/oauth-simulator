'use server';

import { login, logout, register, loginWithMfa } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { saveClient, deleteClient, OAuthClient } from '@/lib/config';
import { revalidatePath } from 'next/cache';
import { v4 as uuidv4 } from 'uuid';
import logger from '@/lib/logger';

export async function loginAction(username: string, password: string) {
    const { getAuthSettings } = await import('@/lib/settings');
    const settings = getAuthSettings();

    if (!settings.enablePasswordLogin) {
        return { success: false, error: 'Password login is disabled' };
    }

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

export async function exportClientsAction(includeSecrets: boolean = true) {
    const { getClients } = await import('@/lib/config');
    const clients = await getClients();

    // Convert to legacy format
    const legacyClients = clients.map(client => ({
        id: client.id,
        name: client.name,
        clientId: client.clientId,
        clientSecret: includeSecrets ? client.clientSecret : '',
        authorizeUrl: client.authorizeUrl,
        tokenUrl: client.tokenUrl,
        scope: client.scope,
        redirectUri: client.redirectUri,
        endSessionEndpoint: client.endSessionEndpoint,
        postLogoutRedirectUri: client.postLogoutRedirectUri,
        customAttributes: client.customAttributes,
        jwksUrl: client.jwksUrl,
    }));

    return legacyClients;
}

export async function importClientsAction(clients: any[]) {
    const { saveClient } = await import('@/lib/config');
    const { getSession } = await import('@/lib/auth');

    const session = await getSession();
    if (!session) throw new Error('Unauthorized');

    // Import each client
    for (const clientData of clients) {
        const client = {
            id: clientData.id || uuidv4(),
            name: clientData.name,
            clientId: clientData.clientId,
            clientSecret: clientData.clientSecret,
            authorizeUrl: clientData.authorizeUrl,
            tokenUrl: clientData.tokenUrl,
            scope: clientData.scope,
            redirectUri: clientData.redirectUri,
            endSessionEndpoint: clientData.endSessionEndpoint,
            postLogoutRedirectUri: clientData.postLogoutRedirectUri,
            customAttributes: clientData.customAttributes,
            jwksUrl: clientData.jwksUrl,
        };

        await saveClient(client);
    }

    revalidatePath('/');
    return { success: true, count: clients.length };
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
        logger.error('Refresh Token Flow Error:', e);
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
        logger.error('Client Credentials Flow Error:', e);
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
            jwks_uri: config.jwks_uri,
            issuer: config.issuer, // Optional but good to have
        };
    } catch (error: any) {
        logger.error('OIDC Discovery failed:', error);
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

export async function adminGetClientsForUserAction(userId: string) {
    try {
        await requireAdmin();
        const { getClientsByUserId } = await import('@/lib/db');
        const clients = getClientsByUserId(userId);
        return clients.map(c => ({
            id: c.id,
            name: c.name,
            clientId: c.client_id,
            redirectUri: c.redirect_uri,
            created_at: c.created_at
        }));
    } catch (e: any) {
        logger.error('Failed to get clients:', e);
        return [];
    }
}

export async function adminDeleteClientAction(clientId: string) {
    try {
        await requireAdmin();
        const { adminDeleteClient } = await import('@/lib/db');
        adminDeleteClient(clientId);
        revalidatePath('/admin');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function adminCopyClientAction(clientId: string, targetUserId: string) {
    try {
        await requireAdmin();
        const { getClientById, createClient } = await import('@/lib/db');

        const sourceClient = getClientById(clientId);
        if (!sourceClient) throw new Error('Client not found');

        const newClient = {
            ...sourceClient,
            id: uuidv4(),
            user_id: targetUserId,
            name: `${sourceClient.name} (Copy)`,
            // Keep other fields same
        };

        // Remove created_at to let DB set it
        const { created_at, ...clientData } = newClient;

        createClient(clientData);
        revalidatePath('/admin');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function executeHttpRequestAction({
    method,
    url,
    token,
    headers = {},
    body,
}: {
    method: 'GET' | 'POST';
    url: string;
    token: string;
    headers?: Record<string, string>;
    body?: any;
}) {
    try {
        // Validate URL
        const parsedUrl = new URL(url);

        // Prepare headers
        const requestHeaders: Record<string, string> = {
            'Authorization': `Bearer ${token}`,
            ...headers,
        };

        // Add Content-Type for POST requests with body
        if (method === 'POST' && body) {
            requestHeaders['Content-Type'] = 'application/json';
        }

        logger.info('Making HTTP request:', { method, url, headers: requestHeaders, body });

        // Check if this is an internal request to /api/endpoint
        // Always call the handler directly to avoid network/routing issues
        if (parsedUrl.pathname === '/api/endpoint') {
            logger.debug('Internal API request detected, calling handler directly');

            // Import the route handler
            const { GET, POST: POST_HANDLER } = await import('@/app/api/endpoint/route');

            // Create a mock NextRequest with nextUrl property
            const mockRequest = new Request(url, {
                method,
                headers: new Headers(requestHeaders),
                body: method === 'POST' && body ? JSON.stringify(body) : undefined,
            }) as any;

            // Add nextUrl property that NextRequest expects
            mockRequest.nextUrl = parsedUrl;

            // Call the appropriate handler
            const response = method === 'GET'
                ? await GET(mockRequest)
                : await POST_HANDLER(mockRequest);

            // Extract response data
            const responseHeaders: Record<string, string> = {};
            response.headers.forEach((value, key) => {
                responseHeaders[key] = value;
            });

            const responseBody = await response.text();

            return {
                success: true,
                response: {
                    status: response.status,
                    statusText: response.statusText,
                    headers: responseHeaders,
                    body: responseBody,
                },
            };
        }

        // For external requests, use fetch
        const response = await fetch(url, {
            method,
            headers: requestHeaders,
            body: method === 'POST' && body ? JSON.stringify(body) : undefined,
        });

        logger.debug('Response status:', response.status, response.statusText);
        logger.debug('Response headers:', Object.fromEntries(response.headers.entries()));

        // Extract response headers
        const responseHeaders: Record<string, string> = {};
        response.headers.forEach((value, key) => {
            responseHeaders[key] = value;
        });

        // Get response body
        const responseBody = await response.text();
        logger.debug('Response body preview:', responseBody.substring(0, 200));

        return {
            success: true,
            response: {
                status: response.status,
                statusText: response.statusText,
                headers: responseHeaders,
                body: responseBody,
            },
        };
    } catch (e: any) {
        logger.error('HTTP Request Error:', e);
        return {
            success: false,
            error: e.message || 'Request failed',
        };
    }
}



// System Settings Actions
import { getAuthSettings, updateAuthSettings, AuthSettings } from '@/lib/settings';

export async function getAuthSettingsAction() {
    return getAuthSettings();
}

export async function updateSystemSettingsAction(settings: Partial<AuthSettings>) {
    try {
        await requireAdmin();

        // Fetch current settings to merge with updates
        const currentSettings = getAuthSettings();
        const newSettings = { ...currentSettings, ...settings };

        if (!newSettings.enablePasswordLogin && !newSettings.enableOidcLogin) {
            return { success: false, error: 'At least one login method must be enabled' };
        }

        updateAuthSettings(settings);
        revalidatePath('/');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function mergeAccountsAction(sourceUserId: string, targetUserId: string) {
    try {
        await requireAdmin();
        const { mergeUsers } = await import('@/lib/db');

        if (sourceUserId === targetUserId) {
            return { success: false, error: 'Cannot merge an account into itself' };
        }

        mergeUsers(sourceUserId, targetUserId);
        revalidatePath('/admin');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function discoverOidcConfigurationAction(url: string) {
    try {
        await requireAdmin();
        const { discoverOidcEndpoints } = await import('@/lib/oidc');
        const config = await discoverOidcEndpoints(url);
        return { success: true, config };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

// Profile Management Actions
import { updateUserEmail, getUser } from '@/lib/db';

export async function updateProfileEmailAction(email: string) {
    try {
        const session = await getSession();
        if (!session) throw new Error('Unauthorized');

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (email && !emailRegex.test(email)) {
            return { success: false, error: 'Invalid email format' };
        }

        updateUserEmail(session.id, email || null);
        revalidatePath('/profile');
        return { success: true };
    } catch (e: any) {
        if (e.message?.includes('UNIQUE')) {
            return { success: false, error: 'Email already in use' };
        }
        return { success: false, error: e.message };
    }
}

export async function changePasswordAction(currentPassword: string, newPassword: string) {
    try {
        const session = await getSession();
        if (!session) throw new Error('Unauthorized');

        // Validate password length
        if (newPassword.length < 8) {
            return { success: false, error: 'Password must be at least 8 characters' };
        }

        // Get user and verify current password
        const user = getUser(session.id);
        if (!user) throw new Error('User not found');

        const isValid = await bcrypt.compare(currentPassword, user.password_hash);
        if (!isValid) {
            return { success: false, error: 'Current password is incorrect' };
        }

        // Hash and update new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        updateUserPassword(session.id, hashedPassword);

        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}
