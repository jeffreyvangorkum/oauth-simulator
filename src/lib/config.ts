import { z } from 'zod';
import { getClientsByUserId, getClientById, createClient as dbCreateClient, updateClient as dbUpdateClient, deleteClient as dbDeleteClient, Client } from './db';
import { getSession } from './auth';

export const OAuthClientSchema = z.object({
    id: z.string().optional(),
    name: z.string(),
    clientId: z.string(),
    clientSecret: z.string(),
    authorizeUrl: z.string().url(),
    tokenUrl: z.string().url(),
    scope: z.string().optional(),
    redirectUri: z.string().url(),
    endSessionEndpoint: z.string().url().optional().or(z.literal('')),
    postLogoutRedirectUri: z.string().url().optional().or(z.literal('')),
    customAttributes: z.record(z.string(), z.string()).optional(),
    jwksUrl: z.string().url().optional().or(z.literal('')),
});

export type OAuthClient = z.infer<typeof OAuthClientSchema> & { id: string };

// Helper to map DB client to OAuthClient type
function mapClient(client: Client): OAuthClient {
    return {
        id: client.id,
        name: client.name,
        clientId: client.client_id,
        clientSecret: client.client_secret,
        authorizeUrl: client.authorize_url,
        tokenUrl: client.token_url,
        scope: client.scope,
        redirectUri: client.redirect_uri,
        endSessionEndpoint: client.end_session_endpoint,
        postLogoutRedirectUri: client.post_logout_redirect_uri,
        customAttributes: client.custom_attributes ? JSON.parse(client.custom_attributes) : undefined,
        jwksUrl: client.jwks_url,
    };
}

export async function getClients(): Promise<OAuthClient[]> {
    const session = await getSession();
    if (!session) return [];

    const clients = getClientsByUserId(session.id);
    return clients.map(mapClient);
}

export async function saveClient(clientData: OAuthClient): Promise<void> {
    const session = await getSession();
    if (!session) throw new Error('Unauthorized');

    const existing = getClientById(clientData.id);

    const dbClient = {
        id: clientData.id,
        user_id: session.id,
        name: clientData.name,
        client_id: clientData.clientId,
        client_secret: clientData.clientSecret,
        authorize_url: clientData.authorizeUrl,
        token_url: clientData.tokenUrl,
        scope: clientData.scope,
        redirect_uri: clientData.redirectUri,
        end_session_endpoint: clientData.endSessionEndpoint,
        post_logout_redirect_uri: clientData.postLogoutRedirectUri,
        custom_attributes: clientData.customAttributes ? JSON.stringify(clientData.customAttributes) : undefined,
        jwks_url: clientData.jwksUrl,
    };

    if (existing) {
        // Ensure ownership
        if (existing.user_id !== session.id) throw new Error('Unauthorized');
        dbUpdateClient(dbClient as Client);
    } else {
        dbCreateClient(dbClient);
    }
}

export async function deleteClient(id: string): Promise<void> {
    const session = await getSession();
    if (!session) throw new Error('Unauthorized');
    dbDeleteClient(id, session.id);
}

export async function getClient(id: string): Promise<OAuthClient | undefined> {
    // Note: This might need to verify ownership depending on context, 
    // but for viewing/editing it usually does.
    // For public execution (if any), we might need a separate method.
    const client = getClientById(id);
    if (!client) return undefined;

    // Optional: Check ownership if strictly scoped to user
    const session = await getSession();
    if (session && client.user_id !== session.id) return undefined;

    return mapClient(client);
}

export function isRegistrationEnabled(): boolean {
    return process.env.ENABLE_REGISTRATION !== 'false';
}
