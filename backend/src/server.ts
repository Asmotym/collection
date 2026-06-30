import cors from '@fastify/cors';
import Fastify from 'fastify';
import { checkDatabase, pool } from './db.js';
import { getDiscordUser } from './discord.js';
import type { DiscordAuth } from '../../shared/types/discord.types.js';
import type {
    CreateAlbumPayload,
    CreateArtistPayload,
    CreateCollectionPayload,
    DatabaseAlbum,
    DatabaseArtist,
    DatabaseCollectionItem,
    DatabaseUser,
} from '../../shared/types/database.types.js';

const app = Fastify({
    logger: true,
});

await app.register(cors, {
    origin: process.env.FRONTEND_URL || true,
    credentials: true,
});

await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS rights TEXT NOT NULL DEFAULT 'user'
`);

await pool.query(`
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conname = 'users_rights_check'
        ) THEN
            ALTER TABLE users
            ADD CONSTRAINT users_rights_check CHECK (rights IN ('user', 'admin'));
        END IF;
    END
    $$;
`);

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

const collectionItemQuery = `
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
`;

app.get('/api/artists', async () => {
    const result = await pool.query<DatabaseArtist>(`
        SELECT id, name
        FROM artist
        ORDER BY name
    `);

    return {
        success: true,
        data: result.rows,
        queryType: 'artists',
    };
});

app.post('/api/artists', async (request, reply) => {
    const body = request.body as Partial<CreateArtistPayload>;
    const name = body.name?.trim();

    if (!name) {
        reply.code(400);
        return { error: 'Artist name is required' };
    }

    const result = await pool.query<DatabaseArtist>(
        `
            INSERT INTO artist (name)
            VALUES ($1)
            RETURNING id, name
        `,
        [name],
    );

    return {
        success: true,
        data: result.rows[0],
        queryType: 'artist',
    };
});

app.get('/api/albums', async () => {
    const result = await pool.query<DatabaseAlbum>(`
        SELECT id, name, year, image
        FROM album
        ORDER BY name
    `);

    return {
        success: true,
        data: result.rows,
        queryType: 'albums',
    };
});

app.post('/api/albums', async (request, reply) => {
    const body = request.body as Omit<Partial<CreateAlbumPayload>, 'year'> & { year?: unknown };
    const name = body.name?.trim();
    const year = body.year === undefined || body.year === null || body.year === '' ? null : Number(body.year);
    const image = body.image?.trim() || null;

    if (!name) {
        reply.code(400);
        return { error: 'Album name is required' };
    }

    if (year !== null && (!Number.isInteger(year) || year < 0)) {
        reply.code(400);
        return { error: 'Album year must be a positive integer' };
    }

    const result = await pool.query<DatabaseAlbum>(
        `
            INSERT INTO album (name, year, image)
            VALUES ($1, $2, $3)
            RETURNING id, name, year, image
        `,
        [name, year, image],
    );

    return {
        success: true,
        data: result.rows[0],
        queryType: 'album',
    };
});

app.get('/api/collection', async () => {
    const result = await pool.query<DatabaseCollectionItem>(`
        ${collectionItemQuery}
        ORDER BY c.id
    `);

    return {
        success: true,
        data: result.rows,
        queryType: 'collection',
    };
});

app.post('/api/collection', async (request, reply) => {
    const body = request.body as Partial<CreateCollectionPayload>;
    const artistId = Number(body.artist_id);
    const albumId = Number(body.album_id);

    if (!Number.isInteger(artistId) || !Number.isInteger(albumId)) {
        reply.code(400);
        return { error: 'Artist and album are required' };
    }

    const insertResult = await pool.query<{ id: number }>(
        `
            INSERT INTO collection (artist_id, album_id)
            VALUES ($1, $2)
            RETURNING id
        `,
        [artistId, albumId],
    );

    const result = await pool.query<DatabaseCollectionItem>(
        `
            ${collectionItemQuery}
            WHERE c.id = $1
        `,
        [insertResult.rows[0].id],
    );

    return {
        success: true,
        data: result.rows[0],
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

        const userResult = await pool.query<DatabaseUser>(
            `
                INSERT INTO users (discord_user_id, username, avatar)
                VALUES ($1, $2, $3)
                ON CONFLICT (discord_user_id)
                DO UPDATE SET
                    username = EXCLUDED.username,
                    avatar = EXCLUDED.avatar
                RETURNING discord_user_id, username, avatar, rights
            `,
            [discordUser.id, discordUser.username, discordUser.avatar],
        );
        const user = userResult.rows[0];

        return {
            success: true,
            data: {
                id: user.discord_user_id,
                username: user.username,
                avatar: user.avatar,
                rights: user.rights,
            },
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
