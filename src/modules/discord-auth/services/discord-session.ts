import type { DiscordAuth } from '../../../../shared/types/discord.types';
import { getApiUrl } from '../utils/urls.utils';

export function readDiscordAuth(): DiscordAuth | null {
    try { return JSON.parse(localStorage.getItem('discord_auth') || 'null'); } catch { return null; }
}

export class InvalidDiscordSession extends Error {}

export async function exchangeDiscordToken(body: Record<string, string>): Promise<DiscordAuth> {
    const response = await fetch(getApiUrl('/discord/token'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    if (response.status === 401) throw new InvalidDiscordSession('Please sign in to Discord again');
    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(result.error || 'Discord token exchange failed');
    return result.data;
}

let refreshing: { token: string; promise: Promise<DiscordAuth | null> } | null = null;

export async function ensureDiscordAuth(force = false, failedToken?: string): Promise<DiscordAuth | null> {
    // Serialize refresh-token rotation across tabs as well as concurrent requests.
    if (navigator.locks) {
        return navigator.locks.request('discord-token-refresh', () => refreshDiscordAuth(force, failedToken));
    }
    return refreshDiscordAuth(force, failedToken);
}

async function refreshDiscordAuth(force = false, failedToken?: string): Promise<DiscordAuth | null> {
    const auth = readDiscordAuth();
    if (!auth?.accessToken) return null;
    if (failedToken && auth.accessToken !== failedToken) return auth;
    if (!force && (!auth.expiresAt || auth.expiresAt > Date.now() + 60000)) return auth;
    if (!auth.refreshToken) {
        localStorage.removeItem('discord_auth');
        localStorage.removeItem('discord_user');
        window.dispatchEvent(new Event('discord-session-expired'));
        throw new InvalidDiscordSession('Please sign in to Discord again');
    }
    if (refreshing?.token === auth.accessToken) return refreshing.promise;
    const promise = (async () => {
        try {
            const updated = await exchangeDiscordToken({ grantType: 'refresh_token', refreshToken: auth.refreshToken! });
            // Logout or another login must win over an in-flight refresh.
            if (readDiscordAuth()?.accessToken !== auth.accessToken) return readDiscordAuth();
            localStorage.setItem('discord_auth', JSON.stringify(updated));
            return updated;
        } catch (error) {
            if (error instanceof InvalidDiscordSession && readDiscordAuth()?.accessToken === auth.accessToken) {
                localStorage.removeItem('discord_auth');
                localStorage.removeItem('discord_user');
                window.dispatchEvent(new Event('discord-session-expired'));
            }
            throw error;
        } finally {
            if (refreshing?.token === auth.accessToken) refreshing = null;
        }
    })();
    refreshing = { token: auth.accessToken, promise };
    return promise;
}
