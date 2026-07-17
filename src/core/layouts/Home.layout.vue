<template>
    <HeaderComponent />

    <template v-if="userLoggedIn">
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
import { useI18n } from 'vue-i18n';
import HeaderComponent from 'core/components/Header.component.vue';
import AppSkeleton from 'core/components/AppSkeleton.component.vue';
import CollectionCard from 'core/components/CollectionCard.component.vue';
import CollectionDetailsDialog from 'core/components/CollectionDetailsDialog.component.vue';
import CollectionFilters from 'core/components/CollectionFilters.component.vue';
import SignedOutLanding from 'core/components/SignedOutLanding.component.vue';
import { useCollectionFilters } from 'core/composables/useCollectionFilters';
import type { CollectionItem } from 'core/store/stores/collection.store';
import { store } from 'core/store/index.store';
import { DiscordService } from 'modules/discord-auth/services/discord.service';

const { t } = useI18n();
const discordService = DiscordService.getInstance();
const collectionStore = store.collection();
const collection = ref<CollectionItem[]>([]);
const authReady = ref(false);
const collectionLoading = ref(false);
const selectedItem = ref<CollectionItem | null>(null);
const detailDialogOpen = ref(false);
const userLoggedIn = computed(() => discordService.user.value !== null);
const filters = useCollectionFilters(collection);

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
            collection.value = await collectionStore.getAll(user.id);
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
</style>
