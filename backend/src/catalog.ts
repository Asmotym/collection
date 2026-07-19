import type {
    CatalogAlbumResult,
    CatalogAlbumSearchParams,
    CatalogArtistResult,
    CatalogCoverCandidate,
    CatalogCoverSearchPayload,
    CatalogEditionResult,
    CatalogProviderSection,
    CatalogProviderSource,
    CatalogSource,
} from '../../shared/types/catalog.types.js';
import type { MusicBrainzArtist, MusicBrainzReleaseGroup } from '../../shared/types/database.types.js';
import { MusicBrainzClient } from './musicbrainz.js';

type FetchImplementation = typeof fetch;

export class CatalogUpstreamError extends Error {
    constructor(public readonly code: string, message: string) {
        super(message);
    }
}

interface CacheEntry<T> { expiresAt: number; value: Promise<T> }

abstract class CachedApiClient {
    private readonly cache = new Map<string, CacheEntry<unknown>>();
    private cooldownUntil = 0;

    protected constructor(
        private readonly fetchImplementation: FetchImplementation = fetch,
        private readonly cacheTtlMs = 5 * 60 * 1000,
        private readonly timeoutMs = 8000,
        private readonly now: () => number = Date.now,
        private readonly telemetry?: (event: { cacheHit: boolean; status: string }) => void,
    ) {}

    protected requestJson<T>(url: string, init: RequestInit = {}): Promise<T> {
        if (this.cooldownUntil > this.now()) {
            return Promise.reject(new CatalogUpstreamError('rate_limited', 'Provider is temporarily rate limited'));
        }
        const cached = this.cache.get(url) as CacheEntry<T> | undefined;
        if (cached && cached.expiresAt > this.now()) {
            this.telemetry?.({ cacheHit: true, status: 'cached' });
            return cached.value;
        }
        if (cached) this.cache.delete(url);
        const value = this.fetchImplementation(url, { ...init, signal: AbortSignal.timeout(this.timeoutMs) })
            .then(async (response) => {
                if (response.status === 429) {
                    const retrySeconds = Number(response.headers.get('retry-after') ?? '60');
                    this.cooldownUntil = this.now() + (Number.isFinite(retrySeconds) ? retrySeconds : 60) * 1000;
                    throw new CatalogUpstreamError('rate_limited', 'Provider rate limit exceeded');
                }
                if (response.status === 404) throw new CatalogUpstreamError('not_found', 'Provider record was not found');
                if (!response.ok) throw new CatalogUpstreamError('upstream_error', `Provider returned HTTP ${response.status}`);
                this.telemetry?.({ cacheHit: false, status: String(response.status) });
                try { return await response.json() as T; }
                catch { throw new CatalogUpstreamError('invalid_response', 'Provider returned invalid JSON'); }
            })
            .catch((error: unknown) => {
                if (error instanceof CatalogUpstreamError) throw error;
                throw new CatalogUpstreamError('request_failed', error instanceof Error ? error.message : 'Provider request failed');
            });
        this.cache.set(url, { expiresAt: this.now() + this.cacheTtlMs, value });
        void value.catch(() => this.cache.delete(url));
        return value;
    }
}

export interface CatalogProvider {
    readonly source: CatalogSource;
    readonly enabled: boolean;
    searchArtists(query: string): Promise<CatalogArtistResult[]>;
    searchAlbums(params: CatalogAlbumSearchParams): Promise<CatalogAlbumResult[]>;
    getEditions(kind: string, id: string): Promise<CatalogEditionResult[]>;
    getCovers(payload: CatalogCoverSearchPayload): Promise<CatalogCoverCandidate[]>;
}

export interface CatalogArtworkProvider {
    readonly source: Exclude<CatalogProviderSource, CatalogSource>;
    readonly enabled: boolean;
    getCovers(payload: CatalogCoverSearchPayload): Promise<CatalogCoverCandidate[]>;
}

function uniqueBy<T>(values: T[], key: (value: T) => string): T[] {
    const seen = new Set<string>();
    return values.filter((value) => {
        const id = key(value);
        if (!id || seen.has(id)) return false;
        seen.add(id);
        return true;
    });
}

