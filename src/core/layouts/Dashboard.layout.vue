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
                                <td>
                                    <ImagePreview
                                        :src="item.album_image"
                                        :source-url="item.album_image_url"
                                        :alt="item.album_name"
                                    />
                                </td>
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
                                        @click="requestCollectionDeletion(item)"
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
                        >
                            <template #item="{ props, item }">
                                <v-list-subheader v-if="item.kind === 'header'">{{ item.title }}</v-list-subheader>
                                <v-list-item v-else v-bind="getAutocompleteItemProps(props)">
                                    <v-list-item-title>{{ item.title }}</v-list-item-title>
                                    <v-list-item-subtitle v-if="item.props.subtitle">{{ item.props.subtitle }}</v-list-item-subtitle>
                                    <a v-if="item.externalUrl" :href="item.externalUrl" target="_blank" rel="noopener noreferrer" class="catalog-source-link" @click.stop>
                                        {{ item.externalUrl.includes('discogs.com') ? 'Data provided by Discogs' : `Open on ${item.externalUrl.includes('last.fm') ? 'Last.fm' : 'MusicBrainz'}` }}
                                    </a>
                                </v-list-item>
                            </template>
                        </v-autocomplete>
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
                                :hint="t('dashboard.musicbrainz.searchHint')"
                                persistent-hint
                                @update:search="scheduleAlbumSearch"
                                @update:model-value="selectAlbumSuggestion"
                            >
                                <template #item="{ props, item }">
                                    <v-list-subheader v-if="item.kind === 'header'">{{ item.title }}</v-list-subheader>
                                    <v-list-item v-else v-bind="getAutocompleteItemProps(props)">
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
                                                <a v-if="item.externalUrl" :href="item.externalUrl" target="_blank" rel="noopener noreferrer" class="catalog-source-link" @click.stop>
                                                    {{ item.externalUrl.includes('discogs.com') ? 'Data provided by Discogs' : `Open on ${item.externalUrl.includes('last.fm') ? 'Last.fm' : 'MusicBrainz'}` }}
                                                </a>
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
                                    @update:model-value="markManualCover"
                                />
                                <div v-if="coverCandidates.length" class="text-caption text-medium-emphasis mb-2">
                                    {{ t('dashboard.musicbrainz.selectCover') }}
                                </div>
                                <div v-if="coverCandidates.length" class="d-flex flex-wrap ga-2 mb-3">
                                    <div
                                        v-for="candidate in coverCandidates"
                                        :key="`${candidate.source}:${candidate.entityType}:${candidate.entityId}`"
                                        class="cover-candidate"
                                        :class="{ 'cover-candidate--selected': albumDraft.image === candidate.previewUrl }"
                                        role="button"
                                        tabindex="0"
                                        :aria-pressed="albumDraft.image === candidate.previewUrl"
                                        :title="candidate.source === 'discogs' ? 'Data provided by Discogs' : candidate.source === 'fanart' ? 'Album art provided by Fanart.tv' : 'Cover Art Archive'"
                                        @click="selectCover(candidate)"
                                        @keydown.enter.prevent="selectCover(candidate)"
                                        @keydown.space.prevent="selectCover(candidate)"
                                    >
                                        <v-img :src="candidate.previewUrl" width="72" height="72" cover />
                                        <a :href="candidate.externalUrl" target="_blank" rel="noopener noreferrer" @click.stop>
                                            {{ candidate.source === 'discogs' ? 'Discogs' : candidate.source === 'fanart' ? 'Fanart.tv' : 'CAA' }}
                                        </a>
                                    </div>
                                </div>
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
                                :catalog-reference="selectedAlbumCatalogReference"
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
                <v-alert type="info" variant="tonal" density="compact" class="mb-4">
                    {{ t('dashboard.edit.sharedFieldsHint') }}
                </v-alert>
                <h2 class="text-subtitle-1 font-weight-bold mb-2">{{ t('dashboard.steps.artist') }}</h2>
                <v-row dense>
                    <v-col cols="12" md="6">
                        <v-text-field
                            v-model="collectionEditForm.artistName"
                            :label="t('dashboard.fields.artistName')"
                            :rules="[requiredRule]"
                        />
                    </v-col>
                    <v-col cols="12" md="6">
                        <v-text-field
                            v-model="collectionEditForm.artistImage"
                            :label="t('dashboard.fields.artistImage')"
                            :rules="[imageUrlRule]"
                        />
                    </v-col>
                </v-row>

                <h2 class="text-subtitle-1 font-weight-bold mb-2">{{ t('dashboard.steps.album') }}</h2>
                <v-row dense>
                    <v-col cols="12" md="6">
                        <v-text-field
                            v-model="collectionEditForm.albumName"
                            :label="t('dashboard.fields.albumName')"
                            :rules="[requiredRule]"
                        />
                    </v-col>
                    <v-col cols="12" md="6">
                        <v-text-field
                            v-model.number="collectionEditForm.albumYear"
                            :label="t('dashboard.fields.year')"
                            type="number"
                            min="0"
                        />
                    </v-col>
                    <v-col cols="12">
                        <v-text-field
                            v-model="collectionEditForm.albumImage"
                            :label="t('dashboard.fields.albumImage')"
                            :rules="[imageUrlRule]"
                            @update:model-value="markEditCoverManual"
                        />
                    </v-col>
                </v-row>

                <h2 class="text-subtitle-1 font-weight-bold mb-2">{{ t('dashboard.steps.informations') }}</h2>
                <MusicBrainzEditionSelector
                    v-model="collectionEditRelease"
                    :release-group="collectionEditReleaseGroup"
                    :catalog-reference="collectionEditCatalogReference"
                />
                <CollectionMetadataEditor v-model="collectionEditMetadata" />
                <v-alert v-if="collectionEditSaveError" type="error" variant="tonal" density="compact" class="mt-3">
                    {{ collectionEditSaveError }}
                </v-alert>
            </v-card-text>
            <v-card-actions class="justify-end">
                <v-btn variant="text" :disabled="saving" @click="cancelCollectionEdit">
                    {{ t('dashboard.actions.cancel') }}
                </v-btn>
                <v-btn
                    color="primary"
                    :disabled="!collectionEditFormValid"
                    :loading="saving"
                    @click="saveCollectionEdit"
                >
                    {{ t('dashboard.actions.save') }}
                </v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>

    <v-dialog
        :model-value="pendingCollectionDeletion !== null"
        max-width="520"
        @update:model-value="cancelCollectionDeletion"
    >
        <v-card :title="t('dashboard.modals.confirmRemoval')">
            <v-card-text>
                <p v-if="pendingCollectionDeletion">
                    {{ t('dashboard.delete.confirm', {
                        album: pendingCollectionDeletion.album_name,
                        artist: pendingCollectionDeletion.artist_name,
                    }) }}
                </p>
                <v-alert
                    v-if="collectionDeleteError"
                    class="mt-4"
                    type="error"
                    variant="tonal"
                    density="compact"
                >
                    {{ collectionDeleteError }}
                </v-alert>
            </v-card-text>
            <v-card-actions class="justify-end">
                <v-btn variant="text" :disabled="deletingCollectionId !== null" @click="cancelCollectionDeletion">
                    {{ t('dashboard.actions.cancel') }}
                </v-btn>
                <v-btn
                    color="error"
                    variant="flat"
                    :loading="deletingCollectionId !== null"
                    @click="confirmCollectionDeletion"
                >
                    {{ t('dashboard.actions.remove') }}
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
import type {
    CatalogAlbumResult,
    CatalogArtistResult,
    CatalogCoverCandidate,
    CatalogCoverReference,
    CatalogExternalReference,
    CatalogProviderSection,
    CatalogProviderSource,
    CatalogSource,
} from '../../../shared/types/catalog.types';
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
const pendingCollectionDeletion = ref<CollectionItem | null>(null);
const collectionDeleteError = ref('');
const showCollectionForm = ref(false);
const showCollectionEdit = ref(false);
const editingCollectionId = ref<number | null>(null);

