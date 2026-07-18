export type CatalogSource = 'musicbrainz' | 'discogs' | 'lastfm';
export type CatalogProviderSource = CatalogSource | 'fanart';
export type CatalogEntityKind = 'artist' | 'release-group' | 'master' | 'release' | 'album';

export interface CatalogExternalReference {
    source: CatalogSource;
    kind: CatalogEntityKind;
    externalId: string;
    externalUrl: string;
    musicBrainzId?: string;
}

export interface CatalogProviderError {
    code: string;
    message: string;
}

export interface CatalogProviderSection<T> {
    source: CatalogProviderSource;
    status: 'ok' | 'error' | 'disabled';
    items: T[];
    error?: CatalogProviderError;
}

export interface CatalogArtistResult extends CatalogExternalReference {
    kind: 'artist';
    name: string;
    musicBrainzId?: string;
    subtitle?: string;
    rawMusicBrainz?: Record<string, unknown>;
}

export interface CatalogCoverCandidate {
    source: 'cover-art-archive' | 'discogs' | 'fanart';
    entityType: 'release-group' | 'master' | 'release';
    entityId: string;
    previewUrl: string;
    externalUrl: string;
}

export interface CatalogAlbumResult extends CatalogExternalReference {
    kind: 'release-group' | 'master' | 'release' | 'album';
    title: string;
    artistName: string;
    year?: number;
    musicBrainzId?: string;
    cover?: CatalogCoverCandidate;
    rawMusicBrainz?: Record<string, unknown>;
}

export interface CatalogEditionResult {
    source: 'musicbrainz' | 'discogs';
    id: string;
    title: string;
    externalUrl: string;
    date?: string;
    year?: number;
    country?: string;
    formats?: string[];
    labels?: string[];
    catalogNumber?: string;
    barcode?: string;
    rawMusicBrainz?: Record<string, unknown>;
}

export interface DiscogsReleaseSelection {
    source: 'discogs';
    id: string;
    kind: 'release';
    externalUrl: string;
}

export interface MusicBrainzReleaseSelection {
    source: 'musicbrainz';
    id: string;
    title: string;
    [key: string]: unknown;
}

export interface CatalogCoverReference {
    source: 'manual' | 'cover-art-archive' | 'discogs' | 'fanart';
    kind?: 'release-group' | 'master' | 'release';
    externalId?: string;
    externalUrl?: string;
}

export interface CatalogAlbumSearchParams {
    artistName: string;
    query: string;
    musicbrainzId?: string;
    discogsId?: string;
    lastfmId?: string;
}

export interface CatalogCoverSearchPayload {
    artistName: string;
    albumTitle: string;
    references: CatalogExternalReference[];
}