export class MusicBrainzCatalogProvider implements CatalogProvider {
    readonly source = 'musicbrainz' as const;
    readonly enabled = true;
    constructor(private readonly client: MusicBrainzClient) {}

    async searchArtists(query: string): Promise<CatalogArtistResult[]> {
        return (await this.client.searchArtists(query)).map((artist) => ({
            source: this.source, kind: 'artist', externalId: artist.id, name: artist.name,
            externalUrl: `https://musicbrainz.org/artist/${artist.id}`, musicBrainzId: artist.id,
            subtitle: [artist.type, artist.disambiguation, artist.area?.name ?? artist.country].filter(Boolean).join(' · '),
            rawMusicBrainz: artist,
        }));
    }

    async searchAlbums(params: CatalogAlbumSearchParams): Promise<CatalogAlbumResult[]> {
        const albums = params.musicbrainzId
            ? (params.query
                ? await this.client.searchReleaseGroups(params.musicbrainzId, params.query)
                : await this.client.browseReleaseGroups(params.musicbrainzId))
            : await this.client.searchReleaseGroupsByArtistName(params.artistName, params.query);
        return albums.map((album) => ({
            source: this.source, kind: 'release-group', externalId: album.id, title: album.title,
            artistName: params.artistName, externalUrl: `https://musicbrainz.org/release-group/${album.id}`,
            year: parseYear(album['first-release-date']), musicBrainzId: album.id, rawMusicBrainz: album,
        }));
    }

    async getEditions(kind: string, id: string): Promise<CatalogEditionResult[]> {
        if (kind !== 'release-group') return [];
        return (await this.client.browseReleases(id)).map((release) => ({
            source: this.source, id: release.id, title: release.title,
            externalUrl: `https://musicbrainz.org/release/${release.id}`, date: release.date,
            country: release.country ?? undefined,
            formats: uniqueBy((release.media ?? []).map((medium) => medium.format).filter((v): v is string => Boolean(v)), (v) => v),
            labels: (release['label-info'] ?? []).map((entry) => entry.label?.name).filter((v): v is string => Boolean(v)),
            catalogNumber: release['label-info']?.[0]?.['catalog-number'] ?? undefined,
            barcode: release.barcode ?? undefined, rawMusicBrainz: release,
        }));
    }

    async getCovers(payload: CatalogCoverSearchPayload): Promise<CatalogCoverCandidate[]> {
        const reference = payload.references.find((item) => item.source === this.source && item.kind === 'release-group');
        if (!reference) return [];
        const result = await this.client.getReleaseGroupCover(reference.externalId);
        return result.imageUrl ? [{
            source: 'cover-art-archive', entityType: 'release-group', entityId: reference.externalId,
            previewUrl: result.imageUrl, externalUrl: reference.externalUrl,
        }] : [];
    }
}

interface DiscogsOptions {
    token: string;
    enabled: boolean;
    userAgent: string;
    fetchImplementation?: FetchImplementation;
    cacheTtlMs?: number;
    timeoutMs?: number;
    now?: () => number;
    telemetry?: (event: { cacheHit: boolean; status: string }) => void;
}

export class DiscogsCatalogProvider extends CachedApiClient implements CatalogProvider {
    readonly source = 'discogs' as const;
    readonly enabled: boolean;
    private readonly headers: Record<string, string>;
    constructor(private readonly options: DiscogsOptions) {
        super(options.fetchImplementation, Math.min(options.cacheTtlMs ?? 5 * 60 * 60 * 1000, 5 * 60 * 60 * 1000), options.timeoutMs, options.now, options.telemetry);
        this.enabled = options.enabled && Boolean(options.token.trim());
        this.headers = { Accept: 'application/vnd.discogs.v2.discogs+json', Authorization: `Discogs token=${options.token}`, 'User-Agent': options.userAgent };
    }

    private request<T>(path: string, params?: URLSearchParams): Promise<T> {
        return this.requestJson<T>(`https://api.discogs.com${path}${params ? `?${params}` : ''}`, { headers: this.headers });
    }