interface ArtistDraft {
    name: string;
    musicbrainz_data: MusicBrainzArtist | null;
    external_references: CatalogExternalReference[];
}

interface AlbumDraft {
    name: string;
    year: number | null | '';
    image: string;
    musicbrainz_data: MusicBrainzReleaseGroup | null;
    external_references: CatalogExternalReference[];
    image_reference: CatalogCoverReference;
}

interface AutocompleteItem {
    key: string;
    title: string;
    props: { subtitle?: string; prependIcon?: string; disabled?: boolean };
    kind: 'local' | 'remote' | 'custom' | 'header';
    releaseGroupId?: string;
    catalogResult?: CatalogAlbumResult;
    externalUrl?: string;
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
const collectionEditCatalogReference = ref<CatalogExternalReference | null>(null);
const collectionEditForm = ref({
    artistName: '',
    artistImage: '',
    albumName: '',
    albumYear: null as number | null | '',
    albumImage: '',
    albumImageSource: 'manual' as 'manual' | 'cover-art-archive' | 'discogs' | 'fanart',
    albumImageReference: null as CatalogCoverReference | null,
});
const collectionEditSaveError = ref('');

const artistSearch = ref('');
const artistSelectionKey = ref<string | null>(null);
const artistSections = ref<CatalogProviderSection<CatalogArtistResult>[]>([]);
const artistSearching = ref(false);
const artistSearchError = ref('');
const albumSearch = ref('');
const albumSelectionKey = ref<string | null>(null);
const albumSections = ref<CatalogProviderSection<CatalogAlbumResult>[]>([]);
const albumDefaultSections = ref<CatalogProviderSection<CatalogAlbumResult>[]>([]);
const albumSearching = ref(false);
const albumSearchError = ref('');
const albumCoverErrors = ref(new Set<string>());
const coverStatus = ref<'idle' | 'loading' | 'found' | 'missing' | 'error'>('idle');
const coverCandidates = ref<CatalogCoverCandidate[]>([]);
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
const selectedArtistReferences = computed<CatalogExternalReference[]>(() =>
    selectedExistingArtist.value?.external_references ?? artistDraft.value?.external_references ?? []);
const selectedArtistName = computed(() => selectedExistingArtist.value?.name ?? artistDraft.value?.name ?? '');
const selectedExistingAlbum = computed(() => selectedAlbumId.value === null
    ? null
    : albums.value.find((album) => album.id === selectedAlbumId.value) ?? null);
const albumSelected = computed(() => selectedExistingAlbum.value !== null || albumDraft.value !== null);
const selectedAlbumReleaseGroup = computed(() =>
    selectedExistingAlbum.value?.musicbrainz_data ?? albumDraft.value?.musicbrainz_data ?? null);
const selectedAlbumReferences = computed<CatalogExternalReference[]>(() =>
    selectedExistingAlbum.value?.external_references ?? albumDraft.value?.external_references ?? []);
const selectedAlbumCatalogReference = computed<CatalogExternalReference | null>(() =>
    selectedAlbumReferences.value.find((reference) => reference.source === 'discogs')
    ?? selectedAlbumReferences.value.find((reference) => reference.source === 'musicbrainz')
    ?? selectedAlbumReferences.value[0] ?? null);

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
    }
    const localMatches = [...localMatchMap.values()];
    const localReferenceKeys = new Set(artists.value.flatMap((artist) => artist.external_references ?? [])
        .map((reference) => `${reference.source}:${reference.kind}:${reference.externalId}`));
    const exactLocalMatch = artists.value.some((artist) => normalizeName(artist.name) === normalizedQuery);
    const remoteItems = artistSections.value.flatMap((section) => {
        if (section.status !== 'ok' || section.items.length === 0) return [];
        const items: AutocompleteItem[] = [{ key: `header:${section.source}`, title: providerLabel(section.source),
            props: { disabled: true }, kind: 'header' }];
        items.push(...section.items.filter((artist) => !localReferenceKeys.has(referenceKey(artist))).map((artist) => ({
            key: `remote:${artist.source}:${encodeURIComponent(artist.externalId)}`, title: artist.name,
            props: { subtitle: artist.subtitle, prependIcon: providerIcon(artist.source) }, kind: 'remote',
            externalUrl: artist.externalUrl,
        } satisfies AutocompleteItem)));
        return items.length > 1 ? items : [];
    });
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
    const localMatches = [...localMatchMap.values()];
    const allArtistAlbums = selectedArtistId.value === null
        ? []
        : albums.value.filter((album) => album.artist_id === selectedArtistId.value);
    const localReferenceKeys = new Set(allArtistAlbums.flatMap((album) => album.external_references ?? [])
        .map(referenceKey));
    const exactLocalMatch = allArtistAlbums.some((album) => normalizeName(album.name) === normalizedQuery);
    const remoteItems = albumSections.value.flatMap((section) => {
        if (section.status !== 'ok' || section.items.length === 0) return [];
        const items: AutocompleteItem[] = [{ key: `header:${section.source}`, title: providerLabel(section.source),
            props: { disabled: true }, kind: 'header' }];
        items.push(...section.items.filter((album) => !localReferenceKeys.has(referenceKey(album))).map((album) => ({
            key: `remote:${album.source}:${encodeURIComponent(album.externalId)}`, title: album.title,
            props: { subtitle: [album.year, album.kind === 'release' ? 'Release' : 'Album'].filter(Boolean).join(' · '),
                prependIcon: providerIcon(album.source) }, kind: 'remote', image: album.cover?.previewUrl,
            releaseGroupId: album.source === 'musicbrainz' ? album.externalId : undefined, catalogResult: album,
            externalUrl: album.externalUrl,
        } satisfies AutocompleteItem)));
        return items.length > 1 ? items : [];
    });
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
const coverSelectionValid = computed(() => albumDraft.value === null || (
    coverStatus.value !== 'loading'
    && (coverCandidates.value.length === 0 || albumDraft.value.image.trim() !== '')
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
        props: { complete: albumSelected.value && albumDraftValid.value && coverSelectionValid.value },
    },
    { title: t('dashboard.steps.informations'), value: 3 },
]);
const collectionFormValid = computed(() => artistSelected.value
    && albumSelected.value
    && artistDraftValid.value
    && albumDraftValid.value
    && coverSelectionValid.value
    && isMetadataValid(collectionForm.value.metadata));
