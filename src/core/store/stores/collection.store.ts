import { defineStore } from "pinia";
import { api } from "api/api";
import type {
    CreateAlbumPayload,
    CreateArtistPayload,
    CreateCollectionPayload,
    DatabaseAlbum,
    DatabaseArtist,
    UpdateAlbumPayload,
    UpdateArtistPayload,
    UpdateCollectionPayload,
    DatabaseCollectionItem,
} from "../../../../shared/types/database.types";

export type CollectionItem = DatabaseCollectionItem;

export interface CollectionState {
    collection: CollectionItem[];
    artists: DatabaseArtist[];
    albums: DatabaseAlbum[];
}

export interface CollectionGetters {}

export interface CollectionActions {
    getAll(createdByUserId?: string): Promise<CollectionItem[]>;
    getArtists(): Promise<DatabaseArtist[]>;
    getAlbums(artistId?: number): Promise<DatabaseAlbum[]>;
    createArtist(payload: CreateArtistPayload): Promise<DatabaseArtist>;
    createAlbum(payload: CreateAlbumPayload): Promise<DatabaseAlbum>;
    updateArtist(id: number, payload: UpdateArtistPayload): Promise<DatabaseArtist>;
    updateAlbum(id: number, payload: UpdateAlbumPayload): Promise<DatabaseAlbum>;
    deleteArtist(id: number): Promise<void>;
    deleteAlbum(id: number): Promise<void>;
    createCollection(payload: CreateCollectionPayload): Promise<CollectionItem>;
    updateCollection(id: number, payload: UpdateCollectionPayload): Promise<CollectionItem>;
    deleteCollection(id: number): Promise<void>;
}

export const useCollectionStore = defineStore('collection', {
    state: (): CollectionState => ({
        collection: [],
        artists: [],
        albums: [],
    }),
    getters: {},
    actions: {
        async getAll(createdByUserId?: string): Promise<CollectionItem[]> {
            const response = await api.collection.getAll(createdByUserId);
            this.collection = response as CollectionItem[];
            return this.collection;
        },
        async getArtists(): Promise<DatabaseArtist[]> {
            const response = await api.collection.getArtists();
            this.artists = response;
            return this.artists;
        },
        async getAlbums(artistId?: number): Promise<DatabaseAlbum[]> {
            const response = await api.collection.getAlbums(artistId);
            this.albums = response;
            return this.albums;
        },
        async createArtist(payload: CreateArtistPayload): Promise<DatabaseArtist> {
            const artist = await api.collection.createArtist(payload);
            this.artists.push(artist);
            return artist;
        },
        async createAlbum(payload: CreateAlbumPayload): Promise<DatabaseAlbum> {
            const album = await api.collection.createAlbum(payload);
            this.albums.push(album);
            return album;
        },
        async updateArtist(id: number, payload: UpdateArtistPayload): Promise<DatabaseArtist> {
            const artist = await api.collection.updateArtist(id, payload);
            const index = this.artists.findIndex((item) => item.id === id);

            if (index !== -1) {
                this.artists[index] = artist;
            }

            for (const album of this.albums) {
                if (album.artist_id === id) album.artist_name = artist.name;
            }
            for (const item of this.collection) {
                if (item.artist_id === id) {
                    item.artist_name = artist.name;
                    item.artist_musicbrainz_data = artist.musicbrainz_data;
                }
            }
            return artist;
        },
        async updateAlbum(id: number, payload: UpdateAlbumPayload): Promise<DatabaseAlbum> {
            const album = await api.collection.updateAlbum(id, payload);
            const index = this.albums.findIndex((item) => item.id === id);

            if (index !== -1) {
                this.albums[index] = album;
            }

            for (const item of this.collection) {
                if (item.album_id === id) {
                    item.artist_id = album.artist_id ?? item.artist_id;
                    item.artist_name = album.artist_name ?? item.artist_name;
                    item.album_name = album.name;
                    item.album_year = album.year;
                    item.album_image = album.image;
                    item.album_musicbrainz_data = album.musicbrainz_data;
                    item.artist_musicbrainz_data = this.artists.find((artist) => artist.id === album.artist_id)
                        ?.musicbrainz_data ?? item.artist_musicbrainz_data;
                }
            }
            return album;
        },
        async deleteArtist(id: number): Promise<void> {
            await api.collection.deleteArtist(id);
            const albumIds = new Set(this.albums.filter((album) => album.artist_id === id).map((album) => album.id));
            this.artists = this.artists.filter((artist) => artist.id !== id);
            this.albums = this.albums.filter((album) => album.artist_id !== id);
            this.collection = this.collection.filter((item) => item.artist_id !== id && !albumIds.has(item.album_id));
        },
        async deleteAlbum(id: number): Promise<void> {
            await api.collection.deleteAlbum(id);
            this.albums = this.albums.filter((album) => album.id !== id);
            this.collection = this.collection.filter((item) => item.album_id !== id);
        },
        async createCollection(payload: CreateCollectionPayload): Promise<CollectionItem> {
            const item = await api.collection.createCollection(payload);
            this.collection.push(item);
            return item;
        },
        async updateCollection(id: number, payload: UpdateCollectionPayload): Promise<CollectionItem> {
            const item = await api.collection.updateCollection(id, payload);
            const index = this.collection.findIndex((collectionItem) => collectionItem.id === id);

            if (index !== -1) {
                this.collection[index] = item;
            }

            return item;
        },
        async deleteCollection(id: number): Promise<void> {
            await api.collection.deleteCollection(id);
            this.collection = this.collection.filter((item) => item.id !== id);
        },
    },
})