    async searchArtists(query: string): Promise<CatalogArtistResult[]> {
        const data = await this.request<{ results?: unknown[] }>('/database/search', new URLSearchParams({ type: 'artist', q: query, per_page: '12' }));
        return parseDiscogsArtists(data.results);
    }

    async searchAlbums(params: CatalogAlbumSearchParams): Promise<CatalogAlbumResult[]> {
        if (params.discogsId && !params.query.trim()) {
            const data = await this.request<{ releases?: unknown[] }>(`/artists/${encodeURIComponent(params.discogsId)}/releases`, new URLSearchParams({ per_page: '100', sort: 'year', sort_order: 'asc' }));
            return parseDiscogsAlbums(data.releases, params.artistName);
        }
        const search = new URLSearchParams({ artist: params.artistName, per_page: params.query ? '12' : '100' });
        if (params.query) search.set('release_title', params.query);
        const data = await this.request<{ results?: unknown[] }>('/database/search', search);
        return parseDiscogsAlbums(data.results, params.artistName);
    }

    async getEditions(kind: string, id: string): Promise<CatalogEditionResult[]> {
        if (kind === 'release') {
            const release = await this.request<Record<string, unknown>>(`/releases/${encodeURIComponent(id)}`);
            const mapped = mapDiscogsEdition(release);
            return mapped ? [mapped] : [];
        }
        if (kind !== 'master') return [];
        const data = await this.request<{ versions?: unknown[] }>(`/masters/${encodeURIComponent(id)}/versions`, new URLSearchParams({ per_page: '100' }));
        return (data.versions ?? []).map((value) => mapDiscogsEdition(value)).filter((value): value is CatalogEditionResult => Boolean(value));
    }

    async getCovers(payload: CatalogCoverSearchPayload): Promise<CatalogCoverCandidate[]> {
        const references = payload.references.filter((item) => item.source === this.source && ['master', 'release'].includes(item.kind));
        const candidates: CatalogCoverCandidate[] = [];
        if (references.length === 0) {
            const search = await this.request<{ results?: unknown[] }>('/database/search', new URLSearchParams({
                artist: payload.artistName, release_title: payload.albumTitle, per_page: '5',
            }));
            for (const album of parseDiscogsAlbums(search.results, payload.artistName)) {
                if (album.cover) candidates.push(album.cover);
            }
            return uniqueBy(candidates, (candidate) => `${candidate.entityType}:${candidate.entityId}`);
        }
        for (const reference of references.slice(0, 2)) {
            const data = await this.request<Record<string, unknown>>(`/${reference.kind}s/${encodeURIComponent(reference.externalId)}`);
            const image = Array.isArray(data.images) ? data.images.find((entry) => isRecord(entry) && entry.type === 'primary') ?? data.images[0] : undefined;
            if (isRecord(image) && typeof image.uri === 'string') candidates.push({
                source: 'discogs', entityType: reference.kind as 'master' | 'release', entityId: reference.externalId,
                previewUrl: image.uri, externalUrl: reference.externalUrl,
            });
        }
        return candidates;
    }

    async resolveImage(kind: 'master' | 'release', id: string): Promise<string | null> {
        const data = await this.request<Record<string, unknown>>(`/${kind}s/${encodeURIComponent(id)}`);
        const images = Array.isArray(data.images) ? data.images : [];
        const image = images.find((entry) => isRecord(entry) && entry.type === 'primary') ?? images[0];
        return isRecord(image) && typeof image.uri === 'string' ? image.uri : null;
    }
}

interface LastFmOptions { apiKey: string; enabled: boolean; fetchImplementation?: FetchImplementation; cacheTtlMs?: number; timeoutMs?: number; now?: () => number; telemetry?: (event: { cacheHit: boolean; status: string }) => void }

