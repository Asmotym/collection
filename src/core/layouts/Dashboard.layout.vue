<template>
    <HeaderComponent />
    <v-container class="py-6">
        <v-row>
            <v-col cols="12">
                <h1 class="text-h4 mb-4">{{ t('dashboard.title') }}</h1>
                <v-tabs v-model="tab" color="primary">
                    <v-tab value="artists" prepend-icon="mdi-account-music">{{ t('dashboard.tabs.artists') }}</v-tab>
                    <v-tab value="albums" prepend-icon="mdi-album">{{ t('dashboard.tabs.albums') }}</v-tab>
                    <v-tab value="collection" prepend-icon="mdi-view-grid">{{ t('dashboard.tabs.collection') }}</v-tab>
                </v-tabs>

                <AppSkeleton
                    v-if="dashboardLoading"
                    class="mt-4"
                    variant="table"
                    :count="6"
                    :label="t('common.loading')"
                />
                <v-window v-else v-model="tab" class="mt-4">
                    <v-window-item value="artists">
                        <v-btn class="mb-4" color="primary" prepend-icon="mdi-plus" @click="showArtistForm = true">
                            {{ t('dashboard.actions.addArtist') }}
                        </v-btn>
                        <v-table>
                            <thead>
                                <tr>
                                    <th>{{ t('dashboard.columns.image') }}</th>
                                    <th>{{ t('dashboard.columns.name') }}</th>
                                    <th>{{ t('dashboard.columns.albums') }}</th>
                                    <th class="text-right">{{ t('dashboard.columns.actions') }}</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="artist in artists" :key="artist.id">
                                    <td><ImagePreview :src="artist.image" :alt="artist.name" /></td>
                                    <td>{{ artist.name }}</td>
                                    <td>{{ getArtistAlbumCount(artist.id) }}</td>
                                    <td class="text-right">
                                        <v-btn
                                            icon="mdi-pencil"
                                            variant="text"
                                            size="small"
                                            :aria-label="t('dashboard.actions.editArtist')"
                                            @click="openArtistEdit(artist)"
                                        />
                                        <v-btn
                                            icon="mdi-delete"
                                            variant="text"
                                            color="error"
                                            size="small"
                                            :aria-label="t('dashboard.actions.deleteArtist')"
                                            @click="openArtistDelete(artist)"
                                        />
                                    </td>
                                </tr>
                            </tbody>
                        </v-table>
                    </v-window-item>

                    <v-window-item value="albums">
                        <v-btn class="mb-4" color="primary" prepend-icon="mdi-plus" @click="showAlbumForm = true">
                            {{ t('dashboard.actions.addAlbum') }}
                        </v-btn>
                        <v-table>
                            <thead>
                                <tr>
                                    <th>{{ t('dashboard.columns.image') }}</th>
                                    <th>{{ t('dashboard.columns.artist') }}</th>
                                    <th>{{ t('dashboard.columns.name') }}</th>
                                    <th>{{ t('dashboard.columns.year') }}</th>
                                    <th class="text-right">{{ t('dashboard.columns.actions') }}</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="album in albums" :key="album.id">
                                    <td><ImagePreview :src="album.image" :alt="album.name" /></td>
                                    <td>{{ album.artist_name ?? '-' }}</td>
                                    <td>{{ album.name }}</td>
                                    <td>{{ album.year ?? '-' }}</td>
                                    <td class="text-right">
                                        <v-btn
                                            icon="mdi-pencil"
                                            variant="text"
                                            size="small"
                                            :aria-label="t('dashboard.actions.editAlbum')"
                                            @click="openAlbumEdit(album)"
                                        />
                                        <v-btn
                                            icon="mdi-delete"
                                            variant="text"
                                            color="error"
                                            size="small"
                                            :aria-label="t('dashboard.actions.deleteAlbum')"
                                            @click="openAlbumDelete(album)"
                                        />
                                    </td>
                                </tr>
                            </tbody>
                        </v-table>
                    </v-window-item>

                    <v-window-item value="collection">
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
                    </v-window-item>
                </v-window>
            </v-col>
        </v-row>
    </v-container>

    <v-dialog v-model="showArtistForm" max-width="650" @after-leave="resetArtistForm">
        <v-card :title="t('dashboard.modals.addArtist')">
            <v-card-text>
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
                <template v-if="artistForm.selectionMade">
                    <v-text-field
                        v-model="artistForm.name"
                        :label="t('dashboard.fields.artistName')"
                        :rules="[requiredRule]"
                    />
                    <v-text-field
                        v-model="artistForm.image"
                        :label="t('dashboard.fields.image')"
                        :rules="[imageUrlRule]"
                    />
                </template>
                <v-alert v-if="artistSearchError" type="warning" variant="tonal" density="compact" class="mb-3">
                    {{ artistSearchError }}
                </v-alert>
                <v-alert v-if="artistSaveError" type="error" variant="tonal" density="compact">
                    {{ artistSaveError }}
                </v-alert>
            </v-card-text>
            <v-card-actions class="justify-end">
                <v-btn variant="text" @click="cancelArtist">{{ t('dashboard.actions.cancel') }}</v-btn>
                <v-btn color="primary" :disabled="!artistFormValid" :loading="saving" @click="saveArtist">
                    {{ t('dashboard.actions.add') }}
                </v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>

    <v-dialog v-model="showArtistEdit" max-width="650" @after-leave="resetArtistEdit">
        <v-card :title="t('dashboard.modals.editArtist')">
            <v-card-text>
                <v-text-field
                    v-model="artistEditForm.name"
                    :label="t('dashboard.fields.artistName')"
                    :rules="[requiredRule]"
                />
                <v-text-field
                    v-model="artistEditForm.image"
                    :label="t('dashboard.fields.image')"
                    :rules="[imageUrlRule]"
                />
            </v-card-text>
            <v-card-actions class="justify-end">
                <v-btn variant="text" @click="cancelArtistEdit">{{ t('dashboard.actions.cancel') }}</v-btn>
                <v-btn color="primary" :disabled="!artistEditFormValid" :loading="saving" @click="saveArtistEdit">
                    {{ t('dashboard.actions.save') }}
                </v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>

    <v-dialog v-model="showAlbumForm" max-width="750" @after-leave="resetAlbumForm">
        <v-card :title="t('dashboard.modals.addAlbum')">
            <v-card-text>
                <v-select
                    v-model="albumForm.artist_id"
                    :items="artists"
                    item-title="name"
                    item-value="id"
                    :label="t('dashboard.fields.artist')"
                    :rules="[requiredRule]"
                    @update:model-value="resetAlbumSelection"
                />
                <template v-if="albumForm.artist_id !== null">
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
                        :hint="selectedAlbumArtist?.musicbrainz_data
                            ? t('dashboard.musicbrainz.searchHint')
                            : t('dashboard.musicbrainz.customArtistHint')"
                        persistent-hint
                        @update:search="scheduleAlbumSearch"
                        @update:model-value="selectAlbumSuggestion"
                    >
                        <template #item="{ props, item }">
                            <v-list-item v-bind="getMusicBrainzAutocompleteItemProps(props)">
                                <div class="album-select-item">
                                    <v-icon
                                        v-if="item.kind === 'custom'"
                                        class="album-select-thumb album-select-fallback"
                                    >
                                        mdi-plus
                                    </v-icon>
                                    <template v-else-if="item.data">
                                        <v-img
                                            v-if="!albumCoverErrors.has(item.data.id)"
                                            :src="getReleaseGroupThumbnailUrl(item.data.id)"
                                            :alt="item.data.title"
                                            cover
                                            class="album-select-thumb"
                                            @error="markAlbumCoverMissing(item.data.id)"
                                        />
                                        <v-icon v-else class="album-select-thumb album-select-fallback">
                                            mdi-disc
                                        </v-icon>
                                    </template>
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
                    <v-alert v-if="albumSearchError" type="warning" variant="tonal" density="compact" class="mb-3">
                        {{ albumSearchError }}
                    </v-alert>
                </template>
                <template v-if="albumForm.selectionMade">
                    <v-text-field
                        v-model="albumForm.name"
                        :label="t('dashboard.fields.albumName')"
                        :rules="[requiredRule]"
                    />
                    <v-text-field
                        v-model.number="albumForm.year"
                        :label="t('dashboard.fields.year')"
                        type="number"
                        min="0"
                    />
                    <v-text-field
                        v-model="albumForm.image"
                        :label="t('dashboard.fields.image')"
                        :rules="[imageUrlRule]"
                        :loading="coverStatus === 'loading'"
                    />
                    <v-alert v-if="coverStatus === 'missing'" type="info" variant="tonal" density="compact" class="mb-3">
                        {{ t('dashboard.musicbrainz.coverMissing') }}
                    </v-alert>
                    <v-alert v-else-if="coverStatus === 'error'" type="warning" variant="tonal" density="compact" class="mb-3">
                        <div class="d-flex align-center justify-space-between ga-2">
                            <span>{{ t('dashboard.musicbrainz.coverError') }}</span>
                            <v-btn size="small" variant="text" @click="retryCover">
                                {{ t('dashboard.actions.retry') }}
                            </v-btn>
                        </div>
                    </v-alert>
                </template>
                <v-alert v-if="albumSaveError" type="error" variant="tonal" density="compact">
                    {{ albumSaveError }}
                </v-alert>
            </v-card-text>
            <v-card-actions class="justify-end">
                <v-btn variant="text" @click="cancelAlbum">{{ t('dashboard.actions.cancel') }}</v-btn>
                <v-btn color="primary" :disabled="!albumFormValid" :loading="saving" @click="saveAlbum">
                    {{ t('dashboard.actions.add') }}
                </v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>

    <v-dialog v-model="showAlbumEdit" max-width="750" @after-leave="resetAlbumEdit">
        <v-card :title="t('dashboard.modals.editAlbum')">
            <v-card-text>
                <v-select
                    v-model="albumEditForm.artist_id"
                    :items="artists"
                    item-title="name"
                    item-value="id"
                    :label="t('dashboard.fields.artist')"
                    :rules="[requiredRule]"
                />
                <v-text-field
                    v-model="albumEditForm.name"
                    :label="t('dashboard.fields.albumName')"
                    :rules="[requiredRule]"
                />
                <v-text-field
                    v-model.number="albumEditForm.year"
                    :label="t('dashboard.fields.year')"
                    type="number"
                    min="0"
                />
                <v-text-field
                    v-model="albumEditForm.image"
                    :label="t('dashboard.fields.image')"
                    :rules="[imageUrlRule]"
                />
            </v-card-text>
            <v-card-actions class="justify-end">
                <v-btn variant="text" @click="cancelAlbumEdit">{{ t('dashboard.actions.cancel') }}</v-btn>
                <v-btn color="primary" :disabled="!albumEditFormValid" :loading="saving" @click="saveAlbumEdit">
                    {{ t('dashboard.actions.save') }}
                </v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>

    <v-dialog
        v-model="showCatalogDelete"
        max-width="650"
        :persistent="deletingCatalogItem"
        @after-leave="resetCatalogDelete"
    >
        <v-card v-if="deleteTarget" :title="deleteDialogTitle">
            <v-card-text>
                <p v-if="!deleteHasDependencies">
                    {{ t('dashboard.delete.simplePrompt', { name: deleteTarget.item.name }) }}
                </p>
                <template v-else>
                    <v-alert type="warning" variant="tonal" class="mb-4">
                        {{ deleteTarget.kind === 'artist'
                            ? t('dashboard.delete.artistWarning')
                            : t('dashboard.delete.albumWarning') }}
                    </v-alert>

                    <div v-if="deleteAffectedAlbums.length" class="mb-4">
                        <div class="text-subtitle-1 font-weight-medium mb-1">
                            {{ t('dashboard.delete.affectedAlbums', { count: deleteAffectedAlbums.length }) }}
                        </div>
                        <v-list density="compact" class="delete-impact-list">
                            <v-list-item v-for="album in deleteAffectedAlbums" :key="album.id">
                                <v-list-item-title>{{ album.name }}</v-list-item-title>
                                <v-list-item-subtitle>
                                    {{ album.year ?? t('dashboard.delete.unknownYear') }}
                                </v-list-item-subtitle>
                            </v-list-item>
                        </v-list>
                    </div>

                    <div v-if="deleteAffectedCollection.length">
                        <div class="text-subtitle-1 font-weight-medium mb-1">
                            {{ t('dashboard.delete.affectedCollection', { count: deleteAffectedCollection.length }) }}
                        </div>
                        <v-list density="compact" class="delete-impact-list">
                            <v-list-item v-for="item in deleteAffectedCollection" :key="item.id">
                                <v-list-item-title>{{ item.album_name }}</v-list-item-title>
                                <v-list-item-subtitle>
                                    {{ item.artist_name }} · {{ item.created_by_username ?? t('dashboard.delete.unknownUser') }}
                                </v-list-item-subtitle>
                            </v-list-item>
                        </v-list>
                    </div>
                </template>
                <v-alert v-if="catalogDeleteError" type="error" variant="tonal" class="mt-4">
                    {{ catalogDeleteError }}
                </v-alert>
            </v-card-text>
            <v-card-actions class="justify-end">
                <v-btn variant="text" :disabled="deletingCatalogItem" @click="cancelCatalogDelete">
                    {{ t('dashboard.actions.cancel') }}
                </v-btn>
                <v-btn color="error" :loading="deletingCatalogItem" @click="confirmCatalogDelete">
                    {{ t('dashboard.actions.delete') }}
                </v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>

    <v-dialog v-model="showCollectionForm" max-width="850" @after-leave="resetCollectionForm">
        <v-card :title="t('dashboard.modals.addCollection')">
            <v-card-text>
                <v-select
                    v-model="collectionForm.artist_id"
                    :items="artists"
                    item-title="name"
                    item-value="id"
                    :label="t('dashboard.fields.artist')"
                    :rules="[requiredRule]"
                    @update:model-value="resetCollectionAlbum"
                />
                <v-select
                    v-if="collectionForm.artist_id !== null"
                    v-model="collectionForm.album_id"
                    :items="collectionAlbums"
                    item-title="name"
                    item-value="id"
                    :label="t('dashboard.fields.album')"
                    :rules="[requiredRule]"
                    @update:model-value="resetCollectionEdition"
                >
                    <template #selection="{ item }">
                        <div class="album-select-selection">
                            <v-img v-if="item.image" :src="item.image" :alt="item.name" cover class="album-select-thumb" />
                            <v-icon v-else class="album-select-thumb album-select-fallback">mdi-album</v-icon>
                            <span>{{ item.name }}</span>
                        </div>
                    </template>
                    <template #item="{ props, item }">
                        <v-list-item v-bind="getAlbumSelectItemProps(props)">
                            <div class="album-select-item">
                                <v-img v-if="item.image" :src="item.image" :alt="item.name" cover class="album-select-thumb" />
                                <v-icon v-else class="album-select-thumb album-select-fallback">mdi-album</v-icon>
                                <div class="album-select-copy">
                                    <v-list-item-title>{{ item.name }}</v-list-item-title>
                                    <v-list-item-subtitle>{{ item.year ?? '-' }}</v-list-item-subtitle>
                                </div>
                            </div>
                        </v-list-item>
                    </template>
                </v-select>
                <MusicBrainzEditionSelector
                    v-if="collectionForm.album_id !== null"
                    v-model="collectionForm.musicbrainz_release_data"
                    :release-group="selectedCollectionAlbum?.musicbrainz_data ?? null"
                />
                <CollectionMetadataEditor
                    v-if="collectionForm.artist_id !== null && collectionForm.album_id !== null"
                    v-model="collectionForm.metadata"
                />
            </v-card-text>
            <v-card-actions class="justify-end">
                <v-btn variant="text" @click="cancelCollection">{{ t('dashboard.actions.cancel') }}</v-btn>
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
                <v-btn color="primary" :disabled="!isMetadataValid(collectionEditMetadata)" :loading="saving" @click="saveCollectionEdit">
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
const tab = ref('artists');
const collectionStore = store.collection();
const discordService = DiscordService.getInstance();
const collection = ref<CollectionItem[]>([]);
const artists = ref<DatabaseArtist[]>([]);
const albums = ref<DatabaseAlbum[]>([]);
const dashboardLoading = ref(true);
const saving = ref(false);
const deletingCollectionId = ref<number | null>(null);
const deletingCatalogItem = ref(false);
const showArtistForm = ref(false);
const showAlbumForm = ref(false);
const showArtistEdit = ref(false);
const showAlbumEdit = ref(false);
const showCollectionForm = ref(false);
const showCollectionEdit = ref(false);
const showCatalogDelete = ref(false);
const editingCollectionId = ref<number | null>(null);
const editingArtistId = ref<number | null>(null);
const editingAlbumId = ref<number | null>(null);
type CatalogDeleteTarget =
    | { kind: 'artist'; item: DatabaseArtist }
    | { kind: 'album'; item: DatabaseAlbum };
