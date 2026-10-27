import { ApiClient } from '../../api/client.api';
import type { CollectionItem } from '../store/stores/collection.store';
import type { MusicBrainzArtist, MusicBrainzRelease } from '../../../shared/types/database.types';
import { getMusicBrainzReleases } from '../../api/routes/collection.routes';

export interface Track { id: string; number: string; title: string; length?: number | null; disc: number }
export function releaseTracks(release: MusicBrainzRelease | null): Track[] {
    return (release?.media ?? []).flatMap((medium, disc) => (medium.tracks ?? []).map(track => ({
        id: `${disc}:${track.id}`, number: track.number, title: track.title || track.recording?.title || '',
        length: track.length ?? track.recording?.length, disc: disc + 1,
    }))).filter(track => track.title);
}
export async function loadRelease(item: CollectionItem): Promise<MusicBrainzRelease | null> {
    const selection = item.musicbrainz_release_data;
    if (selection && selection.source !== 'common' && selection.source !== 'discogs') {
        return ApiClient.request(`/musicbrainz/release/${encodeURIComponent(selection.id)}/details`);
    }
    if (!item.album_musicbrainz_data) return null;
    const releases = await getMusicBrainzReleases(item.album_musicbrainz_data.id);
    const release = releases[0];
    return release ? ApiClient.request(`/musicbrainz/release/${release.id}/details`) : null;
}
async function publicJson(url: string, signal: AbortSignal) {
    const response = await fetch(url, { signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
}
export interface ArtistSummary { image?: string; description?: string; url?: string }
export async function loadArtistSummary(artist: MusicBrainzArtist, signal: AbortSignal): Promise<ArtistSummary> {
    const details = await ApiClient.request<MusicBrainzArtist>(`/musicbrainz/artist/${artist.id}/details`);
    const relations = details.relations as Array<{ type: string; url?: { resource: string } }> | undefined;
    let article = relations?.find(relation => relation.type === 'wikipedia')?.url?.resource;
    if (!article) {
        const resource = relations?.find(relation => relation.type === 'wikidata')?.url?.resource;
        const id = resource?.match(/\/(Q\d+)$/)?.[1];
        if (id) {
            const data = await publicJson(`https://www.wikidata.org/wiki/Special:EntityData/${id}.json`, signal);
            const title = data.entities?.[id]?.sitelinks?.enwiki?.title;
            if (title) article = `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`;
        }
    }
    if (!article) return {};
    const url = new URL(article);
    if (!/^[a-z-]+\.wikipedia\.org$/.test(url.hostname) || !url.pathname.startsWith('/wiki/')) return {};
    const data = await publicJson(`https://${url.hostname}/api/rest_v1/page/summary/${encodeURIComponent(decodeURIComponent(url.pathname.slice(6)))}`, signal);
    return { image: data.thumbnail?.source, description: data.extract, url: article };
}
export async function loadLyrics(item: CollectionItem, track: Track, signal: AbortSignal): Promise<string | null> {
    const params = new URLSearchParams({ artist_name: item.artist_name, track_name: track.title, album_name: item.album_name });
    if (track.length) params.set('duration', String(Math.round(track.length / 1000)));
    const response = await fetch(`https://lrclib.net/api/get?${params}`, { signal });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error('Lyrics service unavailable');
    const data = await response.json();
    return data.plainLyrics || data.syncedLyrics?.replace(/\[\d+:\d+(?:\.\d+)?\]/g, '') || null;
}