export class LastFmCatalogProvider extends CachedApiClient implements CatalogProvider {
    readonly source = 'lastfm' as const;
    readonly enabled: boolean;
    constructor(private readonly options: LastFmOptions) {
        super(options.fetchImplementation, options.cacheTtlMs, options.timeoutMs, options.now, options.telemetry);
        this.enabled = options.enabled && Boolean(options.apiKey.trim());
    }
    private request<T>(method: string, params: Record<string, string>): Promise<T> {
        return this.requestJson<T>(`https://ws.audioscrobbler.com/2.0/?${new URLSearchParams({ method, api_key: this.options.apiKey, format: 'json', ...params })}`)
            .then((data) => {
                if (isRecord(data) && typeof data.error === 'number') {
                    throw new CatalogUpstreamError(data.error === 29 ? 'rate_limited' : 'upstream_error',
                        stringValue(data.message) ?? 'Last.fm returned an API error');
                }
                return data;
            });
    }
    async searchArtists(query: string): Promise<CatalogArtistResult[]> {
        const data = await this.request<Record<string, unknown>>('artist.search', { artist: query, limit: '12' });
        const matches = nestedArray(data, ['results', 'artistmatches', 'artist']);
        return uniqueBy(matches.map(mapLastFmArtist).filter((v): v is CatalogArtistResult => Boolean(v)), (v) => v.externalId);
    }
    async searchAlbums(params: CatalogAlbumSearchParams): Promise<CatalogAlbumResult[]> {
        const topPromise = this.request<Record<string, unknown>>('artist.gettopalbums', { artist: params.artistName, limit: '100', autocorrect: '1' });
        const searchPromise = params.query
            ? this.request<Record<string, unknown>>('album.search', { album: params.query, limit: '50' })
            : Promise.resolve({});
        const [top, search] = await Promise.all([topPromise, searchPromise]);
        const values = [...nestedArray(top, ['topalbums', 'album']), ...nestedArray(search, ['results', 'albummatches', 'album'])];
        const normalizedArtist = normalizeName(params.artistName);
        const normalizedQuery = normalizeName(params.query);
        return uniqueBy(values.map((value) => mapLastFmAlbum(value, params.artistName)).filter((value): value is CatalogAlbumResult => Boolean(value))
            .filter((value) => normalizeName(value.artistName) === normalizedArtist && (!normalizedQuery || normalizeName(value.title).includes(normalizedQuery))), (v) => v.externalId);
    }
    async getEditions(): Promise<CatalogEditionResult[]> { return []; }
    async getCovers(): Promise<CatalogCoverCandidate[]> { return []; }
}

interface FanartOptions {
    apiKey: string;
    enabled: boolean;
    fetchImplementation?: FetchImplementation;
    cacheTtlMs?: number;
    timeoutMs?: number;
    now?: () => number;
    telemetry?: (event: { cacheHit: boolean; status: string }) => void;
}

export class FanartCatalogProvider extends CachedApiClient implements CatalogArtworkProvider {
    readonly source = 'fanart' as const;
    readonly enabled: boolean;
    constructor(private readonly options: FanartOptions) {
        super(options.fetchImplementation, options.cacheTtlMs ?? 60 * 60 * 1000, options.timeoutMs, options.now, options.telemetry);
        this.enabled = options.enabled && Boolean(options.apiKey.trim());
    }

    async getCovers(payload: CatalogCoverSearchPayload): Promise<CatalogCoverCandidate[]> {
        const releaseGroup = payload.references.find((reference) => reference.source === 'musicbrainz'
            && reference.kind === 'release-group');
        if (!releaseGroup) return [];
        let data: Record<string, unknown>;
        try {
            data = await this.requestJson<Record<string, unknown>>(
                `https://webservice.fanart.tv/v3.2/music/albums/${encodeURIComponent(releaseGroup.externalId)}?${new URLSearchParams({ api_key: this.options.apiKey })}`,
            );
        } catch (error) {
            if (error instanceof CatalogUpstreamError && error.code === 'not_found') return [];
            throw error;
        }
        const album = nestedArray(data, ['albums']).find((value) => value.release_group_id === releaseGroup.externalId);
        if (!album) return [];
        const cover = nestedArray(album, ['albumcover'])
            .filter((value) => stringValue(value.url))
            .sort((left, right) => (numberValue(right.likes) ?? 0) - (numberValue(left.likes) ?? 0))[0];
        const imageUrl = cover && stringValue(cover.url);
        if (!imageUrl) return [];
        const artistId = stringValue(data.mbid_id);
        return [{
            source: this.source,
            entityType: 'release-group',
            entityId: releaseGroup.externalId,
            previewUrl: imageUrl,
            externalUrl: artistId ? `https://fanart.tv/artist/${encodeURIComponent(artistId)}/` : 'https://fanart.tv/',
        }];
    }
}

