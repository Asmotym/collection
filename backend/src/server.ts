import cors from '@fastify/cors';
import Fastify from 'fastify';
import { checkDatabase, pool } from './db.js';
import { getDiscordUser } from './discord.js';
import { isPostgresUniqueViolation } from './database-errors.js';
import type { DiscordAuth } from '../../shared/types/discord.types.js';
import type {
    CreateAlbumPayload,
    CreateArtistPayload,
    CreateCollectionPayload,
    CollectionMetadata,
    CollectionReleaseSelection,
    DatabaseAlbum,
    DatabaseArtist,
    DatabaseCollectionItem,
    DatabaseUser,
    MusicBrainzArtist,
    MusicBrainzReleaseGroup,
    UpdateAlbumPayload,
    UpdateArtistPayload,
    UpdateCollectionPayload,
} from '../../shared/types/database.types.js';
import {
    isMusicBrainzArtist,
    isMusicBrainzId,
    isMusicBrainzRelease,
    isMusicBrainzReleaseGroup,
    MusicBrainzClient,
    UpstreamServiceError,
} from './musicbrainz.js';

const app = Fastify({
    logger: true,
});
const musicBrainzClient = new MusicBrainzClient(
    process.env.MUSICBRAINZ_USER_AGENT
        ?? 'Collection/0.1.0 (https://github.com/Asmotym/collection)',
);

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
    ALTER TABLE artist
    ADD COLUMN IF NOT EXISTS musicbrainz_data JSONB
`);

await pool.query(`
    ALTER TABLE album
    ADD COLUMN IF NOT EXISTS musicbrainz_data JSONB
`);

await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS artist_musicbrainz_id_unique_idx
    ON artist ((musicbrainz_data->>'id'))
    WHERE musicbrainz_data->>'id' IS NOT NULL
`);

await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS album_musicbrainz_id_unique_idx
    ON album ((musicbrainz_data->>'id'))
    WHERE musicbrainz_data->>'id' IS NOT NULL
`);

await pool.query(`
    ALTER TABLE collection
    ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '[]'::jsonb
`);

await pool.query(`
    ALTER TABLE collection
    ADD COLUMN IF NOT EXISTS musicbrainz_release_data JSONB
`);

await pool.query(`
    DO $$
    BEGIN
        IF EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_name = 'album'
                AND column_name = 'musicbrainz_release_data'
        ) THEN
            EXECUTE '
                UPDATE collection c
                SET musicbrainz_release_data = alb.musicbrainz_release_data
                FROM album alb
                WHERE c.album_id = alb.id
                    AND c.musicbrainz_release_data IS NULL
                    AND alb.musicbrainz_release_data IS NOT NULL
            ';
        END IF;
    END
    $$
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
        COALESCE(album_artist.musicbrainz_data, art.musicbrainz_data) AS artist_musicbrainz_data,
        alb.id AS album_id,
        alb.name AS album_name,
        alb.year AS album_year,
        alb.image AS album_image,
        alb.musicbrainz_data AS album_musicbrainz_data,
        c.musicbrainz_release_data,
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

function normalizeArtistMusicBrainzData(value: unknown): MusicBrainzArtist | null {
    if (value === undefined || value === null) return null;
    if (!isMusicBrainzArtist(value)) throw new Error('Invalid MusicBrainz artist data');
    return value;
}

function normalizeAlbumMusicBrainzData(value: unknown): MusicBrainzReleaseGroup | null {
    if (value === undefined || value === null) return null;
    if (!isMusicBrainzReleaseGroup(value)) throw new Error('Invalid MusicBrainz release-group data');
    return value;
}

function normalizeAlbumMusicBrainzReleaseData(
    value: unknown,
    releaseGroup: MusicBrainzReleaseGroup | null,
): CollectionReleaseSelection | null {
    if (value === undefined || value === null) return null;
    if (typeof value === 'object' && !Array.isArray(value) && 'source' in value && value.source === 'common') {
        const commonRelease = value as Record<string, unknown>;
        const allowedFormats = new Map([
            ['common:cd', 'CD'],
            ['common:vinyl', 'Vinyl'],
            ['common:cassette', 'Cassette'],
            ['common:digital', 'Digital'],
            ['common:dvd', 'DVD'],
            ['common:blu-ray', 'Blu-ray'],
            ['common:minidisc', 'MiniDisc'],
        ]);
        const format = typeof commonRelease.id === 'string' ? allowedFormats.get(commonRelease.id) : undefined;
        if (!format) throw new Error('Invalid common release format');
        return { source: 'common', id: commonRelease.id as string, title: format, format };
    }
    if (!releaseGroup || !isMusicBrainzRelease(value)) throw new Error('Invalid MusicBrainz release data');
    if (value['release-group']?.id !== releaseGroup.id) {
        throw new Error('MusicBrainz release does not belong to the selected album');
    }
    return value;
}