const deleteTarget = ref<CatalogDeleteTarget | null>(null);
const catalogDeleteError = ref('');
interface AutocompleteItem<T> {
    key: string;
    title: string;
    props: { subtitle?: string; prependIcon?: string };
    kind: 'remote' | 'custom';
    data: T | null;
}

interface ArtistCreateForm {
    name: string;
    image: string;
    musicbrainz_data: MusicBrainzArtist | null;
    selectionMade: boolean;
}

interface AlbumCreateForm {
    artist_id: number | null;
    name: string;
    year: number | null | '';
    image: string;
    musicbrainz_data: MusicBrainzReleaseGroup | null;
    selectionMade: boolean;
}

const artistForm = ref<ArtistCreateForm>({
    name: '', image: '', musicbrainz_data: null, selectionMade: false,
});
const artistEditForm = ref({ name: '', image: '' });
const albumForm = ref<AlbumCreateForm>({
    artist_id: null,
    name: '',
    year: null,
    image: '',
    musicbrainz_data: null,
    selectionMade: false,
});
const albumEditForm = ref<{ artist_id: number | null; name: string; year: number | null | ''; image: string }>({
    artist_id: null,
    name: '',
    year: null,
    image: '',
});
const collectionForm = ref<{
    artist_id: number | null;
    album_id: number | null;
    metadata: CollectionMetadata[];
    musicbrainz_release_data: CollectionReleaseSelection | null;
}>({
    artist_id: null,
    album_id: null,
    metadata: [],
    musicbrainz_release_data: null,
});
const collectionEditMetadata = ref<CollectionMetadata[]>([]);
const collectionEditRelease = ref<CollectionReleaseSelection | null>(null);
const collectionEditReleaseGroup = ref<MusicBrainzReleaseGroup | null>(null);
const artistSearch = ref('');
const artistSelectionKey = ref<string | null>(null);
const artistSuggestions = ref<MusicBrainzArtist[]>([]);
const artistSearching = ref(false);
const artistSearchError = ref('');
const artistSaveError = ref('');
const albumSearch = ref('');
const albumSelectionKey = ref<string | null>(null);
const albumSuggestions = ref<MusicBrainzReleaseGroup[]>([]);
const albumDefaultSuggestions = ref<MusicBrainzReleaseGroup[]>([]);
const albumSearching = ref(false);
const albumSearchError = ref('');
const albumSaveError = ref('');
const albumCoverErrors = ref(new Set<string>());
const coverStatus = ref<'idle' | 'loading' | 'found' | 'missing' | 'error'>('idle');
let artistSearchTimer: ReturnType<typeof setTimeout> | undefined;
let albumSearchTimer: ReturnType<typeof setTimeout> | undefined;
let artistSearchRequest = 0;
let albumSearchRequest = 0;
let coverRequest = 0;

