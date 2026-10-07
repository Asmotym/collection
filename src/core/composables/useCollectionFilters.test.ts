import { expect, it } from 'vitest';
import { ref } from 'vue';
import { useCollectionFilters, type CollectionSort } from './useCollectionFilters';
import type { CollectionItem } from 'core/store/stores/collection.store';

const items = () => [
    { id: 1, album_name: 'Zulu', artist_name: 'Artist', album_year: 2000,
        created_at: '2020-01-01', updated_at: '2024-01-01',
        album_musicbrainz_data: { 'first-release-date': '2000-12-01' } },
    { id: 2, album_name: 'alpha', artist_name: 'Artist', album_year: 2000,
        created_at: '2021-01-01', updated_at: '2023-01-01',
        musicbrainz_release_data: { date: '2000-02-01' } },
    { id: 3, album_name: 'Beta', artist_name: 'Other', album_year: null,
        created_at: '2022-01-01', updated_at: '2025-01-01' },
] as unknown as CollectionItem[];

it.each<[CollectionSort, number[]]>([
    ['added-asc', [1, 2, 3]], ['added-desc', [3, 2, 1]],
    ['edited-asc', [2, 1, 3]], ['edited-desc', [3, 1, 2]],
    ['releaseDate-asc', [2, 1, 3]], ['releaseDate-desc', [1, 2, 3]],
    ['alphabetic-asc', [2, 3, 1]], ['alphabetic-desc', [1, 3, 2]],
])('sorts %s without mutating the source', (sort, expected) => {
    const source = ref(items());
    const filters = useCollectionFilters(source);
    filters.sort.value = sort;
    expect(filters.filtered.value.map((item) => item.id)).toEqual(expected);
    expect(source.value.map((item) => item.id)).toEqual([1, 2, 3]);
});

it('combines search and filters with sorting and retains sorting when cleared', () => {
    const filters = useCollectionFilters(ref(items()));
    filters.sort.value = 'alphabetic-asc';
    filters.search.value = 'artist';
    filters.year.value = [2000];
    expect(filters.filtered.value.map((item) => item.id)).toEqual([2, 1]);
    filters.clear();
    expect(filters.filtered.value.map((item) => item.id)).toEqual([2, 3, 1]);
});

it('falls back to the album year and creation timestamp for older records', () => {
    const source = ref(items());
    source.value[0]!.album_musicbrainz_data = null;
    source.value[0]!.updated_at = '';
    const filters = useCollectionFilters(source);
    filters.sort.value = 'releaseDate-asc';
    expect(filters.filtered.value.map((item) => item.id)).toEqual([1, 2, 3]);
    filters.sort.value = 'edited-asc';
    expect(filters.filtered.value.map((item) => item.id)).toEqual([1, 2, 3]);
});
