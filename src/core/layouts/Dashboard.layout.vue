<template>
    <HeaderComponent />
    <v-container class="py-6">
        <v-row>
            <v-col cols="12">
                <h1 class="text-h4 mb-4">{{ t('dashboard.title') }}</h1>
                <AppSkeleton
                    v-if="dashboardLoading"
                    variant="table"
                    :count="6"
                    :label="t('common.loading')"
                />
                <template v-else>
                    <v-btn class="mb-4" color="primary" prepend-icon="mdi-plus" @click="showCollectionForm = true">
                        {{ t('dashboard.actions.addCollection') }}
                    </v-btn>
                    <v-table>
                        <thead>
                            <tr>
                                <th>{{ t('dashboard.columns.image') }}</th>
                                <th>{{ t('dashboard.columns.album') }}</th>
                                <th>{{ t('dashboard.columns.artist') }}</th>
                                <th>{{ t('dashboard.columns.year') }}</th>
                                <th>{{ t('dashboard.columns.release') }}</th>
                                <th>{{ t('dashboard.columns.details') }}</th>
                                <th>{{ t('dashboard.columns.createdBy') }}</th>
                                <th class="text-right">{{ t('dashboard.columns.actions') }}</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="item in collection" :key="item.id">
                                <td><ImagePreview :src="item.album_image" :alt="item.album_name" /></td>
                                <td>{{ item.album_name }}</td>
                                <td>{{ item.artist_name }}</td>
                                <td>{{ item.album_year ?? '-' }}</td>
                                <td>{{ formatCollectionRelease(item.musicbrainz_release_data) }}</td>
                                <td><CollectionMetadataDisplay :metadata="item.metadata" /></td>
                                <td>{{ item.created_by_username ?? '-' }}</td>
                                <td class="text-right text-no-wrap">
                                    <v-btn
                                        icon="mdi-pencil"
                                        variant="text"
                                        size="small"
                                        :aria-label="t('dashboard.actions.editCollection')"
                                        @click="openCollectionEdit(item)"
                                    />
                                    <v-btn
                                        icon="mdi-delete"
                                        variant="text"
                                        color="error"
                                        size="small"
                                        :loading="deletingCollectionId === item.id"
                                        :aria-label="t('dashboard.actions.removeCollection')"
                                        @click="removeCollection(item.id)"
                                    />
                                </td>
                            </tr>
                        </tbody>
                    </v-table>
                </template>
            </v-col>
        </v-row>
    </v-container>

    <v-dialog v-model="showCollectionForm" max-width="850" @after-leave="resetCollectionForm">
        <v-card :title="t('dashboard.modals.addCollection')">
            <v-card-text>
                <v-stepper
                    v-model="collectionStep"
                    :items="collectionSteps"
                    editable
                    flat
                >
                    <template #item.1>
                        <v-autocomplete
                            v-model="artistSelectionKey"
                            v-model:search="artistSearch"
                            :items="artistAutocompleteItems"
                            item-title="title"
                            item-value="key"
                            item-props="props"
                            no-filter
                            clearable
                            :loading="artistSearching"
                            :label="t('dashboard.musicbrainz.searchArtist')"
                            :hint="t('dashboard.musicbrainz.searchHint')"
                            persistent-hint
                            @update:search="scheduleArtistSearch"
                            @update:model-value="selectArtistSuggestion"
                        />
                        <v-alert
                            v-if="artistSearchError"
                            type="warning"
                            variant="tonal"
                            density="compact"
                            class="mb-3"
                        >
                            {{ artistSearchError }}
                        </v-alert>
                        <v-text-field
                            v-if="selectedExistingArtist"
                            :model-value="selectedExistingArtist.name"
                            :label="t('dashboard.fields.artistName')"
                            readonly
                        />
                        <v-text-field
                            v-else-if="artistDraft"
                            v-model="artistDraft.name"
                            :label="t('dashboard.fields.artistName')"
                            :rules="[requiredRule]"
                        />
                    </template>

                    <template #item.2>
                        <v-alert v-if="!artistSelected" type="info" variant="tonal">
                            {{ t('dashboard.steps.selectArtist') }}
                        </v-alert>
                        <template v-else>
                            <v-autocomplete
                                v-model="albumSelectionKey"
                                v-model:search="albumSearch"
                                :items="albumAutocompleteItems"
                                item-title="title"
                                item-value="key"
                                item-props="props"
                                no-filter
                                clearable
                                :loading="albumSearching"
                                :label="t('dashboard.musicbrainz.searchAlbum')"
                                :hint="selectedArtistMusicBrainz
                                    ? t('dashboard.musicbrainz.searchHint')
                                    : t('dashboard.musicbrainz.customArtistHint')"
                                persistent-hint
                                @update:search="scheduleAlbumSearch"
                                @update:model-value="selectAlbumSuggestion"
                            >
                                <template #item="{ props, item }">
                                    <v-list-item v-bind="getAutocompleteItemProps(props)">
                                        <div class="album-select-item">
                                            <v-icon
                                                v-if="item.kind === 'custom'"
                                                class="album-select-thumb album-select-fallback"
                                            >
                                                mdi-plus
                                            </v-icon>
                                            <template v-else-if="item.releaseGroupId">
                                                <v-img
                                                    v-if="!albumCoverErrors.has(item.releaseGroupId)"
                                                    :src="getReleaseGroupThumbnailUrl(item.releaseGroupId)"
                                                    :alt="item.title"
                                                    cover
                                                    class="album-select-thumb"
                                                    @error="markAlbumCoverMissing(item.releaseGroupId)"
                                                />
                                                <v-icon v-else class="album-select-thumb album-select-fallback">
                                                    mdi-disc
                                                </v-icon>
                                            </template>
                                            <v-img
                                                v-else-if="item.image"
                                                :src="item.image"
                                                :alt="item.title"
                                                cover
                                                class="album-select-thumb"
                                            />
                                            <v-icon v-else class="album-select-thumb album-select-fallback">
                                                mdi-album
                                            </v-icon>
                                            <div class="album-select-copy">
                                                <v-list-item-title>{{ item.title }}</v-list-item-title>
                                                <v-list-item-subtitle v-if="item.props.subtitle">
                                                    {{ item.props.subtitle }}
                                                </v-list-item-subtitle>
                                            </div>
                                        </div>
                                    </v-list-item>
                                </template>
                            </v-autocomplete>
                            <v-alert
                                v-if="albumSearchError"
                                type="warning"
                                variant="tonal"
                                density="compact"
                                class="mb-3"
                            >
                                {{ albumSearchError }}
                            </v-alert>

                            <template v-if="selectedExistingAlbum">
                                <v-text-field
                                    :model-value="selectedExistingAlbum.name"
                                    :label="t('dashboard.fields.albumName')"
                                    readonly
                                />
                                <v-text-field
                                    :model-value="selectedExistingAlbum.year ?? ''"
                                    :label="t('dashboard.fields.year')"
                                    readonly
                                />
                                <v-text-field
                                    :model-value="selectedExistingAlbum.image ?? ''"
                                    :label="t('dashboard.fields.image')"
                                    readonly
                                />
                            </template>
                            <template v-else-if="albumDraft">
                                <v-text-field
                                    v-model="albumDraft.name"
                                    :label="t('dashboard.fields.albumName')"
                                    :rules="[requiredRule]"
                                />
                                <v-text-field
                                    v-model.number="albumDraft.year"
                                    :label="t('dashboard.fields.year')"
                                    type="number"
                                    min="0"
                                />
                                <v-text-field
                                    v-model="albumDraft.image"
                                    :label="t('dashboard.fields.image')"
                                    :rules="[imageUrlRule]"
                                    :loading="coverStatus === 'loading'"
                                />
                                <v-alert
                                    v-if="coverStatus === 'missing'"
                                    type="info"
                                    variant="tonal"
                                    density="compact"
                                    class="mb-3"
                                >
                                    {{ t('dashboard.musicbrainz.coverMissing') }}
                                </v-alert>
                                <v-alert
                                    v-else-if="coverStatus === 'error'"
                                    type="warning"
                                    variant="tonal"
                                    density="compact"
                                    class="mb-3"
                                >
                                    <div class="d-flex align-center justify-space-between ga-2">
                                        <span>{{ t('dashboard.musicbrainz.coverError') }}</span>
                                        <v-btn size="small" variant="text" @click="retryCover">
                                            {{ t('dashboard.actions.retry') }}
                                        </v-btn>
                                    </div>
                                </v-alert>
                            </template>
                        </template>
                    </template>

                    <template #item.3>
                        <v-alert v-if="!albumSelected" type="info" variant="tonal">
                            {{ t('dashboard.steps.selectAlbum') }}
                        </v-alert>
                        <template v-else>
                            <MusicBrainzEditionSelector
                                v-model="collectionForm.musicbrainz_release_data"
                                :release-group="selectedAlbumReleaseGroup"
                            />
                            <CollectionMetadataEditor v-model="collectionForm.metadata" />
                        </template>
                    </template>
                </v-stepper>

                <v-alert v-if="collectionSaveError" type="error" variant="tonal" density="compact" class="mt-3">
                    {{ collectionSaveError }}
                </v-alert>
            </v-card-text>
            <v-card-actions class="justify-end">
                <v-btn variant="text" :disabled="saving" @click="cancelCollection">
                    {{ t('dashboard.actions.cancel') }}
                </v-btn>
                <v-btn color="primary" :disabled="!collectionFormValid" :loading="saving" @click="saveCollection">
                    {{ t('dashboard.actions.add') }}
                </v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>

    <v-dialog v-model="showCollectionEdit" max-width="850" @after-leave="resetCollectionEdit">
        <v-card :title="t('dashboard.modals.editCollection')">
            <v-card-text>
                <MusicBrainzEditionSelector
                    v-model="collectionEditRelease"
                    :release-group="collectionEditReleaseGroup"
                />
                <CollectionMetadataEditor v-model="collectionEditMetadata" />
            </v-card-text>
            <v-card-actions class="justify-end">
                <v-btn variant="text" @click="cancelCollectionEdit">{{ t('dashboard.actions.cancel') }}</v-btn>
                <v-btn
                    color="primary"
                    :disabled="!isMetadataValid(collectionEditMetadata)"
                    :loading="saving"
                    @click="saveCollectionEdit"
                >
                    {{ t('dashboard.actions.save') }}
                </v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>