const artistAlbumCounts = computed<Map<number, number>>(() => {
    const counts = new Map<number, number>();
    for (const album of albums.value) {
        if (album.artist_id !== null) counts.set(album.artist_id, (counts.get(album.artist_id) ?? 0) + 1);
    }
    return counts;
});

const deleteAffectedAlbums = computed<DatabaseAlbum[]>(() => {
    const target = deleteTarget.value;
    if (!target || target.kind !== 'artist') return [];
    return albums.value.filter((album) => album.artist_id === target.item.id);
});

const deleteAffectedCollection = computed<CollectionItem[]>(() => {
    const target = deleteTarget.value;
    if (!target) return [];
    if (target.kind === 'album') {
        return collection.value.filter((item) => item.album_id === target.item.id);
    }
    const albumIds = new Set(deleteAffectedAlbums.value.map((album) => album.id));
    return collection.value.filter((item) => item.artist_id === target.item.id || albumIds.has(item.album_id));
});

const deleteHasDependencies = computed(() => deleteAffectedAlbums.value.length > 0
    || deleteAffectedCollection.value.length > 0);

const deleteDialogTitle = computed(() => {
    const target = deleteTarget.value;
    if (!target) return '';
    return target.kind === 'artist'
        ? t('dashboard.delete.artistTitle', { name: target.item.name })
        : t('dashboard.delete.albumTitle', { name: target.item.name });
});

