import { ApiClient } from '../client.api';
import type { DiscordUser } from '../../../shared/types/discord.types';
import type { UserPreferences } from '../../../shared/types/database.types';

export async function updatePreferences(userId: string, preferences: UserPreferences) {
    return await ApiClient.request<DiscordUser>(`/users/${encodeURIComponent(userId)}/preferences`, {
        method: 'PATCH',
        body: JSON.stringify(preferences),
    });
}