<script setup lang="ts">
import CollectionMetadataDisplay from 'core/components/CollectionMetadataDisplay.component.vue';
import CollectionMetadataEditor from 'core/components/CollectionMetadataEditor.component.vue';
import MusicBrainzEditionSelector from 'core/components/MusicBrainzEditionSelector.component.vue';
import HeaderComponent from 'core/components/Header.component.vue';
import ImagePreview from 'core/components/ImagePreview.component.vue';
import AppSkeleton from 'core/components/AppSkeleton.component.vue';
import { cloneMetadata, isMetadataValid, isOptionalHttpUrl } from 'core/utils/collection-metadata.utils';
import { store } from 'core/store/index.store';
import type { CollectionItem } from 'core/store/stores/collection.store';
import { DiscordService } from 'modules/discord-auth/services/discord.service';
import { api } from 'api/api';
import type {
    CollectionMetadata,
    CollectionReleaseSelection,
    CommonReleaseSelection,
    DatabaseAlbum,
    DatabaseArtist,
    MusicBrainzArtist,
    MusicBrainzRelease,
    MusicBrainzReleaseGroup,
} from '../../../shared/types/database.types';
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const collectionStore = store.collection();
const discordService = DiscordService.getInstance();
const collection = ref<CollectionItem[]>([]);
const artists = ref<DatabaseArtist[]>([]);
const albums = ref<DatabaseAlbum[]>([]);
const dashboardLoading = ref(true);
const saving = ref(false);
const deletingCollectionId = ref<number | null>(null);
const showCollectionForm = ref(false);
const showCollectionEdit = ref(false);
const editingCollectionId = ref<number | null>(null);