const collectionAlbums = computed<DatabaseAlbum[]>(() => {
    const artistId = collectionForm.value.artist_id;
    if (artistId === null) return [];

    const userId = discordService.user.value?.id;
    const addedAlbumIds = new Set(collection.value
        .filter((item) => item.created_by_user_id === userId)
        .map((item) => item.album_id));
    return albums.value.filter((album) => album.artist_id === artistId && !addedAlbumIds.has(album.id));
});

const selectedCollectionAlbum = computed<DatabaseAlbum | null>(() => {
    if (collectionForm.value.album_id === null) return null;
    return albums.value.find((album) => album.id === collectionForm.value.album_id) ?? null;
});

const selectedAlbumArtist = computed<DatabaseArtist | null>(() => {
    if (albumForm.value.artist_id === null) return null;
    return artists.value.find((artist) => artist.id === albumForm.value.artist_id) ?? null;
});

const artistAutocompleteItems = computed<AutocompleteItem<MusicBrainzArtist>[]>(() => {
    const selectedCustomQuery = artistSelectionKey.value?.startsWith('custom:')
        ? artistSelectionKey.value.slice('custom:'.length)
        : null;
    const query = (selectedCustomQuery ?? artistSearch.value).trim();
    const custom: AutocompleteItem<MusicBrainzArtist>[] = query
        ? [{
            key: `custom:${query}`,
            title: t('dashboard.musicbrainz.create', { query }),
            props: { prependIcon: 'mdi-plus' },
            kind: 'custom',
            data: null,
        }]
        : [];
    return [
        ...custom,
        ...artistSuggestions.value.map((artist) => ({
            key: artist.id,
            title: artist.name,
            props: { subtitle: formatArtistSubtitle(artist), prependIcon: 'mdi-database-music' },
            kind: 'remote' as const,
            data: artist,
        })),
    ];
});

