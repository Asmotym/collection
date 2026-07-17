export type UserRights = 'user' | 'admin';

export interface MusicBrainzArea {
    id?: string;
    name?: string;
    'sort-name'?: string;
    type?: string | null;
}

export interface MusicBrainzLifeSpan {
    begin?: string | null;
    end?: string | null;
    ended?: boolean | null;
}

export interface MusicBrainzArtist {
    id: string;
    name: string;
    'sort-name'?: string;
    disambiguation?: string;
    type?: string | null;
    country?: string | null;
    area?: MusicBrainzArea | null;
    'life-span'?: MusicBrainzLifeSpan | null;
    score?: number;
    [key: string]: unknown;
}

export interface MusicBrainzArtistCredit {
    name: string;
    joinphrase?: string;
    artist: MusicBrainzArtist;
}

export interface MusicBrainzReleaseGroup {
    id: string;
    title: string;
    'first-release-date'?: string;
    'primary-type'?: string | null;
    'secondary-types'?: string[];
    'artist-credit'?: MusicBrainzArtistCredit[];
    disambiguation?: string;
    score?: number;
    [key: string]: unknown;
}

export interface MusicBrainzReleaseMedia {
    format?: string | null;
    title?: string | null;
    'track-count'?: number;
}

export interface MusicBrainzReleaseLabelInfo {
    'catalog-number'?: string | null;
    label?: { id?: string; name?: string } | null;
}

export interface MusicBrainzRelease {
    id: string;
    title: string;
    date?: string;
    country?: string | null;
    status?: string | null;
    barcode?: string | null;
    disambiguation?: string;
    media?: MusicBrainzReleaseMedia[];
    'label-info'?: MusicBrainzReleaseLabelInfo[];
    'artist-credit'?: MusicBrainzArtistCredit[];
    'release-group'?: Pick<MusicBrainzReleaseGroup, 'id' | 'title' | 'primary-type'>;
    [key: string]: unknown;
}

export interface CommonReleaseSelection {
    source: 'common';
    id: string;
    title: string;
    format: string;
}

export type CollectionReleaseSelection = MusicBrainzRelease | CommonReleaseSelection;

export interface CoverArtResult {
    imageUrl: string | null;
}

export interface DatabaseArtist {
    id: number;
    name: string;
    image: string | null;
    musicbrainz_data: MusicBrainzArtist | null;
}

export interface CollectionUrlMetadata {
    type: 'url';
    name: string;
    value: string;
    showInCards: boolean;
}

export interface CollectionTextMetadata {
    type: 'text';
    title?: string;
    value: string;
    showInCards: boolean;
}

export type CollectionMetadata = CollectionUrlMetadata | CollectionTextMetadata;

export interface DatabaseAlbum {
    id: number;
    artist_id: number | null;
    artist_name?: string | null;
    name: string;
    year: number | null;
    image: string | null;
    musicbrainz_data: MusicBrainzReleaseGroup | null;
}

export interface DatabaseCollection {
    id: number;
    artist_id: number;
    album_id: number;
    created_by_user_id: string | null;
    created_at: string;
    metadata: CollectionMetadata[];
    musicbrainz_release_data: CollectionReleaseSelection | null;
}

export interface DatabaseUser {
    discord_user_id?: string;
    username: string;
    avatar: string | null;
    rights: UserRights;
    rights_update?: boolean;
    rights_testing_ground?: boolean;
}

export interface DatabaseCollectionItem {
    id: number;
    album_id: number;
    album_name: string;
    album_image: string | null;
    album_year: number | null;
    artist_id: number;
    artist_name: string;
    artist_musicbrainz_data: MusicBrainzArtist | null;
    album_musicbrainz_data: MusicBrainzReleaseGroup | null;
    musicbrainz_release_data: CollectionReleaseSelection | null;
    created_by_user_id: string | null;
    created_by_username: string | null;
    metadata: CollectionMetadata[];
}

export type CreateArtistPayload = Pick<DatabaseArtist, 'name'>
    & Partial<Pick<DatabaseArtist, 'image' | 'musicbrainz_data'>>;
export type CreateAlbumPayload = Pick<DatabaseAlbum, 'artist_id' | 'name' | 'year' | 'image' | 'musicbrainz_data'>;
export type UpdateArtistPayload = Pick<DatabaseArtist, 'name' | 'image'>;
export type UpdateAlbumPayload = Pick<DatabaseAlbum, 'artist_id' | 'name' | 'year' | 'image'>;
export type CreateCollectionPayload = Pick<DatabaseCollection, 'artist_id' | 'album_id' | 'created_by_user_id'>
    & Partial<Pick<DatabaseCollection, 'metadata' | 'musicbrainz_release_data'>>;
export type UpdateCollectionPayload = Pick<DatabaseCollection, 'metadata' | 'musicbrainz_release_data'>;