interface ArtistDraft {
    name: string;
    musicbrainz_data: MusicBrainzArtist | null;
}

interface AlbumDraft {
    name: string;
    year: number | null | '';
    image: string;
    musicbrainz_data: MusicBrainzReleaseGroup | null;
}

interface AutocompleteItem {
    key: string;
    title: string;
    props: { subtitle?: string; prependIcon?: string };
    kind: 'local' | 'remote' | 'custom';
    releaseGroupId?: string;
    image?: string | null;
}

const selectedArtistId = ref<number | null>(null);
const artistDraft = ref<ArtistDraft | null>(null);
const selectedAlbumId = ref<number | null>(null);
const albumDraft = ref<AlbumDraft | null>(null);
const collectionStep = ref(1);
const collectionForm = ref<{
    metadata: CollectionMetadata[];
    musicbrainz_release_data: CollectionReleaseSelection | null;
}>({ metadata: [], musicbrainz_release_data: null });
const collectionEditMetadata = ref<CollectionMetadata[]>([]);
const collectionEditRelease = ref<CollectionReleaseSelection | null>(null);
const collectionEditReleaseGroup = ref<MusicBrainzReleaseGroup | null>(null);

const artistSearch = ref('');
const artistSelectionKey = ref<string | null>(null);
const artistSuggestions = ref<MusicBrainzArtist[]>([]);
const artistSearching = ref(false);
const artistSearchError = ref('');
const albumSearch = ref('');
const albumSelectionKey = ref<string | null>(null);
const albumSuggestions = ref<MusicBrainzReleaseGroup[]>([]);
const albumDefaultSuggestions = ref<MusicBrainzReleaseGroup[]>([]);
const albumSearching = ref(false);
const albumSearchError = ref('');
const albumCoverErrors = ref(new Set<string>());
const coverStatus = ref<'idle' | 'loading' | 'found' | 'missing' | 'error'>('idle');
const collectionSaveError = ref('');
let artistSearchTimer: ReturnType<typeof setTimeout> | undefined;
let albumSearchTimer: ReturnType<typeof setTimeout> | undefined;
let artistSearchRequest = 0;
let albumSearchRequest = 0;
let coverRequest = 0;

