<template>
    <HeaderComponent />

    <template v-if="userLoggedIn">
        <v-navigation-drawer
            v-if="categories.length"
            v-model="drawerOpen"
            :permanent="!mobile"
            :temporary="mobile"
            class="category-drawer"
        >
            <v-list nav :aria-label="t('categories.navigation')">
                <v-list-item prepend-icon="mdi-view-grid" :title="t('categories.all')"
                    :active="selectedCategoryId === null" @click="selectCategory(null)" />
                <CategoryNavigationList :nodes="categoryTree" :selected-id="selectedCategoryId"
                    @select="selectCategory" />
            </v-list>
        </v-navigation-drawer>
        <v-btn v-if="categories.length && mobile" class="category-drawer-toggle" icon="mdi-folder-outline"
            color="primary" :aria-label="t('categories.openNavigation')" @click="drawerOpen = true" />
        <CollectionFilters
            v-if="collection.length"
            v-model:search="filters.search.value"
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
            <h1 class="text-h4 mb-4">{{ t('home.title') }}</h1>
            <AppSkeleton v-if="collectionLoading" variant="cards" :count="8" :label="t('common.loading')" />
            <v-row v-else-if="filters.filtered.value.length">
                <v-col v-for="item in filters.filtered.value" :key="item.id" cols="12" sm="6" md="3">
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
        </v-container>

        <CollectionDetailsDialog
            v-model="detailDialogOpen"
            :item="selectedItem"
            @closed="selectedItem = null"
        />
    </template>

    <SignedOutLanding v-else-if="authReady" @login="discordService.login()" />
    <v-container v-else class="auth-loading">
        <AppSkeleton type="avatar, heading, paragraph, button" :label="t('home.signedOut.loading')" />
    </v-container>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useDisplay } from 'vuetify';
import { useI18n } from 'vue-i18n';
import HeaderComponent from 'core/components/Header.component.vue';
import AppSkeleton from 'core/components/AppSkeleton.component.vue';
import CollectionCard from 'core/components/CollectionCard.component.vue';
import CollectionDetailsDialog from 'core/components/CollectionDetailsDialog.component.vue';
import CollectionFilters from 'core/components/CollectionFilters.component.vue';
import SignedOutLanding from 'core/components/SignedOutLanding.component.vue';
import CategoryNavigationList from 'core/components/CategoryNavigationList.component.vue';
import { buildCategoryTree, descendantCategoryIds } from 'core/utils/category-tree.utils';
import { useCollectionFilters } from 'core/composables/useCollectionFilters';
import type { CollectionItem } from 'core/store/stores/collection.store';
import type { DatabaseCategory } from '../../../shared/types/database.types';
import { store } from 'core/store/index.store';
import { DiscordService } from 'modules/discord-auth/services/discord.service';

const { t } = useI18n();
const discordService = DiscordService.getInstance();
const collectionStore = store.collection();
const categoryStore = store.category();
const collection = ref<CollectionItem[]>([]);
const categories = ref<DatabaseCategory[]>([]);
const authReady = ref(false);
const collectionLoading = ref(false);
const selectedItem = ref<CollectionItem | null>(null);
const detailDialogOpen = ref(false);
const userLoggedIn = computed(() => discordService.user.value !== null);
const { mobile } = useDisplay();
const drawerOpen = ref(false);
const selectedCategoryId = ref<number | null>(null);
const categoryTree = computed(() => buildCategoryTree(categories.value));
const categoryScopedCollection = computed(() => {
    if (selectedCategoryId.value === null) return collection.value;
    const ids = descendantCategoryIds(selectedCategoryId.value, categories.value);
    return collection.value.filter((item) => item.category_ids.some((id) => ids.has(id)));
});
const filters = useCollectionFilters(categoryScopedCollection);

function selectCategory(id: number | null) {
    selectedCategoryId.value = id;
    filters.clear();
    if (mobile.value) drawerOpen.value = false;
}

function openDetails(item: CollectionItem) {
    selectedItem.value = item;
    detailDialogOpen.value = true;
}

onMounted(async () => {
    try {
        const user = await discordService.handleLogin();
        authReady.value = true;
        if (user) {
            collectionLoading.value = true;
            [collection.value, categories.value] = await Promise.all([
                collectionStore.getAll(user.id), categoryStore.getAll(user.id),
            ]);
            drawerOpen.value = !mobile.value;
        }
    } finally {
        collectionLoading.value = false;
        authReady.value = true;
    }
});
</script>

<style scoped>
.auth-loading {
    width: min(900px, 100%);
    min-height: calc(100vh - 64px);
    padding-top: clamp(48px, 10vw, 120px);
}
.category-drawer { overflow-y: auto; }
.category-drawer-toggle { position: fixed; left: 16px; top: 80px; z-index: 1005; }
</style>
