<template>
    <HeaderComponent />
    <template v-if="userLoggedIn">
        <div v-if="collection.length > 0" class="filters-fab">
            <v-menu location="start top" :offset="12" :close-on-content-click="false">
                <template #activator="{ props: menuProps }">
                    <v-badge
                        color="primary"
                        :content="activeFilterCount"
                        :model-value="activeFilterCount > 0"
                        :aria-label="t('home.filters.activeCount', { count: activeFilterCount })"
                    >
                        <v-fab
                            v-bind="menuProps"
                            color="primary"
                            icon="mdi-filter-variant"
                            :aria-label="t('home.filters.open')"
                        />
                    </v-badge>
                </template>

                <v-card class="filters-popover">
                    <v-card-title>{{ t('home.filters.title') }}</v-card-title>
                    <v-expansion-panels v-model="openFilterSections" multiple variant="accordion">
                        <v-expansion-panel :title="t('home.filters.general')">
                            <v-expansion-panel-text>
                                <v-text-field
                                    v-model="search"
                                    :label="t('home.filters.search')"
                                    :placeholder="t('home.filters.searchPlaceholder')"
                                    prepend-inner-icon="mdi-magnify"
                                    clearable
                                    hide-details
                                />
                            </v-expansion-panel-text>
                        </v-expansion-panel>

                        <v-expansion-panel :title="t('home.filters.collectionDetails')">
                            <v-expansion-panel-text>
                                <v-autocomplete
                                    v-model="artistFilter"
                                    :items="artistOptions"
                                    :label="t('home.filters.artist')"
                                    :no-data-text="t('home.filters.noOptions')"
                                    clearable
                                    hide-details
                                    class="mb-4"
                                />
                                <v-autocomplete
                                    v-model="albumFilter"
                                    :items="albumOptions"
                                    :label="t('home.filters.album')"
                                    :no-data-text="t('home.filters.noOptions')"
                                    clearable
                                    hide-details
                                    class="mb-4"
                                />
                                <v-autocomplete
                                    v-model="yearFilter"
                                    :items="yearOptions"
                                    :label="t('home.filters.year')"
                                    :no-data-text="t('home.filters.noOptions')"
                                    clearable
                                    hide-details
                                />
                            </v-expansion-panel-text>
                        </v-expansion-panel>
                    </v-expansion-panels>
                    <v-card-actions class="justify-end pa-4">
                        <v-btn
                            color="primary"
                            variant="text"
                            prepend-icon="mdi-filter-remove"
                            :disabled="activeFilterCount === 0"
                            @click="clearFilters"
                        >
                            {{ t('home.filters.clear') }}
                        </v-btn>
                    </v-card-actions>
                </v-card>
            </v-menu>
        </div>

        <v-container class="py-6">
            <h1 class="text-h4 mb-4">{{ t('home.title') }}</h1>
            <v-row v-if="filteredCollection.length > 0">
                <v-col v-for="item in filteredCollection" :key="item.id" cols="12" sm="6" md="3">
                    <v-card
                        class="collection-card h-100 d-flex flex-column"
                        :class="{ 'collection-card--no-actions': !cardUrlMetadata(item).length }"
                        role="button"
                        tabindex="0"
                        :aria-label="t('home.details.open', { name: item.album_name })"
                        @click="openDetails(item)"
                        @keydown.enter.prevent="openDetails(item)"
                        @keydown.space.prevent="openDetails(item)"
                    >
                        <v-card-title>
                            {{ item.album_name }} <span class="text-body-secondary">({{ item.album_year ?? '-' }})</span>
                        </v-card-title>
                        <v-card-subtitle>
                            {{ item.artist_name }}
                        </v-card-subtitle>
                        <div v-if="item.album_image" class="mt-3 pl-4 pr-4">
                            <v-img
                                :src="item.album_image"
                                :alt="item.album_name"
                                aspect-ratio="1"
                                cover
                                class="collection-card-image"
                            >
                                <template #error>
                                    <div class="image-placeholder">
                                        <v-icon size="48">mdi-image-broken-variant</v-icon>
                                    </div>
                                </template>
                            </v-img>
                        </div>
                        <v-card-text v-if="cardTextMetadata(item).length">
                            <CollectionMetadataDisplay :metadata="cardTextMetadata(item)" />
                        </v-card-text>
                        <v-card-actions
                            v-if="cardUrlMetadata(item).length"
                            class="mt-auto flex-wrap"
                            @click.stop
                            @keydown.stop
                        >
                            <v-btn
                                v-for="(entry, index) in cardUrlMetadata(item)"
                                :key="index"
                                :href="entry.value"
                                target="_blank"
                                rel="noopener noreferrer"
                                size="small"
                                variant="text"
                                prepend-icon="mdi-open-in-new"
                            >
                                {{ entry.name }}
                            </v-btn>
                        </v-card-actions>
                    </v-card>
                </v-col>
            </v-row>
            <v-empty-state
                v-else-if="collection.length > 0"
                icon="mdi-filter-off-outline"
                :title="t('home.filters.noResultsTitle')"
                :text="t('home.filters.noResultsText')"
            />
        </v-container>

        <v-dialog v-model="detailDialogOpen" max-width="900" @after-leave="clearSelectedItem">
            <v-card v-if="selectedItem">
                <v-card-item class="detail-header">
                    <template #prepend>
                        <div class="detail-image-wrap">
                            <ImagePreview
                                v-if="selectedItem.album_image"
                                :src="selectedItem.album_image"
                                :alt="selectedItem.album_name"
                                full-width
                            />
                            <div v-else class="detail-image image-placeholder">
                                <v-icon size="48" color="medium-emphasis">mdi-image-off-outline</v-icon>
                            </div>
                        </div>
                    </template>
                    <template #title>
                        <span class="detail-title text-h5">
                            {{ selectedItem.album_name }}
                            <span class="text-body-secondary">({{ selectedItem.album_year ?? '-' }})</span>
                        </span>
                    </template>
                    <template #subtitle>
                        <span class="text-subtitle-1">{{ selectedItem.artist_name }}</span>
                    </template>
                    <template #append>
                        <v-btn
                            icon="mdi-close"
                            variant="text"
                            :aria-label="t('home.details.close')"
                            @click="detailDialogOpen = false"
                        />
                    </template>
                </v-card-item>
                <v-card-text>
                    <MusicBrainzDetails
                        :artist="selectedItem.artist_musicbrainz_data"
                        :album="selectedItem.album_musicbrainz_data"
                        :release="selectedItem.musicbrainz_release_data"
                    />
                    <h2 class="text-h6 mb-2">{{ t('metadata.title') }}</h2>
                    <v-row>
                        <v-col cols="12" sm="6">
                            <div v-if="detailTextMetadata(selectedItem).length" class="detail-text-list">
                                <v-sheet
                                    v-for="(entry, index) in detailTextMetadata(selectedItem)"
                                    :key="index"
                                    color="surface-light"
                                    rounded="lg"
                                    elevation="3"
                                    class="detail-text-sheet pa-3"
                                >
                                    <h4 v-if="entry.title" class="text-subtitle-1 font-weight-bold mb-1 mt-0">
                                        {{ entry.title }}
                                    </h4>
                                    <v-divider
                                        v-if="entry.title"
                                        class="mb-2"
                                    />
                                    {{ entry.value }}
                                </v-sheet>
                            </div>
                            <span v-else class="text-medium-emphasis">-</span>
                        </v-col>
                        <v-col cols="12" sm="6">
                            <div v-if="detailUrlMetadata(selectedItem).length" class="detail-links">
                                <v-btn
                                    v-for="(entry, index) in detailUrlMetadata(selectedItem)"
                                    :key="index"
                                    :href="entry.value"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    variant="tonal"
                                    prepend-icon="mdi-open-in-new"
                                >
                                    {{ entry.name }}
                                </v-btn>
                            </div>
                            <span v-else class="text-medium-emphasis">-</span>
                        </v-col>
                    </v-row>
                </v-card-text>
            </v-card>
        </v-dialog>
    </template>
    <v-container v-else class="d-flex justify-center align-center" style="height: 100vh">
        <v-card :title="t('home.not_logged_in_title')" :text="t('home.not_logged_in_message')"></v-card>
    </v-container>
