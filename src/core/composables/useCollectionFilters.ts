import type { Ref } from 'vue';
import { computed, ref } from 'vue';
import type { CollectionItem } from 'core/store/stores/collection.store';

import { DEFAULT_USER_PREFERENCES, type CollectionSort } from '../../../shared/types/database.types';
export type { CollectionSort } from '../../../shared/types/database.types';

export function useCollectionFilters(collection: Ref<CollectionItem[]>) {
    const sort = ref<CollectionSort>(DEFAULT_USER_PREFERENCES.sortBy);
    const search = ref<string | null>('');
    const artist = ref<string[]>([]);
    const album = ref<string[]>([]);
    const year = ref<number[]>([]);

    const activeCount = computed(() => [search.value?.trim(), artist.value.length, album.value.length, year.value.length]
        .filter(Boolean).length);
    const options = computed(() => ({
        artists: uniqueSorted(collection.value.map((item) => item.artist_name)),
        albums: uniqueSorted(collection.value.map((item) => item.album_name)),
        years: [...new Set(collection.value.map((item) => item.album_year).filter((value): value is number => value !== null))]
            .sort((a, b) => b - a),
    }));
    const filtered = computed(() => {
        const query = search.value?.trim().toLocaleLowerCase() ?? '';
        return collection.value.filter((item) => (
            (!query || [item.artist_name, item.album_name, item.album_year]
                .some((value) => String(value ?? '').toLocaleLowerCase().includes(query)))
            && (!artist.value.length || artist.value.includes(item.artist_name))
            && (!album.value.length || album.value.includes(item.album_name))
            && (!year.value.length || (item.album_year !== null && year.value.includes(item.album_year)))
        )).sort((a, b) => {
            const [field, direction] = sort.value.split('-');
            const order = direction === 'asc' ? 1 : -1;
            if (field === 'alphabetic') {
                return order * (a.album_name.localeCompare(b.album_name, undefined, { sensitivity: 'base', numeric: true })
                    || a.artist_name.localeCompare(b.artist_name)) || a.id - b.id;
            }
            const value = (item: CollectionItem) => field === 'releaseDate' ? releaseDate(item)
                : timestamp(field === 'edited' ? item.updated_at || item.created_at : item.created_at);
            const left = value(a), right = value(b);
            // Unknown dates stay last in either direction.
            if (left === null) return right === null ? a.id - b.id : 1;
            if (right === null) return -1;
            return order * (left - right) || a.id - b.id;
        });
    });

    function clear() {
        search.value = '';
        artist.value = [];
        album.value = [];
        year.value = [];
    }

    return { sort, search, artist, album, year, activeCount, options, filtered, clear };
}

const uniqueSorted = (values: string[]) => [...new Set(values)].sort((a, b) => a.localeCompare(b));

function timestamp(value: unknown): number | null {
    if (typeof value !== 'string' || !value) return null;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function releaseDate(item: CollectionItem): number | null {
    const release = item.musicbrainz_release_data;
    return timestamp(release && 'date' in release ? release.date : null)
        ?? timestamp(item.album_musicbrainz_data?.['first-release-date'])
        ?? (item.album_year == null ? null : timestamp(String(item.album_year)));
}
