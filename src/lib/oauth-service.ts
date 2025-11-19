import { OAuthClient } from './config';
import { decodeJwt } from 'jose';

export interface TokenResponse {
    access_token: string;
    token_type: string;
    expires_in?: number;
    refresh_token?: string;
    id_token?: string;
    scope?: string;
    [key: string]: any;
}

export interface DecodedToken {
    header: any;
    payload: any;
    raw: string;
}

export function generateAuthorizeUrl(client: OAuthClient, state: string): string {
    const url = new URL(client.authorizeUrl);
    url.searchParams.append('response_type', 'code');
    url.searchParams.append('client_id', client.clientId);
    url.searchParams.append('redirect_uri', client.redirectUri);
    if (client.scope) {
        url.searchParams.append('scope', client.scope);
    }

    // Add custom attributes
    if (client.customAttributes) {
        Object.entries(client.customAttributes).forEach(([key, value]) => {
            url.searchParams.append(key, value);
        });
    }

    url.searchParams.append('state', state);
    return url.toString();
}

export async function exchangeCodeForToken(
    client: OAuthClient,
    code: string
): Promise<TokenResponse> {
    const body = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: client.redirectUri,
        client_id: client.clientId,
        client_secret: client.clientSecret,
    });

    const response = await fetch(client.tokenUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
        },
        body,
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Token exchange failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return response.json();
}

export async function clientCredentialsFlow(client: OAuthClient): Promise<TokenResponse> {
    const body = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: client.clientId,
        client_secret: client.clientSecret,
    });

    if (client.scope) {
        body.append('scope', client.scope);
    }

    const response = await fetch(client.tokenUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
        },
        body,
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Client credentials flow failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return response.json();
}

export function decodeToken(token: string): DecodedToken | null {
    try {
        const payload = decodeJwt(token);
        // jose.decodeJwt only returns payload. To get header we might need decodeProtectedHeader but that requires import.
        // For simple display, let's just try to parse the parts manually if we want header too, or use jose's other functions.
        // Actually, let's just use a simple manual decode for display to show header/payload/signature structure.
        const parts = token.split('.');
        if (parts.length !== 3) return null;

        const header = JSON.parse(atob(parts[0]));
        // payload is already decoded by jose or we can do it manually
        const payloadFromParts = JSON.parse(atob(parts[1]));

        return {
            header,
            payload: payloadFromParts,
            raw: token,
        };
    } catch (e) {
        return null;
    }
}
