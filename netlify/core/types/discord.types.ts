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
    avatar: string;
}