export class CatalogService {
    constructor(readonly providers: CatalogProvider[], readonly artworkProviders: CatalogArtworkProvider[] = []) {}
    searchArtists(query: string) { return this.sections((provider) => provider.searchArtists(query)); }
    searchAlbums(params: CatalogAlbumSearchParams) { return this.sections((provider) => provider.searchAlbums(params)); }
    async getCovers(payload: CatalogCoverSearchPayload): Promise<CatalogProviderSection<CatalogCoverCandidate>[]> {
        const musicBrainz = this.providers.find((provider) => provider.source === 'musicbrainz');
        const discogs = this.providers.find((provider) => provider.source === 'discogs');
        const coverProviders: Array<CatalogProvider | CatalogArtworkProvider> = [musicBrainz, discogs, ...this.artworkProviders]
            .filter((provider): provider is CatalogProvider | CatalogArtworkProvider => Boolean(provider));
        const sections: CatalogProviderSection<CatalogCoverCandidate>[] = [];
        for (const provider of coverProviders) {
            sections.push(await this.providerSection<CatalogCoverCandidate>(provider, () => provider.getCovers(payload)));
        }
        return sections;
    }
    async getEditions(source: CatalogSource, kind: string, id: string): Promise<CatalogEditionResult[]> {
        const provider = this.providers.find((item) => item.source === source);
        if (!provider || !provider.enabled) throw new CatalogUpstreamError('provider_disabled', 'Provider is not configured');
        return provider.getEditions(kind, id);
    }
    private async providerSection<T>(provider: { source: CatalogProviderSource; enabled: boolean }, operation: () => Promise<T[]>): Promise<CatalogProviderSection<T>> {
        if (!provider.enabled) return { source: provider.source, status: 'disabled', items: [] };
        try {
            const items = await operation();
            return { source: provider.source, status: 'ok', items: uniqueBy(items, (value) => providerResultId(value)) };
        } catch (reason) {
            const error = reason instanceof CatalogUpstreamError ? reason : new CatalogUpstreamError('upstream_error', 'Provider request failed');
            return { source: provider.source, status: 'error', items: [], error: { code: error.code, message: error.message } };
        }
    }
    private async sections<T>(operation: (provider: CatalogProvider) => Promise<T[]>): Promise<CatalogProviderSection<T>[]> {
        return Promise.all(this.providers.map((provider) => this.providerSection(provider, () => operation(provider))));
    }
}

