import { ApiClient } from "../client.api";

export async function getAll() {
    return await ApiClient.request('collection', { action: 'getAll' });
}