const selectedExistingArtist = computed(() => selectedArtistId.value === null
    ? null
    : artists.value.find((artist) => artist.id === selectedArtistId.value) ?? null);
const artistSelected = computed(() => selectedExistingArtist.value !== null || artistDraft.value !== null);
const selectedArtistMusicBrainz = computed(() =>
    selectedExistingArtist.value?.musicbrainz_data ?? artistDraft.value?.musicbrainz_data ?? null);
const selectedExistingAlbum = computed(() => selectedAlbumId.value === null
    ? null
    : albums.value.find((album) => album.id === selectedAlbumId.value) ?? null);
const albumSelected = computed(() => selectedExistingAlbum.value !== null || albumDraft.value !== null);
const selectedAlbumReleaseGroup = computed(() =>
    selectedExistingAlbum.value?.musicbrainz_data ?? albumDraft.value?.musicbrainz_data ?? null);

const currentUserAlbumIds = computed(() => {
    const userId = discordService.user.value?.id;
    return new Set(collection.value
        .filter((item) => item.created_by_user_id === userId)
        .map((item) => item.album_id));
});

const availableLocalAlbums = computed(() => {
    if (selectedArtistId.value === null) return [];
    return albums.value.filter((album) => album.artist_id === selectedArtistId.value
        && !currentUserAlbumIds.value.has(album.id));
});

function normalizeName(value: string): string {
    return value.trim().toLocaleLowerCase();
}

const artistAutocompleteItems = computed<AutocompleteItem[]>(() => {
    const selectedCustomQuery = artistSelectionKey.value?.startsWith('custom:')
        ? artistSelectionKey.value.slice('custom:'.length)
        : null;
    const query = (selectedCustomQuery ?? artistSearch.value).trim();
    const normalizedQuery = normalizeName(query);
    const localMatchMap = new Map<number, DatabaseArtist>();
    if (normalizedQuery) {
        for (const artist of artists.value) {
            if (normalizeName(artist.name).includes(normalizedQuery)) localMatchMap.set(artist.id, artist);
        }
        const suggestedIds = new Set(artistSuggestions.value.map((artist) => artist.id));
        for (const artist of artists.value) {
            if (artist.musicbrainz_data && suggestedIds.has(artist.musicbrainz_data.id)) {
                localMatchMap.set(artist.id, artist);
            }
        }
    }
    const localMatches = [...localMatchMap.values()];
    const localMusicBrainzIds = new Set(artists.value
        .map((artist) => artist.musicbrainz_data?.id)
        .filter((id): id is string => Boolean(id)));
    const exactLocalMatch = artists.value.some((artist) => normalizeName(artist.name) === normalizedQuery);
    const remoteItems = artistSuggestions.value
        .filter((artist) => !localMusicBrainzIds.has(artist.id))
        .map((artist) => ({
            key: `mb:${artist.id}`,
            title: artist.name,
            props: {
                subtitle: [t('dashboard.musicbrainz.musicBrainzResult'), formatArtistSubtitle(artist)]
                    .filter(Boolean).join(' · '),
                prependIcon: 'mdi-database-music',
            },
            kind: 'remote' as const,
        }));
    return [
        ...localMatches.map((artist) => ({
            key: `local:${artist.id}`,
            title: artist.name,
            props: { subtitle: t('dashboard.musicbrainz.existingArtist'), prependIcon: 'mdi-account-check' },
            kind: 'local' as const,
        })),
        ...remoteItems,
        ...query && !exactLocalMatch ? [{
            key: `custom:${query}`,
            title: t('dashboard.musicbrainz.create', { query }),
            props: { prependIcon: 'mdi-plus' },
            kind: 'custom' as const,
        }] : [],
    ];
});

