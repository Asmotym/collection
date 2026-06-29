import cors from '@fastify/cors';
import Fastify from 'fastify';
import { checkDatabase, pool } from './db.js';
import { getDiscordUser } from './discord.js';
import type { DiscordAuth } from '../../shared/types/discord.types.js';

const app = Fastify({
    logger: true,
});

await app.register(cors, {
    origin: process.env.FRONTEND_URL || true,
    credentials: true,
});

app.get('/health', async (_request, reply) => {
    try {
        const database = await checkDatabase();
        return { service: 'ok', database: database ? 'ok' : 'error' };
    } catch (error) {
        reply.code(503);
        return {
            service: 'ok',
            database: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
});

app.get('/api/collection', async () => {
    const result = await pool.query(`
        SELECT
            c.id,
            art.id AS artist_id,
            art.name AS artist_name,
            alb.id AS album_id,
            alb.name AS album_name,
            alb.year AS album_year,
            alb.image AS album_image
        FROM collection c
        JOIN artist art ON c.artist_id = art.id
        JOIN album alb ON c.album_id = alb.id
        ORDER BY c.id
    `);

    return {
        success: true,
        data: result.rows,
        queryType: 'collection',
    };
});

app.post('/api/discord', async (request, reply) => {
    const body = request.body as DiscordAuth & { queryType?: string };
    const queryType = body.queryType || 'user';

    if (queryType !== 'user') {
        reply.code(400);
        return { error: `Unknown query type: ${queryType}` };
    }

    try {
        const discordUser = await getDiscordUser(body);

        await pool.query(
            `
                INSERT INTO users (discord_user_id, username, avatar)
                VALUES ($1, $2, $3)
                ON CONFLICT (discord_user_id)
                DO UPDATE SET
                    username = EXCLUDED.username,
                    avatar = EXCLUDED.avatar
            `,
            [discordUser.id, discordUser.username, discordUser.avatar],
        );

        return {
            success: true,
            data: discordUser,
            queryType,
        };
    } catch (error) {
        reply.code(400);
        return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
});

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '0.0.0.0';

try {
    await app.listen({ port, host });
} catch (error) {
    app.log.error(error);
    process.exit(1);
}