function providerResultId(value: unknown): string {
    if (!isRecord(value)) return JSON.stringify(value);
    return String(value.externalId ?? value.id ?? `${value.source}:${JSON.stringify(value)}`);
}
function isRecord(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
function stringValue(value: unknown): string | undefined { return typeof value === 'string' && value.trim() ? value.trim() : undefined; }
function numberValue(value: unknown): number | undefined { const number = Number(value); return Number.isFinite(number) && number > 0 ? number : undefined; }
function parseYear(value: unknown): number | undefined { const match = String(value ?? '').match(/^\d{4}/); return match ? Number(match[0]) : undefined; }
function normalizeName(value: string): string { return value.trim().toLocaleLowerCase(); }
function nestedArray(value: unknown, path: string[]): Record<string, unknown>[] {
    let current: unknown = value;
    for (const key of path) current = isRecord(current) ? current[key] : undefined;
    const values = Array.isArray(current) ? current : current ? [current] : [];
    return values.filter(isRecord);
}
function parseDiscogsArtists(values: unknown): CatalogArtistResult[] {
    const results: CatalogArtistResult[] = [];
    for (const value of (Array.isArray(values) ? values : []).filter(isRecord)) {
        const id = numberValue(value.id); const name = stringValue(value.title); if (!id || !name) continue;
        results.push({ source: 'discogs', kind: 'artist', externalId: String(id), name,
            externalUrl: `https://www.discogs.com/artist/${id}`, subtitle: stringValue(value.type) });
    }
    return uniqueBy(results, (value) => value.externalId);
}
function parseDiscogsAlbums(values: unknown, artistName: string): CatalogAlbumResult[] {
    const results: CatalogAlbumResult[] = [];
    for (const value of (Array.isArray(values) ? values : []).filter(isRecord)) {
        const id = numberValue(value.id); if (!id) continue;
        const type = String(value.type ?? '').toLowerCase();
        const kind = type === 'master' ? 'master' : 'release';
        const fullTitle = stringValue(value.title) ?? stringValue(value.name); if (!fullTitle) continue;
        const title = fullTitle.includes(' - ') ? fullTitle.slice(fullTitle.indexOf(' - ') + 3) : fullTitle;
        const externalUrl = `https://www.discogs.com/${kind}/${id}`;
        const coverUrl = stringValue(value.cover_image) ?? stringValue(value.thumb);
        results.push({ source: 'discogs', kind, externalId: String(id), title, artistName, externalUrl,
            year: numberValue(value.year), cover: coverUrl ? { source: 'discogs', entityType: kind, entityId: String(id), previewUrl: coverUrl, externalUrl } : undefined });
    }
    return uniqueBy(results, (value) => `${value.kind}:${value.externalId}`);
}
function mapDiscogsEdition(value: unknown): CatalogEditionResult | null {
    if (!isRecord(value)) return null; const id = numberValue(value.id); const title = stringValue(value.title) ?? `Discogs release #${id}`; if (!id) return null;
    const formats = Array.isArray(value.format) ? value.format.filter((v): v is string => typeof v === 'string')
        : Array.isArray(value.formats) ? value.formats.filter(isRecord).flatMap((entry) => [stringValue(entry.name), ...(Array.isArray(entry.descriptions) ? entry.descriptions.filter((v): v is string => typeof v === 'string') : [])]).filter((v): v is string => Boolean(v)) : [];
    const labels = Array.isArray(value.labels) ? value.labels.filter(isRecord).map((entry) => stringValue(entry.name)).filter((v): v is string => Boolean(v)) : [];
    return { source: 'discogs', id: String(id), title, externalUrl: `https://www.discogs.com/release/${id}`,
        year: numberValue(value.year), country: stringValue(value.country), formats, labels,
        catalogNumber: stringValue(value.catno), barcode: stringValue(value.barcode) };
}
function mapLastFmArtist(value: Record<string, unknown>): CatalogArtistResult | null {
    const name = stringValue(value.name); const url = stringValue(value.url); if (!name || !url) return null;
    const mbid = stringValue(value.mbid);
    return { source: 'lastfm', kind: 'artist', externalId: mbid ?? url, name, externalUrl: url, musicBrainzId: mbid };
}
function mapLastFmAlbum(value: Record<string, unknown>, fallbackArtist: string): CatalogAlbumResult | null {
    const title = stringValue(value.name); const url = stringValue(value.url); if (!title || !url) return null;
    const rawArtist = value.artist; const artistName = typeof rawArtist === 'string' ? rawArtist : isRecord(rawArtist) ? stringValue(rawArtist.name) ?? fallbackArtist : fallbackArtist;
    const mbid = stringValue(value.mbid);
    return { source: 'lastfm', kind: 'album', externalId: mbid ?? url, title, artistName, externalUrl: url, musicBrainzId: mbid };
}

export function musicBrainzArtistFromCatalog(value: CatalogArtistResult): MusicBrainzArtist | null {
    return value.source === 'musicbrainz' && value.rawMusicBrainz ? value.rawMusicBrainz as MusicBrainzArtist : null;
}
export function musicBrainzAlbumFromCatalog(value: CatalogAlbumResult): MusicBrainzReleaseGroup | null {
    return value.source === 'musicbrainz' && value.rawMusicBrainz ? value.rawMusicBrainz as MusicBrainzReleaseGroup : null;
}
