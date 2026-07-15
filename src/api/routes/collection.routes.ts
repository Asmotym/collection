import { ApiClient } from "../client.api";
import type { CollectionItem } from "core/store/stores/collection.store";
import type {
    CreateAlbumPayload,
    CreateArtistPayload,
    CreateCollectionPayload,
    DatabaseAlbum,
    DatabaseArtist,
    UpdateAlbumPayload,
    UpdateArtistPayload,
    UpdateCollectionPayload,
} from "../../../shared/types/database.types";

export async function getAll(createdByUserId?: string) {
    const params = new URLSearchParams();

    if (createdByUserId) {
        params.set('created_by_user_id', createdByUserId);
    }

    const queryString = params.toString();
    return await ApiClient.request<CollectionItem[]>(`/collection${queryString ? `?${queryString}` : ''}`);
}

export async function getArtists() {
    return await ApiClient.request<DatabaseArtist[]>('/artists');
}

export async function getAlbums(artistId?: number) {
    const params = new URLSearchParams();

    if (artistId) {
        params.set('artist_id', String(artistId));
    }

    const queryString = params.toString();
    return await ApiClient.request<DatabaseAlbum[]>(`/albums${queryString ? `?${queryString}` : ''}`);
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

export async function updateArtist(id: number, payload: UpdateArtistPayload) {
    return await ApiClient.request<DatabaseArtist>(`/artists/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
    });
}

export async function updateAlbum(id: number, payload: UpdateAlbumPayload) {
    return await ApiClient.request<DatabaseAlbum>(`/albums/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
    });
}

export async function createCollection(payload: CreateCollectionPayload) {
    return await ApiClient.request<CollectionItem>('/collection', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
}

export async function updateCollection(id: number, payload: UpdateCollectionPayload) {
    return await ApiClient.request<CollectionItem>(`/collection/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
    });
}

export async function deleteCollection(id: number) {
    return await ApiClient.request<{ id: number }>(`/collection/${id}`, {
        method: 'DELETE',
    });
}
