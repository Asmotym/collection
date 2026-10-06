<template>
    <div class="filters-fab">
        <v-menu location="start top" :offset="12" :close-on-content-click="false">
            <template #activator="{ props }">
                <v-badge color="primary" :content="activeCount" :model-value="activeCount > 0" :aria-label="t('home.filters.activeCount', { count: activeCount })">
                    <v-fab v-bind="props" color="primary" icon="mdi-filter-variant" :aria-label="t('home.filters.open')" />
                </v-badge>
            </template>
            <v-card class="filters-popover">
                <v-card-title>{{ t('home.filters.title') }}</v-card-title>
                <v-expansion-panels :model-value="[0]" multiple variant="accordion">
                    <v-expansion-panel :title="t('home.filters.collectionDetails')">
                        <v-expansion-panel-text>
                            <v-autocomplete :model-value="artist" :items="artists" :label="t('home.filters.artist')" :no-data-text="t('home.filters.noOptions')" clearable hide-details class="mb-4" @update:model-value="emit('update:artist', $event)" />
                            <v-autocomplete :model-value="album" :items="albums" :label="t('home.filters.album')" :no-data-text="t('home.filters.noOptions')" clearable hide-details class="mb-4" @update:model-value="emit('update:album', $event)" />
                            <v-autocomplete :model-value="year" :items="years" :label="t('home.filters.year')" :no-data-text="t('home.filters.noOptions')" clearable hide-details @update:model-value="emit('update:year', $event)" />
                        </v-expansion-panel-text>
                    </v-expansion-panel>
                </v-expansion-panels>
                <v-card-actions class="justify-end pa-4">
                    <v-btn color="primary" variant="text" prepend-icon="mdi-filter-remove" :disabled="activeCount === 0" @click="emit('clear')">{{ t('home.filters.clear') }}</v-btn>
                </v-card-actions>
            </v-card>
        </v-menu>
    </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

defineProps<{
    artist: string | null;
    album: string | null;
    year: number | null;
    artists: string[];
    albums: string[];
    years: number[];
    activeCount: number;
}>();
const emit = defineEmits<{
    'update:artist': [value: string | null];
    'update:album': [value: string | null];
    'update:year': [value: number | null];
    clear: [];
}>();
const { t } = useI18n();
</script>

<style scoped>
.filters-fab { position: fixed; top: 80px; right: 24px; z-index: 1005; }
.filters-popover { width: min(380px, calc(100vw - 32px)); overflow: hidden; }
@media (max-width: 600px) { .filters-fab { right: 16px; } }
</style>
