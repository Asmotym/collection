import type { Ref } from 'vue';
import { computed, ref } from 'vue';
import type { CollectionItem } from 'core/store/stores/collection.store';

export function useCollectionFilters(collection: Ref<CollectionItem[]>) {
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
        ));
    });

    function clear() {
        search.value = '';
        artist.value = [];
        album.value = [];
        year.value = [];
    }

    return { search, artist, album, year, activeCount, options, filtered, clear };
}

const uniqueSorted = (values: string[]) => [...new Set(values)].sort((a, b) => a.localeCompare(b));
