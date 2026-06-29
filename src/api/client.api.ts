export class ApiClient {
    private static readonly baseUrl = '/api';

    public static async request<T>(endpoint: string): Promise<T> {
        const response = await fetch(`${ApiClient.baseUrl}${endpoint}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        const responseData = await response.json();

        if (responseData.success) {
            return responseData.data as T;
        } else {
            throw new Error(responseData.error || 'Unknown error occurred');
        }
    }
}
