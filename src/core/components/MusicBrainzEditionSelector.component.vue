<template>
    <v-select
        v-model="selectedId"
        :items="releaseItems"
        item-title="title"
        item-value="id"
        item-props="props"
        :label="t('dashboard.musicbrainz.edition')"
        :hint="t('dashboard.musicbrainz.editionHint')"
        persistent-hint
        clearable
        :loading="loading"
        @update:model-value="selectRelease"
    >
        <template #item="{ props: itemProps, item }">
            <v-list-subheader v-if="item.kind === 'header'">
                {{ item.title }}
            </v-list-subheader>
            <v-divider v-else-if="item.kind === 'divider'" class="my-1" />
            <v-list-item v-else v-bind="itemProps" />
        </template>
    </v-select>
    <v-alert v-if="loadError" type="warning" variant="tonal" density="compact" class="mb-3">
        <div class="d-flex align-center justify-space-between ga-2">
            <span>{{ t('dashboard.musicbrainz.editionError') }}</span>
            <v-btn size="small" variant="text" @click="loadReleases">
                {{ t('dashboard.actions.retry') }}
            </v-btn>
        </div>
    </v-alert>
</template>

<script setup lang="ts">
import { api } from 'api/api';
import type {
    CollectionReleaseSelection,
    CommonReleaseSelection,
    MusicBrainzRelease,
    MusicBrainzReleaseGroup,
} from '../../../shared/types/database.types';
import type { CatalogEditionResult, CatalogExternalReference } from '../../../shared/types/catalog.types';
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps<{
    releaseGroup: MusicBrainzReleaseGroup | null;
    catalogReference?: CatalogExternalReference | null;
    modelValue: CollectionReleaseSelection | null;
}>();

const emit = defineEmits<{
    'update:modelValue': [value: CollectionReleaseSelection | null];
}>();

interface ReleaseSelectItem {
    id: string;
    title: string;
    kind: 'header' | 'divider' | 'common' | 'catalog';
    data: CollectionReleaseSelection | null;
    props: { disabled?: boolean; subtitle?: string; prependIcon?: string };
}

const { t } = useI18n();
const catalogEditions = ref<Array<{ edition: CatalogEditionResult; selection: CollectionReleaseSelection }>>([]);
const selectedId = ref<string | null>(props.modelValue?.id ?? null);
const loading = ref(false);
const loadError = ref(false);
let requestId = 0;

const commonReleases: CommonReleaseSelection[] = [
    { source: 'common', id: 'common:cd', title: 'CD', format: 'CD' },
    { source: 'common', id: 'common:vinyl', title: 'Vinyl', format: 'Vinyl' },
    { source: 'common', id: 'common:cassette', title: 'Cassette', format: 'Cassette' },
    { source: 'common', id: 'common:digital', title: 'Digital', format: 'Digital' },
    { source: 'common', id: 'common:dvd', title: 'DVD', format: 'DVD' },
    { source: 'common', id: 'common:blu-ray', title: 'Blu-ray', format: 'Blu-ray' },
    { source: 'common', id: 'common:minidisc', title: 'MiniDisc', format: 'MiniDisc' },
];

const releaseItems = computed<ReleaseSelectItem[]>(() => {
    const commonItems: ReleaseSelectItem[] = [
        {
            id: 'header:common',
            title: t('dashboard.musicbrainz.commonReleases'),
            kind: 'header',
            data: null,
            props: { disabled: true },
        },
        ...commonReleases.map((release) => ({
            id: release.id,
            title: release.title,
            kind: 'common' as const,
            data: release,
            props: { prependIcon: commonReleaseIcon(release.format) },
        })),
    ];

    if (!effectiveReference.value || effectiveReference.value.source === 'lastfm') return commonItems;
    const source = effectiveReference.value.source;
    return [
        ...commonItems,
        { id: `divider:${source}`, title: '', kind: 'divider', data: null, props: { disabled: true } },
        {
            id: `header:${source}`,
            title: source === 'discogs' ? 'Discogs' : t('dashboard.musicbrainz.musicBrainzReleases'),
            kind: 'header',
            data: null,
            props: { disabled: true },
        },
        ...catalogEditions.value.map(({ edition, selection }) => ({
            id: edition.id,
            title: formatCatalogEdition(edition),
            kind: 'catalog' as const,
            data: selection,
            props: { prependIcon: source === 'discogs' ? 'mdi-record-circle-outline' : 'mdi-database-music' },
        })),
    ];
});

const effectiveReference = computed<CatalogExternalReference | null>(() => props.catalogReference ?? (props.releaseGroup ? {
    source: 'musicbrainz', kind: 'release-group', externalId: props.releaseGroup.id,
    externalUrl: `https://musicbrainz.org/release-group/${props.releaseGroup.id}`,
} : null));

watch(() => `${effectiveReference.value?.source}:${effectiveReference.value?.kind}:${effectiveReference.value?.externalId}`,
    () => void loadReleases(), { immediate: true });
watch(() => props.modelValue?.id, (value) => { selectedId.value = value ?? null; });

function commonReleaseIcon(format: string): string {
    if (format === 'Vinyl') return 'mdi-album';
    if (format === 'Cassette') return 'mdi-cassette';
    if (format === 'Digital') return 'mdi-cloud-download-outline';
    return 'mdi-disc';
}

function formatCatalogEdition(edition: CatalogEditionResult): string {
    return [edition.date ?? edition.year, edition.country, edition.formats?.join(', '),
        edition.labels?.join(', '), edition.catalogNumber, edition.barcode].filter(Boolean).join(' · ') || edition.title;
}

async function loadReleases() {
    const currentRequestId = ++requestId;
    catalogEditions.value = [];
    loadError.value = false;
    const currentSelection = props.modelValue;
    const commonSelection = currentSelection?.id.startsWith('common:') ? currentSelection : null;
    selectedId.value = currentSelection?.id ?? null;
    const reference = effectiveReference.value;
    if (!reference || reference.source === 'lastfm') {
        emit('update:modelValue', commonSelection);
        return;
    }

    loading.value = true;
    try {
        const results = await api.collection.getCatalogEditions(reference.source, reference.kind, reference.externalId);
        if (currentRequestId !== requestId) return;
        catalogEditions.value = results.map((edition) => ({
            edition,
            selection: edition.source === 'discogs'
                ? { source: 'discogs', kind: 'release', id: edition.id, externalUrl: edition.externalUrl }
                : { ...(edition.rawMusicBrainz as MusicBrainzRelease), source: 'musicbrainz' },
        }));
        const catalogSelection = currentSelection && !currentSelection.id.startsWith('common:')
            ? catalogEditions.value.find(({ selection }) => selection.id === currentSelection.id)?.selection ?? null
            : null;
        const selection = commonSelection ?? catalogSelection;
        selectedId.value = selection?.id ?? null;
        emit('update:modelValue', selection);
    } catch {
        if (currentRequestId === requestId) loadError.value = true;
    } finally {
        if (currentRequestId === requestId) loading.value = false;
    }
}

function selectRelease(releaseId: string | null) {
    const selection = commonReleases.find((release) => release.id === releaseId)
        ?? catalogEditions.value.find(({ selection }) => selection.id === releaseId)?.selection
        ?? null;
    emit('update:modelValue', selection);
}
</script>