const collectionEditFormValid = computed(() => collectionEditForm.value.artistName.trim() !== ''
    && collectionEditForm.value.albumName.trim() !== ''
    && (collectionEditForm.value.albumYear === null || collectionEditForm.value.albumYear === ''
        || (Number.isInteger(collectionEditForm.value.albumYear) && collectionEditForm.value.albumYear >= 0))
    && isOptionalHttpUrl(collectionEditForm.value.artistImage)
    && isOptionalHttpUrl(collectionEditForm.value.albumImage)
    && isMetadataValid(collectionEditMetadata.value));

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
    if (release.source === 'discogs') return `Discogs #${release.id}`;
    const musicBrainzRelease = release as MusicBrainzRelease;
    const formats = [...new Set((musicBrainzRelease.media ?? [])
        .map((medium) => medium.format).filter(Boolean))].join(', ');
    return [musicBrainzRelease.date, musicBrainzRelease.country, formats]
        .filter(Boolean).join(' · ') || musicBrainzRelease.title;
}

function providerLabel(source: CatalogProviderSource): string {
    return source === 'musicbrainz' ? 'MusicBrainz' : source === 'discogs' ? 'Discogs'
        : source === 'fanart' ? 'Fanart.tv' : 'Last.fm';
}

function providerIcon(source: CatalogSource): string {
    return source === 'musicbrainz' ? 'mdi-database-music' : source === 'discogs' ? 'mdi-record-circle-outline' : 'mdi-radio';
}

