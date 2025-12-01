import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify, decodeJwt, importJWK } from 'jose';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    return handleRequest(request, 'GET');
}

export async function POST(request: NextRequest) {
    return handleRequest(request, 'POST');
}

async function handleRequest(request: NextRequest, method: string) {
    try {
        // Extract Authorization header
        const authHeader = request.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Missing or invalid Authorization header',
                    message: 'Expected: Authorization: Bearer <token>',
                },
                { status: 401 }
            );
        }

        const token = authHeader.substring(7); // Remove 'Bearer ' prefix

        // Decode token to get claims (without verification first)
        let decodedToken;
        try {
            decodedToken = decodeJwt(token);
        } catch (e) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Invalid JWT format',
                    message: 'Token could not be decoded',
                },
                { status: 401 }
            );
        }

        // Check expiration
        if (decodedToken.exp && decodedToken.exp < Date.now() / 1000) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Token expired',
                    message: `Token expired at ${new Date(decodedToken.exp * 1000).toISOString()}`,
                    tokenClaims: decodedToken,
                },
                { status: 401 }
            );
        }

        // Extract request payload
        let receivedPayload = null;
        if (method === 'POST') {
            try {
                receivedPayload = await request.json();
            } catch (e) {
                receivedPayload = { error: 'Could not parse JSON body' };
            }
        }

        // Extract query parameters for GET
        const queryParams: Record<string, string> = {};
        request.nextUrl.searchParams.forEach((value, key) => {
            queryParams[key] = value;
        });

        // Extract headers (excluding sensitive ones)
        const receivedHeaders: Record<string, string> = {};
        request.headers.forEach((value, key) => {
            if (!['authorization', 'cookie'].includes(key.toLowerCase())) {
                receivedHeaders[key] = value;
            }
        });

        // Attempt JWKS validation if issuer is present
        let signatureValidation = { validated: false, message: 'Signature validation skipped' };

        if (decodedToken.iss) {
            try {
                // Try to discover JWKS endpoint
                const issuer = decodedToken.iss as string;
                const wellKnownUrl = `${issuer.endsWith('/') ? issuer.slice(0, -1) : issuer}/.well-known/openid-configuration`;

                const discoveryResponse = await fetch(wellKnownUrl);
                if (discoveryResponse.ok) {
                    const discoveryData = await discoveryResponse.json();
                    const jwksUri = discoveryData.jwks_uri;

                    if (jwksUri) {
                        // Fetch JWKS
                        const jwksResponse = await fetch(jwksUri);
                        if (jwksResponse.ok) {
                            const jwks = await jwksResponse.json();

                            // Get kid from token header
                            const parts = token.split('.');
                            const header = JSON.parse(Buffer.from(parts[0], 'base64').toString());
                            const kid = header.kid;

                            // Find matching key
                            const key = jwks.keys.find((k: any) => k.kid === kid);
                            if (key) {
                                // Import and verify
                                const publicKey = await importJWK(key);
                                await jwtVerify(token, publicKey, {
                                    issuer: decodedToken.iss as string,
                                });
                                signatureValidation = { validated: true, message: 'Signature verified successfully' };
                            } else {
                                signatureValidation = { validated: false, message: 'No matching key found in JWKS' };
                            }
                        }
                    }
                }
            } catch (e: any) {
                signatureValidation = { validated: false, message: `Signature validation failed: ${e.message}` };
            }
        }

        // Return success response
        return NextResponse.json({
            success: true,
            message: 'Request received and token validated',
            timestamp: new Date().toISOString(),
            method,
            tokenClaims: decodedToken,
            signatureValidation,
            receivedPayload: method === 'POST' ? receivedPayload : undefined,
            queryParameters: method === 'GET' && Object.keys(queryParams).length > 0 ? queryParams : undefined,
            receivedHeaders,
        });

    } catch (e: any) {
        return NextResponse.json(
            {
                success: false,
                error: 'Internal server error',
                message: e.message,
            },
            { status: 500 }
        );
    }
}
