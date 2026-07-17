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
    <v-container v-else-if="authReady" class="signed-out-page">
        <v-row align="center" class="signed-out-hero">
            <v-col cols="12" md="7" lg="6">
                <div class="hero-kicker">
                    <v-icon icon="mdi-album" size="small" />
                    <span>{{ t('home.signedOut.kicker') }}</span>
                </div>
                <h1 class="hero-title">{{ t('home.signedOut.title') }}</h1>
                <p class="hero-description">{{ t('home.signedOut.description') }}</p>
                <v-btn
                    color="primary"
                    size="x-large"
                    class="hero-cta"
                    @click="discordService.login()"
                >
                    <template #prepend>
                        <svg class="hero-discord-icon" viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                        </svg>
                    </template>
                    {{ t('home.signedOut.cta') }}
                </v-btn>
                <p class="hero-caption">{{ t('home.signedOut.caption') }}</p>
            </v-col>

            <v-col cols="12" md="5" lg="6" class="d-flex justify-center">
                <div class="collection-art" aria-hidden="true">
                    <div class="record-sleeve record-sleeve--back">
                        <v-icon icon="mdi-disc" />
                    </div>
                    <div class="record-sleeve record-sleeve--front">
                        <div class="cover-copy">
                            <span>COLLECTION</span>
                            <small>{{ t('home.signedOut.artLabel') }}</small>
                        </div>
                    </div>
                    <div class="vinyl-record">
                        <div class="vinyl-label"><span></span></div>
                    </div>
                </div>
            </v-col>
        </v-row>

        <section class="feature-section" :aria-label="t('home.signedOut.featuresLabel')">
            <v-row>
                <v-col cols="12" sm="4">
                    <div class="feature-item">
                        <v-icon icon="mdi-disc-player" color="primary" size="32" />
                        <h2>{{ t('home.signedOut.features.formats.title') }}</h2>
                        <p>{{ t('home.signedOut.features.formats.text') }}</p>
                    </div>
                </v-col>
                <v-col cols="12" sm="4">
                    <div class="feature-item">
                        <v-icon icon="mdi-tag-multiple-outline" color="primary" size="32" />
                        <h2>{{ t('home.signedOut.features.details.title') }}</h2>
                        <p>{{ t('home.signedOut.features.details.text') }}</p>
                    </div>
                </v-col>
                <v-col cols="12" sm="4">
                    <div class="feature-item">
                        <v-icon icon="mdi-magnify" color="primary" size="32" />
                        <h2>{{ t('home.signedOut.features.find.title') }}</h2>
                        <p>{{ t('home.signedOut.features.find.text') }}</p>
                    </div>
                </v-col>
            </v-row>
        </section>
    </v-container>
    <div v-else class="auth-loading" role="status" :aria-label="t('home.signedOut.loading')">
        <v-progress-circular indeterminate color="primary" />
    </div>
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
const authReady = ref(false);
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
    try {
        const user = await discordService.handleLogin();

        if (user) {
            collection.value = await collectionStore.getAll(user.id);
        }
    } finally {
        authReady.value = true;
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

.signed-out-page {
    width: min(1180px, 100%);
    min-height: calc(100vh - 64px);
    padding-block: clamp(48px, 8vw, 96px) 48px;
}

.signed-out-hero {
    min-height: 500px;
}

.hero-kicker {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 20px;
    color: rgb(var(--v-theme-primary));
    font-size: 0.8rem;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
}

.hero-title {
    max-width: 720px;
    font-size: clamp(2.75rem, 7vw, 5.5rem);
    font-weight: 800;
    letter-spacing: -0.055em;
    line-height: 0.98;
}

.hero-description {
    max-width: 620px;
    margin: 28px 0 32px;
    color: rgba(var(--v-theme-on-surface), 0.72);
    font-size: clamp(1.05rem, 2vw, 1.25rem);
    line-height: 1.7;
}

.hero-cta {
    text-transform: none;
}

.hero-discord-icon {
    width: 21px;
    height: 21px;
    fill: currentColor;
}

.hero-caption {
    margin-top: 12px;
    color: rgba(var(--v-theme-on-surface), 0.55);
    font-size: 0.85rem;
}

.collection-art {
    position: relative;
    width: min(430px, 86vw);
    aspect-ratio: 1.15;
}

.record-sleeve,
.vinyl-record {
    position: absolute;
    width: 68%;
    aspect-ratio: 1;
    border-radius: 3px;
    box-shadow: 0 30px 70px rgba(0, 0, 0, 0.4);
}

.record-sleeve--back {
    top: 3%;
    left: 3%;
    display: grid;
    place-items: center;
    transform: rotate(-8deg);
    background: #cbc0a8;
    color: rgba(27, 23, 18, 0.22);
}

.record-sleeve--back .v-icon {
    font-size: 9rem;
}

.record-sleeve--front {
    bottom: 2%;
    left: 8%;
    z-index: 2;
    overflow: hidden;
    transform: rotate(4deg);
    background:
        linear-gradient(145deg, transparent 52%, rgba(255, 255, 255, 0.14) 52%),
        linear-gradient(140deg, #805ad5, #e04f78 55%, #ef8d4e);
}

.cover-copy {
    display: flex;
    height: 100%;
    flex-direction: column;
    justify-content: space-between;
    padding: 11%;
    color: white;
    font-weight: 900;
    letter-spacing: -0.06em;
}

.cover-copy > span {
    max-width: 100%;
    font-size: clamp(1.5rem, 4.4vw, 2.15rem);
    letter-spacing: -0.07em;
    white-space: nowrap;
}

.cover-copy small {
    max-width: 160px;
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.16em;
    line-height: 1.4;
    text-transform: uppercase;
}

.vinyl-record {
    top: 13%;
    right: 0;
    z-index: 1;
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: repeating-radial-gradient(circle, #171717 0 3px, #272727 4px 5px);
}

.vinyl-label {
    display: grid;
    width: 32%;
    aspect-ratio: 1;
    place-items: center;
    border-radius: 50%;
    background: #f1a34f;
}

.vinyl-label span {
    width: 12%;
    aspect-ratio: 1;
    border-radius: 50%;
    background: #171717;
}

.feature-section {
    margin-top: clamp(40px, 8vw, 88px);
    padding-top: 40px;
    border-top: 1px solid rgba(var(--v-theme-on-surface), 0.12);
}

.feature-item {
    height: 100%;
    padding: 16px 20px 16px 0;
}

.feature-item h2 {
    margin: 18px 0 8px;
    font-size: 1.05rem;
}

.feature-item p {
    margin: 0;
    color: rgba(var(--v-theme-on-surface), 0.62);
    line-height: 1.65;
}

.auth-loading {
    display: grid;
    min-height: calc(100vh - 64px);
    place-items: center;
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

    .signed-out-page {
        padding-top: 40px;
    }

    .signed-out-hero {
        min-height: 0;
    }

    .collection-art {
        margin-top: 48px;
    }
}
</style>