const albumAutocompleteItems = computed<AutocompleteItem[]>(() => {
    const selectedCustomQuery = albumSelectionKey.value?.startsWith('custom:')
        ? albumSelectionKey.value.slice('custom:'.length)
        : null;
    const query = (selectedCustomQuery ?? albumSearch.value).trim();
    const normalizedQuery = normalizeName(query);
    const localMatchMap = new Map<number, DatabaseAlbum>();
    for (const album of availableLocalAlbums.value) {
        if (!normalizedQuery || normalizeName(album.name).includes(normalizedQuery)) {
            localMatchMap.set(album.id, album);
        }
    }
    const suggestedIds = new Set(albumSuggestions.value.map((album) => album.id));
    for (const album of availableLocalAlbums.value) {
        if (album.musicbrainz_data && suggestedIds.has(album.musicbrainz_data.id)) {
            localMatchMap.set(album.id, album);
        }
    }
    const localMatches = [...localMatchMap.values()];
    const allArtistAlbums = selectedArtistId.value === null
        ? []
        : albums.value.filter((album) => album.artist_id === selectedArtistId.value);
    const localMusicBrainzIds = new Set(allArtistAlbums
        .map((album) => album.musicbrainz_data?.id)
        .filter((id): id is string => Boolean(id)));
    const exactLocalMatch = allArtistAlbums.some((album) => normalizeName(album.name) === normalizedQuery);
    const remoteItems = albumSuggestions.value
        .filter((releaseGroup) => !localMusicBrainzIds.has(releaseGroup.id))
        .map((releaseGroup) => ({
            key: `mb:${releaseGroup.id}`,
            title: releaseGroup.title,
            props: {
                subtitle: [
                    t('dashboard.musicbrainz.musicBrainzResult'),
                    releaseGroup['first-release-date'],
                    releaseGroup.disambiguation,
                ].filter(Boolean).join(' · '),
                prependIcon: 'mdi-album',
            },
            kind: 'remote' as const,
            releaseGroupId: releaseGroup.id,
        }));
    return [
        ...localMatches.map((album) => ({
            key: `local:${album.id}`,
            title: album.name,
            props: {
                subtitle: [t('dashboard.musicbrainz.existingAlbum'), album.year].filter(Boolean).join(' · '),
                prependIcon: 'mdi-album',
            },
            kind: 'local' as const,
            image: album.image,
            releaseGroupId: album.musicbrainz_data?.id,
        })),
        ...remoteItems,
        ...query && !exactLocalMatch ? [{
            key: `custom:${query}`,
            title: t('dashboard.musicbrainz.create', { query }),
            props: { prependIcon: 'mdi-plus' },
            kind: 'custom' as const,
        }] : [],
    ];
});

const artistDraftValid = computed(() => artistDraft.value === null || artistDraft.value.name.trim() !== '');
const albumDraftValid = computed(() => albumDraft.value === null || (
    albumDraft.value.name.trim() !== ''
    && (albumDraft.value.year === null || albumDraft.value.year === ''
        || (Number.isInteger(albumDraft.value.year) && albumDraft.value.year >= 0))
    && isOptionalHttpUrl(albumDraft.value.image)
));
const collectionSteps = computed(() => [
    {
        title: t('dashboard.steps.artist'),
        value: 1,
        props: { complete: artistSelected.value && artistDraftValid.value },
    },
    {
        title: t('dashboard.steps.album'),
        value: 2,
        props: { complete: albumSelected.value && albumDraftValid.value },
    },
    { title: t('dashboard.steps.informations'), value: 3 },
]);
const collectionFormValid = computed(() => artistSelected.value
    && albumSelected.value
    && artistDraftValid.value
    && albumDraftValid.value
    && isMetadataValid(collectionForm.value.metadata));

function requiredRule(value: unknown): true | string {
    return value !== null && value !== undefined && String(value).trim() ? true : t('validation.required');
}

