import { describe, expect, it } from 'vitest';
import { computed, ref } from 'vue';
import { buildCategoryTree, categoryPath, descendantCategoryIds } from './category-tree.utils';
import { useCollectionFilters } from 'core/composables/useCollectionFilters';
import type { DatabaseCategory } from '../../../shared/types/database.types';
import type { CollectionItem } from 'core/store/stores/collection.store';

const category = (id: number, parent_id: number | null, position: number, name: string): DatabaseCategory => ({
    id, parent_id, position, name, created_by_user_id: 'user', created_at: '',
});
const categories = [category(1, null, 1, 'Second'), category(2, null, 0, 'First'),
    category(3, 2, 0, 'Child'), category(4, 3, 0, 'Grandchild')];

describe('category tree', () => {
    it('builds a manually ordered three-level tree and paths', () => {
        const tree = buildCategoryTree(categories);
        expect(tree.map((node) => node.id)).toEqual([2, 1]);
        expect(tree[0].children[0].children[0].id).toBe(4);
        expect(categoryPath(4, categories)).toBe('First > Child > Grandchild');
    });

    it('includes the selected category and all descendants', () => {
        expect([...descendantCategoryIds(2, categories)]).toEqual([2, 3, 4]);
    });
});

describe('category-scoped collection filters', () => {
    const item = (id: number, artist: string, category_ids: number[]) => ({
        id, artist_name: artist, album_name: `Album ${id}`, album_year: 2000 + id, category_ids,
    } as CollectionItem);

    it('rescopes options and clears active filters', () => {
        const collection = ref([item(1, 'One', [2]), item(2, 'Two', [1])]);
        const selected = ref<number | null>(null);
        const scoped = computed(() => selected.value === null ? collection.value
            : collection.value.filter((entry) => entry.category_ids.includes(selected.value!)));
        const filters = useCollectionFilters(scoped);
        filters.artist.value = ['One'];
        selected.value = 1;
        filters.clear();
        expect(filters.artist.value).toEqual([]);
        expect(filters.options.value.artists).toEqual(['Two']);
        expect(filters.filtered.value.map((entry) => entry.id)).toEqual([2]);
    });

    it('matches any selected artist and combines with other filters', () => {
        const collection = ref([item(1, 'One', []), item(2, 'Two', []), item(3, 'Three', [])]);
        const filters = useCollectionFilters(collection);
        expect(filters.activeCount.value).toBe(0);
        filters.artist.value = ['One', 'Two'];
        expect(filters.filtered.value.map((entry) => entry.id)).toEqual([1, 2]);
        expect(filters.activeCount.value).toBe(1);

        filters.year.value = [2002];
        expect(filters.filtered.value.map((entry) => entry.id)).toEqual([2]);
        expect(filters.activeCount.value).toBe(2);

        filters.clear();
        expect(filters.filtered.value).toEqual(collection.value);
        expect(filters.activeCount.value).toBe(0);
    });

    it('matches multiple albums and years, and restores results when selections are cleared', () => {
        const collection = ref([
            item(1, 'One', []), item(2, 'Two', []), item(3, 'Three', []),
            { ...item(4, 'Four', []), album_year: null },
        ]);
        const filters = useCollectionFilters(collection);
        filters.album.value = ['Album 1', 'Album 2'];
        expect(filters.filtered.value.map((entry) => entry.id)).toEqual([1, 2]);
        expect(filters.activeCount.value).toBe(1);

        filters.year.value = [2002, 2003];
        expect(filters.filtered.value.map((entry) => entry.id)).toEqual([2]);
        expect(filters.activeCount.value).toBe(2);

        filters.album.value = [];
        expect(filters.filtered.value.map((entry) => entry.id)).toEqual([2, 3]);
        expect(filters.activeCount.value).toBe(1);

        filters.year.value = [];
        expect(filters.filtered.value).toEqual(collection.value);
        expect(filters.activeCount.value).toBe(0);

        filters.album.value = ['Album 1', 'Album 2'];
        filters.year.value = [2001, 2002];
        filters.clear();
        expect(filters.album.value).toEqual([]);
        expect(filters.year.value).toEqual([]);
        expect(filters.filtered.value).toEqual(collection.value);
        expect(filters.activeCount.value).toBe(0);
    });
});
