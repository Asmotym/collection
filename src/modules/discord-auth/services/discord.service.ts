import type { DiscordAuth, DiscordUser } from "netlify/core/types/discord.types";
import { getApiUrl, getRedirectUri } from "modules/discord-auth/utils/urls.utils";
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

    public async handleLogin(): Promise<DiscordUser | null> {
        const savedUser = this.getUser();
        if (savedUser !== null) {
            this.storeUser(savedUser);
        } else {
            const auth = this.getAuth();
            if (auth && auth.accessToken) {
                await this.fetchUserInfo(auth);
            }
        }
        
        // Handle OAuth callback
        if (window.location.hash.includes('token_type=')) {
            await this.handleAuthCallback();
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

        this.storeUser(data.data);
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

    protected storeUser(user: DiscordUser) {
        localStorage.setItem('discord_user', JSON.stringify(user));
        this.user.value = user;
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
        return user ? JSON.parse(user) : null;
    }

    public isLoggedIn(): boolean {
        return this.getUser() !== null;
    }

    public getAuth(): DiscordAuth | null {
        const auth = localStorage.getItem('discord_auth');
        return auth ? JSON.parse(auth) : null;
    }

    public getOauthState(): string | null {
        return localStorage.getItem('discord_oauth_state');
    }
}