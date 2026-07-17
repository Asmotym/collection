<template>
    <section v-if="artist || album || release" class="musicbrainz-details mb-6">
        <h2 class="text-h6 mb-3">{{ t('musicbrainzDetails.title') }}</h2>
        <v-row>
            <v-col v-if="album || release" cols="12" md="6">
                <v-sheet color="surface-light" rounded="lg" class="pa-4 h-100">
                    <div class="d-flex align-center ga-2 mb-3">
                        <v-icon>mdi-album</v-icon>
                        <h3 class="text-subtitle-1 font-weight-bold">{{ t('musicbrainzDetails.album') }}</h3>
                    </div>
                    <dl class="musicbrainz-fields mb-3">
                        <template v-for="detail in albumDetails" :key="detail.label">
                            <dt class="text-medium-emphasis">{{ detail.label }}</dt>
                            <dd>{{ detail.value }}</dd>
                        </template>
                    </dl>
                    <v-btn
                        v-if="album"
                        :href="`https://musicbrainz.org/release-group/${album.id}`"
                        target="_blank"
                        rel="noopener noreferrer"
                        size="small"
                        variant="tonal"
                        prepend-icon="mdi-open-in-new"
                    >
                        {{ t('musicbrainzDetails.openAlbum') }}
                    </v-btn>
                    <v-btn
                        v-if="musicBrainzRelease"
                        :href="`https://musicbrainz.org/release/${musicBrainzRelease.id}`"
                        target="_blank"
                        rel="noopener noreferrer"
                        size="small"
                        variant="text"
                        prepend-icon="mdi-open-in-new"
                        class="ml-2"
                    >
                        {{ t('musicbrainzDetails.openEdition') }}
                    </v-btn>
                </v-sheet>
            </v-col>
            <v-col v-if="artist" cols="12" md="6">
                <v-sheet color="surface-light" rounded="lg" class="pa-4 h-100">
                    <div class="d-flex align-center ga-2 mb-3">
                        <v-icon>mdi-account-music</v-icon>
                        <h3 class="text-subtitle-1 font-weight-bold">{{ t('musicbrainzDetails.artist') }}</h3>
                    </div>
                    <dl class="musicbrainz-fields mb-3">
                        <template v-for="detail in artistDetails" :key="detail.label">
                            <dt class="text-medium-emphasis">{{ detail.label }}</dt>
                            <dd>{{ detail.value }}</dd>
                        </template>
                    </dl>
                    <v-btn
                        :href="`https://musicbrainz.org/artist/${artist.id}`"
                        target="_blank"
                        rel="noopener noreferrer"
                        size="small"
                        variant="tonal"
                        prepend-icon="mdi-open-in-new"
                    >
                        {{ t('musicbrainzDetails.openArtist') }}
                    </v-btn>
                </v-sheet>
            </v-col>
        </v-row>
        <v-divider class="mt-6" />
    </section>
</template>

<script setup lang="ts">
import type {
    CollectionReleaseSelection,
    CommonReleaseSelection,
    MusicBrainzArtist,
    MusicBrainzRelease,
    MusicBrainzReleaseGroup,
} from '../../../shared/types/database.types';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps<{
    artist: MusicBrainzArtist | null;
    album: MusicBrainzReleaseGroup | null;
    release: CollectionReleaseSelection | null;
}>();

const { t } = useI18n();
const commonRelease = computed<CommonReleaseSelection | null>(() => (
    props.release && isCommonRelease(props.release) ? props.release : null
));
const musicBrainzRelease = computed<MusicBrainzRelease | null>(() => (
    props.release && !isCommonRelease(props.release) ? props.release as MusicBrainzRelease : null
));

function isCommonRelease(release: CollectionReleaseSelection): release is CommonReleaseSelection {
    return (release as CommonReleaseSelection).source === 'common';
}

interface Detail {
    label: string;
    value: string;
}

const albumDetails = computed<Detail[]>(() => {
    if (!props.album && !props.release) return [];
    const types = props.album
        ? [props.album['primary-type'], ...(props.album['secondary-types'] ?? [])]
            .filter((value): value is string => Boolean(value))
        : [];
    const formats = commonRelease.value
        ? [commonRelease.value.format]
        : [...new Set((musicBrainzRelease.value?.media ?? [])
        .map((medium) => medium.format).filter((value): value is string => Boolean(value)))];
    const labelInfo = musicBrainzRelease.value?.['label-info']?.[0];
    return compactDetails([
        { label: t('musicbrainzDetails.canonicalName'), value: props.album?.title },
        {
            label: t('musicbrainzDetails.releaseDate'),
            value: musicBrainzRelease.value?.date ?? props.album?.['first-release-date'],
        },
        { label: t('musicbrainzDetails.type'), value: types.join(', ') },
        { label: t('musicbrainzDetails.country'), value: musicBrainzRelease.value?.country },
        { label: t('musicbrainzDetails.format'), value: formats.join(', ') },
        { label: t('musicbrainzDetails.label'), value: labelInfo?.label?.name },
        { label: t('musicbrainzDetails.catalogNumber'), value: labelInfo?.['catalog-number'] },
        { label: t('musicbrainzDetails.barcode'), value: musicBrainzRelease.value?.barcode },
        {
            label: t('musicbrainzDetails.disambiguation'),
            value: musicBrainzRelease.value?.disambiguation ?? props.album?.disambiguation,
        },
    ]);
});

const artistDetails = computed<Detail[]>(() => {
    if (!props.artist) return [];
    const lifeSpan = props.artist['life-span'];
    const activePeriod = lifeSpan?.begin
        ? `${lifeSpan.begin} – ${lifeSpan.end ?? t('musicbrainzDetails.present')}`
        : lifeSpan?.end;
    return compactDetails([
        { label: t('musicbrainzDetails.canonicalName'), value: props.artist.name },
        { label: t('musicbrainzDetails.type'), value: props.artist.type },
        { label: t('musicbrainzDetails.origin'), value: props.artist.area?.name ?? props.artist.country },
        { label: t('musicbrainzDetails.activePeriod'), value: activePeriod },
        { label: t('musicbrainzDetails.disambiguation'), value: props.artist.disambiguation },
    ]);
});

function compactDetails(details: Array<{ label: string; value?: string | null }>): Detail[] {
    return details.filter((detail): detail is Detail => Boolean(detail.value?.trim()));
}
</script>

<style scoped>
.musicbrainz-fields {
    display: grid;
    grid-template-columns: minmax(110px, auto) 1fr;
    gap: 6px 16px;
}

.musicbrainz-fields dd {
    margin: 0;
    min-width: 0;
}
</style>
