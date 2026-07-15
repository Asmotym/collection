export type UserRights = 'user' | 'admin';

export interface DatabaseArtist {
    id: number;
    name: string;
    image: string | null;
}

export interface CollectionUrlMetadata {
    type: 'url';
    name: string;
    value: string;
    showInCards: boolean;
}

export interface CollectionTextMetadata {
    type: 'text';
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
}

export interface DatabaseCollection {
    id: number;
    artist_id: number;
    album_id: number;
    created_by_user_id: string | null;
    created_at: string;
    metadata: CollectionMetadata[];
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
    created_by_user_id: string | null;
    created_by_username: string | null;
    metadata: CollectionMetadata[];
}

export type CreateArtistPayload = Pick<DatabaseArtist, 'name'> & Partial<Pick<DatabaseArtist, 'image'>>;
export type CreateAlbumPayload = Pick<DatabaseAlbum, 'artist_id' | 'name' | 'year' | 'image'>;
export type UpdateArtistPayload = Pick<DatabaseArtist, 'name' | 'image'>;
export type UpdateAlbumPayload = Pick<DatabaseAlbum, 'artist_id' | 'name' | 'year' | 'image'>;
export type CreateCollectionPayload = Pick<DatabaseCollection, 'artist_id' | 'album_id' | 'created_by_user_id'>
    & Partial<Pick<DatabaseCollection, 'metadata'>>;
export type UpdateCollectionPayload = Pick<DatabaseCollection, 'metadata'>;
