import { generateAuthorizationUrl } from '@/lib/oidc';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import logger from '@/lib/logger';

export async function GET() {
    try {
        const state = uuidv4();
        const nonce = uuidv4();

        const url = await generateAuthorizationUrl(state, nonce);

        const cookieStore = await cookies();
        cookieStore.set('oidc_state', state, { httpOnly: true, secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 300 }); // 5 mins
        cookieStore.set('oidc_nonce', nonce, { httpOnly: true, secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 300 });

        redirect(url);
    } catch (error) {
        logger.error('Failed to initiate OIDC login:', error);
        return new Response('Internal Server Error', { status: 500 });
    }
}
