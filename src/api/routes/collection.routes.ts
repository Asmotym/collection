import { ApiClient } from "../client.api";
import type { CollectionItem } from "core/store/stores/collection.store";
import type {
    CreateAlbumPayload,
    CreateArtistPayload,
    CreateCollectionPayload,
    DatabaseAlbum,
    DatabaseArtist,
} from "../../../shared/types/database.types";

export async function getAll() {
    return await ApiClient.request<CollectionItem[]>('/collection');
}

export async function getArtists() {
    return await ApiClient.request<DatabaseArtist[]>('/artists');
}

export async function getAlbums() {
    return await ApiClient.request<DatabaseAlbum[]>('/albums');
}

export async function createArtist(payload: CreateArtistPayload) {
    return await ApiClient.request<DatabaseArtist>('/artists', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
}

export async function createAlbum(payload: CreateAlbumPayload) {
    return await ApiClient.request<DatabaseAlbum>('/albums', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
}

export async function createCollection(payload: CreateCollectionPayload) {
    return await ApiClient.request<CollectionItem>('/collection', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
}
