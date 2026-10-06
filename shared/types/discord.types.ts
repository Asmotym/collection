import type { UserPreferences, UserRights } from './database.types.js';

export type DiscordAuth = {
    tokenType: string;
    accessToken: string;
    expiresIn: number;
    scope: string;
    state: string;
}

export interface DiscordUser {
    id: string;
    username: string;
    originalUsername: string;
    customUsername: string | null;
    collectionShared: boolean;
    avatar: string;
    rights: UserRights;
    preferences: UserPreferences;
}
