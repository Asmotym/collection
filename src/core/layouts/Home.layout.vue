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
                    <v-card>
                        <v-card-title>
                            {{ item.album_name }}<span class="text-body-secondary">({{ item.album_year ?? '-' }})</span>
                        </v-card-title>
                        <v-card-subtitle>
                            {{ item.artist_name }}
                        </v-card-subtitle>
                        <div v-if="item.album_image" class="mt-3 pl-4 pr-4">
                            <ImagePreview
                                :src="item.album_image"
                                :alt="item.album_name"
                                full-width
                            />
                        </div>
                        <v-card-text>
                            <CollectionMetadataDisplay :metadata="item.metadata" cards-only />
                        </v-card-text>
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
    </template>
    <v-container v-else class="d-flex justify-center align-center" style="height: 100vh">
        <v-card :title="t('home.not_logged_in_title')" :text="t('home.not_logged_in_message')"></v-card>
    </v-container>
</template>

<script setup lang="ts">
import type { CollectionItem } from 'core/store/stores/collection.store';
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import HeaderComponent from 'core/components/Header.component.vue';
import ImagePreview from 'core/components/ImagePreview.component.vue';
import CollectionMetadataDisplay from 'core/components/CollectionMetadataDisplay.component.vue';
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

@media (max-width: 600px) {
    .filters-fab {
        right: 16px;
    }
}
</style>