function imageUrlRule(value: unknown): true | string {
    return typeof value !== 'string' || isOptionalHttpUrl(value) ? true : t('validation.httpUrl');
}

function formatCollectionRelease(release: CollectionReleaseSelection | null): string {
    if (!release) return '-';
    const commonRelease = release as CommonReleaseSelection;
    if (commonRelease.source === 'common') return commonRelease.format;
    const musicBrainzRelease = release as MusicBrainzRelease;
    const formats = [...new Set((musicBrainzRelease.media ?? [])
        .map((medium) => medium.format).filter(Boolean))].join(', ');
    return [musicBrainzRelease.date, musicBrainzRelease.country, formats]
        .filter(Boolean).join(' · ') || musicBrainzRelease.title;
}

function formatArtistSubtitle(artist: MusicBrainzArtist): string {
    return [artist.type, artist.disambiguation, artist.area?.name ?? artist.country].filter(Boolean).join(' · ');
}

function scheduleArtistSearch(value: string | null) {
    artistSearchRequest += 1;
    const requestId = artistSearchRequest;
    if (artistSearchTimer) clearTimeout(artistSearchTimer);
    artistSearchError.value = '';
    const query = value?.trim() ?? '';
    if (query.length < 2) {
        artistSuggestions.value = [];
        artistSearching.value = false;
        return;
    }
    artistSearchTimer = setTimeout(async () => {
        artistSearching.value = true;
        try {
            const results = await api.collection.searchMusicBrainzArtists(query);
            if (requestId === artistSearchRequest) artistSuggestions.value = results;
        } catch {
            if (requestId === artistSearchRequest) {
                artistSuggestions.value = [];
                artistSearchError.value = t('dashboard.musicbrainz.searchError');
            }
        } finally {
            if (requestId === artistSearchRequest) artistSearching.value = false;
        }
    }, 350);
}

function selectArtistSuggestion(key: string | null) {
    collectionSaveError.value = '';
    selectedArtistId.value = null;
    artistDraft.value = null;
    resetAlbumFlow(true);
    if (!key) return;
    if (key.startsWith('local:')) {
        const id = Number(key.slice('local:'.length));
        if (artists.value.some((artist) => artist.id === id)) selectedArtistId.value = id;
    } else if (key.startsWith('mb:')) {
        const id = key.slice('mb:'.length);
        const artist = artistSuggestions.value.find((item) => item.id === id);
        if (artist) artistDraft.value = { name: artist.name, musicbrainz_data: artist };
    } else if (key.startsWith('custom:')) {
        artistDraft.value = {
            name: key.slice('custom:'.length), musicbrainz_data: null,
        };
    }
    if (artistSelected.value) {
        collectionStep.value = 2;
        void loadSelectedArtistAlbums();
    } else {
        collectionStep.value = 1;
    }
}

function scheduleAlbumSearch(value: string | null) {
    albumSearchRequest += 1;
    const requestId = albumSearchRequest;
    if (albumSearchTimer) clearTimeout(albumSearchTimer);
    albumSearchError.value = '';
    const query = value?.trim() ?? '';
    const artistMbid = selectedArtistMusicBrainz.value?.id;
    if (!artistMbid) {
        albumSuggestions.value = [];
        albumSearching.value = false;
        return;
    }
    if (query.length < 2) {
        const normalizedQuery = normalizeName(query);
        albumSuggestions.value = normalizedQuery
            ? albumDefaultSuggestions.value.filter((item) => normalizeName(item.title).includes(normalizedQuery))
            : albumDefaultSuggestions.value;
        albumSearching.value = false;
        return;
    }
    albumSearchTimer = setTimeout(async () => {
        albumSearching.value = true;
        try {
            const results = await api.collection.searchMusicBrainzReleaseGroups(artistMbid, query);
            if (requestId === albumSearchRequest) albumSuggestions.value = results;
        } catch {
            if (requestId === albumSearchRequest) {
                albumSuggestions.value = [];
                albumSearchError.value = t('dashboard.musicbrainz.searchError');
            }
        } finally {
            if (requestId === albumSearchRequest) albumSearching.value = false;
        }
    }, 350);
}

