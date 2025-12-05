import { jwtVerify, createRemoteJWKSet } from 'jose';
import logger from './logger';

export interface OidcConfig {
    issuer: string;
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    authorizationEndpoint?: string;
    tokenEndpoint?: string;
    jwksUri?: string;
}

import { getAuthSettings } from './settings';

export function getOidcConfig(): OidcConfig {
    const settings = getAuthSettings();
    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const redirectUri = `${appUrl}/api/auth/oidc/callback`;

    if (!settings.oidcIssuer || !settings.oidcClientId || !settings.oidcClientSecret) {
        throw new Error('Missing OIDC configuration. Please configure it in the Admin Settings.');
    }

    return {
        issuer: settings.oidcIssuer,
        clientId: settings.oidcClientId,
        clientSecret: settings.oidcClientSecret,
        redirectUri,
    };
}

let discoveryCache: { [issuer: string]: any } = {};

export async function discoverOidcEndpoints(issuer: string) {
    if (discoveryCache[issuer]) {
        return discoveryCache[issuer];
    }

    let targetUrl = issuer;
    if (!targetUrl.endsWith('/.well-known/openid-configuration')) {
        targetUrl = targetUrl.replace(/\/$/, '') + '/.well-known/openid-configuration';
    }

    try {
        const response = await fetch(targetUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch OIDC config: ${response.statusText}`);
        }
        const config = await response.json();
        discoveryCache[issuer] = config;
        return config;
    } catch (error) {
        logger.error('OIDC Discovery failed:', error);
        throw error;
    }
}

export async function generateAuthorizationUrl(state: string, nonce: string) {
    const config = getOidcConfig();
    const endpoints = await discoverOidcEndpoints(config.issuer);

    const params = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: config.redirectUri,
        response_type: 'code',
        scope: 'openid email profile',
        state,
        nonce,
    });

    return `${endpoints.authorization_endpoint}?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string) {
    const config = getOidcConfig();
    const endpoints = await discoverOidcEndpoints(config.issuer);

    const params = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: config.redirectUri,
        client_id: config.clientId,
        client_secret: config.clientSecret,
    });

    const response = await fetch(endpoints.token_endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
    });

    if (!response.ok) {
        const error = await response.text();
        logger.error('Token exchange failed:', error);
        throw new Error('Failed to exchange code for tokens');
    }

    return response.json();
}

export async function verifyIdToken(idToken: string, nonce: string) {
    const config = getOidcConfig();
    const endpoints = await discoverOidcEndpoints(config.issuer);

    const JWKS = createRemoteJWKSet(new URL(endpoints.jwks_uri));

    const { payload } = await jwtVerify(idToken, JWKS, {
        issuer: config.issuer,
        audience: config.clientId,
    });

    if (payload.nonce !== nonce) {
        throw new Error('Invalid nonce');
    }

    return payload;
}
