import { cookies } from 'next/headers';

const APP_PASSWORD = process.env.APP_PASSWORD || 'admin'; // Default to 'admin' if not set
const AUTH_COOKIE_NAME = 'oauth_sim_auth';

export async function isAuthenticated(): Promise<boolean> {
    const cookieStore = await cookies();
    const authCookie = cookieStore.get(AUTH_COOKIE_NAME);
    return authCookie?.value === 'true';
}

export async function login(password: string): Promise<boolean> {
    if (password === APP_PASSWORD) {
        const cookieStore = await cookies();
        cookieStore.set(AUTH_COOKIE_NAME, 'true', { httpOnly: true, path: '/' });
        return true;
    }
    return false;
}

export async function logout(): Promise<void> {
    const cookieStore = await cookies();
    cookieStore.delete(AUTH_COOKIE_NAME);
}
