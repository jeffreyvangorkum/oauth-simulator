import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import { getUserByUsername, getUserByEmail, createUser, User, updateUserChallenge, getUserAuthenticators, createAuthenticator, updateAuthenticatorCounter } from './db';
import bcrypt from 'bcryptjs';
import logger from './logger';
import {
    generateRegistrationOptions,
    verifyRegistrationResponse,
    generateAuthenticationOptions,
    verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import { isoUint8Array, isoBase64URL } from '@simplewebauthn/server/helpers';

const RP_NAME = 'OAuth Simulator';
const RP_ID = process.env.RP_ID || 'localhost';
const ORIGIN = process.env.APP_URL || `http://${RP_ID}:3000`;

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
    logger.debug('Login attempt for user:', username);
    const user = getUserByUsername(username);
    if (!user) {
        logger.warn('Login failed - user not found:', username);
        return { success: false, error: 'Invalid credentials' };
    }

    if (user.disabled) {
        logger.warn('Login failed - account disabled:', username);
        return { success: false, error: 'Account is disabled' };
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
        logger.warn('Login failed - invalid password:', username);
        return { success: false, error: 'Invalid credentials' };
    }

    if (user.totp_secret) {
        logger.debug('MFA required for user:', username);
        return { success: false, mfaRequired: true };
    }

    logger.info('Login successful for user:', username);
    return createSession(user);
}

export async function loginWithMfa(username: string, token: string): Promise<{ success: boolean; error?: string }> {
    logger.debug('MFA login attempt for user:', username);
    const user = getUserByUsername(username);
    if (!user || !user.totp_secret) {
        logger.warn('MFA login failed - invalid request:', username);
        return { success: false, error: 'Invalid request' };
    }

    const isValid = await verifyTotp(user.totp_secret, token);
    if (!isValid) {
        logger.warn('MFA login failed - invalid code:', username);
        return { success: false, error: 'Invalid MFA code' };
    }

    logger.info('MFA login successful for user:', username);
    return createSession(user);
}

export async function loginWithOidc(identifier: string): Promise<{ success: boolean; error?: string }> {
    logger.debug('OIDC login attempt for identifier:', identifier);
    // User requested that the claim maps to the username in the database
    let user = getUserByUsername(identifier);

    if (!user) {
        // Check if auto-provisioning is enabled
        const { getAuthSettings } = await import('./settings');
        const settings = getAuthSettings();

        if (!settings.enableOidcAutoProvision) {
            logger.warn('OIDC login failed - user not found and auto-provisioning disabled:', identifier);
            return { success: false, error: 'Account not found and registration is disabled' };
        }

        logger.info('OIDC login - user not found, creating new user for:', identifier);
        // Auto-provision user
        // Use identifier as username directly as requested
        const username = identifier;
        // Generate a random password since they will use OIDC
        const randomPassword = Math.random().toString(36).slice(-8);
        const hashedPassword = await bcrypt.hash(randomPassword, 10);

        // We don't have an email if the claim wasn't email, so we pass null or try to infer it if it looks like an email
        const email = identifier.includes('@') ? identifier : undefined;

        user = createUser(username, hashedPassword, email);
    }

    if (!user) {
        return { success: false, error: 'Failed to create user' };
    }

    if (user.disabled) {
        logger.warn('OIDC login failed - account disabled:', user.username);
        return { success: false, error: 'Account is disabled' };
    }

    logger.info('OIDC login successful for user:', user.username);
    return createSession(user);
}

async function createSession(user: User) {
    // Create session
    logger.debug('Creating session for user:', user.username);
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

    logger.info('Session created for user:', user.username);
    return { success: true };
}

