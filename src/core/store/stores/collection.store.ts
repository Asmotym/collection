import { defineStore } from "pinia";
import { api } from "api/api";

export interface CollectionItem {
    id: number;
    album_id: number;
    album_name: string;
    album_image: string;
    album_year: number;
    artist_id: number;
    artist_name: string;
}

export interface CollectionState {
    collection: CollectionItem[];
}

export interface CollectionGetters {}

export interface CollectionActions {
    getAll(): Promise<void>;
}

export const useCollectionStore = defineStore('collection', {
    state: (): CollectionState => ({
        collection: [],
    }),
    getters: {},
    actions: {
        async getAll(): Promise<CollectionItem[]> {
            const response = await api.collection.getAll();
            this.collection = response as CollectionItem[];
            return this.collection;
        },
    },
})