const albumAutocompleteItems = computed<AutocompleteItem<MusicBrainzReleaseGroup>[]>(() => {
    const selectedCustomQuery = albumSelectionKey.value?.startsWith('custom:')
        ? albumSelectionKey.value.slice('custom:'.length)
        : null;
    const query = (selectedCustomQuery ?? albumSearch.value).trim();
    const custom: AutocompleteItem<MusicBrainzReleaseGroup>[] = query
        ? [{
            key: `custom:${query}`,
            title: t('dashboard.musicbrainz.create', { query }),
            props: { prependIcon: 'mdi-plus' },
            kind: 'custom',
            data: null,
        }]
        : [];
    return [
        ...custom,
        ...albumSuggestions.value.map((releaseGroup) => ({
            key: releaseGroup.id,
            title: releaseGroup.title,
            props: {
                subtitle: [releaseGroup['first-release-date'], releaseGroup.disambiguation]
                    .filter(Boolean).join(' · '),
                prependIcon: 'mdi-album',
            },
            kind: 'remote' as const,
            data: releaseGroup,
        })),
    ];
});

const artistFormValid = computed(() => artistForm.value.selectionMade
    && artistForm.value.name.trim() !== ''
    && isOptionalHttpUrl(artistForm.value.image));
const artistEditFormValid = computed(() => artistEditForm.value.name.trim() !== ''
    && isOptionalHttpUrl(artistEditForm.value.image));
