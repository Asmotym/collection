import { createLogger } from "../utils/logger";
import type { DiscordAuth, DiscordUser } from '../types/discord.types'

const logger = createLogger('DiscordClient');

export class DiscordClient {
    protected baseUrl: string = "https://discord.com/api/v10";

    public async getUserInfo(auth: DiscordAuth): Promise<DiscordUser> {
        logger.info('Fetching user info from Discord API');
        const userResponse = await fetch(`${this.baseUrl}/users/@me`, {
            headers: {
                Authorization: `${auth.tokenType} ${auth.accessToken}`,
            },
        });

        if (!userResponse.ok) {
            const errorText = await userResponse.text();
            logger.error(`Discord API request failed: ${logger.errorValue(userResponse.status.toString())} - ${errorText}`);
            throw new Error('Failed to get user info');
        }

        const json = await userResponse.json() as DiscordUser & { global_name: string };
        const user: DiscordUser = {
            id: json.id,
            username: json.global_name,
            avatar: `https://cdn.discordapp.com/avatars/${json.id}/${json.avatar}.png?size=512`,
        };

        logger.success(`Successfully retrieved user: ${logger.highlight(user.username)}`);
        return user;
    }
}