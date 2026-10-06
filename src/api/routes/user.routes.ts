import { ApiClient } from '../client.api';
import type { DiscordUser } from '../../../shared/types/discord.types';
import type { UserPreferences } from '../../../shared/types/database.types';

export async function updatePreferences(userId: string, preferences: UserPreferences) {
    return await ApiClient.request<DiscordUser>(`/users/${encodeURIComponent(userId)}/preferences`, {
        method: 'PATCH',
        body: JSON.stringify(preferences),
    });
}

export interface UserSettingsUpdate {
    customUsername?: string | null;
    collectionShared?: boolean;
}
export interface UserCollection {
    owner: { id: string; username: string; avatar: string | null };
    collection: import('../../../shared/types/database.types').DatabaseCollectionItem[];
    categories: import('../../../shared/types/database.types').DatabaseCategory[];
}
export function getSettings(userId: string) {
    return ApiClient.request<DiscordUser>(`/users/${encodeURIComponent(userId)}/settings`);
}
export function updateSettings(userId: string, settings: UserSettingsUpdate) {
    return ApiClient.request<DiscordUser>(`/users/${encodeURIComponent(userId)}/settings`, {
        method: 'PATCH', body: JSON.stringify(settings),
    });
}
export function getCollection(userId: string) {
    return ApiClient.request<UserCollection>(`/users/${encodeURIComponent(userId)}/collection`);
}
