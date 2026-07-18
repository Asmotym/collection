<template>
    <v-card
        class="collection-card h-100 d-flex flex-column"
        :class="{ 'collection-card--no-actions': !links.length }"
        role="button"
        tabindex="0"
        :aria-label="t('home.details.open', { name: item.album_name })"
        @click="emit('open')"
        @keydown.enter.prevent="emit('open')"
        @keydown.space.prevent="emit('open')"
    >
        <v-card-title>
            {{ item.album_name }} <span class="text-body-secondary">({{ item.album_year ?? '-' }})</span>
        </v-card-title>
        <v-card-subtitle>{{ item.artist_name }}</v-card-subtitle>
        <div class="collection-card-image-wrap mt-3 mx-4">
            <v-img v-if="item.album_image" :src="item.album_image" :alt="item.album_name" cover class="collection-card-image">
                <template #placeholder><v-skeleton-loader type="image" /></template>
                <template #error><div class="image-placeholder"><v-icon size="48">mdi-image-broken-variant</v-icon></div></template>
            </v-img>
            <div v-else class="collection-card-image image-placeholder" aria-hidden="true">
                <v-icon size="56">mdi-album</v-icon>
            </div>
        </div>
        <v-card-text v-if="notes.length"><CollectionMetadataDisplay :metadata="notes" /></v-card-text>
        <v-card-actions v-if="links.length" class="mt-auto flex-wrap" @click.stop @keydown.stop>
            <v-btn
                v-for="(entry, index) in links"
                :key="index"
                :href="entry.value"
                target="_blank"
                rel="noopener noreferrer"
                size="small"
                variant="text"
                prepend-icon="mdi-open-in-new"
            >{{ entry.name }}</v-btn>
        </v-card-actions>
    </v-card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { CollectionItem } from 'core/store/stores/collection.store';
import CollectionMetadataDisplay from 'core/components/CollectionMetadataDisplay.component.vue';
import { textMetadata, urlMetadata } from 'core/utils/collection-metadata.utils';

const props = defineProps<{ item: CollectionItem }>();
const emit = defineEmits<{ open: [] }>();
const { t } = useI18n();
const notes = computed(() => textMetadata(props.item.metadata, true));
const links = computed(() => urlMetadata(props.item.metadata, true));
</script>

<style scoped>
.collection-card { cursor: pointer; }
.collection-card--no-actions { padding-bottom: 16px; }
.collection-card:focus-visible { outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: 2px; }
.collection-card-image-wrap { aspect-ratio: 1; }
.collection-card-image { width: 100%; height: 100%; overflow: hidden; border-radius: 4px; }
.image-placeholder {
    display: flex;
    width: 100%;
    height: 100%;
    align-items: center;
    justify-content: center;
    color: rgba(var(--v-theme-on-surface), .45);
    background:
        radial-gradient(circle at center, rgba(var(--v-theme-on-surface), .08), transparent 42%),
        rgb(var(--v-theme-surface-variant));
}
</style>