async function loadSelectedArtistAlbums() {
    const artistMbid = selectedArtistMusicBrainz.value?.id;
    if (!artistMbid) return;
    const requestId = ++albumSearchRequest;
    albumSearching.value = true;
    albumSearchError.value = '';
    try {
        const results = await api.collection.searchMusicBrainzReleaseGroups(artistMbid, '');
        if (requestId !== albumSearchRequest) return;
        albumDefaultSuggestions.value = results;
        const query = normalizeName(albumSearch.value);
        albumSuggestions.value = results.filter((item) => !query || normalizeName(item.title).includes(query));
    } catch {
        if (requestId === albumSearchRequest) {
            albumDefaultSuggestions.value = [];
            albumSuggestions.value = [];
            albumSearchError.value = t('dashboard.musicbrainz.searchError');
        }
    } finally {
        if (requestId === albumSearchRequest) albumSearching.value = false;
    }
}

function selectAlbumSuggestion(key: string | null) {
    collectionSaveError.value = '';
    selectedAlbumId.value = null;
    albumDraft.value = null;
    collectionForm.value.musicbrainz_release_data = null;
    coverRequest += 1;
    coverStatus.value = 'idle';
    if (!key) return;
    if (key.startsWith('local:')) {
        const id = Number(key.slice('local:'.length));
        if (availableLocalAlbums.value.some((album) => album.id === id)) selectedAlbumId.value = id;
        if (selectedAlbumId.value !== null) collectionStep.value = 3;
        return;
    }
    if (key.startsWith('custom:')) {
        albumDraft.value = {
            name: key.slice('custom:'.length), year: null, image: '', musicbrainz_data: null,
        };
        collectionStep.value = 3;
        return;
    }
    if (!key.startsWith('mb:')) return;
    const id = key.slice('mb:'.length);
    const releaseGroup = albumSuggestions.value.find((item) => item.id === id)
        ?? albumDefaultSuggestions.value.find((item) => item.id === id);
    if (!releaseGroup) return;
    const yearText = releaseGroup['first-release-date']?.match(/^\d{4}/)?.[0];
    albumDraft.value = {
        name: releaseGroup.title,
        year: yearText ? Number(yearText) : null,
        image: '',
        musicbrainz_data: releaseGroup,
    };
    collectionStep.value = 3;
    void loadCover(releaseGroup.id);
}

async function loadCover(releaseGroupMbid: string) {
    const requestId = ++coverRequest;
    const initialImage = albumDraft.value?.image ?? '';
    coverStatus.value = 'loading';
    try {
        const result = await api.collection.getReleaseGroupCover(releaseGroupMbid);
        if (requestId !== coverRequest || !albumDraft.value) return;
        if (result.imageUrl) {
            if (albumDraft.value.image === initialImage) albumDraft.value.image = result.imageUrl;
            coverStatus.value = 'found';
        } else {
            coverStatus.value = albumDraft.value.image ? 'found' : 'missing';
        }
    } catch {
        if (requestId === coverRequest) coverStatus.value = 'error';
    }
}

function retryCover() {
    const releaseGroupMbid = albumDraft.value?.musicbrainz_data?.id;
    if (releaseGroupMbid) void loadCover(releaseGroupMbid);
}

function getReleaseGroupThumbnailUrl(releaseGroupMbid: string): string {
    return `https://coverartarchive.org/release-group/${releaseGroupMbid}/front-250`;
}

function markAlbumCoverMissing(releaseGroupMbid: string) {
    albumCoverErrors.value.add(releaseGroupMbid);
}

function getAutocompleteItemProps(props: Record<string, unknown>) {
    const { title: _title, subtitle: _subtitle, prependIcon: _prependIcon, ...itemProps } = props;
    return itemProps;
}

function resetAlbumFlow(clearMetadata: boolean) {
    albumSearchRequest += 1;
    coverRequest += 1;
    if (albumSearchTimer) clearTimeout(albumSearchTimer);
    selectedAlbumId.value = null;
    albumDraft.value = null;
    albumSearch.value = '';
    albumSelectionKey.value = null;
    albumSuggestions.value = [];
    albumDefaultSuggestions.value = [];
    albumSearching.value = false;
    albumSearchError.value = '';
    coverStatus.value = 'idle';
    collectionForm.value.musicbrainz_release_data = null;
    if (clearMetadata) collectionForm.value.metadata = [];
}

