<template>
    <v-navigation-drawer
        id="collection-filters-panel"
        v-model="open"
        location="right"
        :width="320"
        :temporary="mobile"
        disable-resize-watcher
        class="filters-panel"
        :aria-label="t('home.filters.title')"
    >
        <div class="px-3 py-2">
            <h2 class="text-h6 ma-0">{{ t('home.filters.title') }}</h2>
        </div>
        <v-divider />
        <div class="pa-4">
            <v-autocomplete :model-value="artist" :items="artists" :label="t('home.filters.artist')" :no-data-text="t('home.filters.noOptions')" multiple chips closable-chips clearable hide-details class="mb-4" @update:model-value="emit('update:artist', $event ?? [])" />
            <v-autocomplete :model-value="album" :items="albums" :label="t('home.filters.album')" :no-data-text="t('home.filters.noOptions')" multiple chips closable-chips clearable hide-details class="mb-4" @update:model-value="emit('update:album', $event ?? [])" />
            <v-autocomplete :model-value="year" :items="years" :label="t('home.filters.year')" :no-data-text="t('home.filters.noOptions')" multiple chips closable-chips clearable hide-details @update:model-value="emit('update:year', $event ?? [])" />
            <v-btn class="mt-4" color="primary" variant="text" prepend-icon="mdi-filter-remove" :disabled="activeCount === 0" @click="emit('clear')">{{ t('home.filters.clear') }}</v-btn>
        </div>
    </v-navigation-drawer>
    <v-btn
        class="filters-panel-toggle"
        :class="{ 'filters-panel-toggle--open': open }"
        :icon="open ? 'mdi-chevron-right' : 'mdi-chevron-left'"
        color="surface"
        variant="elevated"
        :aria-label="t(open ? 'home.filters.hide' : 'home.filters.open')"
        :aria-expanded="open"
        aria-controls="collection-filters-panel"
        @click="open = !open"
    />
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { useDisplay } from 'vuetify';

const open = defineModel<boolean>({ required: true });
const { mobile } = useDisplay();

defineProps<{
    artist: string[];
    album: string[];
    year: number[];
    artists: string[];
    albums: string[];
    years: number[];
    activeCount: number;
}>();
const emit = defineEmits<{
    'update:artist': [value: string[]];
    'update:album': [value: string[]];
    'update:year': [value: number[]];
    clear: [];
}>();
const { t } = useI18n();
</script>

<style scoped>
.filters-panel { max-width: calc(100vw - 48px); }
.filters-panel-toggle {
    position: fixed;
    top: 50%;
    right: 0;
    z-index: 1006;
    width: 32px;
    height: 56px;
    border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
    border-radius: 8px 0 0 8px;
    transform: translateY(-50%);
    transition: right .2s cubic-bezier(.4, 0, .2, 1);
}
.filters-panel-toggle--open {
    right: calc(min(320px, calc(100vw - 48px)) - 16px);
    border-radius: 8px;
}
</style>
