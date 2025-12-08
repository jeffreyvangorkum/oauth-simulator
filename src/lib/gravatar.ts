import crypto from 'crypto';

export function getGravatarUrl(email: string | null | undefined, size: number = 200): string {
    if (!email) {
        return `https://www.gravatar.com/avatar/?s=${size}&d=mp`;
    }

    const hash = crypto
        .createHash('md5')
        .update(email.toLowerCase().trim())
        .digest('hex');

    return `https://www.gravatar.com/avatar/${hash}?s=${size}&d=mp`;
}
