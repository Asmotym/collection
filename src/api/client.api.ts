import { ensureDiscordAuth } from '../modules/discord-auth/services/discord-session';

export class ApiClient {
    private static readonly baseUrl = '/api';

    public static async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
        const headers = new Headers(options.headers);
        const auth = await ensureDiscordAuth();
        if (auth?.accessToken) headers.set('Authorization', `Bearer ${auth.accessToken}`);

        if (options.body && !headers.has('Content-Type')) {
            headers.set('Content-Type', 'application/json');
        }

        let response = await fetch(`${ApiClient.baseUrl}${endpoint}`, {
            method: options.method ?? 'GET',
            headers,
            body: options.body,
        });

        if (response.status === 401 && auth?.accessToken) {
            const updated = await ensureDiscordAuth(true, auth.accessToken);
            if (updated) {
                headers.set('Authorization', `Bearer ${updated.accessToken}`);
                response = await fetch(`${ApiClient.baseUrl}${endpoint}`, {
                    method: options.method ?? 'GET', headers, body: options.body,
                });
            }
        }

        const responseData = await response.json();

        if (responseData.success) {
            return responseData.data as T;
        } else {
            throw new Error(responseData.error || 'Unknown error occurred');
        }
    }
}
