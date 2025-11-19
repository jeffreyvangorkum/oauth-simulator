import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import { getUserByUsername, createUser, User } from './db';
import bcrypt from 'bcryptjs';

const SECRET_KEY = new TextEncoder().encode(process.env.JWT_SECRET || 'default-secret-key-change-me');
const AUTH_COOKIE_NAME = 'oauth_sim_session';

export async function getSession(): Promise<User | null> {
    const cookieStore = await cookies();
    const session = cookieStore.get(AUTH_COOKIE_NAME);
    if (!session) return null;

    try {
        const { payload } = await jwtVerify(session.value, SECRET_KEY);
        return payload as unknown as User;
    } catch (error) {
        return null;
    }
}

export async function isAuthenticated(): Promise<boolean> {
    const session = await getSession();
    return !!session;
}

export async function login(username: string, password: string): Promise<{ success: boolean; error?: string; mfaRequired?: boolean }> {
    const user = getUserByUsername(username);
    if (!user) {
        return { success: false, error: 'Invalid credentials' };
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
        return { success: false, error: 'Invalid credentials' };
    }

    if (user.totp_secret) {
        return { success: false, mfaRequired: true };
    }

    return createSession(user);
}

export async function loginWithMfa(username: string, token: string): Promise<{ success: boolean; error?: string }> {
    const user = getUserByUsername(username);
    if (!user || !user.totp_secret) {
        return { success: false, error: 'Invalid request' };
    }

    const isValid = await verifyTotp(user.totp_secret, token);
    if (!isValid) {
        return { success: false, error: 'Invalid MFA code' };
    }

    return createSession(user);
}

async function createSession(user: User) {
    // Create session
    const token = await new SignJWT({ ...user })
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime('24h')
        .sign(SECRET_KEY);

    const cookieStore = await cookies();
    cookieStore.set(AUTH_COOKIE_NAME, token, {
        httpOnly: true,
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
    });

    return { success: true };
}

export async function register(username: string, password: string): Promise<{ success: boolean; error?: string }> {
    const existing = getUserByUsername(username);
    if (existing) {
        return { success: false, error: 'Username already taken' };
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    createUser(username, hashedPassword);

    // Auto login after register
    return login(username, password);
}

export async function logout(): Promise<void> {
    const cookieStore = await cookies();
    cookieStore.delete(AUTH_COOKIE_NAME);
}

// MFA - TOTP
import { authenticator } from 'otplib';
import { updateUserTotpSecret } from './db';

export async function generateTotpSecret(username: string) {
    const secret = authenticator.generateSecret();
    const otpauth = authenticator.keyuri(username, 'OAuth Simulator', secret);
    return { secret, otpauth };
}

export async function verifyTotpAndEnable(userId: string, secret: string, token: string): Promise<boolean> {
    const isValid = authenticator.verify({ token, secret });
    if (isValid) {
        updateUserTotpSecret(userId, secret);
        return true;
    }
    return false;
}

export async function verifyTotp(secret: string, token: string): Promise<boolean> {
    return authenticator.verify({ token, secret });
}

