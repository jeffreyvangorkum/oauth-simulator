import { getSystemSetting, setSystemSetting } from './db';

export interface AuthSettings {
    enablePasswordLogin: boolean;
    enableOidcLogin: boolean;
    enableOidcAutoProvision: boolean;
    oidcUsernameClaim: string;
    oidcIssuer?: string;
    oidcClientId?: string;
    oidcClientSecret?: string;
}

export function getAuthSettings(): AuthSettings {
    const enablePasswordLogin = getSystemSetting('enable_password_login') !== 'false'; // Default true
    const enableOidcLogin = getSystemSetting('enable_oidc_login') === 'true'; // Default false
    const enableOidcAutoProvision = getSystemSetting('enable_oidc_auto_provision') !== 'false'; // Default true
    const oidcUsernameClaim = getSystemSetting('oidc_username_claim') || 'email';
    const oidcIssuer = getSystemSetting('oidc_issuer') || undefined;
    const oidcClientId = getSystemSetting('oidc_client_id') || undefined;
    const oidcClientSecret = getSystemSetting('oidc_client_secret') || undefined;

    return {
        enablePasswordLogin,
        enableOidcLogin,
        enableOidcAutoProvision,
        oidcUsernameClaim,
        oidcIssuer,
        oidcClientId,
        oidcClientSecret,
    };
}

export function updateAuthSettings(settings: Partial<AuthSettings>) {
    if (settings.enablePasswordLogin !== undefined) {
        setSystemSetting('enable_password_login', String(settings.enablePasswordLogin));
    }
    if (settings.enableOidcLogin !== undefined) {
        setSystemSetting('enable_oidc_login', String(settings.enableOidcLogin));
    }
    if (settings.enableOidcAutoProvision !== undefined) {
        setSystemSetting('enable_oidc_auto_provision', String(settings.enableOidcAutoProvision));
    }
    if (settings.oidcUsernameClaim !== undefined) {
        setSystemSetting('oidc_username_claim', settings.oidcUsernameClaim);
    }
    if (settings.oidcIssuer !== undefined) {
        setSystemSetting('oidc_issuer', settings.oidcIssuer);
    }
    if (settings.oidcClientId !== undefined) {
        setSystemSetting('oidc_client_id', settings.oidcClientId);
    }
    if (settings.oidcClientSecret !== undefined) {
        setSystemSetting('oidc_client_secret', settings.oidcClientSecret);
    }
}
