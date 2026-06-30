import type { DiscordAuth } from '../../shared/types/discord.types.js';

const DISCORD_API_URL = 'https://discord.com/api/v10';

interface DiscordProfile {
    id: string;
    username: string;
    avatar: string | null;
    global_name?: string | null;
}

export async function getDiscordUser(auth: DiscordAuth): Promise<DiscordProfile> {
    const response = await fetch(`${DISCORD_API_URL}/users/@me`, {
        headers: {
            Authorization: `${auth.tokenType} ${auth.accessToken}`,
        },
    });

    if (!response.ok) {
        throw new Error('Failed to get user info');
    }

    const json = await response.json() as DiscordProfile;

    return {
        id: json.id,
        username: json.global_name || json.username,
        avatar: json.avatar
            ? `https://cdn.discordapp.com/avatars/${json.id}/${json.avatar}.png?size=512`
            : '',
    };
}
