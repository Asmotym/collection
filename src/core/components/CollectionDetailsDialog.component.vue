<template>
    <v-dialog :model-value="modelValue" max-width="900" @update:model-value="emit('update:modelValue', $event)" @after-leave="emit('closed')">
        <v-card v-if="item">
            <v-card-item class="detail-header">
                <template #prepend>
                    <div class="detail-image-wrap">
                        <ImagePreview
                            v-if="item.album_image"
                            :src="item.album_image"
                            :source-url="item.album_image_url"
                            :alt="item.album_name"
                            full-width
                        />
                        <div v-else class="detail-image image-placeholder"><v-icon size="48" color="medium-emphasis">mdi-image-off-outline</v-icon></div>
                    </div>
                </template>
                <template #title><span class="detail-title text-h5">{{ item.album_name }} <span class="text-body-secondary">({{ item.album_year ?? '-' }})</span></span></template>
                <template #subtitle><span class="text-subtitle-1">{{ item.artist_name }}</span></template>
                <template #append><v-btn icon="mdi-close" variant="text" :aria-label="t('home.details.close')" @click="emit('update:modelValue', false)" /></template>
            </v-card-item>
            <v-card-text>
                <MusicBrainzDetails :artist="item.artist_musicbrainz_data" :album="item.album_musicbrainz_data" :release="item.musicbrainz_release_data" />
                <div v-if="providerLinks.length" class="d-flex flex-wrap ga-2 mb-5">
                    <v-btn
                        v-for="reference in providerLinks"
                        :key="`${reference.source}:${reference.kind}:${reference.externalId}`"
                        :href="reference.externalUrl"
                        target="_blank"
                        rel="noopener noreferrer"
                        variant="tonal"
                        size="small"
                        prepend-icon="mdi-open-in-new"
                    >
                        {{ reference.source === 'discogs' ? 'Data provided by Discogs' : reference.source === 'lastfm' ? 'Open on Last.fm' : 'Open on MusicBrainz' }}
                    </v-btn>
                </div>
                <h2 class="text-h6 mb-2">{{ t('metadata.title') }}</h2>
                <v-row>
                    <v-col cols="12" sm="6">
                        <div v-if="notes.length" class="detail-list">
                            <v-sheet v-for="(entry, index) in notes" :key="index" color="surface-light" rounded="lg" elevation="3" class="detail-text-sheet pa-3">
                                <h4 v-if="entry.title" class="text-subtitle-1 font-weight-bold mb-1 mt-0">{{ entry.title }}</h4>
                                <v-divider v-if="entry.title" class="mb-2" />{{ entry.value }}
                            </v-sheet>
                        </div><span v-else class="text-medium-emphasis">-</span>
                    </v-col>
                    <v-col cols="12" sm="6">
                        <div v-if="links.length" class="detail-list detail-links">
                            <v-btn v-for="(entry, index) in links" :key="index" :href="entry.value" target="_blank" rel="noopener noreferrer" variant="tonal" prepend-icon="mdi-open-in-new">{{ entry.name }}</v-btn>
                        </div><span v-else class="text-medium-emphasis">-</span>
                    </v-col>
                </v-row>
            </v-card-text>
        </v-card>
    </v-dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { CollectionItem } from 'core/store/stores/collection.store';
import ImagePreview from 'core/components/ImagePreview.component.vue';
import MusicBrainzDetails from 'core/components/MusicBrainzDetails.component.vue';
import { textMetadata, urlMetadata } from 'core/utils/collection-metadata.utils';

const props = defineProps<{ modelValue: boolean; item: CollectionItem | null }>();
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; closed: [] }>();
const { t } = useI18n();
const notes = computed(() => textMetadata(props.item?.metadata ?? []));
const links = computed(() => urlMetadata(props.item?.metadata ?? []));
const providerLinks = computed(() => props.item?.album_external_references ?? []);
</script>

<style scoped>
.detail-title { display: block; min-width: 0; white-space: normal; }
.detail-image-wrap { width: min(50px, 45vw); }
.detail-image { width: 100%; aspect-ratio: 1; }
.image-placeholder { display: flex; align-items: center; justify-content: center; background: rgb(var(--v-theme-surface-variant)); }
.detail-header { align-items: start; }
.detail-header :deep(.v-card-item__content) { min-width: 0; align-self: center; }
.detail-header :deep(.v-card-item__prepend) { align-self: start; }
.detail-list { display: flex; flex-direction: column; gap: 12px; }
.detail-links { align-items: flex-start; gap: 8px; }
.detail-text-sheet { overflow-wrap: anywhere; white-space: pre-wrap; }
@media (max-width: 600px) {
    .detail-header { grid-template-areas: "prepend append" "content content"; grid-template-columns: minmax(0, 1fr) max-content; }
    .detail-header :deep(.v-card-item__prepend) { width: 100%; justify-content: center; padding-inline-end: 0; }
    .detail-header :deep(.v-card-item__content) { margin-top: 16px; }
    .detail-image-wrap { width: min(100%, 50px); }
}
</style>
