export class ApiClient {
    private static readonly baseUrl = '/api';

    public static async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
        const response = await fetch(`${ApiClient.baseUrl}${endpoint}`, {
            method: options.method ?? 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
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
