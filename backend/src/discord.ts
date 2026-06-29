import type { DiscordAuth, DiscordUser } from '../../shared/types/discord.types.js';

const DISCORD_API_URL = 'https://discord.com/api/v10';

export async function getDiscordUser(auth: DiscordAuth): Promise<DiscordUser> {
    const response = await fetch(`${DISCORD_API_URL}/users/@me`, {
        headers: {
            Authorization: `${auth.tokenType} ${auth.accessToken}`,
        },
    });

    if (!response.ok) {
        throw new Error('Failed to get user info');
    }

    const json = await response.json() as DiscordUser & { global_name?: string | null };

    return {
        id: json.id,
        username: json.global_name || json.username,
        avatar: json.avatar
            ? `https://cdn.discordapp.com/avatars/${json.id}/${json.avatar}.png?size=512`
            : '',
    };
}
