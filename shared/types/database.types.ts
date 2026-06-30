export type UserRights = 'user' | 'admin';

export interface DatabaseArtist {
    id: number;
    name: string;
}

export interface DatabaseAlbum {
    id: number;
    name: string;
    year: number | null;
    image: string | null;
}

export interface DatabaseCollection {
    id: number;
    artist_id: number;
    album_id: number;
    created_at: string;
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
}

export type CreateArtistPayload = Pick<DatabaseArtist, 'name'>;
export type CreateAlbumPayload = Pick<DatabaseAlbum, 'name' | 'year' | 'image'>;
export type CreateCollectionPayload = Pick<DatabaseCollection, 'artist_id' | 'album_id'>;
