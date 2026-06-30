import { defineStore } from "pinia";
import { api } from "api/api";
import type {
    CreateAlbumPayload,
    CreateArtistPayload,
    CreateCollectionPayload,
    DatabaseAlbum,
    DatabaseArtist,
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
    getAll(): Promise<CollectionItem[]>;
    getArtists(): Promise<DatabaseArtist[]>;
    getAlbums(): Promise<DatabaseAlbum[]>;
    createArtist(payload: CreateArtistPayload): Promise<DatabaseArtist>;
    createAlbum(payload: CreateAlbumPayload): Promise<DatabaseAlbum>;
    createCollection(payload: CreateCollectionPayload): Promise<CollectionItem>;
}

export const useCollectionStore = defineStore('collection', {
    state: (): CollectionState => ({
        collection: [],
        artists: [],
        albums: [],
    }),
    getters: {},
    actions: {
        async getAll(): Promise<CollectionItem[]> {
            const response = await api.collection.getAll();
            this.collection = response as CollectionItem[];
            return this.collection;
        },
        async getArtists(): Promise<DatabaseArtist[]> {
            const response = await api.collection.getArtists();
            this.artists = response;
            return this.artists;
        },
        async getAlbums(): Promise<DatabaseAlbum[]> {
            const response = await api.collection.getAlbums();
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
        async createCollection(payload: CreateCollectionPayload): Promise<CollectionItem> {
            const item = await api.collection.createCollection(payload);
            this.collection.push(item);
            return item;
        },
    },
})
