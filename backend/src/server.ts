import cors from '@fastify/cors';
import Fastify from 'fastify';
import { checkDatabase, pool } from './db.js';
import { getDiscordUser } from './discord.js';
import { isPostgresUniqueViolation } from './database-errors.js';
import type { DiscordAuth } from '../../shared/types/discord.types.js';
import type {
    CreateAlbumPayload,
    CreateArtistPayload,
    ComposeCollectionPayload,
    ComposeCollectionResult,
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
import type {
    CatalogCoverReference,
    CatalogCoverSearchPayload,
    CatalogEntityKind,
    CatalogExternalReference,
    CatalogSource,
} from '../../shared/types/catalog.types.js';
import {
    isMusicBrainzArtist,
    isMusicBrainzId,
    isMusicBrainzRelease,
    isMusicBrainzReleaseGroup,
    MusicBrainzClient,
    UpstreamServiceError,
} from './musicbrainz.js';
import {
    CatalogService,
    CatalogUpstreamError,
    DiscogsCatalogProvider,
    FanartCatalogProvider,
    LastFmCatalogProvider,
    MusicBrainzCatalogProvider,
} from './catalog.js';

const app = Fastify({
    logger: true,
});
const musicBrainzClient = new MusicBrainzClient(
    process.env.MUSICBRAINZ_USER_AGENT
        ?? 'Collection/0.1.0 (https://github.com/Asmotym/collection)',
);
const discogsProvider = new DiscogsCatalogProvider({
    token: process.env.DISCOGS_TOKEN ?? '',
    enabled: process.env.CATALOG_DISCOGS_ENABLED === 'true',
    userAgent: process.env.MUSICBRAINZ_USER_AGENT ?? 'Collection/0.1.0 (https://github.com/Asmotym/collection)',
    telemetry: (event) => app.log.info({ provider: 'discogs', ...event }, 'catalog provider cache'),
});
const lastFmProvider = new LastFmCatalogProvider({
    apiKey: process.env.LASTFM_API_KEY ?? '',
    enabled: process.env.CATALOG_LASTFM_ENABLED === 'true',
    telemetry: (event) => app.log.info({ provider: 'lastfm', ...event }, 'catalog provider cache'),
});
const fanartProvider = new FanartCatalogProvider({
    apiKey: process.env.FANART_API_KEY ?? '',
    enabled: process.env.CATALOG_FANART_ENABLED === 'true',
    telemetry: (event) => app.log.info({ provider: 'fanart', ...event }, 'catalog provider cache'),
});
const catalogService = new CatalogService([
    new MusicBrainzCatalogProvider(musicBrainzClient),
    discogsProvider,
    lastFmProvider,
], [fanartProvider]);

function logCatalogSections(operation: string, startedAt: number, sections: Array<{ source: string; status: string; items: unknown[] }>) {
    for (const section of sections) {
        app.log.info({ provider: section.source, operation, status: section.status,
            resultCount: section.items.length, durationMs: Date.now() - startedAt }, 'catalog provider request');
    }
}

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
    ALTER TABLE album ADD COLUMN IF NOT EXISTS image_source TEXT NOT NULL DEFAULT 'manual';
    ALTER TABLE album ADD COLUMN IF NOT EXISTS image_reference JSONB;
    UPDATE album SET image_source = 'cover-art-archive'
    WHERE image LIKE 'https://coverartarchive.org/%' AND image_source = 'manual';
    ALTER TABLE album DROP CONSTRAINT IF EXISTS album_image_source_check;
    ALTER TABLE album ADD CONSTRAINT album_image_source_check
        CHECK (image_source IN ('manual', 'cover-art-archive', 'discogs', 'fanart'));
    CREATE TABLE IF NOT EXISTS artist_external_reference (
        artist_id INTEGER NOT NULL REFERENCES artist(id) ON DELETE CASCADE,
        provider TEXT NOT NULL CHECK (provider IN ('musicbrainz', 'discogs', 'lastfm')),
        entity_kind TEXT NOT NULL DEFAULT 'artist',
        external_id TEXT NOT NULL,
        external_url TEXT NOT NULL,
        PRIMARY KEY (provider, entity_kind, external_id),
        UNIQUE (artist_id, provider, entity_kind)
    );
    CREATE TABLE IF NOT EXISTS album_external_reference (
        album_id INTEGER NOT NULL REFERENCES album(id) ON DELETE CASCADE,
        provider TEXT NOT NULL CHECK (provider IN ('musicbrainz', 'discogs', 'lastfm')),
        entity_kind TEXT NOT NULL,
        external_id TEXT NOT NULL,
        external_url TEXT NOT NULL,
        PRIMARY KEY (provider, entity_kind, external_id),
        UNIQUE (album_id, provider, entity_kind)
    );
    INSERT INTO artist_external_reference (artist_id, provider, entity_kind, external_id, external_url)
    SELECT id, 'musicbrainz', 'artist', musicbrainz_data->>'id',
           'https://musicbrainz.org/artist/' || (musicbrainz_data->>'id')
    FROM artist WHERE musicbrainz_data->>'id' IS NOT NULL
    ON CONFLICT DO NOTHING;
    INSERT INTO album_external_reference (album_id, provider, entity_kind, external_id, external_url)
    SELECT id, 'musicbrainz', 'release-group', musicbrainz_data->>'id',
           'https://musicbrainz.org/release-group/' || (musicbrainz_data->>'id')
    FROM album WHERE musicbrainz_data->>'id' IS NOT NULL
    ON CONFLICT DO NOTHING;
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
        return {
            service: 'ok', database: database ? 'ok' : 'error',
            catalog: Object.fromEntries([...catalogService.providers, ...catalogService.artworkProviders]
                .map((provider) => [provider.source, provider.enabled ? 'enabled' : 'disabled'])),
        };
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
        COALESCE(album_artist.image, art.image) AS artist_image,
        COALESCE(album_artist.musicbrainz_data, art.musicbrainz_data) AS artist_musicbrainz_data,
        alb.id AS album_id,
        alb.name AS album_name,
        alb.year AS album_year,
        CASE
            WHEN alb.image_source = 'discogs' AND alb.image_reference->>'kind' IN ('master', 'release')
                THEN '/api/catalog/images/discogs/' || (alb.image_reference->>'kind') || '/' || (alb.image_reference->>'externalId')
            ELSE alb.image
        END AS album_image,
        alb.image_source AS album_image_source,
        alb.image_reference AS album_image_reference,
        alb.musicbrainz_data AS album_musicbrainz_data,
        c.musicbrainz_release_data,
        c.created_by_user_id,
        u.username AS created_by_username,
        c.metadata,
        COALESCE((SELECT jsonb_agg(jsonb_build_object(
            'source', aer.provider, 'kind', aer.entity_kind, 'externalId', aer.external_id, 'externalUrl', aer.external_url
        ) ORDER BY aer.provider) FROM artist_external_reference aer
            WHERE aer.artist_id = COALESCE(alb.artist_id, c.artist_id)), '[]'::jsonb) AS artist_external_references,
        COALESCE((SELECT jsonb_agg(jsonb_build_object(
            'source', alr.provider, 'kind', alr.entity_kind, 'externalId', alr.external_id, 'externalUrl', alr.external_url
        ) ORDER BY alr.provider) FROM album_external_reference alr
            WHERE alr.album_id = alb.id), '[]'::jsonb) AS album_external_references
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
    if (typeof value === 'object' && !Array.isArray(value) && 'source' in value && value.source === 'discogs') {
        const release = value as Record<string, unknown>;
        if (release.kind !== 'release' || typeof release.id !== 'string' || !/^\d+$/.test(release.id)
            || !normalizeOptionalHttpUrl(release.externalUrl)) throw new Error('Invalid Discogs release data');
        return { source: 'discogs', kind: 'release', id: release.id,
            externalUrl: normalizeOptionalHttpUrl(release.externalUrl) as string };
    }
    if (typeof value === 'object' && !Array.isArray(value) && 'source' in value && value.source === 'musicbrainz') {
        if (!releaseGroup || !isMusicBrainzRelease(value)) throw new Error('Invalid MusicBrainz release data');
        if (value['release-group']?.id !== releaseGroup.id) throw new Error('MusicBrainz release does not belong to the selected album');
        return value;
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

const catalogSources = new Set<CatalogSource>(['musicbrainz', 'discogs', 'lastfm']);
const catalogKinds = new Set<CatalogEntityKind>(['artist', 'release-group', 'master', 'release', 'album']);

function normalizeExternalReferences(value: unknown, expected: 'artist' | 'album'): CatalogExternalReference[] {
    if (value === undefined || value === null) return [];
    if (!Array.isArray(value)) throw new Error('External references must be an array');
    const references = value.map((entry) => {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new Error('Invalid external reference');
        const raw = entry as Record<string, unknown>;
        if (!catalogSources.has(raw.source as CatalogSource) || !catalogKinds.has(raw.kind as CatalogEntityKind)
            || typeof raw.externalId !== 'string' || !raw.externalId.trim()) throw new Error('Invalid external reference');
        const externalUrl = normalizeOptionalHttpUrl(raw.externalUrl);
        if (!externalUrl) throw new Error('Invalid external reference URL');
        if (expected === 'artist' && raw.kind !== 'artist') throw new Error('Invalid artist reference');
        if (expected === 'album' && raw.kind === 'artist') throw new Error('Invalid album reference');
        const musicBrainzId = typeof raw.musicBrainzId === 'string' && isMusicBrainzId(raw.musicBrainzId)
            ? raw.musicBrainzId : undefined;
        return { source: raw.source as CatalogSource, kind: raw.kind as CatalogEntityKind,
            externalId: raw.externalId.trim(), externalUrl, ...(musicBrainzId ? { musicBrainzId } : {}) };
    });
    const unique = new Map(references.map((reference) => [`${reference.source}:${reference.kind}`, reference]));
    return [...unique.values()];
}

function normalizeCoverReference(value: unknown, image: string | null): CatalogCoverReference {
    if (value === undefined || value === null) return { source: image?.includes('coverartarchive.org') ? 'cover-art-archive' : 'manual' };
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid cover reference');
    const raw = value as Record<string, unknown>;
    if (raw.source === 'discogs') {
        if (!['master', 'release'].includes(String(raw.kind)) || typeof raw.externalId !== 'string' || !raw.externalId.trim()) {
            throw new Error('Invalid Discogs cover reference');
        }
        return { source: 'discogs', kind: raw.kind as 'master' | 'release', externalId: raw.externalId.trim(),
            externalUrl: normalizeOptionalHttpUrl(raw.externalUrl) ?? undefined };
    }
    if (raw.source === 'cover-art-archive') return { source: 'cover-art-archive' };
    if (raw.source === 'fanart') {
        if (raw.kind !== 'release-group' || typeof raw.externalId !== 'string' || !isMusicBrainzId(raw.externalId)) {
            throw new Error('Invalid Fanart.tv cover reference');
        }
        return { source: 'fanart', kind: 'release-group', externalId: raw.externalId,
            externalUrl: normalizeOptionalHttpUrl(raw.externalUrl) ?? 'https://fanart.tv/' };
    }
    if (raw.source === 'manual') return { source: 'manual' };
    throw new Error('Invalid cover reference');
}

async function insertExternalReferences(
    client: { query: (text: string, values?: unknown[]) => Promise<unknown> },
    entity: 'artist' | 'album', entityId: number, references: CatalogExternalReference[],
) {
    for (const reference of references) {
        await client.query(
            `INSERT INTO ${entity}_external_reference
                (${entity}_id, provider, entity_kind, external_id, external_url)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT DO NOTHING`,
            [entityId, reference.source, reference.kind, reference.externalId, reference.externalUrl],
        );
    }
}

async function findEntityByReferences(
    client: { query: <T>(text: string, values?: unknown[]) => Promise<{ rows: T[] }> },
    entity: 'artist' | 'album', references: CatalogExternalReference[],
): Promise<number | undefined> {
    for (const reference of references) {
        const result = await client.query<{ id: number }>(
            `SELECT ${entity}_id AS id FROM ${entity}_external_reference
             WHERE provider = $1 AND entity_kind = $2 AND external_id = $3`,
            [reference.source, reference.kind, reference.externalId],
        );
        if (result.rows[0]) return result.rows[0].id;
    }
    return undefined;
}

function replyWithUpstreamError(reply: { code: (statusCode: number) => unknown }, error: unknown) {
    const upstreamError = error instanceof UpstreamServiceError
        ? error
        : new UpstreamServiceError('External music service request failed');
    reply.code(upstreamError.statusCode);
    return { error: upstreamError.message };
}

class RequestError extends Error {
    constructor(message: string, readonly statusCode = 400) {
        super(message);
    }
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

app.get('/api/catalog/artists', async (request, reply) => {
    const queryParams = request.query as { query?: string };
    try {
        const query = normalizeSearchQuery(queryParams.query);
        const startedAt = Date.now();
        const data = await catalogService.searchArtists(query);
        logCatalogSections('search-artists', startedAt, data);
        return { success: true, data, queryType: 'catalog-artists' };
    } catch (error) {
        if (error instanceof Error && !(error instanceof CatalogUpstreamError)) {
            reply.code(400);
            return { error: error.message };
        }
        return replyWithUpstreamError(reply, error);
    }
});

app.get('/api/catalog/albums', async (request, reply) => {
    const query = request.query as {
        artistName?: string; query?: string; musicbrainzId?: string; discogsId?: string; lastfmId?: string;
    };
    const artistName = query.artistName?.trim() ?? '';
    const albumQuery = query.query?.trim() ?? '';
    if (!artistName || artistName.length > 200) {
        reply.code(400);
        return { error: 'Artist name is required' };
    }
    if (albumQuery && (albumQuery.length < 2 || albumQuery.length > 100)) {
        reply.code(400);
        return { error: 'Album query must contain between 2 and 100 characters' };
    }
    if (query.musicbrainzId && !isMusicBrainzId(query.musicbrainzId)) {
        reply.code(400);
        return { error: 'Invalid MusicBrainz artist id' };
    }
    const startedAt = Date.now();
    const data = await catalogService.searchAlbums({
        artistName, query: albumQuery, musicbrainzId: query.musicbrainzId,
        discogsId: query.discogsId, lastfmId: query.lastfmId,
    });
    logCatalogSections('search-albums', startedAt, data);
    return {
        success: true,
        data,
        queryType: 'catalog-albums',
    };
});

app.get('/api/catalog/albums/:source/:kind/:id/editions', async (request, reply) => {
    const params = request.params as { source: CatalogSource; kind: string; id: string };
    if (!catalogSources.has(params.source) || !catalogKinds.has(params.kind as CatalogEntityKind) || !params.id.trim()) {
        reply.code(400);
        return { error: 'Invalid catalog album reference' };
    }
    try {
        return {
            success: true,
            data: await catalogService.getEditions(params.source, params.kind, params.id),
            queryType: 'catalog-editions',
        };
    } catch (error) {
        if (error instanceof CatalogUpstreamError && error.code === 'provider_disabled') reply.code(503);
        else reply.code(502);
        return { error: error instanceof Error ? error.message : 'Edition lookup failed' };
    }
});

app.post('/api/catalog/covers', async (request, reply) => {
    const body = request.body as Partial<CatalogCoverSearchPayload>;
    const artistName = body.artistName?.trim() ?? '';
    const albumTitle = body.albumTitle?.trim() ?? '';
    if (!artistName || !albumTitle) {
        reply.code(400);
        return { error: 'Artist and album names are required' };
    }
    try {
        const references = normalizeExternalReferences(body.references ?? [], 'album');
        const startedAt = Date.now();
        const data = await catalogService.getCovers({ artistName, albumTitle, references });
        logCatalogSections('search-covers', startedAt, data);
        return {
            success: true,
            data,
            queryType: 'catalog-covers',
        };
    } catch (error) {
        reply.code(400);
        return { error: error instanceof Error ? error.message : 'Invalid cover lookup' };
    }
});

app.get('/api/catalog/images/discogs/:kind/:id', async (request, reply) => {
    const params = request.params as { kind: 'master' | 'release'; id: string };
    if (!['master', 'release'].includes(params.kind) || !/^\d+$/.test(params.id)) {
        reply.code(400);
        return { error: 'Invalid Discogs image reference' };
    }
    if (!discogsProvider.enabled) {
        reply.code(503);
        return { error: 'Discogs is not configured' };
    }
    try {
        const imageUrl = await discogsProvider.resolveImage(params.kind, params.id);
        if (!imageUrl) {
            reply.code(404);
            return { error: 'Discogs image not found' };
        }
        return reply.redirect(imageUrl);
    } catch (error) {
        reply.code(502);
        return { error: error instanceof Error ? error.message : 'Discogs image lookup failed' };
    }
});

app.get('/api/artists', async () => {
    const result = await pool.query<DatabaseArtist>(`
        SELECT art.id, art.name, art.image, art.musicbrainz_data,
            COALESCE((SELECT jsonb_agg(jsonb_build_object(
                'source', refs.provider, 'kind', refs.entity_kind, 'externalId', refs.external_id, 'externalUrl', refs.external_url
            ) ORDER BY refs.provider) FROM artist_external_reference refs WHERE refs.artist_id = art.id), '[]'::jsonb) AS external_references
        FROM artist art
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
                SELECT alb.id, alb.artist_id, art.name AS artist_name, alb.name, alb.year,
                    CASE WHEN alb.image_source = 'discogs' THEN '/api/catalog/images/discogs/' ||
                        (alb.image_reference->>'kind') || '/' || (alb.image_reference->>'externalId') ELSE alb.image END AS image,
                    alb.musicbrainz_data, alb.image_source, alb.image_reference,
                    COALESCE((SELECT jsonb_agg(jsonb_build_object(
                        'source', refs.provider, 'kind', refs.entity_kind, 'externalId', refs.external_id, 'externalUrl', refs.external_url
                    ) ORDER BY refs.provider) FROM album_external_reference refs WHERE refs.album_id = alb.id), '[]'::jsonb) AS external_references
                FROM album alb
                LEFT JOIN artist art ON alb.artist_id = art.id
                WHERE alb.artist_id = $1
                ORDER BY alb.name
            `,
            [artistId],
        )
        : await pool.query<DatabaseAlbum>(`
            SELECT alb.id, alb.artist_id, art.name AS artist_name, alb.name, alb.year,
                CASE WHEN alb.image_source = 'discogs' THEN '/api/catalog/images/discogs/' ||
                    (alb.image_reference->>'kind') || '/' || (alb.image_reference->>'externalId') ELSE alb.image END AS image,
                alb.musicbrainz_data, alb.image_source, alb.image_reference,
                COALESCE((SELECT jsonb_agg(jsonb_build_object(
                    'source', refs.provider, 'kind', refs.entity_kind, 'externalId', refs.external_id, 'externalUrl', refs.external_url
                ) ORDER BY refs.provider) FROM album_external_reference refs WHERE refs.album_id = alb.id), '[]'::jsonb) AS external_references
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

app.post('/api/collection/compose', async (request, reply) => {
    const body = request.body as Partial<ComposeCollectionPayload>;
    const createdByUserId = body.created_by_user_id?.trim();
    if (!createdByUserId) {
        reply.code(400);
        return { error: 'Collection creator is required' };
    }

    let metadata: CollectionMetadata[];
    try {
        metadata = normalizeMetadata(body.metadata ?? []);
    } catch (error) {
        reply.code(400);
        return { error: error instanceof Error ? error.message : 'Invalid collection metadata' };
    }

    const artistSelection = body.artist;
    const albumSelection = body.album;
    if (!artistSelection || !albumSelection
        || (artistSelection.type !== 'existing' && artistSelection.type !== 'new')
        || (albumSelection.type !== 'existing' && albumSelection.type !== 'new')) {
        reply.code(400);
        return { error: 'Artist and album selections are required' };
    }

    let newArtist: {
        name: string; image: string | null; musicbrainzData: MusicBrainzArtist | null;
        externalReferences: CatalogExternalReference[];
    } | null = null;
    if (artistSelection.type === 'new') {
        const name = artistSelection.data?.name?.trim();
        if (!name) {
            reply.code(400);
            return { error: 'Artist name is required' };
        }
        try {
            newArtist = {
                name,
                image: normalizeOptionalHttpUrl(artistSelection.data.image),
                musicbrainzData: normalizeArtistMusicBrainzData(artistSelection.data.musicbrainz_data),
                externalReferences: normalizeExternalReferences(artistSelection.data.external_references, 'artist'),
            };
        } catch (error) {
            reply.code(400);
            return { error: error instanceof Error ? error.message : 'Invalid artist data' };
        }
    } else if (!Number.isInteger(artistSelection.id)) {
        reply.code(400);
        return { error: 'Artist id is required' };
    }

    let newAlbum: {
        name: string;
        year: number | null;
        image: string | null;
        musicbrainzData: MusicBrainzReleaseGroup | null;
        externalReferences: CatalogExternalReference[];
        imageSource: 'manual' | 'cover-art-archive' | 'discogs' | 'fanart';
        imageReference: CatalogCoverReference;
    } | null = null;
    if (albumSelection.type === 'new') {
        const name = albumSelection.data?.name?.trim();
        const rawYear: unknown = albumSelection.data?.year;
        const year = rawYear === undefined || rawYear === null || rawYear === '' ? null : Number(rawYear);
        if (!name) {
            reply.code(400);
            return { error: 'Album name is required' };
        }
        if (year !== null && (!Number.isInteger(year) || year < 0)) {
            reply.code(400);
            return { error: 'Album year must be a positive integer' };
        }
        try {
            const image = normalizeOptionalHttpUrl(albumSelection.data.image);
            const imageReference = normalizeCoverReference(albumSelection.data.image_reference, image);
            newAlbum = {
                name,
                year,
                image: imageReference.source === 'discogs' ? null : image,
                musicbrainzData: normalizeAlbumMusicBrainzData(albumSelection.data.musicbrainz_data),
                externalReferences: normalizeExternalReferences(albumSelection.data.external_references, 'album'),
                imageSource: imageReference.source,
                imageReference,
            };
        } catch (error) {
            reply.code(400);
            return { error: error instanceof Error ? error.message : 'Invalid album data' };
        }
    } else if (!Number.isInteger(albumSelection.id)) {
        reply.code(400);
        return { error: 'Album id is required' };
    }

    if (newArtist && !newArtist.musicbrainzData) {
        const hintedMbid = newArtist.externalReferences.find((reference) => reference.source === 'lastfm')?.musicBrainzId;
        if (hintedMbid) {
            try {
                newArtist.musicbrainzData = await musicBrainzClient.lookupArtist(hintedMbid);
                if (newArtist.musicbrainzData) newArtist.externalReferences.push({
                    source: 'musicbrainz', kind: 'artist', externalId: hintedMbid,
                    externalUrl: `https://musicbrainz.org/artist/${hintedMbid}`,
                });
            } catch { /* Last.fm selection remains valid when optional MBID verification is unavailable. */ }
        }
    }
    if (newAlbum && !newAlbum.musicbrainzData) {
        const hintedMbid = newAlbum.externalReferences.find((reference) => reference.source === 'lastfm')?.musicBrainzId;
        if (hintedMbid) {
            try {
                newAlbum.musicbrainzData = await musicBrainzClient.lookupReleaseGroup(hintedMbid);
                if (newAlbum.musicbrainzData) newAlbum.externalReferences.push({
                    source: 'musicbrainz', kind: 'release-group', externalId: hintedMbid,
                    externalUrl: `https://musicbrainz.org/release-group/${hintedMbid}`,
                });
            } catch { /* Keep the Last.fm result without an unverified cross-provider link. */ }
        }
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const userResult = await client.query<{ discord_user_id: string }>(
            'SELECT discord_user_id FROM users WHERE discord_user_id = $1',
            [createdByUserId],
        );
        if (!userResult.rows[0]) throw new RequestError('Collection creator does not exist');

        let artist: DatabaseArtist | undefined;
        if (artistSelection.type === 'existing') {
            const result = await client.query<DatabaseArtist>(
                'SELECT id, name, image, musicbrainz_data FROM artist WHERE id = $1',
                [artistSelection.id],
            );
            artist = result.rows[0];
            if (!artist) throw new RequestError('Artist not found', 404);
        } else if (newArtist) {
            const referencedArtistId = await findEntityByReferences(client, 'artist', newArtist.externalReferences);
            if (referencedArtistId) {
                const existing = await client.query<DatabaseArtist>(
                    'SELECT id, name, image, musicbrainz_data FROM artist WHERE id = $1', [referencedArtistId],
                );
                artist = existing.rows[0];
            }
            const musicBrainzJson = newArtist.musicbrainzData === null
                ? null
                : JSON.stringify(newArtist.musicbrainzData);
            const result = artist ? { rows: [] as DatabaseArtist[] } : await client.query<DatabaseArtist>(
                `
                    INSERT INTO artist (name, image, musicbrainz_data)
                    VALUES ($1, $2, $3::jsonb)
                    ON CONFLICT ((musicbrainz_data->>'id'))
                    WHERE (musicbrainz_data->>'id') IS NOT NULL
                    DO NOTHING
                    RETURNING id, name, image, musicbrainz_data
                `,
                [newArtist.name, newArtist.image, musicBrainzJson],
            );
            artist = artist ?? result.rows[0];
            if (!artist && newArtist.musicbrainzData) {
                const existing = await client.query<DatabaseArtist>(
                    `SELECT id, name, image, musicbrainz_data
                     FROM artist WHERE musicbrainz_data->>'id' = $1`,
                    [newArtist.musicbrainzData.id],
                );
                artist = existing.rows[0];
            }
            if (artist) await insertExternalReferences(client, 'artist', artist.id, newArtist.externalReferences);
        }
        if (!artist) throw new RequestError('Artist could not be resolved');

        let album: DatabaseAlbum | undefined;
        if (albumSelection.type === 'existing') {
            const result = await client.query<DatabaseAlbum>(
                `
                    SELECT alb.id, alb.artist_id, art.name AS artist_name,
                           alb.name, alb.year, alb.image, alb.musicbrainz_data
                    FROM album alb
                    LEFT JOIN artist art ON alb.artist_id = art.id
                    WHERE alb.id = $1
                `,
                [albumSelection.id],
            );
            album = result.rows[0];
            if (!album) throw new RequestError('Album not found', 404);
        } else if (newAlbum) {
            const referencedAlbumId = await findEntityByReferences(client, 'album', newAlbum.externalReferences);
            const musicBrainzJson = newAlbum.musicbrainzData === null
                ? null
                : JSON.stringify(newAlbum.musicbrainzData);
            const insertResult = referencedAlbumId ? { rows: [{ id: referencedAlbumId }] } : await client.query<{ id: number }>(
                `
                    INSERT INTO album (artist_id, name, year, image, musicbrainz_data, image_source, image_reference)
                    VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7::jsonb)
                    ON CONFLICT ((musicbrainz_data->>'id'))
                    WHERE (musicbrainz_data->>'id') IS NOT NULL
                    DO NOTHING
                    RETURNING id
                `,
                [artist.id, newAlbum.name, newAlbum.year, newAlbum.image, musicBrainzJson,
                    newAlbum.imageSource, JSON.stringify(newAlbum.imageReference)],
            );
            let albumId = insertResult.rows[0]?.id;
            if (!albumId && newAlbum.musicbrainzData) {
                const existing = await client.query<{ id: number }>(
                    `SELECT id FROM album WHERE musicbrainz_data->>'id' = $1`,
                    [newAlbum.musicbrainzData.id],
                );
                albumId = existing.rows[0]?.id;
            }
            if (albumId) {
                await insertExternalReferences(client, 'album', albumId, newAlbum.externalReferences);
                const result = await client.query<DatabaseAlbum>(
                    `
                        SELECT alb.id, alb.artist_id, art.name AS artist_name,
                               alb.name, alb.year,
                               CASE WHEN alb.image_source = 'discogs' THEN '/api/catalog/images/discogs/' ||
                                   (alb.image_reference->>'kind') || '/' || (alb.image_reference->>'externalId') ELSE alb.image END AS image,
                               alb.musicbrainz_data, alb.image_source, alb.image_reference
                        FROM album alb
                        LEFT JOIN artist art ON alb.artist_id = art.id
                        WHERE alb.id = $1
                    `,
                    [albumId],
                );
                album = result.rows[0];
            }
        }
        if (!album) throw new RequestError('Album could not be resolved');
        if (album.artist_id !== artist.id) {
            throw new RequestError('Album does not belong to selected artist');
        }

        let musicBrainzReleaseData: CollectionReleaseSelection | null;
        try {
            musicBrainzReleaseData = normalizeAlbumMusicBrainzReleaseData(
                body.musicbrainz_release_data,
                album.musicbrainz_data,
            );
        } catch (error) {
            throw new RequestError(
                error instanceof Error ? error.message : 'Invalid MusicBrainz release data',
            );
        }
        const insertResult = await client.query<{ id: number }>(
            `
                INSERT INTO collection
                    (artist_id, album_id, created_by_user_id, metadata, musicbrainz_release_data)
                VALUES ($1, $2, $3, $4::jsonb, $5::jsonb)
                RETURNING id
            `,
            [
                artist.id,
                album.id,
                createdByUserId,
                JSON.stringify(metadata),
                musicBrainzReleaseData === null ? null : JSON.stringify(musicBrainzReleaseData),
            ],
        );
        const collectionResult = await client.query<DatabaseCollectionItem>(
            `${collectionItemQuery} WHERE c.id = $1`,
            [insertResult.rows[0].id],
        );
        const result: ComposeCollectionResult = {
            artist,
            album,
            collection: collectionResult.rows[0],
        };
        await client.query('COMMIT');
        return { success: true, data: result, queryType: 'collection-compose' };
    } catch (error) {
        await client.query('ROLLBACK');
        if (error instanceof RequestError) {
            reply.code(error.statusCode);
            return { error: error.message };
        }
        if (isPostgresUniqueViolation(error)) {
            reply.code(409);
            return { error: 'Album is already in this user collection' };
        }
        if (error instanceof Error && error.message.startsWith('Invalid')) {
            reply.code(400);
            return { error: error.message };
        }
        throw error;
    } finally {
        client.release();
    }
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
    const artistName = body.artist?.name?.trim();
    const albumName = body.album?.name?.trim();
    const albumYear = body.album?.year === undefined || body.album.year === null
        ? null
        : Number(body.album.year);
    let metadata: CollectionMetadata[];
    let musicBrainzReleaseData: CollectionReleaseSelection | null;
    let artistImage: string | null;
    let albumImage: string | null;

    if (!Number.isInteger(collectionId)) {
        reply.code(400);
        return { error: 'Collection item id is required' };
    }

    if (!artistName) {
        reply.code(400);
        return { error: 'Artist name is required' };
    }

    if (!albumName) {
        reply.code(400);
        return { error: 'Album name is required' };
    }

    if (albumYear !== null && (!Number.isInteger(albumYear) || albumYear < 0)) {
        reply.code(400);
        return { error: 'Album year must be a positive integer' };
    }

    const collectionResult = await pool.query<{
        artist_id: number;
        album_id: number;
        musicbrainz_data: MusicBrainzReleaseGroup | null;
        image_source: 'manual' | 'cover-art-archive' | 'discogs' | 'fanart';
        image_reference: CatalogCoverReference | null;
    }>(
        `
            SELECT COALESCE(alb.artist_id, c.artist_id) AS artist_id, c.album_id, alb.musicbrainz_data,
                   alb.image_source, alb.image_reference
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
        artistImage = normalizeOptionalHttpUrl(body.artist?.image);
        const requestedCover = normalizeCoverReference(body.album?.image_reference,
            normalizeOptionalHttpUrl(body.album?.image));
        albumImage = requestedCover.source === 'discogs' ? null : normalizeOptionalHttpUrl(body.album?.image);
        metadata = normalizeMetadata(body.metadata);
        musicBrainzReleaseData = normalizeAlbumMusicBrainzReleaseData(
            body.musicbrainz_release_data,
            collectionResult.rows[0].musicbrainz_data,
        );
    } catch (error) {
        reply.code(400);
        return { error: error instanceof Error ? error.message : 'Invalid collection metadata' };
    }

    const client = await pool.connect();
    let result;
    try {
        await client.query('BEGIN');
        await client.query(
            'UPDATE artist SET name = $2, image = $3 WHERE id = $1',
            [collectionResult.rows[0].artist_id, artistName, artistImage],
        );
        await client.query(
            `UPDATE album SET name = $2, year = $3, image = $4, image_source = $5, image_reference = $6::jsonb
             WHERE id = $1`,
            [collectionResult.rows[0].album_id, albumName, albumYear, albumImage,
                body.album?.image_source ?? (albumImage?.includes('coverartarchive.org') ? 'cover-art-archive' : 'manual'),
                JSON.stringify(body.album?.image_reference ?? { source: albumImage?.includes('coverartarchive.org') ? 'cover-art-archive' : 'manual' })],
        );
        const updateResult = await client.query<{ id: number }>(
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
            await client.query('ROLLBACK');
            reply.code(404);
            return { error: 'Collection item not found' };
        }
        result = await client.query<DatabaseCollectionItem>(
            `${collectionItemQuery} WHERE c.id = $1`,
            [collectionId],
        );
        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }

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
