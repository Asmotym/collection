import cors from '@fastify/cors';
import Fastify from 'fastify';
import { checkDatabase, pool } from './db.js';
import { getDiscordUser } from './discord.js';
import type { DiscordAuth } from '../../shared/types/discord.types.js';
import type {
    CreateAlbumPayload,
    CreateArtistPayload,
    CreateCollectionPayload,
    CollectionMetadata,
    DatabaseAlbum,
    DatabaseArtist,
    DatabaseCollectionItem,
    DatabaseUser,
    UpdateAlbumPayload,
    UpdateArtistPayload,
    UpdateCollectionPayload,
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
    ALTER TABLE collection
    ADD COLUMN IF NOT EXISTS created_by_user_id TEXT REFERENCES users(discord_user_id) ON DELETE SET NULL
`);

await pool.query(`
    ALTER TABLE artist
    ADD COLUMN IF NOT EXISTS image TEXT
`);

await pool.query(`
    ALTER TABLE collection
    ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '[]'::jsonb
`);

await pool.query(`
    ALTER TABLE album
    ADD COLUMN IF NOT EXISTS artist_id INTEGER REFERENCES artist(id) ON DELETE CASCADE
`);

await pool.query(`
    UPDATE album alb
    SET artist_id = collection_artist.artist_id
    FROM (
        SELECT DISTINCT ON (album_id) album_id, artist_id
        FROM collection
        ORDER BY album_id, id
    ) collection_artist
    WHERE alb.id = collection_artist.album_id
        AND alb.artist_id IS NULL
`);

await pool.query(`
    DELETE FROM collection c
    USING collection duplicate
    WHERE c.album_id = duplicate.album_id
        AND c.created_by_user_id = duplicate.created_by_user_id
        AND c.id > duplicate.id
        AND c.created_by_user_id IS NOT NULL
`);

await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS collection_album_user_unique_idx
    ON collection (album_id, created_by_user_id)
    WHERE created_by_user_id IS NOT NULL
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
        COALESCE(alb.artist_id, c.artist_id) AS artist_id,
        COALESCE(album_artist.name, art.name) AS artist_name,
        alb.id AS album_id,
        alb.name AS album_name,
        alb.year AS album_year,
        alb.image AS album_image,
        c.created_by_user_id,
        u.username AS created_by_username,
        c.metadata
    FROM collection c
    JOIN artist art ON c.artist_id = art.id
    JOIN album alb ON c.album_id = alb.id
    LEFT JOIN artist album_artist ON alb.artist_id = album_artist.id
    LEFT JOIN users u ON c.created_by_user_id = u.discord_user_id
`;

function normalizeOptionalHttpUrl(value: unknown): string | null {
    if (value === undefined || value === null || value === '') {
        return null;
    }

    if (typeof value !== 'string') {
        throw new Error('URL must be a string');
    }

    const trimmedValue = value.trim();

    if (!trimmedValue) {
        return null;
    }

    try {
        const url = new URL(trimmedValue);

        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
            throw new Error('URL must use HTTP or HTTPS');
        }
    } catch (error) {
        if (error instanceof Error && error.message === 'URL must use HTTP or HTTPS') {
            throw error;
        }

        throw new Error('URL must be a valid HTTP(S) URL');
    }

    return trimmedValue;
}

