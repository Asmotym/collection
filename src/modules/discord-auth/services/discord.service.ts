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

    private initialization: Promise<DiscordUser | null> | null = null;

    public handleLogin(): Promise<DiscordUser | null> {
        return this.initialization ??= this.initialize();
    }

    private async initialize(): Promise<DiscordUser | null> {
        // Handle OAuth callback
        if (window.location.hash.includes('token_type=')) {
            await this.handleAuthCallback();
            return this.user.value;
        }

        const auth = this.getAuth();
        if (auth && auth.accessToken) {
            try {
                await this.fetchUserInfo(auth);
            } catch (error) {
                this.removeAuth();
                this.removeUser();
            }
        }

        return this.user.value;
    }

    public login() {
        const state = this.generateRandomString(32)
        this.storeOauthState(state)

        const params = new URLSearchParams({
            client_id: DiscordService.DISCORD_CLIENT_ID,
            redirect_uri: getRedirectUri(),
            response_type: 'token',
            scope: 'identify email',
            state: state
        })

        window.location.href = `${DiscordService.DISCORD_API_URL}/oauth2/authorize?${params.toString()}`
    }

    public logout() {
        this.initialization = null;
        this.removeAuth();
        this.removeUser();
        this.removeOauthState();
    }

    public async handleAuthCallback() {
        const urlParams = new URLSearchParams(window.location.hash.slice(1));

        // retrieve url params from the discord redirect login
        const tokenType = urlParams.get('token_type') || '';
        const accessToken = urlParams.get('access_token') || '';
        const expiresIn = Number(urlParams.get('expires_in') || 0);
        const scope = urlParams.get('scope') || '';
        const state = urlParams.get('state') || '';
        const auth = {
            tokenType,
            accessToken,
            expiresIn,
            scope,
            state,
        }

        // retrieve saved state
        const savedState = this.getOauthState();

        if (auth.state === savedState) {
            // save auth to local storage
            this.storeAuth(auth);

            // clean up url
            window.history.replaceState({}, document.title, window.location.pathname);

            // retrieve user info
            await this.fetchUserInfo(auth);
        }
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
            body: JSON.stringify({ ...auth, queryType: 'user' }),
        });
        const data = await userInfo.json();
        if (!data || !data.success) {
            throw new Error('[DiscordAuth] Failed to fetch user info');
        }

        if (this.getAuth()?.accessToken === auth.accessToken) this.storeUser(data.data);
        return data.data;
    }

    private generateRandomString(length: number): string {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
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
