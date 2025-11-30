import { createRemoteJWKSet, jwtVerify } from 'jose';

export interface ValidationResult {
    isValid: boolean;
    kid?: string;
    alg?: string;
    publicKey?: any; // The key object from JWKS
    error?: string;
}

export async function validateTokenSignature(token: string, jwksUrl: string): Promise<ValidationResult> {
    try {
        const JWKS = createRemoteJWKSet(new URL(jwksUrl));

        const { protectedHeader, key } = await jwtVerify(token, JWKS);

        return {
            isValid: true,
            kid: protectedHeader.kid,
            alg: protectedHeader.alg,
            publicKey: key,
        };
    } catch (error: any) {
        console.error('Token validation failed:', error);
        return {
            isValid: false,
            error: error.message || 'Validation failed',
        };
    }
}