function normalizeMetadata(value: unknown): CollectionMetadata[] {
    if (!Array.isArray(value)) {
        throw new Error('Collection metadata must be an array');
    }

    return value.map((entry, index) => {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
            throw new Error(`Metadata entry ${index + 1} is invalid`);
        }

        const rawEntry = entry as Record<string, unknown>;
        const showInCards = rawEntry.showInCards === undefined ? true : rawEntry.showInCards;

        if (typeof showInCards !== 'boolean') {
            throw new Error(`Metadata entry ${index + 1} has an invalid card visibility value`);
        }

        if (rawEntry.type === 'url') {
            const name = typeof rawEntry.name === 'string' ? rawEntry.name.trim() : '';
            const url = normalizeOptionalHttpUrl(rawEntry.value);

            if (!name) {
                throw new Error(`Metadata URL entry ${index + 1} requires a name`);
            }

            if (!url) {
                throw new Error(`Metadata URL entry ${index + 1} requires a URL`);
            }

            return { type: 'url', name, value: url, showInCards };
        }

        if (rawEntry.type === 'text') {
            if (rawEntry.title !== undefined && typeof rawEntry.title !== 'string') {
                throw new Error(`Metadata text entry ${index + 1} has an invalid title`);
            }

            const title = typeof rawEntry.title === 'string' ? rawEntry.title.trim() : '';
            const text = typeof rawEntry.value === 'string' ? rawEntry.value.trim() : '';

            if (!text) {
                throw new Error(`Metadata text entry ${index + 1} requires content`);
            }

            return {
                type: 'text',
                ...(title ? { title } : {}),
                value: text,
                showInCards,
            };
        }

        throw new Error(`Metadata entry ${index + 1} has an unknown type`);
    });
}

