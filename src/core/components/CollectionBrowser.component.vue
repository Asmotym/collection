<template>
        <v-navigation-drawer
            v-if="categories.length"
            v-model="drawerOpen"
            id="collection-categories-panel"
            :width="256"
            :temporary="mobile"
            disable-resize-watcher
            class="category-drawer"
        >
            <div class="px-3 py-2">
                <h2 class="text-h6 ma-0">{{ t('categories.title') }}</h2>
            </div>
            <v-divider />
            <v-list nav :aria-label="t('categories.navigation')">
                <v-list-item prepend-icon="mdi-view-grid" :title="t('categories.all')"
                    :active="selectedCategoryId === null" @click="selectCategory(null)" />
                <CategoryNavigationList :nodes="categoryTree" :selected-id="selectedCategoryId"
                    @select="selectCategory" />
            </v-list>
        </v-navigation-drawer>
        <v-btn
            v-if="categories.length"
            class="category-drawer-toggle"
            :class="{ 'category-drawer-toggle--open': drawerOpen }"
            :icon="drawerOpen ? 'mdi-chevron-left' : 'mdi-chevron-right'"
            color="surface"
            variant="elevated"
            :aria-label="t(drawerOpen ? 'categories.hideNavigation' : 'categories.openNavigation')"
            :aria-expanded="drawerOpen"
            aria-controls="collection-categories-panel"
            @click="drawerOpen = !drawerOpen"
        />
        <CollectionFilters
            v-model="filtersOpen"
            v-if="collection.length"
            v-model:artist="filters.artist.value"
            v-model:album="filters.album.value"
            v-model:year="filters.year.value"
            :artists="filters.options.value.artists"
            :albums="filters.options.value.albums"
            :years="filters.options.value.years"
            :active-count="filters.activeCount.value"
            @clear="filters.clear"
        />

        <v-container class="py-6">
            <div class="collection-heading mb-4">
                <h1 class="text-h4">{{ title }}</h1>
                <div v-if="collection.length" class="collection-toolbar">
                    <div class="collection-search-sort">
                        <v-text-field
                            v-model="search"
                            :label="t('home.filters.search')"
                            :placeholder="t('home.filters.searchPlaceholder')"
                            prepend-inner-icon="mdi-magnify"
                            variant="outlined"
                            density="compact"
                            clearable
                            hide-details
                            class="collection-search"
                        />
                        <v-select
                            v-model="filters.sort.value"
                            :items="sortOptions"
                            :label="t('home.sort.label')"
                            variant="outlined"
                            density="compact"
                            hide-details
                            class="collection-sort"
                        >
                            <template #selection="{ item }">
                                <v-icon :icon="item.icon" size="small" class="mr-1" aria-hidden="true" />
                                <span>{{ item.label }}</span>
                            </template>
                            <template #item="{ props: itemProps, item }">
                                <v-list-item v-bind="itemProps" :prepend-icon="item.icon" :aria-label="item.accessibleLabel" />
                            </template>
                        </v-select>
                    </div>
                    <div class="collection-size-control">
                        <span class="text-body-2 text-medium-emphasis">{{ t('home.viewSize.label') }}</span>
                        <v-btn-toggle
                            v-model="cardSize"
                            mandatory
                            divided
                            density="compact"
                            variant="outlined"
                            :aria-label="t('home.viewSize.label')"
                        >
                            <v-btn value="large">{{ t('home.viewSize.large') }}</v-btn>
                            <v-btn value="medium">{{ t('home.viewSize.medium') }}</v-btn>
                            <v-btn value="small">{{ t('home.viewSize.small') }}</v-btn>
                        </v-btn-toggle>
                    </div>
                </div>
            </div>
            <AppSkeleton v-if="collectionLoading" variant="cards" :count="8" :label="t('common.loading')" />
            <v-alert v-else-if="error" type="error">{{ error }}</v-alert>
            <v-row
                v-else-if="filters.filtered.value.length"
                class="collection-grid"
                :class="`collection-grid--${cardSize}`"
                justify="center"
            >
                <v-col
                    v-for="item in filters.filtered.value"
                    :key="item.id"
                    class="collection-grid-item"
                    cols="6"
                    sm="6"
                >
                    <CollectionCard :item="item" @open="openDetails(item)" />
                </v-col>
            </v-row>
            <v-empty-state
                v-else-if="selectedCategoryId !== null && categoryScopedCollection.length === 0"
                icon="mdi-folder-open-outline"
                :title="t('categories.emptySelectionTitle')"
                :text="t('categories.emptySelectionText')"
            />
            <v-empty-state
                v-else-if="collection.length"
                icon="mdi-filter-off-outline"
                :title="t('home.filters.noResultsTitle')"
                :text="t('home.filters.noResultsText')"
            />
            <v-empty-state v-else :title="t('profile.emptyCollection')" icon="mdi-music-box-multiple-outline" />
        </v-container>

        <CollectionDetailsDialog
            v-model="detailDialogOpen"
            :item="selectedItem"
            @closed="selectedItem = null"
        />
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useDisplay } from 'vuetify';
import { useI18n } from 'vue-i18n';
import AppSkeleton from 'core/components/AppSkeleton.component.vue';
import CollectionCard from 'core/components/CollectionCard.component.vue';
import CollectionDetailsDialog from 'core/components/CollectionDetailsDialog.component.vue';
import CollectionFilters from 'core/components/CollectionFilters.component.vue';
import CategoryNavigationList from 'core/components/CategoryNavigationList.component.vue';
import { buildCategoryTree, descendantCategoryIds } from 'core/utils/category-tree.utils';
import { useCollectionFilters } from 'core/composables/useCollectionFilters';
import type { CollectionItem } from 'core/store/stores/collection.store';
import { DEFAULT_USER_PREFERENCES, isCollectionSort, type CardSizePreference, type DatabaseCategory } from '../../../shared/types/database.types';
import { DiscordService } from 'modules/discord-auth/services/discord.service';

