import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
    const authCookie = request.cookies.get('oauth_sim_session');
    const isAuthenticated = !!authCookie;
    const isLoginPage = request.nextUrl.pathname === '/login';
    const isRegisterPage = request.nextUrl.pathname === '/register';
    const isApiRoute = request.nextUrl.pathname.startsWith('/api');

    // Allow API routes (except maybe some administrative ones, but callback needs to be public)
    // Actually, callback needs to be public. Other APIs might need auth.
    // For simplicity, let's allow all /api/oauth routes, but protect others if any.
    if (request.nextUrl.pathname.startsWith('/api/oauth')) {
        return NextResponse.next();
    }

    if (!isAuthenticated && !isLoginPage && !isRegisterPage) {
        return NextResponse.redirect(new URL('/login', request.url));
    }

    if (isAuthenticated && (isLoginPage || isRegisterPage)) {
        return NextResponse.redirect(new URL('/', request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         */
        '/((?!_next/static|_next/image|favicon.ico).*)',
    ],
};
