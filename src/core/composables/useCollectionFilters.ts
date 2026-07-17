import type { Ref } from 'vue';
import { computed, ref } from 'vue';
import type { CollectionItem } from 'core/store/stores/collection.store';

export function useCollectionFilters(collection: Ref<CollectionItem[]>) {
    const search = ref<string | null>('');
    const artist = ref<string | null>(null);
    const album = ref<string | null>(null);
    const year = ref<number | null>(null);

    const activeCount = computed(() => [search.value?.trim(), artist.value, album.value, year.value]
        .filter((value) => value !== null && value !== undefined && value !== '').length);
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
            && (!artist.value || item.artist_name === artist.value)
            && (!album.value || item.album_name === album.value)
            && (year.value === null || item.album_year === year.value)
        ));
    });

    function clear() {
        search.value = '';
        artist.value = null;
        album.value = null;
        year.value = null;
    }

    return { search, artist, album, year, activeCount, options, filtered, clear };
}

const uniqueSorted = (values: string[]) => [...new Set(values)].sort((a, b) => a.localeCompare(b));