const { t } = useI18n();
const discordService = DiscordService.getInstance();
const props = defineProps<{
    collection: CollectionItem[]; categories: DatabaseCategory[];
    title: string; collectionLoading: boolean; error?: string;
}>();
const collection = computed(() => props.collection);
const categories = computed(() => props.categories);
const selectedItem = ref<CollectionItem | null>(null);
const detailDialogOpen = ref(false);
const cardSize = ref<CardSizePreference>(DEFAULT_USER_PREFERENCES.cardSize);
const { mobile } = useDisplay();
const filtersOpen = ref(!mobile.value);
const drawerOpen = ref(!mobile.value);
const selectedCategoryId = ref<number | null>(null);
const categoryTree = computed(() => buildCategoryTree(categories.value));
const categoryScopedCollection = computed(() => {
    if (selectedCategoryId.value === null) return collection.value;
    const ids = descendantCategoryIds(selectedCategoryId.value, categories.value);
    return collection.value.filter((item) => item.category_ids.some((id) => ids.has(id)));
});
const filters = useCollectionFilters(categoryScopedCollection);
const { search } = filters;
const sortOptions = computed(() => ['added', 'edited', 'releaseDate', 'alphabetic'].flatMap((field) =>
    ['asc', 'desc'].map((direction) => ({
        value: `${field}-${direction}`,
        label: t(`home.sort.${field}`),
        title: t(`home.sort.${field}`),
        accessibleLabel: `${t(`home.sort.${field}`)} — ${t(`home.sort.${direction}`)}`,
        icon: direction === 'asc' ? 'mdi-arrow-up' : 'mdi-arrow-down',
    })),
));

function selectCategory(id: number | null) {
    selectedCategoryId.value = id;
    filters.clear();
    if (mobile.value) drawerOpen.value = false;
}

function openDetails(item: CollectionItem) {
    selectedItem.value = item;
    detailDialogOpen.value = true;
}

watch(() => discordService.user.value?.preferences.cardSize, (size) => {
    const saved = localStorage.getItem('collection_card_size');
    cardSize.value = size ?? (saved === 'small' || saved === 'medium' ? saved : 'large');
}, { immediate: true });
watch([() => discordService.user.value?.id, () => discordService.user.value?.preferences.sortBy], ([, sortBy]) => {
    const saved = localStorage.getItem('collection_sort_by');
    filters.sort.value = discordService.user.value
        ? sortBy ?? DEFAULT_USER_PREFERENCES.sortBy
        : isCollectionSort(saved) ? saved : DEFAULT_USER_PREFERENCES.sortBy;
}, { immediate: true });
watch(filters.sort, async (sortBy) => {
    const user = discordService.user.value;
    if (!user) { localStorage.setItem('collection_sort_by', sortBy); return; }
    if ((user.preferences.sortBy ?? DEFAULT_USER_PREFERENCES.sortBy) === sortBy) return;
    try { await discordService.updatePreferences({ sortBy }); }
    catch { /* Keep the selected sort for this visit when persistence fails. */ }
});
watch(cardSize, async (size) => {
    const user = discordService.user.value;
    if (!user) { localStorage.setItem('collection_card_size', size); return; }
    if (user.preferences.cardSize === size) return;
    try { await discordService.updatePreferences({ cardSize: size }); }
    catch { /* Keep the selected size for this visit when persistence fails. */ }
});
</script>

<style scoped>
.category-drawer { overflow-y: auto; max-width: calc(100vw - 48px); }
.category-drawer-toggle {
    position: fixed;
    top: 50%;
    left: 0;
    z-index: 1016;
    width: 32px;
    height: 56px;
    border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
    border-radius: 0 8px 8px 0;
    transform: translateY(-50%);
    transition: left .2s cubic-bezier(.4, 0, .2, 1);
}
.category-drawer-toggle--open {
    left: calc(min(256px, calc(100vw - 48px)) - 16px);
    border-radius: 8px;
}
.collection-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
}
.collection-toolbar {
    display: flex;
    align-items: center;
    flex: 1 1 560px;
    gap: 16px;
    flex-wrap: wrap;
}
.collection-search-sort {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1 1 440px;
    min-width: 0;
}
.collection-sort {
    flex: 0 0 175px;
    min-width: 0;
}
.collection-search {
    flex: 1 1 240px;
    min-width: 0;
}
.collection-size-control {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-shrink: 0;
}

@media (min-width: 600px) and (max-width: 959.98px) {
    .collection-grid--medium .collection-grid-item {
        flex: 0 0 33.333333%;
        max-width: 33.333333%;
    }
    .collection-grid--small .collection-grid-item {
        flex: 0 0 25%;
        max-width: 25%;
    }
}

@media (min-width: 960px) {
    .collection-grid--large .collection-grid-item {
        flex: 0 0 25%;
        max-width: 25%;
    }
    .collection-grid--medium .collection-grid-item {
        flex: 0 0 20%;
        max-width: 20%;
    }
    .collection-grid--small .collection-grid-item {
        flex: 0 0 16.666667%;
        max-width: 16.666667%;
    }
}

@media (max-width: 599.98px) {
    .collection-search-sort { gap: 8px; }
    .collection-sort { flex-basis: 145px; }
    .collection-size-control {
        display: none;
    }
}
</style>
