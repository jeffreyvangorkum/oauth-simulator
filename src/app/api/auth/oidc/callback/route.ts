import { exchangeCodeForTokens, verifyIdToken } from '@/lib/oidc';
import { loginWithOidc } from '@/lib/auth';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { NextRequest } from 'next/server';
import logger from '@/lib/logger';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
        logger.error('OIDC callback error:', error);
        redirect(`/login?error=${encodeURIComponent(error)}`);
    }

    if (!code || !state) {
        logger.error('OIDC callback missing code or state');
        redirect('/login?error=Invalid request');
    }

    const cookieStore = await cookies();
    const storedState = cookieStore.get('oidc_state')?.value;
    const storedNonce = cookieStore.get('oidc_nonce')?.value;

    if (!storedState || state !== storedState) {
        logger.error('OIDC callback invalid state');
        redirect('/login?error=Invalid state');
    }

    if (!storedNonce) {
        logger.error('OIDC callback missing nonce');
        redirect('/login?error=Invalid session');
    }

    try {
        // Exchange code for tokens
        const tokens = await exchangeCodeForTokens(code);

        // Verify ID token
        const payload = await verifyIdToken(tokens.id_token, storedNonce);

        const { getAuthSettings } = await import('@/lib/settings');
        const settings = getAuthSettings();
        const usernameClaim = settings.oidcUsernameClaim || 'email';
        const identifier = payload[usernameClaim];

        if (!identifier) {
            throw new Error(`ID token missing ${usernameClaim} claim`);
        }

        // Login user
        const result = await loginWithOidc(identifier as string);

        // Clear OIDC cookies
        cookieStore.delete('oidc_state');
        cookieStore.delete('oidc_nonce');

        if (result.success) {
            redirect('/');
        } else {
            redirect(`/login?error=${encodeURIComponent(result.error || 'Login failed')}`);
        }
    } catch (error: any) {
        logger.error('OIDC login failed:', error);
        redirect(`/login?error=${encodeURIComponent(error.message || 'Login failed')}`);
    }
}