function resetCollectionForm() {
    artistSearchRequest += 1;
    if (artistSearchTimer) clearTimeout(artistSearchTimer);
    selectedArtistId.value = null;
    artistDraft.value = null;
    artistSearch.value = '';
    artistSelectionKey.value = null;
    artistSuggestions.value = [];
    artistSearching.value = false;
    artistSearchError.value = '';
    resetAlbumFlow(true);
    collectionStep.value = 1;
    collectionSaveError.value = '';
}

function cancelCollection() {
    if (saving.value) return;
    showCollectionForm.value = false;
    resetCollectionForm();
}

async function refreshDashboard() {
    const [collectionItems, artistRows, albumRows] = await Promise.all([
        collectionStore.getAll(), collectionStore.getArtists(), collectionStore.getAlbums(),
    ]);
    collection.value = collectionItems;
    artists.value = artistRows;
    albums.value = albumRows;
}

async function saveCollection() {
    const userId = discordService.user.value?.id;
    if (!collectionFormValid.value || !userId) return;
    const artist = selectedArtistId.value !== null
        ? { type: 'existing' as const, id: selectedArtistId.value }
        : {
            type: 'new' as const,
            data: {
                name: artistDraft.value!.name.trim(),
                musicbrainz_data: artistDraft.value!.musicbrainz_data,
            },
        };
    const album = selectedAlbumId.value !== null
        ? { type: 'existing' as const, id: selectedAlbumId.value }
        : {
            type: 'new' as const,
            data: {
                name: albumDraft.value!.name.trim(),
                year: albumDraft.value!.year === '' ? null : albumDraft.value!.year,
                image: albumDraft.value!.image.trim() || null,
                musicbrainz_data: albumDraft.value!.musicbrainz_data,
            },
        };
    saving.value = true;
    collectionSaveError.value = '';
    try {
        const result = await collectionStore.composeCollection({
            artist,
            album,
            created_by_user_id: userId,
            metadata: collectionForm.value.metadata,
            musicbrainz_release_data: collectionForm.value.musicbrainz_release_data,
        });
        if (!artists.value.some((item) => item.id === result.artist.id)) artists.value.push(result.artist);
        if (!albums.value.some((item) => item.id === result.album.id)) albums.value.push(result.album);
        if (!collection.value.some((item) => item.id === result.collection.id)) collection.value.push(result.collection);
        showCollectionForm.value = false;
    } catch (error) {
        collectionSaveError.value = error instanceof Error && error.message.includes('already in this user collection')
            ? t('dashboard.musicbrainz.duplicateCollection')
            : t('dashboard.musicbrainz.composeSaveError');
    } finally {
        saving.value = false;
    }
}

function openCollectionEdit(item: CollectionItem) {
    editingCollectionId.value = item.id;
    collectionEditMetadata.value = cloneMetadata(item.metadata);
    collectionEditRelease.value = item.musicbrainz_release_data;
    collectionEditReleaseGroup.value = item.album_musicbrainz_data;
    showCollectionEdit.value = true;
}

function resetCollectionEdit() {
    editingCollectionId.value = null;
    collectionEditMetadata.value = [];
    collectionEditRelease.value = null;
    collectionEditReleaseGroup.value = null;
}

function cancelCollectionEdit() {
    showCollectionEdit.value = false;
    resetCollectionEdit();
}

async function saveCollectionEdit() {
    const id = editingCollectionId.value;
    if (id === null || !isMetadataValid(collectionEditMetadata.value)) return;
    saving.value = true;
    try {
        const updatedItem = await collectionStore.updateCollection(id, {
            metadata: collectionEditMetadata.value,
            musicbrainz_release_data: collectionEditRelease.value,
        });
        const index = collection.value.findIndex((item) => item.id === id);
        if (index !== -1) collection.value[index] = updatedItem;
        cancelCollectionEdit();
    } finally {
        saving.value = false;
    }
}

async function removeCollection(id: number) {
    deletingCollectionId.value = id;
    try {
        await collectionStore.deleteCollection(id);
        collection.value = collection.value.filter((item) => item.id !== id);
    } finally {
        deletingCollectionId.value = null;
    }
}

onMounted(async () => {
    try {
        await refreshDashboard();
    } finally {
        dashboardLoading.value = false;
    }
});
</script>

<style scoped>
.album-select-item {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
    padding: 4px 0;
}
.album-select-copy { min-width: 0; }
.album-select-thumb { width: 36px; height: 36px; flex: 0 0 36px; border-radius: 4px; }
.album-select-fallback {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.08);
}
</style>