app.get('/api/artists', async () => {
    const result = await pool.query<DatabaseArtist>(`
        SELECT id, name, image
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
    let image: string | null;

    if (!name) {
        reply.code(400);
        return { error: 'Artist name is required' };
    }

    try {
        image = normalizeOptionalHttpUrl(body.image);
    } catch (error) {
        reply.code(400);
        return { error: error instanceof Error ? error.message : 'Invalid artist image URL' };
    }

    const result = await pool.query<DatabaseArtist>(
        `
            INSERT INTO artist (name, image)
            VALUES ($1, $2)
            RETURNING id, name, image
        `,
        [name, image],
    );

    return {
        success: true,
        data: result.rows[0],
        queryType: 'artist',
    };
});

app.patch('/api/artists/:id', async (request, reply) => {
    const params = request.params as { id: string };
    const artistId = Number(params.id);
    const body = request.body as Partial<UpdateArtistPayload>;
    const name = body.name?.trim();
    let image: string | null;

    if (!Number.isInteger(artistId)) {
        reply.code(400);
        return { error: 'Artist id is required' };
    }

    if (!name) {
        reply.code(400);
        return { error: 'Artist name is required' };
    }

    try {
        image = normalizeOptionalHttpUrl(body.image);
    } catch (error) {
        reply.code(400);
        return { error: error instanceof Error ? error.message : 'Invalid artist image URL' };
    }

    const result = await pool.query<DatabaseArtist>(
        `
            UPDATE artist
            SET name = $2, image = $3
            WHERE id = $1
            RETURNING id, name, image
        `,
        [artistId, name, image],
    );

    if (!result.rows[0]) {
        reply.code(404);
        return { error: 'Artist not found' };
    }

    return {
        success: true,
        data: result.rows[0],
        queryType: 'artist',
    };
});

app.get('/api/albums', async (request) => {
    const query = request.query as { artist_id?: string };
    const artistId = query.artist_id ? Number(query.artist_id) : null;
    const result = artistId
        ? await pool.query<DatabaseAlbum>(
            `
                SELECT alb.id, alb.artist_id, art.name AS artist_name, alb.name, alb.year, alb.image
                FROM album alb
                LEFT JOIN artist art ON alb.artist_id = art.id
                WHERE alb.artist_id = $1
                ORDER BY alb.name
            `,
            [artistId],
        )
        : await pool.query<DatabaseAlbum>(`
            SELECT alb.id, alb.artist_id, art.name AS artist_name, alb.name, alb.year, alb.image
            FROM album alb
            LEFT JOIN artist art ON alb.artist_id = art.id
            ORDER BY alb.name
        `);

    return {
        success: true,
        data: result.rows,
        queryType: 'albums',
    };
});

app.post('/api/albums', async (request, reply) => {
    const body = request.body as Omit<Partial<CreateAlbumPayload>, 'year'> & { year?: unknown };
    const artistId = Number(body.artist_id);
    const name = body.name?.trim();
    const year = body.year === undefined || body.year === null || body.year === '' ? null : Number(body.year);
    let image: string | null;

    if (!Number.isInteger(artistId)) {
        reply.code(400);
        return { error: 'Album artist is required' };
    }

    if (!name) {
        reply.code(400);
        return { error: 'Album name is required' };
    }

    if (year !== null && (!Number.isInteger(year) || year < 0)) {
        reply.code(400);
        return { error: 'Album year must be a positive integer' };
    }


    try {
        image = normalizeOptionalHttpUrl(body.image);
    } catch (error) {
        reply.code(400);
        return { error: error instanceof Error ? error.message : 'Invalid album image URL' };
    }

    const insertResult = await pool.query<{ id: number }>(
        `
            INSERT INTO album (artist_id, name, year, image)
            VALUES ($1, $2, $3, $4)
            RETURNING id
        `,
        [artistId, name, year, image],
    );
    const result = await pool.query<DatabaseAlbum>(
        `
            SELECT alb.id, alb.artist_id, art.name AS artist_name, alb.name, alb.year, alb.image
            FROM album alb
            LEFT JOIN artist art ON alb.artist_id = art.id
            WHERE alb.id = $1
        `,
        [insertResult.rows[0].id],
    );

    return {
        success: true,
        data: result.rows[0],
        queryType: 'album',
    };
});

app.patch('/api/albums/:id', async (request, reply) => {
    const params = request.params as { id: string };
    const albumId = Number(params.id);
    const body = request.body as Omit<Partial<UpdateAlbumPayload>, 'year'> & { year?: unknown };
    const artistId = Number(body.artist_id);
    const name = body.name?.trim();
    const year = body.year === undefined || body.year === null || body.year === '' ? null : Number(body.year);
    let image: string | null;

    if (!Number.isInteger(albumId)) {
        reply.code(400);
        return { error: 'Album id is required' };
    }

    if (!Number.isInteger(artistId)) {
        reply.code(400);
        return { error: 'Album artist is required' };
    }

    if (!name) {
        reply.code(400);
        return { error: 'Album name is required' };
    }

    if (year !== null && (!Number.isInteger(year) || year < 0)) {
        reply.code(400);
        return { error: 'Album year must be a positive integer' };
    }

    try {
        image = normalizeOptionalHttpUrl(body.image);
    } catch (error) {
        reply.code(400);
        return { error: error instanceof Error ? error.message : 'Invalid album image URL' };
    }

    const artistResult = await pool.query<{ id: number }>('SELECT id FROM artist WHERE id = $1', [artistId]);

    if (!artistResult.rows[0]) {
        reply.code(400);
        return { error: 'Album artist does not exist' };
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        const updateResult = await client.query<{ id: number }>(
            `
                UPDATE album
                SET artist_id = $2, name = $3, year = $4, image = $5
                WHERE id = $1
                RETURNING id
            `,
            [albumId, artistId, name, year, image],
        );

        if (!updateResult.rows[0]) {
            await client.query('ROLLBACK');
            reply.code(404);
            return { error: 'Album not found' };
        }

        await client.query(
            `
                UPDATE collection
                SET artist_id = $2
                WHERE album_id = $1
            `,
            [albumId, artistId],
        );

        const result = await client.query<DatabaseAlbum>(
            `
                SELECT alb.id, alb.artist_id, art.name AS artist_name, alb.name, alb.year, alb.image
                FROM album alb
                LEFT JOIN artist art ON alb.artist_id = art.id
                WHERE alb.id = $1
            `,
            [albumId],
        );
        await client.query('COMMIT');

        return {
            success: true,
            data: result.rows[0],
            queryType: 'album',
        };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
});

app.get('/api/collection', async (request) => {
    const query = request.query as { created_by_user_id?: string };
    const createdByUserId = query.created_by_user_id?.trim();
    const result = createdByUserId
        ? await pool.query<DatabaseCollectionItem>(
            `
                ${collectionItemQuery}
                WHERE c.created_by_user_id = $1
                ORDER BY c.id
            `,
            [createdByUserId],
        )
        : await pool.query<DatabaseCollectionItem>(`
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
    const createdByUserId = body.created_by_user_id?.trim();
    let metadata: CollectionMetadata[];

    if (!Number.isInteger(artistId) || !Number.isInteger(albumId)) {
        reply.code(400);
        return { error: 'Artist and album are required' };
    }

    if (!createdByUserId) {
        reply.code(400);
        return { error: 'Collection creator is required' };
    }


    try {
        metadata = normalizeMetadata(body.metadata ?? []);
    } catch (error) {
        reply.code(400);
        return { error: error instanceof Error ? error.message : 'Invalid collection metadata' };
    }

    const userResult = await pool.query<{ discord_user_id: string }>(
        `
            SELECT discord_user_id
            FROM users
            WHERE discord_user_id = $1
        `,
        [createdByUserId],
    );

    if (!userResult.rows[0]) {
        reply.code(400);
        return { error: 'Collection creator does not exist' };
    }

    const albumResult = await pool.query<{ id: number }>(
        `
            SELECT id
            FROM album
            WHERE id = $1
                AND artist_id = $2
        `,
        [albumId, artistId],
    );

    if (!albumResult.rows[0]) {
        reply.code(400);
        return { error: 'Album does not belong to selected artist' };
    }

    const existingCollectionItem = await pool.query<{ id: number }>(
        `
            SELECT id
            FROM collection
            WHERE album_id = $1
                AND created_by_user_id = $2
        `,
        [albumId, createdByUserId],
    );

    if (existingCollectionItem.rows[0]) {
        reply.code(409);
        return { error: 'Album is already in this user collection' };
    }

    const insertResult = await pool.query<{ id: number }>(
        `
            INSERT INTO collection (artist_id, album_id, created_by_user_id, metadata)
            VALUES ($1, $2, $3, $4::jsonb)
            RETURNING id
        `,
        [artistId, albumId, createdByUserId, JSON.stringify(metadata)],
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

app.patch('/api/collection/:id', async (request, reply) => {
    const params = request.params as { id: string };
    const collectionId = Number(params.id);
    const body = request.body as Partial<UpdateCollectionPayload>;
    let metadata: CollectionMetadata[];

    if (!Number.isInteger(collectionId)) {
        reply.code(400);
        return { error: 'Collection item id is required' };
    }

    try {
        metadata = normalizeMetadata(body.metadata);
    } catch (error) {
        reply.code(400);
        return { error: error instanceof Error ? error.message : 'Invalid collection metadata' };
    }

    const updateResult = await pool.query<{ id: number }>(
        `
            UPDATE collection
            SET metadata = $2::jsonb
            WHERE id = $1
            RETURNING id
        `,
        [collectionId, JSON.stringify(metadata)],
    );

    if (!updateResult.rows[0]) {
        reply.code(404);
        return { error: 'Collection item not found' };
    }

    const result = await pool.query<DatabaseCollectionItem>(
        `
            ${collectionItemQuery}
            WHERE c.id = $1
        `,
        [collectionId],
    );

    return {
        success: true,
        data: result.rows[0],
        queryType: 'collection',
    };
});

app.delete('/api/collection/:id', async (request, reply) => {
    const params = request.params as { id: string };
    const collectionId = Number(params.id);

    if (!Number.isInteger(collectionId)) {
        reply.code(400);
        return { error: 'Collection item id is required' };
    }

    const result = await pool.query<{ id: number }>(
        `
            DELETE FROM collection
            WHERE id = $1
            RETURNING id
        `,
        [collectionId],
    );

    if (!result.rows[0]) {
        reply.code(404);
        return { error: 'Collection item not found' };
    }

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
