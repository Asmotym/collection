import { ApiClient } from "../client.api";
import type { CollectionItem } from "core/store/stores/collection.store";
import type {
    CreateAlbumPayload,
    CreateArtistPayload,
    ComposeCollectionPayload,
    ComposeCollectionResult,
    CreateCollectionPayload,
    CoverArtResult,
    DatabaseAlbum,
    DatabaseArtist,
    MusicBrainzArtist,
    MusicBrainzRelease,
    MusicBrainzReleaseGroup,
    UpdateAlbumPayload,
    UpdateArtistPayload,
    UpdateCollectionPayload,
} from "../../../shared/types/database.types";
import type {
    CatalogAlbumSearchParams,
    CatalogAlbumResult,
    CatalogArtistResult,
    CatalogCoverCandidate,
    CatalogCoverSearchPayload,
    CatalogEditionResult,
    CatalogProviderSection,
    CatalogSource,
} from "../../../shared/types/catalog.types";

export async function searchCatalogArtists(query: string) {
    const params = new URLSearchParams({ query });
    return await ApiClient.request<CatalogProviderSection<CatalogArtistResult>[]>(`/catalog/artists?${params}`);
}

export async function searchCatalogAlbums(search: CatalogAlbumSearchParams) {
    const params = new URLSearchParams({ artistName: search.artistName, query: search.query });
    if (search.musicbrainzId) params.set('musicbrainzId', search.musicbrainzId);
    if (search.discogsId) params.set('discogsId', search.discogsId);
    if (search.lastfmId) params.set('lastfmId', search.lastfmId);
    return await ApiClient.request<CatalogProviderSection<CatalogAlbumResult>[]>(`/catalog/albums?${params}`);
}

export async function getCatalogEditions(source: CatalogSource, kind: string, id: string) {
    return await ApiClient.request<CatalogEditionResult[]>(
        `/catalog/albums/${encodeURIComponent(source)}/${encodeURIComponent(kind)}/${encodeURIComponent(id)}/editions`,
    );
}

export async function searchCatalogCovers(payload: CatalogCoverSearchPayload) {
    return await ApiClient.request<CatalogProviderSection<CatalogCoverCandidate>[]>('/catalog/covers', {
        method: 'POST', body: JSON.stringify(payload),
    });
}

export async function searchMusicBrainzArtists(query: string) {
    const params = new URLSearchParams({ query });
    return await ApiClient.request<MusicBrainzArtist[]>(`/musicbrainz/artists?${params}`);
}

export async function searchMusicBrainzReleaseGroups(artistMbid: string, query: string) {
    const params = new URLSearchParams({ query });
    return await ApiClient.request<MusicBrainzReleaseGroup[]>(
        `/musicbrainz/artists/${encodeURIComponent(artistMbid)}/release-groups?${params}`,
    );
}

export async function getMusicBrainzReleases(releaseGroupMbid: string) {
    return await ApiClient.request<MusicBrainzRelease[]>(
        `/musicbrainz/release-groups/${encodeURIComponent(releaseGroupMbid)}/releases`,
    );
}

export async function getReleaseGroupCover(releaseGroupMbid: string) {
    return await ApiClient.request<CoverArtResult>(
        `/cover-art/release-groups/${encodeURIComponent(releaseGroupMbid)}`,
    );
}

export async function getAll(createdByUserId: string) {
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

export async function deleteArtist(id: number) {
    return await ApiClient.request<{ id: number }>(`/artists/${id}`, { method: 'DELETE' });
}

export async function updateAlbum(id: number, payload: UpdateAlbumPayload) {
    return await ApiClient.request<DatabaseAlbum>(`/albums/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
    });
}

export async function deleteAlbum(id: number) {
    return await ApiClient.request<{ id: number }>(`/albums/${id}`, { method: 'DELETE' });
}

export async function createCollection(payload: CreateCollectionPayload) {
    return await ApiClient.request<CollectionItem>('/collection', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
}

export async function composeCollection(payload: ComposeCollectionPayload) {
    return await ApiClient.request<ComposeCollectionResult>('/collection/compose', {
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

export async function deleteCollection(id: number, userId: string) {
    const query = new URLSearchParams({ created_by_user_id: userId });
    return await ApiClient.request<{ id: number }>(`/collection/${id}?${query}`, {
        method: 'DELETE',
    });
}