</template>

<script setup lang="ts">
import type { CollectionItem } from 'core/store/stores/collection.store';
import type { CollectionTextMetadata, CollectionUrlMetadata } from '../../../shared/types/database.types';
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import HeaderComponent from 'core/components/Header.component.vue';
import CollectionMetadataDisplay from 'core/components/CollectionMetadataDisplay.component.vue';
import ImagePreview from 'core/components/ImagePreview.component.vue';
import MusicBrainzDetails from 'core/components/MusicBrainzDetails.component.vue';
import { DiscordService } from 'modules/discord-auth/services/discord.service';
import { store } from 'core/store/index.store';

const { t } = useI18n();

const discordService = DiscordService.getInstance();
const userLoggedIn = computed(() => {
  return discordService.user.value !== null;
});
const collectionStore = store.collection();
const collection = ref<CollectionItem[]>([]);
const search = ref<string | null>('');
const artistFilter = ref<string | null>(null);
const albumFilter = ref<string | null>(null);
const yearFilter = ref<number | null>(null);
const openFilterSections = ref([0]);
const selectedItem = ref<CollectionItem | null>(null);
const detailDialogOpen = ref(false);

const activeFilterCount = computed(() => {
    return Number((search.value ?? '').trim().length > 0)
        + Number(Boolean(artistFilter.value))
        + Number(Boolean(albumFilter.value))
        + Number(yearFilter.value !== null);
});