function normalizeSearchQuery(value: unknown): string {
    if (typeof value !== 'string') throw new Error('Search query is required');
    const query = value.trim();
    if (query.length < 2) throw new Error('Search query must contain at least 2 characters');
    if (query.length > 100) throw new Error('Search query must contain at most 100 characters');
    return query;
}

function replyWithUpstreamError(reply: { code: (statusCode: number) => unknown }, error: unknown) {
    const upstreamError = error instanceof UpstreamServiceError
        ? error
        : new UpstreamServiceError('External music service request failed');
    reply.code(upstreamError.statusCode);
    return { error: upstreamError.message };
}

app.get('/api/musicbrainz/artists', async (request, reply) => {
    const queryParams = request.query as { query?: string };
    let query: string;
    try {
        query = normalizeSearchQuery(queryParams.query);
    } catch (error) {
        reply.code(400);
        return { error: error instanceof Error ? error.message : 'Invalid search query' };
    }

    try {
        return { success: true, data: await musicBrainzClient.searchArtists(query), queryType: 'musicbrainz-artists' };
    } catch (error) {
        return replyWithUpstreamError(reply, error);
    }
});

app.get('/api/musicbrainz/artists/:mbid/release-groups', async (request, reply) => {
    const params = request.params as { mbid: string };
    const queryParams = request.query as { query?: string };
    if (!isMusicBrainzId(params.mbid)) {
        reply.code(400);
        return { error: 'Invalid MusicBrainz artist id' };
    }

    try {
        const rawQuery = queryParams.query?.trim() ?? '';
        const data = rawQuery
            ? await musicBrainzClient.searchReleaseGroups(params.mbid, normalizeSearchQuery(rawQuery))
            : await musicBrainzClient.browseReleaseGroups(params.mbid);
        return { success: true, data, queryType: 'musicbrainz-release-groups' };
    } catch (error) {
        if (error instanceof Error && !(error instanceof UpstreamServiceError)) {
            reply.code(400);
            return { error: error.message };
        }
        return replyWithUpstreamError(reply, error);
    }
});

app.get('/api/musicbrainz/release-groups/:mbid/releases', async (request, reply) => {
    const params = request.params as { mbid: string };
    if (!isMusicBrainzId(params.mbid)) {
        reply.code(400);
        return { error: 'Invalid MusicBrainz release-group id' };
    }

    try {
        return {
            success: true,
            data: await musicBrainzClient.browseReleases(params.mbid),
            queryType: 'musicbrainz-releases',
        };
    } catch (error) {
        return replyWithUpstreamError(reply, error);
    }
});

app.get('/api/cover-art/release-groups/:mbid', async (request, reply) => {
    const params = request.params as { mbid: string };
    if (!isMusicBrainzId(params.mbid)) {
        reply.code(400);
        return { error: 'Invalid MusicBrainz release-group id' };
    }

    try {
        return {
            success: true,
            data: await musicBrainzClient.getReleaseGroupCover(params.mbid),
            queryType: 'cover-art',
        };
    } catch (error) {
        return replyWithUpstreamError(reply, error);
    }
});

