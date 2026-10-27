import { ensureDiscordAuth, exchangeDiscordToken, InvalidDiscordSession } from './discord-session';
import type { DiscordAuth, DiscordUser } from "../../../../shared/types/discord.types";
import { DEFAULT_USER_PREFERENCES, type UserPreferences } from "../../../../shared/types/database.types";
import { getApiUrl, getRedirectUri } from "modules/discord-auth/utils/urls.utils";
import { api } from "api/api";
import { ref, type Ref } from 'vue';

export class DiscordService {
    private static readonly DISCORD_CLIENT_ID = import.meta.env.VITE_DISCORD_CLIENT_ID;
    private static readonly DISCORD_API_URL = 'https://discord.com/api/v10';
    public user: Ref<DiscordUser | null> = ref(null);
    private static instance: DiscordService | null = null;

    public static getInstance(): DiscordService {
        if (!DiscordService.instance) {
            DiscordService.instance = new DiscordService();
        }
        return DiscordService.instance;
    }

    constructor() {
        window.addEventListener('discord-session-expired', () => {
            this.initialization = null;
            this.removeUser();
        });
    }

    private sessionVersion = 0;

    private initialization: Promise<DiscordUser | null> | null = null;

    public handleLogin(): Promise<DiscordUser | null> {
        if (!this.initialization) {
            this.initialization = this.initialize().catch(error => {
                this.initialization = null;
                throw error;
            });
        }
        return this.initialization;
    }

    private async initialize(): Promise<DiscordUser | null> {
        // Handle OAuth callback
        if (new URLSearchParams(window.location.search).has('code') || new URLSearchParams(window.location.search).has('error')) {
            await this.handleAuthCallback();
            return this.user.value;
        }

        const auth = this.getAuth();
        if (auth && auth.accessToken) {
            let current: DiscordAuth | null;
            try {
                current = await ensureDiscordAuth();
            } catch (error) {
                this.initialization = null;
                if (!(error instanceof InvalidDiscordSession)) throw error;
                this.removeAuth();
                this.removeUser();
                return null;
            }
            if (current) {
                try { await this.fetchUserInfo(current); }
                catch { this.removeAuth(); this.removeUser(); }
            }
        }

        return this.user.value;
    }

    public async login() {
        const state = this.generateRandomString(32)
        this.storeOauthState(state)

        const verifier = this.generateRandomString(64);
        sessionStorage.setItem('discord_code_verifier', verifier);
        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
        const challenge = btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        const params = new URLSearchParams({
            client_id: DiscordService.DISCORD_CLIENT_ID,
            redirect_uri: getRedirectUri(),
            response_type: 'code',
            code_challenge: challenge,
            code_challenge_method: 'S256',
            scope: 'identify email',
            state: state
        })

        window.location.href = `${DiscordService.DISCORD_API_URL}/oauth2/authorize?${params.toString()}`
    }

    public logout() {
        this.sessionVersion++;
        this.initialization = null;
        this.removeAuth();
        this.removeUser();
        this.removeOauthState();
        sessionStorage.removeItem('discord_code_verifier');
    }

    public async handleAuthCallback() {
        const version = this.sessionVersion;
        const params = new URLSearchParams(window.location.search);
        const savedState = this.getOauthState();
        const verifier = sessionStorage.getItem('discord_code_verifier');
        this.removeOauthState();
        sessionStorage.removeItem('discord_code_verifier');
        const cleanUrl = new URL(window.location.href);
        for (const key of ['code', 'state', 'error', 'error_description', 'iss']) cleanUrl.searchParams.delete(key);
        window.history.replaceState({}, document.title, cleanUrl.pathname + cleanUrl.search + cleanUrl.hash);
        if (!savedState || params.get('state') !== savedState || !verifier || !params.get('code') || params.has('error')) {
            throw new Error('[DiscordAuth] Invalid or denied OAuth callback');
        }
        const auth = await exchangeDiscordToken({ grantType: 'authorization_code', code: params.get('code')!, codeVerifier: verifier });
        if (version !== this.sessionVersion) return;
        this.storeAuth(auth);
        await this.fetchUserInfo(auth);
    }

    public async updatePreferences(preferences: Partial<UserPreferences>): Promise<DiscordUser> {
        const user = this.user.value;
        if (!user) {
            throw new Error('[DiscordAuth] Cannot update preferences while signed out');
        }

        const updatedUser = await api.user.updatePreferences(user.id, preferences);
        if (this.user.value?.id === user.id) this.storeUser(updatedUser);
        return updatedUser;
    }

    public async fetchUserInfo(auth: DiscordAuth): Promise<DiscordUser> {
        const userInfo = await fetch(getApiUrl('/discord'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ tokenType: auth.tokenType, accessToken: auth.accessToken, queryType: 'user' }),
        });
        const data = await userInfo.json();
        if (!data || !data.success) {
            throw new Error('[DiscordAuth] Failed to fetch user info');
        }

        if (this.getAuth()?.accessToken === auth.accessToken) this.storeUser(data.data);
        return data.data;
    }

    private generateRandomString(length: number): string {
        const bytes = crypto.getRandomValues(new Uint8Array(length));
        return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('').slice(0, length);
    }

    public storeUser(user: DiscordUser) {
        const normalizedUser: DiscordUser = {
            ...user,
            originalUsername: user.originalUsername ?? user.username,
            customUsername: user.customUsername ?? null,
            collectionShared: user.collectionShared ?? false,
            rights: user.rights ?? 'user',
            preferences: { ...DEFAULT_USER_PREFERENCES, ...user.preferences },
        };
        localStorage.setItem('discord_user', JSON.stringify(normalizedUser));
        this.user.value = normalizedUser;
    }

    protected storeAuth(auth: DiscordAuth) {
        localStorage.setItem('discord_auth', JSON.stringify(auth));
    }

    protected storeOauthState(state: string) {
        localStorage.setItem('discord_oauth_state', state);
    }

    protected removeUser() {
        localStorage.removeItem('discord_user');
        this.user.value = null;
    }

    protected removeAuth() {
        localStorage.removeItem('discord_auth');
    }

    protected removeOauthState() {
        localStorage.removeItem('discord_oauth_state');
    }

    public getUser(): DiscordUser | null {
        const user = localStorage.getItem('discord_user');
        const parsedUser = user ? JSON.parse(user) as DiscordUser : null;
        return parsedUser
            ? {
                ...parsedUser,
                rights: parsedUser.rights ?? 'user',
                preferences: { ...DEFAULT_USER_PREFERENCES, ...parsedUser.preferences },
            }
            : null;
    }

    public isLoggedIn(): boolean {
        return this.getUser() !== null;
    }

    public getAuth(): DiscordAuth | null {
        const auth = localStorage.getItem('discord_auth');
        try { return auth ? JSON.parse(auth) : null; } catch { return null; }
    }

    public getOauthState(): string | null {
        return localStorage.getItem('discord_oauth_state');
    }
}