export async function register(username: string, password: string): Promise<{ success: boolean; error?: string }> {
    logger.info('Registration attempt for username:', username);
    const existing = getUserByUsername(username);
    if (existing) {
        logger.warn('Registration failed - username already taken:', username);
        return { success: false, error: 'Username already taken' };
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    createUser(username, hashedPassword);
    logger.info('User registered successfully:', username);

    // Auto login after register
    return login(username, password);
}

export async function logout(): Promise<void> {
    const session = await getSession();
    if (session) {
        logger.info('User logged out:', session.username);
    }
    const cookieStore = await cookies();
    cookieStore.delete(AUTH_COOKIE_NAME);
}

// MFA - TOTP
import { authenticator } from 'otplib';
import { updateUserTotpSecret } from './db';

export async function generateTotpSecret(username: string) {
    logger.debug('Generating TOTP secret for user:', username);
    const secret = authenticator.generateSecret();
    const otpauth = authenticator.keyuri(username, 'OAuth Simulator', secret);
    logger.info('TOTP secret generated for user:', username);
    return { secret, otpauth };
}

export async function verifyTotpAndEnable(userId: string, secret: string, token: string): Promise<boolean> {
    logger.debug('Verifying and enabling TOTP for user:', userId);
    const isValid = authenticator.verify({ token, secret });
    if (isValid) {
        updateUserTotpSecret(userId, secret);
        logger.info('TOTP enabled successfully for user:', userId);
        return true;
    }
    logger.warn('TOTP verification failed for user:', userId);
    return false;
}

export async function verifyTotp(secret: string, token: string): Promise<boolean> {
    return authenticator.verify({ token, secret });
}

// WebAuthn - Passkeys
export async function getRegistrationOptions(user: User) {
    const userAuthenticators = getUserAuthenticators(user.id);

    const options = await generateRegistrationOptions({
        rpName: RP_NAME,
        rpID: RP_ID,
        userID: isoUint8Array.fromUTF8String(user.id),
        userName: user.username,
        attestationType: 'none',
        excludeCredentials: userAuthenticators.map((auth) => ({
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

export async function verifyRegistration(user: User, body: any) {
    const expectedChallenge = user.current_challenge;
    if (!expectedChallenge) {
        throw new Error('No challenge found for user');
    }

    const verification = await verifyRegistrationResponse({
        response: body,
        expectedChallenge,
        expectedOrigin: ORIGIN,
        expectedRPID: RP_ID,
    });

    if (verification.verified && verification.registrationInfo) {
        const { credential } = verification.registrationInfo as any;

        createAuthenticator({
            credentialID: isoBase64URL.fromBuffer(credential.id),
            credentialPublicKey: isoBase64URL.fromBuffer(credential.publicKey),
            counter: credential.counter,
            credentialDeviceType: (verification.registrationInfo as any).credentialDeviceType,
            credentialBackedUp: (verification.registrationInfo as any).credentialBackedUp ? 1 : 0,
            user_id: user.id,
            transports: JSON.stringify(body.response.transports || []),
        } as any);

        updateUserChallenge(user.id, null);
        return { success: true };
    }

    return { success: false };
}

export async function getAuthenticationOptions(username: string) {
    const user = getUserByUsername(username);
    if (!user) {
        throw new Error('User not found');
    }

    const userAuthenticators = getUserAuthenticators(user.id);

    const options = await generateAuthenticationOptions({
        rpID: RP_ID,
        allowCredentials: userAuthenticators.map((auth) => ({
            id: auth.credentialID,
            type: 'public-key',
            transports: auth.transports ? JSON.parse(auth.transports) : undefined,
        })),
        userVerification: 'preferred',
    });

    updateUserChallenge(user.id, options.challenge);
    return options;
}

export async function verifyAuthentication(username: string, body: any) {
    const user = getUserByUsername(username);
    if (!user) {
        throw new Error('User not found');
    }

    const expectedChallenge = user.current_challenge;
    if (!expectedChallenge) {
        throw new Error('No challenge found for user');
    }

    const userAuthenticators = getUserAuthenticators(user.id);
    const authenticator = userAuthenticators.find((auth) => auth.credentialID === body.id);

    if (!authenticator) {
        throw new Error('Authenticator not found');
    }

    const verification = await verifyAuthenticationResponse({
        response: body,
        expectedChallenge,
        expectedOrigin: ORIGIN,
        expectedRPID: RP_ID,
        credential: {
            id: authenticator.credentialID,
            publicKey: isoBase64URL.toBuffer(authenticator.credentialPublicKey),
            counter: authenticator.counter,
            transports: authenticator.transports ? JSON.parse(authenticator.transports) : undefined,
        },
    });

    if (verification.verified) {
        updateAuthenticatorCounter(authenticator.credentialID, verification.authenticationInfo.newCounter);
        updateUserChallenge(user.id, null);
        return createSession(user);
    }

    return { success: false };
}

