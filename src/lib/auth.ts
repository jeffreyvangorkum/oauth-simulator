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

    if (user.disabled) {
        return { success: false, error: 'Account is disabled' };
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

import {
    generateRegistrationOptions,
    verifyRegistrationResponse,
    generateAuthenticationOptions,
    verifyAuthenticationResponse
} from '@simplewebauthn/server';
import {
    updateUserChallenge,
    getUserAuthenticators,
    saveAuthenticator,
    getAuthenticator,
    updateAuthenticatorCounter,
    getUser
} from './db';

const RP_NAME = process.env.RP_NAME || 'OAuth Simulator';
const RP_ID = process.env.RP_ID || 'localhost';
const ORIGIN = process.env.RP_ORIGIN || 'http://localhost:3000';

// WebAuthn Registration
export async function generateWebAuthnRegistrationOptions(userId: string) {
    const user = getUser(userId);
    if (!user) throw new Error('User not found');

    const userAuthenticators = getUserAuthenticators(userId);

    const options = await generateRegistrationOptions({
        rpName: RP_NAME,
        rpID: RP_ID,
        userID: Buffer.from(user.id),
        userName: user.username,
        attestationType: 'none',
        excludeCredentials: userAuthenticators.map(auth => ({
            id: auth.credentialID,
            type: 'public-key',
            transports: auth.transports ? JSON.parse(auth.transports) : undefined,
        })),
        authenticatorSelection: {
            residentKey: 'preferred',
            userVerification: 'preferred',
            authenticatorAttachment: 'platform',
        },
    });

    updateUserChallenge(user.id, options.challenge);
    return options;
}

export async function verifyWebAuthnRegistration(userId: string, response: any) {
    const user = getUser(userId);
    if (!user || !user.current_challenge) throw new Error('Invalid challenge');

    const verification = await verifyRegistrationResponse({
        response,
        expectedChallenge: user.current_challenge,
        expectedOrigin: ORIGIN,
        expectedRPID: RP_ID,
    });

    if (verification.verified && verification.registrationInfo) {
        const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;

        saveAuthenticator({
            credentialID: credential.id,
            credentialPublicKey: Buffer.from(credential.publicKey).toString('base64'),
            counter: credential.counter,
            credentialDeviceType,
            credentialBackedUp,
            user_id: userId,
            transports: response.response.transports ? JSON.stringify(response.response.transports) : undefined,
        });

        updateUserChallenge(user.id, null); // Clear challenge
        return { success: true };
    }

    return { success: false };
}

// WebAuthn Login
export async function generateWebAuthnLoginOptions(username: string) {
    const user = getUserByUsername(username);
    if (!user) throw new Error('User not found');

    const userAuthenticators = getUserAuthenticators(user.id);

    const options = await generateAuthenticationOptions({
        rpID: RP_ID,
        allowCredentials: userAuthenticators.map(auth => ({
            id: auth.credentialID,
            type: 'public-key',
        })),
        userVerification: 'preferred',
    });

    updateUserChallenge(user.id, options.challenge);
    return options;
}

export async function verifyWebAuthnLogin(username: string, response: any) {
    const user = getUserByUsername(username);
    if (!user || !user.current_challenge) throw new Error('Invalid challenge');

    const authenticator = getAuthenticator(response.id);
    if (!authenticator) throw new Error('Authenticator not found');

    const verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge: user.current_challenge,
        expectedOrigin: ORIGIN,
        expectedRPID: RP_ID,
        credential: {
            id: authenticator.credentialID,
            publicKey: Buffer.from(authenticator.credentialPublicKey, 'base64'),
            counter: authenticator.counter,
            transports: authenticator.transports ? JSON.parse(authenticator.transports) : undefined,
        },
    });

    if (verification.verified) {
        updateAuthenticatorCounter(authenticator.credentialID, verification.authenticationInfo.newCounter);
        updateUserChallenge(user.id, null);

        return createSession(user);
    }

    return { success: false, error: 'Verification failed' };
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

