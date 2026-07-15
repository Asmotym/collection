export class ApiClient {
    private static readonly baseUrl = '/api';

    public static async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
        const headers = new Headers(options.headers);

        if (options.body && !headers.has('Content-Type')) {
            headers.set('Content-Type', 'application/json');
        }

        const response = await fetch(`${ApiClient.baseUrl}${endpoint}`, {
            method: options.method ?? 'GET',
            headers,
            body: options.body,
        });

        const responseData = await response.json();

        if (responseData.success) {
            return responseData.data as T;
        } else {
            throw new Error(responseData.error || 'Unknown error occurred');
        }
    }
}