app.get('/api/artists', async () => {
    const result = await pool.query<DatabaseArtist>(`
        SELECT id, name, image, musicbrainz_data
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
    let musicBrainzData: MusicBrainzArtist | null;

    if (!name) {
        reply.code(400);
        return { error: 'Artist name is required' };
    }

    try {
        image = normalizeOptionalHttpUrl(body.image);
        musicBrainzData = normalizeArtistMusicBrainzData(body.musicbrainz_data);
    } catch (error) {
        reply.code(400);
        return { error: error instanceof Error ? error.message : 'Invalid artist image URL' };
    }

    let result;
    try {
        result = await pool.query<DatabaseArtist>(
            `
                INSERT INTO artist (name, image, musicbrainz_data)
                VALUES ($1, $2, $3::jsonb)
                RETURNING id, name, image, musicbrainz_data
            `,
            [name, image, musicBrainzData === null ? null : JSON.stringify(musicBrainzData)],
        );
    } catch (error) {
        if (isPostgresUniqueViolation(error)) {
            reply.code(409);
            return { error: 'This MusicBrainz artist already exists' };
        }
        throw error;
    }

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
            RETURNING id, name, image, musicbrainz_data
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

app.delete('/api/artists/:id', async (request, reply) => {
    const params = request.params as { id: string };
    const artistId = Number(params.id);
    if (!Number.isInteger(artistId)) {
        reply.code(400);
        return { error: 'Artist id is required' };
    }

    const result = await pool.query<{ id: number }>(
        'DELETE FROM artist WHERE id = $1 RETURNING id',
        [artistId],
    );
    if (!result.rows[0]) {
        reply.code(404);
        return { error: 'Artist not found' };
    }
    return { success: true, data: result.rows[0], queryType: 'artist' };
});

app.get('/api/albums', async (request) => {
    const query = request.query as { artist_id?: string };
    const artistId = query.artist_id ? Number(query.artist_id) : null;
    const result = artistId
        ? await pool.query<DatabaseAlbum>(
            `
                SELECT alb.id, alb.artist_id, art.name AS artist_name, alb.name, alb.year, alb.image, alb.musicbrainz_data
                FROM album alb
                LEFT JOIN artist art ON alb.artist_id = art.id
                WHERE alb.artist_id = $1
                ORDER BY alb.name
            `,
            [artistId],
        )
        : await pool.query<DatabaseAlbum>(`
            SELECT alb.id, alb.artist_id, art.name AS artist_name, alb.name, alb.year, alb.image, alb.musicbrainz_data
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
    let musicBrainzData: MusicBrainzReleaseGroup | null;

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
        musicBrainzData = normalizeAlbumMusicBrainzData(body.musicbrainz_data);
    } catch (error) {
        reply.code(400);
        return { error: error instanceof Error ? error.message : 'Invalid album image URL' };
    }

    let insertResult;
    try {
        insertResult = await pool.query<{ id: number }>(
            `
                INSERT INTO album (artist_id, name, year, image, musicbrainz_data)
                VALUES ($1, $2, $3, $4, $5::jsonb)
                RETURNING id
            `,
            [artistId, name, year, image, musicBrainzData === null ? null : JSON.stringify(musicBrainzData)],
        );
    } catch (error) {
        if (isPostgresUniqueViolation(error)) {
            reply.code(409);
            return { error: 'This MusicBrainz album already exists' };
        }
        throw error;
    }
    const result = await pool.query<DatabaseAlbum>(
        `
            SELECT alb.id, alb.artist_id, art.name AS artist_name, alb.name, alb.year, alb.image, alb.musicbrainz_data
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
                SELECT alb.id, alb.artist_id, art.name AS artist_name, alb.name, alb.year, alb.image, alb.musicbrainz_data
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

app.delete('/api/albums/:id', async (request, reply) => {
    const params = request.params as { id: string };
    const albumId = Number(params.id);
    if (!Number.isInteger(albumId)) {
        reply.code(400);
        return { error: 'Album id is required' };
    }

    const result = await pool.query<{ id: number }>(
        'DELETE FROM album WHERE id = $1 RETURNING id',
        [albumId],
    );
    if (!result.rows[0]) {
        reply.code(404);
        return { error: 'Album not found' };
    }
    return { success: true, data: result.rows[0], queryType: 'album' };
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
    let musicBrainzReleaseData: CollectionReleaseSelection | null;

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

    const albumResult = await pool.query<{ id: number; musicbrainz_data: MusicBrainzReleaseGroup | null }>(
        `
            SELECT id, musicbrainz_data
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

    try {
        musicBrainzReleaseData = normalizeAlbumMusicBrainzReleaseData(
            body.musicbrainz_release_data,
            albumResult.rows[0].musicbrainz_data,
        );
    } catch (error) {
        reply.code(400);
        return { error: error instanceof Error ? error.message : 'Invalid MusicBrainz release data' };
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
            INSERT INTO collection (artist_id, album_id, created_by_user_id, metadata, musicbrainz_release_data)
            VALUES ($1, $2, $3, $4::jsonb, $5::jsonb)
            RETURNING id
        `,
        [
            artistId,
            albumId,
            createdByUserId,
            JSON.stringify(metadata),
            musicBrainzReleaseData === null ? null : JSON.stringify(musicBrainzReleaseData),
        ],
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
    let musicBrainzReleaseData: CollectionReleaseSelection | null;

    if (!Number.isInteger(collectionId)) {
        reply.code(400);
        return { error: 'Collection item id is required' };
    }

    const collectionResult = await pool.query<{ musicbrainz_data: MusicBrainzReleaseGroup | null }>(
        `
            SELECT alb.musicbrainz_data
            FROM collection c
            JOIN album alb ON alb.id = c.album_id
            WHERE c.id = $1
        `,
        [collectionId],
    );

    if (!collectionResult.rows[0]) {
        reply.code(404);
        return { error: 'Collection item not found' };
    }

    try {
        metadata = normalizeMetadata(body.metadata);
        musicBrainzReleaseData = normalizeAlbumMusicBrainzReleaseData(
            body.musicbrainz_release_data,
            collectionResult.rows[0].musicbrainz_data,
        );
    } catch (error) {
        reply.code(400);
        return { error: error instanceof Error ? error.message : 'Invalid collection metadata' };
    }

    const updateResult = await pool.query<{ id: number }>(
        `
            UPDATE collection
            SET metadata = $2::jsonb,
                musicbrainz_release_data = $3::jsonb
            WHERE id = $1
            RETURNING id
        `,
        [
            collectionId,
            JSON.stringify(metadata),
            musicBrainzReleaseData === null ? null : JSON.stringify(musicBrainzReleaseData),
        ],
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