function clearFilters() {
    search.value = '';
    artistFilter.value = null;
    albumFilter.value = null;
    yearFilter.value = null;
}

function cardTextMetadata(item: CollectionItem): CollectionTextMetadata[] {
    return item.metadata.filter((entry): entry is CollectionTextMetadata => (
        entry.type === 'text' && entry.showInCards !== false
    ));
}

function cardUrlMetadata(item: CollectionItem): CollectionUrlMetadata[] {
    return item.metadata.filter((entry): entry is CollectionUrlMetadata => (
        entry.type === 'url' && entry.showInCards !== false
    ));
}

function detailTextMetadata(item: CollectionItem): CollectionTextMetadata[] {
    return item.metadata.filter((entry): entry is CollectionTextMetadata => entry.type === 'text');
}

function detailUrlMetadata(item: CollectionItem): CollectionUrlMetadata[] {
    return item.metadata.filter((entry): entry is CollectionUrlMetadata => entry.type === 'url');
}

function openDetails(item: CollectionItem) {
    selectedItem.value = item;
    detailDialogOpen.value = true;
}

function clearSelectedItem() {
    selectedItem.value = null;
}

const artistOptions = computed(() => {
    return [...new Set(collection.value.map((item) => item.artist_name))]
        .sort((a, b) => a.localeCompare(b));
});

const albumOptions = computed(() => {
    return [...new Set(collection.value.map((item) => item.album_name))]
        .sort((a, b) => a.localeCompare(b));
});

const yearOptions = computed(() => {
    return [...new Set(
        collection.value
            .map((item) => item.album_year)
            .filter((year): year is number => year !== null),
    )].sort((a, b) => b - a);
});

const filteredCollection = computed(() => {
    const query = (search.value ?? '').trim().toLocaleLowerCase();

    return collection.value.filter((item) => {
        const matchesSearch = !query || [item.artist_name, item.album_name, item.album_year]
            .some((value) => String(value ?? '').toLocaleLowerCase().includes(query));

        return matchesSearch
            && (!artistFilter.value || item.artist_name === artistFilter.value)
            && (!albumFilter.value || item.album_name === albumFilter.value)
            && (yearFilter.value === null || item.album_year === yearFilter.value);
    });
});

onMounted(async () => {
    const user = await discordService.handleLogin();

    if (user) {
        collection.value = await collectionStore.getAll(user.id);
    }
})
</script>

<style scoped>
.filters-fab {
    position: fixed;
    top: 80px;
    right: 24px;
    z-index: 1005;
}

.filters-popover {
    width: min(380px, calc(100vw - 32px));
    overflow: hidden;
}

.collection-card {
    cursor: pointer;
}

.collection-card--no-actions {
    padding-bottom: 16px;
}

.collection-card:focus-visible {
    outline: 2px solid rgb(var(--v-theme-primary));
    outline-offset: 2px;
}

.collection-card-image {
    overflow: hidden;
    border-radius: 4px;
}

.image-placeholder {
    display: flex;
    width: 100%;
    height: 100%;
    align-items: center;
    justify-content: center;
    background: rgb(var(--v-theme-surface-variant));
}

.detail-title {
    display: block;
    min-width: 0;
    white-space: normal;
}

.detail-image-wrap {
    width: min(50px, 45vw);
}

.detail-image {
    width: 100%;
    aspect-ratio: 1;
}

.detail-header {
    align-items: start;
}

.detail-header :deep(.v-card-item__content) {
    min-width: 0;
    align-self: center;
}

.detail-header :deep(.v-card-item__prepend) {
    align-self: start;
}

.detail-links {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
}

.detail-text-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.detail-text-sheet {
    overflow-wrap: anywhere;
    white-space: pre-wrap;
}

@media (max-width: 600px) {
    .filters-fab {
        right: 16px;
    }

    .detail-header {
        grid-template-areas:
            "prepend append"
            "content content";
        grid-template-columns: minmax(0, 1fr) max-content;
    }

    .detail-header :deep(.v-card-item__prepend) {
        width: 100%;
        justify-content: center;
        padding-inline-end: 0;
    }

    .detail-header :deep(.v-card-item__content) {
        margin-top: 16px;
    }

    .detail-image-wrap {
        width: min(100%, 50px);
    }
}
</style>