function isAlbumFormValid(form: { artist_id: number | null; name: string; year: number | null | ''; image: string }) {
    const selectionMade = 'selectionMade' in form ? Boolean(form.selectionMade) : true;
    return selectionMade
        && form.artist_id !== null
        && form.name.trim() !== ''
        && (form.year === null || form.year === '' || (Number.isInteger(form.year) && form.year >= 0))
        && isOptionalHttpUrl(form.image);
}
const albumFormValid = computed(() => isAlbumFormValid(albumForm.value));
const albumEditFormValid = computed(() => isAlbumFormValid(albumEditForm.value));
const collectionFormValid = computed(() => collectionForm.value.artist_id !== null
    && collectionForm.value.album_id !== null
    && isMetadataValid(collectionForm.value.metadata));

function requiredRule(value: unknown): true | string {
    return value !== null && value !== undefined && String(value).trim() ? true : t('validation.required');
}

function imageUrlRule(value: unknown): true | string {
    return typeof value !== 'string' || isOptionalHttpUrl(value) ? true : t('validation.httpUrl');
}

function getArtistAlbumCount(artistId: number): number {
    return artistAlbumCounts.value.get(artistId) ?? 0;
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
    artistSaveError.value = '';
    if (!key) {
        artistForm.value = { name: '', image: '', musicbrainz_data: null, selectionMade: false };
        return;
    }
    if (key.startsWith('custom:')) {
        artistForm.value = {
            name: key.slice('custom:'.length), image: '', musicbrainz_data: null, selectionMade: true,
        };
        return;
    }
    const artist = artistSuggestions.value.find((item) => item.id === key);
    if (artist) {
        artistForm.value = { name: artist.name, image: '', musicbrainz_data: artist, selectionMade: true };
    }
}

