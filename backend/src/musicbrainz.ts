import type {
    CoverArtResult,
    MusicBrainzArtist,
    MusicBrainzRelease,
    MusicBrainzReleaseGroup,
} from '../../shared/types/database.types.js';

const MUSICBRAINZ_BASE_URL = 'https://musicbrainz.org/ws/2';
const COVER_ART_BASE_URL = 'https://coverartarchive.org';
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;
const DEFAULT_REQUEST_INTERVAL_MS = 1000;
const DEFAULT_TIMEOUT_MS = 8000;

type FetchImplementation = typeof fetch;

export class UpstreamServiceError extends Error {
    constructor(
        message: string,
        public readonly statusCode: 502 | 503 = 502,
    ) {
        super(message);
    }
}

export function isMusicBrainzId(value: unknown): value is string {
    return typeof value === 'string'
        && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function escapeLuceneValue(value: string): string {
    return value.replace(/(\&\&|\|\||[+\-!(){}[\]^"~*?:\\/])/g, '\\$1');
}

export function buildArtistSearchQuery(query: string): string {
    return `artist:"${escapeLuceneValue(query.trim())}"`;
}

export function buildReleaseGroupSearchQuery(artistMbid: string, query: string): string {
    return `arid:${artistMbid} AND primarytype:album AND releasegroup:"${escapeLuceneValue(query.trim())}"`;
}

export function buildReleaseGroupArtistNameQuery(artistName: string, query: string): string {
    const album = query.trim() ? ` AND releasegroup:"${escapeLuceneValue(query.trim())}"` : '';
    return `artist:"${escapeLuceneValue(artistName.trim())}" AND primarytype:album${album}`;
}

export function isMusicBrainzArtist(value: unknown): value is MusicBrainzArtist {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const artist = value as Record<string, unknown>;
    return isMusicBrainzId(artist.id) && typeof artist.name === 'string' && artist.name.trim().length > 0;
}

export function isMusicBrainzReleaseGroup(value: unknown): value is MusicBrainzReleaseGroup {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const releaseGroup = value as Record<string, unknown>;
    return isMusicBrainzId(releaseGroup.id)
        && typeof releaseGroup.title === 'string'
        && releaseGroup.title.trim().length > 0
        && (releaseGroup['primary-type'] === undefined || releaseGroup['primary-type'] === 'Album');
}

export function isMusicBrainzRelease(value: unknown): value is MusicBrainzRelease {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const release = value as Record<string, unknown>;
    return isMusicBrainzId(release.id)
        && typeof release.title === 'string'
        && release.title.trim().length > 0;
}

interface CacheEntry<T> {
    expiresAt: number;
    value: Promise<T>;
}

export interface MusicBrainzClientOptions {
    fetchImplementation?: FetchImplementation;
    cacheTtlMs?: number;
    requestIntervalMs?: number;
    timeoutMs?: number;
    now?: () => number;
    sleep?: (milliseconds: number) => Promise<void>;
}

export class MusicBrainzClient {
    private readonly fetchImplementation: FetchImplementation;
    private readonly cacheTtlMs: number;
    private readonly requestIntervalMs: number;
    private readonly timeoutMs: number;
    private readonly now: () => number;
    private readonly sleep: (milliseconds: number) => Promise<void>;
    private readonly cache = new Map<string, CacheEntry<unknown>>();
    private queue: Promise<void> = Promise.resolve();
    private lastRequestStartedAt = Number.NEGATIVE_INFINITY;

    constructor(
        private readonly userAgent: string,
        options: MusicBrainzClientOptions = {},
    ) {
        this.fetchImplementation = options.fetchImplementation ?? fetch;
        this.cacheTtlMs = options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
        this.requestIntervalMs = options.requestIntervalMs ?? DEFAULT_REQUEST_INTERVAL_MS;
        this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
        this.now = options.now ?? Date.now;
        this.sleep = options.sleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
    }

    async searchArtists(query: string): Promise<MusicBrainzArtist[]> {
        const params = new URLSearchParams({
            query: buildArtistSearchQuery(query),
            fmt: 'json',
            limit: '12',
        });
        const response = await this.requestMusicBrainz<{ artists?: unknown[] }>(
            `${MUSICBRAINZ_BASE_URL}/artist?${params}`,
        );
        return (response.artists ?? []).filter(isMusicBrainzArtist);
    }

    async lookupArtist(mbid: string): Promise<MusicBrainzArtist | null> {
        try {
            const artist = await this.requestMusicBrainz<unknown>(`${MUSICBRAINZ_BASE_URL}/artist/${mbid}?fmt=json`);
            return isMusicBrainzArtist(artist) ? artist : null;
        } catch (error) {
            if (error instanceof UpstreamServiceError && error.message.includes('HTTP 404')) return null;
            throw error;
        }
    }

    async lookupReleaseGroup(mbid: string): Promise<MusicBrainzReleaseGroup | null> {
        try {
            const releaseGroup = await this.requestMusicBrainz<unknown>(`${MUSICBRAINZ_BASE_URL}/release-group/${mbid}?fmt=json`);
            return isMusicBrainzReleaseGroup(releaseGroup) ? releaseGroup : null;
        } catch (error) {
            if (error instanceof UpstreamServiceError && error.message.includes('HTTP 404')) return null;
            throw error;
        }
    }

    async searchReleaseGroups(artistMbid: string, query: string): Promise<MusicBrainzReleaseGroup[]> {
        const params = new URLSearchParams({
            query: buildReleaseGroupSearchQuery(artistMbid, query),
            fmt: 'json',
            limit: '12',
        });
        const response = await this.requestMusicBrainz<{ 'release-groups'?: unknown[] }>(
            `${MUSICBRAINZ_BASE_URL}/release-group?${params}`,
        );
        return (response['release-groups'] ?? []).filter(isMusicBrainzReleaseGroup);
    }

    async browseReleaseGroups(artistMbid: string): Promise<MusicBrainzReleaseGroup[]> {
        const params = new URLSearchParams({
            artist: artistMbid,
            type: 'album',
            'release-group-status': 'website-default',
            fmt: 'json',
            limit: '100',
        });
        const response = await this.requestMusicBrainz<{ 'release-groups'?: unknown[] }>(
            `${MUSICBRAINZ_BASE_URL}/release-group?${params}`,
        );
        return (response['release-groups'] ?? [])
            .filter(isMusicBrainzReleaseGroup)
            .sort((left, right) => left.title.localeCompare(right.title));
    }

    async searchReleaseGroupsByArtistName(artistName: string, query = ''): Promise<MusicBrainzReleaseGroup[]> {
        const params = new URLSearchParams({
            query: buildReleaseGroupArtistNameQuery(artistName, query),
            fmt: 'json',
            limit: query.trim() ? '12' : '100',
        });
        const response = await this.requestMusicBrainz<{ 'release-groups'?: unknown[] }>(
            `${MUSICBRAINZ_BASE_URL}/release-group?${params}`,
        );
        return (response['release-groups'] ?? []).filter(isMusicBrainzReleaseGroup);
    }

    async browseReleases(releaseGroupMbid: string): Promise<MusicBrainzRelease[]> {
        const params = new URLSearchParams({
            'release-group': releaseGroupMbid,
            status: 'official',
            inc: 'labels+media+artist-credits+release-groups',
            fmt: 'json',
            limit: '100',
        });
        const response = await this.requestMusicBrainz<{ releases?: unknown[] }>(
            `${MUSICBRAINZ_BASE_URL}/release?${params}`,
        );
        return (response.releases ?? [])
            .filter(isMusicBrainzRelease)
            .sort((left, right) => (left.date ?? '').localeCompare(right.date ?? '')
                || (left.country ?? '').localeCompare(right.country ?? '')
                || left.title.localeCompare(right.title));
    }

    async getReleaseGroupCover(releaseGroupMbid: string): Promise<CoverArtResult> {
        return this.getCover(`${COVER_ART_BASE_URL}/release-group/${releaseGroupMbid}/front-500`);
    }

    private async getCover(imageUrl: string): Promise<CoverArtResult> {
        const response = await this.fetchWithTimeout(imageUrl, {
            method: 'HEAD',
            redirect: 'manual',
            headers: { 'User-Agent': this.userAgent },
        });

        if (response.status === 404) return { imageUrl: null };
        if (response.status === 503) throw new UpstreamServiceError('Cover Art Archive is temporarily unavailable', 503);
        if (response.ok || [301, 302, 303, 307, 308].includes(response.status)) return { imageUrl };

        throw new UpstreamServiceError(`Cover Art Archive returned HTTP ${response.status}`);
    }

    private requestMusicBrainz<T>(url: string): Promise<T> {
        if (!this.userAgent.trim()) {
            return Promise.reject(new UpstreamServiceError('MusicBrainz User-Agent is not configured', 503));
        }

        const cached = this.cache.get(url) as CacheEntry<T> | undefined;
        if (cached && cached.expiresAt > this.now()) return cached.value;
        if (cached) this.cache.delete(url);

        const value = this.schedule(async () => {
            const response = await this.fetchWithTimeout(url, {
                headers: {
                    Accept: 'application/json',
                    'User-Agent': this.userAgent,
                },
            });

            if (response.status === 503) {
                throw new UpstreamServiceError('MusicBrainz is temporarily unavailable', 503);
            }
            if (!response.ok) {
                throw new UpstreamServiceError(`MusicBrainz returned HTTP ${response.status}`);
            }

            try {
                return await response.json() as T;
            } catch {
                throw new UpstreamServiceError('MusicBrainz returned an invalid response');
            }
        });

        this.cache.set(url, { expiresAt: this.now() + this.cacheTtlMs, value });
        void value.catch(() => this.cache.delete(url));
        return value;
    }

    private schedule<T>(task: () => Promise<T>): Promise<T> {
        const scheduled = this.queue.then(async () => {
            const waitTime = Math.max(0, this.lastRequestStartedAt + this.requestIntervalMs - this.now());
            if (waitTime > 0) await this.sleep(waitTime);
            this.lastRequestStartedAt = this.now();
            return task();
        });
        this.queue = scheduled.then(() => undefined, () => undefined);
        return scheduled;
    }

    private async fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
        try {
            return await this.fetchImplementation(url, {
                ...init,
                signal: AbortSignal.timeout(this.timeoutMs),
            });
        } catch (error) {
            if (error instanceof UpstreamServiceError) throw error;
            throw new UpstreamServiceError(`Upstream request failed: ${error instanceof Error ? error.message : 'unknown error'}`);
        }
    }
}