function referenceKey(reference: Pick<CatalogExternalReference, 'source' | 'kind' | 'externalId'>): string {
    return `${reference.source}:${reference.kind}:${reference.externalId}`;
}

function catalogSearchError<T>(sections: CatalogProviderSection<T>[]): string {
    const failed = sections.filter((section) => section.status === 'error').map((section) => providerLabel(section.source));
    return failed.length ? `${failed.join(', ')}: ${t('dashboard.musicbrainz.searchError')}` : '';
}

function scheduleArtistSearch(value: string | null) {
    artistSearchRequest += 1;
    const requestId = artistSearchRequest;
    if (artistSearchTimer) clearTimeout(artistSearchTimer);
    artistSearchError.value = '';
    const query = value?.trim() ?? '';
    if (query.length < 2) {
        artistSections.value = [];
        artistSearching.value = false;
        return;
    }
    artistSearchTimer = setTimeout(async () => {
        artistSearching.value = true;
        try {
            const results = await api.collection.searchCatalogArtists(query);
            if (requestId === artistSearchRequest) {
                artistSections.value = results;
                artistSearchError.value = catalogSearchError(results);
            }
        } catch {
            if (requestId === artistSearchRequest) {
                artistSections.value = [];
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
    } else if (key.startsWith('remote:')) {
        const [, source, encodedId] = key.split(':');
        const id = decodeURIComponent(encodedId ?? '');
        const artist = artistSections.value.find((section) => section.source === source)?.items
            .find((item) => item.externalId === id);
        if (artist) artistDraft.value = {
            name: artist.name,
            musicbrainz_data: artist.source === 'musicbrainz' ? artist.rawMusicBrainz as MusicBrainzArtist : null,
            external_references: [{ source: artist.source, kind: 'artist', externalId: artist.externalId,
                externalUrl: artist.externalUrl, musicBrainzId: artist.musicBrainzId }],
        };
    } else if (key.startsWith('custom:')) {
        artistDraft.value = {
            name: key.slice('custom:'.length), musicbrainz_data: null, external_references: [],
        };
    }
    if (artistSelected.value) void loadSelectedArtistAlbums();
}

function scheduleAlbumSearch(value: string | null) {
    albumSearchRequest += 1;
    const requestId = albumSearchRequest;
    if (albumSearchTimer) clearTimeout(albumSearchTimer);
    albumSearchError.value = '';
    const query = value?.trim() ?? '';
    if (query.length < 2) {
        const normalizedQuery = normalizeName(query);
        albumSections.value = albumDefaultSections.value.map((section) => ({ ...section,
            items: normalizedQuery ? section.items.filter((item) => normalizeName(item.title).includes(normalizedQuery)) : section.items }));
        albumSearching.value = false;
        return;
    }
    albumSearchTimer = setTimeout(async () => {
        albumSearching.value = true;
        try {
            const results = await searchAlbums(query);
            if (requestId === albumSearchRequest) {
                albumSections.value = results;
                albumSearchError.value = catalogSearchError(results);
            }
        } catch {
            if (requestId === albumSearchRequest) {
                albumSections.value = [];
                albumSearchError.value = t('dashboard.musicbrainz.searchError');
            }
        } finally {
            if (requestId === albumSearchRequest) albumSearching.value = false;
        }
    }, 350);
}

async function loadSelectedArtistAlbums() {
    if (!selectedArtistName.value) return;
    const requestId = ++albumSearchRequest;
    albumSearching.value = true;
    albumSearchError.value = '';
    try {
        const results = await searchAlbums('');
        if (requestId !== albumSearchRequest) return;
        albumDefaultSections.value = results;
        const query = normalizeName(albumSearch.value);
        albumSections.value = results.map((section) => ({ ...section,
            items: section.items.filter((item) => !query || normalizeName(item.title).includes(query)) }));
        albumSearchError.value = catalogSearchError(results);
    } catch {
        if (requestId === albumSearchRequest) {
            albumDefaultSections.value = [];
            albumSections.value = [];
            albumSearchError.value = t('dashboard.musicbrainz.searchError');
        }
    } finally {
        if (requestId === albumSearchRequest) albumSearching.value = false;
    }
}

function searchAlbums(query: string) {
    const bySource = new Map(selectedArtistReferences.value.map((reference) => [reference.source, reference.externalId]));
    return api.collection.searchCatalogAlbums({ artistName: selectedArtistName.value, query,
        musicbrainzId: selectedArtistMusicBrainz.value?.id ?? bySource.get('musicbrainz'),
        discogsId: bySource.get('discogs'), lastfmId: bySource.get('lastfm') });
}

function selectAlbumSuggestion(key: string | null) {
    collectionSaveError.value = '';
    selectedAlbumId.value = null;
    albumDraft.value = null;
    collectionForm.value.musicbrainz_release_data = null;
    coverRequest += 1;
    coverCandidates.value = [];
    coverStatus.value = 'idle';
    if (!key) return;
    if (key.startsWith('local:')) {
        const id = Number(key.slice('local:'.length));
        if (availableLocalAlbums.value.some((album) => album.id === id)) selectedAlbumId.value = id;
        return;
    }
    if (key.startsWith('custom:')) {
        albumDraft.value = {
            name: key.slice('custom:'.length), year: null, image: '', musicbrainz_data: null,
            external_references: [], image_reference: { source: 'manual' },
        };
        return;
    }
    if (!key.startsWith('remote:')) return;
    const [, source, encodedId] = key.split(':');
    const id = decodeURIComponent(encodedId ?? '');
    const result = [...albumSections.value, ...albumDefaultSections.value]
        .find((section) => section.source === source)?.items.find((item) => item.externalId === id);
    if (!result) return;
    const reference: CatalogExternalReference = { source: result.source, kind: result.kind,
        externalId: result.externalId, externalUrl: result.externalUrl, musicBrainzId: result.musicBrainzId };
    albumDraft.value = {
        name: result.title, year: result.year ?? null, image: '',
        musicbrainz_data: result.source === 'musicbrainz' ? result.rawMusicBrainz as MusicBrainzReleaseGroup : null,
        external_references: [reference], image_reference: { source: 'manual' },
    };
    if (result.kind === 'release' && result.source === 'discogs') {
        collectionForm.value.musicbrainz_release_data = {
            source: 'discogs', kind: 'release', id: result.externalId, externalUrl: result.externalUrl,
        };
    }
    if (result.cover) coverCandidates.value = [result.cover];
    void loadCover();
}

async function loadCover() {
    const requestId = ++coverRequest;
    coverStatus.value = 'loading';
    try {
        if (!albumDraft.value) return;
        const sections = await api.collection.searchCatalogCovers({ artistName: selectedArtistName.value,
            albumTitle: albumDraft.value.name, references: albumDraft.value.external_references });
        if (requestId !== coverRequest || !albumDraft.value) return;
        const candidates = sections.flatMap((section) => section.status === 'ok' ? section.items : []);
        coverCandidates.value = [...new Map([...coverCandidates.value, ...candidates]
            .map((candidate) => [`${candidate.source}:${candidate.entityType}:${candidate.entityId}`, candidate])).values()];
        if (coverCandidates.value.length) {
            coverStatus.value = 'found';
        } else {
            coverStatus.value = albumDraft.value.image ? 'found' : 'missing';
        }
    } catch {
        if (requestId === coverRequest) coverStatus.value = 'error';
    }
}

function retryCover() {
    if (albumDraft.value) void loadCover();
}

function selectCover(candidate: CatalogCoverCandidate) {
    if (!albumDraft.value) return;
    albumDraft.value.image = candidate.previewUrl;
    albumDraft.value.image_reference = candidate.source === 'discogs'
        ? { source: 'discogs', kind: candidate.entityType as 'master' | 'release', externalId: candidate.entityId,
            externalUrl: candidate.externalUrl }
        : candidate.source === 'fanart'
            ? { source: 'fanart', kind: 'release-group', externalId: candidate.entityId,
                externalUrl: candidate.externalUrl }
            : { source: 'cover-art-archive' };
    coverStatus.value = 'found';
}

function markManualCover(value: string) {
    if (!albumDraft.value) return;
    if (coverCandidates.value.some((candidate) => candidate.previewUrl === value)) return;
    albumDraft.value.image_reference = { source: value?.includes('coverartarchive.org') ? 'cover-art-archive' : 'manual' };
}

function markEditCoverManual() {
    collectionEditForm.value.albumImageSource = 'manual';
    collectionEditForm.value.albumImageReference = { source: 'manual' };
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
    albumSections.value = [];
    albumDefaultSections.value = [];
    albumSearching.value = false;
    albumSearchError.value = '';
    coverStatus.value = 'idle';
    coverCandidates.value = [];
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
    artistSections.value = [];
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
                external_references: artistDraft.value!.external_references,
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
                external_references: albumDraft.value!.external_references,
                image_source: albumDraft.value!.image_reference.source,
                image_reference: albumDraft.value!.image_reference,
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
        if (artist.type === 'new') result.artist.external_references ??= artist.data.external_references;
        if (album.type === 'new') {
            result.album.external_references ??= album.data.external_references;
            result.album.image_source ??= album.data.image_source;
            result.album.image_reference ??= album.data.image_reference;
        }
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
    collectionEditCatalogReference.value = item.album_external_references?.find((reference) => reference.source === 'discogs')
        ?? item.album_external_references?.find((reference) => reference.source === 'musicbrainz') ?? null;
    collectionEditForm.value = {
        artistName: item.artist_name,
        artistImage: item.artist_image ?? '',
        albumName: item.album_name,
        albumYear: item.album_year,
        albumImage: item.album_image_url ?? '',
        albumImageSource: item.album_image_source ?? 'manual',
        albumImageReference: item.album_image_reference ?? null,
    };
    collectionEditSaveError.value = '';
    showCollectionEdit.value = true;
}

function resetCollectionEdit() {
    editingCollectionId.value = null;
    collectionEditMetadata.value = [];
    collectionEditRelease.value = null;
    collectionEditReleaseGroup.value = null;
    collectionEditCatalogReference.value = null;
    collectionEditForm.value = {
        artistName: '', artistImage: '', albumName: '', albumYear: null, albumImage: '',
        albumImageSource: 'manual', albumImageReference: null,
    };
    collectionEditSaveError.value = '';
}

function cancelCollectionEdit() {
    showCollectionEdit.value = false;
    resetCollectionEdit();
}

async function saveCollectionEdit() {
    const id = editingCollectionId.value;
    if (id === null || !collectionEditFormValid.value) return;
    saving.value = true;
    collectionEditSaveError.value = '';
    try {
        await collectionStore.updateCollection(id, {
            artist: {
                name: collectionEditForm.value.artistName.trim(),
                image: collectionEditForm.value.artistImage.trim() || null,
            },
            album: {
                name: collectionEditForm.value.albumName.trim(),
                year: collectionEditForm.value.albumYear === '' ? null : collectionEditForm.value.albumYear,
                image: collectionEditForm.value.albumImage.trim() || null,
                image_source: collectionEditForm.value.albumImageSource,
                image_reference: collectionEditForm.value.albumImageReference,
            },
            metadata: collectionEditMetadata.value,
            musicbrainz_release_data: collectionEditRelease.value,
        });
        await refreshDashboard();
        cancelCollectionEdit();
    } catch (error) {
        collectionEditSaveError.value = error instanceof Error
            ? error.message
            : t('dashboard.edit.saveError');
    } finally {
        saving.value = false;
    }
}

function requestCollectionDeletion(item: CollectionItem) {
    pendingCollectionDeletion.value = item;
    collectionDeleteError.value = '';
}

function cancelCollectionDeletion() {
    if (deletingCollectionId.value !== null) return;
    pendingCollectionDeletion.value = null;
    collectionDeleteError.value = '';
}

async function confirmCollectionDeletion() {
    const item = pendingCollectionDeletion.value;
    if (!item || deletingCollectionId.value !== null) return;
    deletingCollectionId.value = item.id;
    collectionDeleteError.value = '';
    try {
        await collectionStore.deleteCollection(item.id);
        collection.value = collection.value.filter((collectionItem) => collectionItem.id !== item.id);
        pendingCollectionDeletion.value = null;
    } catch (error) {
        collectionDeleteError.value = error instanceof Error
            ? error.message
            : t('dashboard.delete.failure');
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
.cover-candidate {
    overflow: hidden;
    width: 76px;
    padding: 2px;
    border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
    border-radius: 6px;
    background: rgb(var(--v-theme-surface));
    color: rgb(var(--v-theme-on-surface));
    cursor: pointer;
}
.cover-candidate:hover,
.cover-candidate:focus-visible { border-color: rgb(var(--v-theme-primary)); }
.cover-candidate--selected {
    border-color: rgb(var(--v-theme-primary));
    box-shadow: 0 0 0 2px rgba(var(--v-theme-primary), .2);
}
.cover-candidate small { display: block; padding: 2px; }
.cover-candidate a,
.catalog-source-link {
    color: rgb(var(--v-theme-primary));
    font-size: .75rem;
}
</style>
