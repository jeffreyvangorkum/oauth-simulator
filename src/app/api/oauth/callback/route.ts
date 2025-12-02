import { NextRequest, NextResponse } from 'next/server';
import { getClient } from '@/lib/config';
import { exchangeCodeForToken } from '@/lib/oauth-service';
import logger from '@/lib/logger';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    logger.debug('OAuth callback received', { hasCode: !!code, state, error });

    if (error) {
        logger.error('OAuth callback error:', { error, errorDescription });
        return NextResponse.json({ error, errorDescription }, { status: 400 });
    }

    if (!code || !state) {
        logger.warn('OAuth callback missing code or state');
        return NextResponse.json({ error: 'Missing code or state' }, { status: 400 });
    }

    // In this simple simulator, state is just the clientId
    const clientId = state;
    const client = await getClient(clientId);

    if (!client) {
        logger.error('OAuth callback - invalid client ID in state:', clientId);
        return NextResponse.json({ error: 'Invalid client ID in state' }, { status: 400 });
    }

    try {
        logger.info('Exchanging authorization code for tokens', { clientId });
        const tokens = await exchangeCodeForToken(client, code);
        logger.debug('Token exchange successful', { clientId, hasAccessToken: !!tokens.access_token });

        // Redirect back to the client page with tokens in query params
        // Note: In a real app, you wouldn't pass tokens in URL. This is a simulator for visualization.
        const baseUrl = process.env.APP_URL || request.url;
        // If APP_URL is just the origin (e.g. https://example.com), we need to ensure we construct the full path correctly.
        // new URL('/path', 'https://example.com') works.
        // new URL('/path', 'https://example.com/foo') works (resolves to https://example.com/path).

        const redirectUrl = new URL(`/client/${clientId}`, baseUrl);
        redirectUrl.searchParams.set('success', 'true');
        // Inject grant_type for visualization
        const tokensWithGrantType = { ...tokens, grant_type: 'authorization_code' };
        redirectUrl.searchParams.set('tokens', JSON.stringify(tokensWithGrantType));

        return NextResponse.redirect(redirectUrl);
    } catch (e: any) {
        logger.error('Token exchange failed:', { clientId, error: e.message });
        const baseUrl = process.env.APP_URL || request.url;
        const redirectUrl = new URL(`/client/${clientId}`, baseUrl);
        redirectUrl.searchParams.set('error', e.message || 'Token exchange failed');
        return NextResponse.redirect(redirectUrl);
    }
}