function scheduleAlbumSearch(value: string | null) {
    albumSearchRequest += 1;
    const requestId = albumSearchRequest;
    if (albumSearchTimer) clearTimeout(albumSearchTimer);
    albumSearchError.value = '';
    const query = value?.trim() ?? '';
    const artistMbid = selectedAlbumArtist.value?.musicbrainz_data?.id;
    if (!artistMbid) {
        albumSuggestions.value = [];
        albumSearching.value = false;
        return;
    }
    if (query.length < 2) {
        const normalizedQuery = query.toLocaleLowerCase();
        albumSuggestions.value = normalizedQuery
            ? albumDefaultSuggestions.value.filter((item) => item.title.toLocaleLowerCase().includes(normalizedQuery))
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
    const artistMbid = selectedAlbumArtist.value?.musicbrainz_data?.id;
    if (!artistMbid) return;
    const requestId = ++albumSearchRequest;
    albumSearching.value = true;
    albumSearchError.value = '';
    try {
        const results = await api.collection.searchMusicBrainzReleaseGroups(artistMbid, '');
        if (requestId !== albumSearchRequest) return;
        albumDefaultSuggestions.value = results;
        const query = albumSearch.value.trim().toLocaleLowerCase();
        albumSuggestions.value = query.length < 2
            ? results.filter((item) => !query || item.title.toLocaleLowerCase().includes(query))
            : albumSuggestions.value;
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
    albumSaveError.value = '';
    coverRequest += 1;
    if (!key) {
        const artistId = albumForm.value.artist_id;
        albumForm.value = {
            artist_id: artistId,
            name: '',
            year: null,
            image: '',
            musicbrainz_data: null,
            selectionMade: false,
        };
        coverStatus.value = 'idle';
        return;
    }
    if (key.startsWith('custom:')) {
        albumForm.value = {
            artist_id: albumForm.value.artist_id,
            name: key.slice('custom:'.length),
            year: null,
            image: '',
            musicbrainz_data: null,
            selectionMade: true,
        };
        coverStatus.value = 'idle';
        return;
    }
    const releaseGroup = albumSuggestions.value.find((item) => item.id === key);
    if (!releaseGroup) return;
    const yearText = releaseGroup['first-release-date']?.match(/^\d{4}/)?.[0];
    albumForm.value = {
        artist_id: albumForm.value.artist_id,
        name: releaseGroup.title,
        year: yearText ? Number(yearText) : null,
        image: '',
        musicbrainz_data: releaseGroup,
        selectionMade: true,
    };
    void loadCover(releaseGroup.id);
}

async function loadCover(releaseGroupMbid: string) {
    const requestId = ++coverRequest;
    const initialImage = albumForm.value.image;
    coverStatus.value = 'loading';
    try {
        const result = await api.collection.getReleaseGroupCover(releaseGroupMbid);
        if (requestId !== coverRequest) return;
        if (result.imageUrl) {
            if (albumForm.value.image === initialImage) albumForm.value.image = result.imageUrl;
            coverStatus.value = 'found';
        } else {
            coverStatus.value = albumForm.value.image ? 'found' : 'missing';
        }
    } catch {
        if (requestId === coverRequest) coverStatus.value = 'error';
    }
}

function retryCover() {
    const releaseGroupMbid = albumForm.value.musicbrainz_data?.id;
    if (releaseGroupMbid) void loadCover(releaseGroupMbid);
}

function getReleaseGroupThumbnailUrl(releaseGroupMbid: string): string {
    return `https://coverartarchive.org/release-group/${releaseGroupMbid}/front-250`;
}

function markAlbumCoverMissing(releaseGroupMbid: string) {
    albumCoverErrors.value.add(releaseGroupMbid);
}

function getMusicBrainzAutocompleteItemProps(props: Record<string, unknown>) {
    const {
        title: _title,
        subtitle: _subtitle,
        prependIcon: _prependIcon,
        ...itemProps
    } = props;
    return itemProps;
}

async function refreshDashboard() {
    const [collectionItems, artistRows, albumRows] = await Promise.all([
        collectionStore.getAll(), collectionStore.getArtists(), collectionStore.getAlbums(),
    ]);
    collection.value = collectionItems;
    artists.value = artistRows;
    albums.value = albumRows;
}

function resetArtistForm() {
    artistSearchRequest += 1;
    if (artistSearchTimer) clearTimeout(artistSearchTimer);
    artistForm.value = { name: '', image: '', musicbrainz_data: null, selectionMade: false };
    artistSearch.value = '';
    artistSelectionKey.value = null;
    artistSuggestions.value = [];
    artistSearching.value = false;
    artistSearchError.value = '';
    artistSaveError.value = '';
}
function cancelArtist() { showArtistForm.value = false; resetArtistForm(); }
function openArtistEdit(artist: DatabaseArtist) {
    editingArtistId.value = artist.id;
    artistEditForm.value = { name: artist.name, image: artist.image ?? '' };
    showArtistEdit.value = true;
}
function resetArtistEdit() { editingArtistId.value = null; artistEditForm.value = { name: '', image: '' }; }
function cancelArtistEdit() { showArtistEdit.value = false; resetArtistEdit(); }
function resetAlbumForm() {
    albumForm.value = {
        artist_id: null,
        name: '',
        year: null,
        image: '',
        musicbrainz_data: null,
        selectionMade: false,
    };
    resetAlbumAutocomplete();
}
function resetAlbumAutocomplete() {
    albumSearchRequest += 1;
    coverRequest += 1;
    if (albumSearchTimer) clearTimeout(albumSearchTimer);
    albumSearch.value = '';
    albumSelectionKey.value = null;
    albumSuggestions.value = [];
    albumDefaultSuggestions.value = [];
    albumSearching.value = false;
    albumSearchError.value = '';
    albumSaveError.value = '';
    coverStatus.value = 'idle';
}
function resetAlbumSelection() {
    const artistId = albumForm.value.artist_id;
    albumForm.value = {
        artist_id: artistId,
        name: '',
        year: null,
        image: '',
        musicbrainz_data: null,
        selectionMade: false,
    };
    resetAlbumAutocomplete();
    void loadSelectedArtistAlbums();
}
function cancelAlbum() { showAlbumForm.value = false; resetAlbumForm(); }
function openAlbumEdit(album: DatabaseAlbum) {
    editingAlbumId.value = album.id;
    albumEditForm.value = {
        artist_id: album.artist_id,
        name: album.name,
        year: album.year,
        image: album.image ?? '',
    };
    showAlbumEdit.value = true;
}
function resetAlbumEdit() {
    editingAlbumId.value = null;
    albumEditForm.value = { artist_id: null, name: '', year: null, image: '' };
}
function cancelAlbumEdit() { showAlbumEdit.value = false; resetAlbumEdit(); }
function openArtistDelete(artist: DatabaseArtist) {
    deleteTarget.value = { kind: 'artist', item: artist };
    catalogDeleteError.value = '';
    showCatalogDelete.value = true;
}
function openAlbumDelete(album: DatabaseAlbum) {
    deleteTarget.value = { kind: 'album', item: album };
    catalogDeleteError.value = '';
    showCatalogDelete.value = true;
}
function resetCatalogDelete() {
    if (deletingCatalogItem.value) return;
    deleteTarget.value = null;
    catalogDeleteError.value = '';
}
function cancelCatalogDelete() {
    if (!deletingCatalogItem.value) showCatalogDelete.value = false;
}
async function confirmCatalogDelete() {
    const target = deleteTarget.value;
    if (!target || deletingCatalogItem.value) return;
    deletingCatalogItem.value = true;
    catalogDeleteError.value = '';
    try {
        if (target.kind === 'artist') {
            const albumIds = new Set(deleteAffectedAlbums.value.map((album) => album.id));
            await collectionStore.deleteArtist(target.item.id);
            artists.value = artists.value.filter((artist) => artist.id !== target.item.id);
            albums.value = albums.value.filter((album) => album.artist_id !== target.item.id);
            collection.value = collection.value.filter((item) => item.artist_id !== target.item.id
                && !albumIds.has(item.album_id));
        } else {
            await collectionStore.deleteAlbum(target.item.id);
            albums.value = albums.value.filter((album) => album.id !== target.item.id);
            collection.value = collection.value.filter((item) => item.album_id !== target.item.id);
        }
        showCatalogDelete.value = false;
    } catch {
        catalogDeleteError.value = t('dashboard.delete.error');
    } finally {
        deletingCatalogItem.value = false;
    }
}
function resetCollectionForm() {
    collectionForm.value = {
        artist_id: null,
        album_id: null,
        metadata: [],
        musicbrainz_release_data: null,
    };
}
function cancelCollection() { showCollectionForm.value = false; resetCollectionForm(); }
function resetCollectionAlbum() {
    collectionForm.value.album_id = null;
    collectionForm.value.metadata = [];
    collectionForm.value.musicbrainz_release_data = null;
}
function resetCollectionEdition() {
    collectionForm.value.musicbrainz_release_data = null;
}
function getAlbumSelectItemProps(props: Record<string, unknown>) {
    const { title: _title, ...itemProps } = props;
    return itemProps;
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
function cancelCollectionEdit() { showCollectionEdit.value = false; resetCollectionEdit(); }

async function saveArtist() {
    if (!artistFormValid.value) return;
    saving.value = true;
    try {
        await collectionStore.createArtist({
            name: artistForm.value.name.trim(),
            image: artistForm.value.image.trim() || null,
            musicbrainz_data: artistForm.value.musicbrainz_data,
        });
        cancelArtist();
    } catch (error) {
        artistSaveError.value = error instanceof Error && error.message.includes('already exists')
            ? t('dashboard.musicbrainz.duplicateArtist')
            : t('dashboard.musicbrainz.saveError');
    } finally { saving.value = false; }
}

async function saveAlbum() {
    if (!albumFormValid.value || albumForm.value.artist_id === null) return;
    saving.value = true;
    try {
        await collectionStore.createAlbum({
            artist_id: albumForm.value.artist_id,
            name: albumForm.value.name.trim(),
            year: albumForm.value.year === '' ? null : albumForm.value.year,
            image: albumForm.value.image.trim() || null,
            musicbrainz_data: albumForm.value.musicbrainz_data,
        });
        cancelAlbum();
    } catch (error) {
        albumSaveError.value = error instanceof Error && error.message.includes('already exists')
            ? t('dashboard.musicbrainz.duplicateAlbum')
            : t('dashboard.musicbrainz.saveError');
    } finally { saving.value = false; }
}

async function saveArtistEdit() {
    const id = editingArtistId.value;
    if (id === null || !artistEditFormValid.value) return;
    saving.value = true;
    try {
        await collectionStore.updateArtist(id, {
            name: artistEditForm.value.name.trim(),
            image: artistEditForm.value.image.trim() || null,
        });
        cancelArtistEdit();
    } finally { saving.value = false; }
}

async function saveAlbumEdit() {
    const id = editingAlbumId.value;
    const artistId = albumEditForm.value.artist_id;
    if (id === null || artistId === null || !albumEditFormValid.value) return;
    saving.value = true;
    try {
        await collectionStore.updateAlbum(id, {
            artist_id: artistId,
            name: albumEditForm.value.name.trim(),
            year: albumEditForm.value.year === '' ? null : albumEditForm.value.year,
            image: albumEditForm.value.image.trim() || null,
        });
        cancelAlbumEdit();
    } finally { saving.value = false; }
}

async function saveCollection() {
    const {
        artist_id: artistId,
        album_id: albumId,
        metadata,
        musicbrainz_release_data: musicBrainzReleaseData,
    } = collectionForm.value;
    const userId = discordService.user.value?.id;
    if (!collectionFormValid.value || artistId === null || albumId === null || !userId) return;
    saving.value = true;
    try {
        await collectionStore.createCollection({
            artist_id: artistId,
            album_id: albumId,
            created_by_user_id: userId,
            metadata,
            musicbrainz_release_data: musicBrainzReleaseData,
        });
        cancelCollection();
    } finally { saving.value = false; }
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
    } finally { saving.value = false; }
}

async function removeCollection(id: number) {
    deletingCollectionId.value = id;
    try {
        await collectionStore.deleteCollection(id);
        collection.value = collection.value.filter((item) => item.id !== id);
    } finally { deletingCollectionId.value = null; }
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
.album-select-selection,
.album-select-item {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
}
.album-select-item { gap: 12px; padding: 4px 0; }
.album-select-copy { min-width: 0; }
.album-select-thumb { width: 36px; height: 36px; flex: 0 0 36px; border-radius: 4px; }
.album-select-fallback {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.08);
}
.delete-impact-list {
    max-height: 180px;
    overflow-y: auto;
    border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
    border-radius: 4px;
}
</style>
