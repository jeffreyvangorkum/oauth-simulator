import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import { getUserByUsername, createUser, User } from './db';
import bcrypt from 'bcryptjs';
import logger from './logger';

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
    logger.debug('Generating WebAuthn registration options for user:', userId);
    const user = getUser(userId);
    if (!user) {
        logger.error('WebAuthn registration failed - user not found:', userId);
        throw new Error('User not found');
    }

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
    logger.info('WebAuthn registration options generated for user:', user.username);
    return options;
}

export async function verifyWebAuthnRegistration(userId: string, response: any) {
    logger.debug('Verifying WebAuthn registration for user:', userId);
    const user = getUser(userId);
    if (!user || !user.current_challenge) {
        logger.error('WebAuthn registration verification failed - invalid challenge:', userId);
        throw new Error('Invalid challenge');
    }

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
        logger.info('WebAuthn registration successful for user:', user.username);
        return { success: true };
    }

    logger.warn('WebAuthn registration verification failed for user:', userId);
    return { success: false };
}

// WebAuthn Login
export async function generateWebAuthnLoginOptions(username: string) {
    logger.debug('Generating WebAuthn login options for user:', username);
    const user = getUserByUsername(username);
    if (!user) {
        logger.error('WebAuthn login options failed - user not found:', username);
        throw new Error('User not found');
    }

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
    logger.info('WebAuthn login options generated for user:', username);
    return options;
}

export async function verifyWebAuthnLogin(username: string, response: any) {
    logger.debug('Verifying WebAuthn login for user:', username);
    const user = getUserByUsername(username);
    if (!user || !user.current_challenge) {
        logger.error('WebAuthn login verification failed - invalid challenge:', username);
        throw new Error('Invalid challenge');
    }

    const authenticator = getAuthenticator(response.id);
    if (!authenticator) {
        logger.error('WebAuthn login verification failed - authenticator not found:', username);
        throw new Error('Authenticator not found');
    }

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
        logger.info('WebAuthn login successful for user:', username);

        return createSession(user);
    }

    logger.warn('WebAuthn login verification failed for user:', username);
    return { success: false, error: 'Verification failed' };
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

