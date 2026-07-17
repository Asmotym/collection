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

                <v-window v-model="tab" class="mt-4">
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
                />
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
                />
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
import HeaderComponent from 'core/components/Header.component.vue';
import ImagePreview from 'core/components/ImagePreview.component.vue';
import { store } from 'core/store/index.store';
import type { CollectionItem } from 'core/store/stores/collection.store';
import { DiscordService } from 'modules/discord-auth/services/discord.service';
import type { CollectionMetadata, DatabaseAlbum, DatabaseArtist } from '../../../shared/types/database.types';
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const tab = ref('artists');
const collectionStore = store.collection();
const discordService = DiscordService.getInstance();
const collection = ref<CollectionItem[]>([]);
const artists = ref<DatabaseArtist[]>([]);
const albums = ref<DatabaseAlbum[]>([]);
const saving = ref(false);
const deletingCollectionId = ref<number | null>(null);
const showArtistForm = ref(false);
const showAlbumForm = ref(false);
const showArtistEdit = ref(false);
const showAlbumEdit = ref(false);
const showCollectionForm = ref(false);
const showCollectionEdit = ref(false);
const editingCollectionId = ref<number | null>(null);
const editingArtistId = ref<number | null>(null);
const editingAlbumId = ref<number | null>(null);
const artistForm = ref({ name: '', image: '' });
const artistEditForm = ref({ name: '', image: '' });
const albumForm = ref<{ artist_id: number | null; name: string; year: number | null | ''; image: string }>({
    artist_id: null,
    name: '',
    year: null,
    image: '',
});
const albumEditForm = ref<{ artist_id: number | null; name: string; year: number | null | ''; image: string }>({
    artist_id: null,
    name: '',
    year: null,
    image: '',
});
const collectionForm = ref<{ artist_id: number | null; album_id: number | null; metadata: CollectionMetadata[] }>({
    artist_id: null,
    album_id: null,
    metadata: [],
});
const collectionEditMetadata = ref<CollectionMetadata[]>([]);

const artistAlbumCounts = computed<Map<number, number>>(() => {
    const counts = new Map<number, number>();
    for (const album of albums.value) {
        if (album.artist_id !== null) counts.set(album.artist_id, (counts.get(album.artist_id) ?? 0) + 1);
    }
    return counts;
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

const artistFormValid = computed(() => artistForm.value.name.trim() !== '' && isOptionalHttpUrl(artistForm.value.image));
const artistEditFormValid = computed(() => artistEditForm.value.name.trim() !== ''
    && isOptionalHttpUrl(artistEditForm.value.image));
function isAlbumFormValid(form: { artist_id: number | null; name: string; year: number | null | ''; image: string }) {
    return form.artist_id !== null
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

function isOptionalHttpUrl(value: string): boolean {
    if (!value.trim()) return true;
    try {
        const url = new URL(value.trim());
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
        return false;
    }
}

function imageUrlRule(value: unknown): true | string {
    return typeof value !== 'string' || isOptionalHttpUrl(value) ? true : t('validation.httpUrl');
}

function isMetadataValid(metadata: CollectionMetadata[]): boolean {
    return metadata.every((entry) => entry.type === 'text'
        ? entry.value.trim() !== ''
        : entry.name.trim() !== '' && entry.value.trim() !== '' && isOptionalHttpUrl(entry.value));
}

function cloneMetadata(metadata: CollectionMetadata[]): CollectionMetadata[] {
    return metadata.map((entry) => ({ ...entry }));
}

function getArtistAlbumCount(artistId: number): number {
    return artistAlbumCounts.value.get(artistId) ?? 0;
}

async function refreshDashboard() {
    const [collectionItems, artistRows, albumRows] = await Promise.all([
        collectionStore.getAll(), collectionStore.getArtists(), collectionStore.getAlbums(),
    ]);
    collection.value = collectionItems;
    artists.value = artistRows;
    albums.value = albumRows;
}

function resetArtistForm() { artistForm.value = { name: '', image: '' }; }
function cancelArtist() { showArtistForm.value = false; resetArtistForm(); }
function openArtistEdit(artist: DatabaseArtist) {
    editingArtistId.value = artist.id;
    artistEditForm.value = { name: artist.name, image: artist.image ?? '' };
    showArtistEdit.value = true;
}
function resetArtistEdit() { editingArtistId.value = null; artistEditForm.value = { name: '', image: '' }; }
function cancelArtistEdit() { showArtistEdit.value = false; resetArtistEdit(); }
function resetAlbumForm() { albumForm.value = { artist_id: null, name: '', year: null, image: '' }; }
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
function resetCollectionForm() { collectionForm.value = { artist_id: null, album_id: null, metadata: [] }; }
function cancelCollection() { showCollectionForm.value = false; resetCollectionForm(); }
function resetCollectionAlbum() { collectionForm.value.album_id = null; collectionForm.value.metadata = []; }
function getAlbumSelectItemProps(props: Record<string, unknown>) {
    const { title: _title, ...itemProps } = props;
    return itemProps;
}

function openCollectionEdit(item: CollectionItem) {
    editingCollectionId.value = item.id;
    collectionEditMetadata.value = cloneMetadata(item.metadata);
    showCollectionEdit.value = true;
}
function resetCollectionEdit() { editingCollectionId.value = null; collectionEditMetadata.value = []; }
function cancelCollectionEdit() { showCollectionEdit.value = false; resetCollectionEdit(); }

async function saveArtist() {
    if (!artistFormValid.value) return;
    saving.value = true;
    try {
        await collectionStore.createArtist({
            name: artistForm.value.name.trim(),
            image: artistForm.value.image.trim() || null,
        });
        cancelArtist();
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
        });
        cancelAlbum();
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
    const { artist_id: artistId, album_id: albumId, metadata } = collectionForm.value;
    const userId = discordService.user.value?.id;
    if (!collectionFormValid.value || artistId === null || albumId === null || !userId) return;
    saving.value = true;
    try {
        await collectionStore.createCollection({
            artist_id: artistId,
            album_id: albumId,
            created_by_user_id: userId,
            metadata,
        });
        cancelCollection();
    } finally { saving.value = false; }
}

async function saveCollectionEdit() {
    const id = editingCollectionId.value;
    if (id === null || !isMetadataValid(collectionEditMetadata.value)) return;
    saving.value = true;
    try {
        const updatedItem = await collectionStore.updateCollection(id, { metadata: collectionEditMetadata.value });
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

onMounted(refreshDashboard);
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
</style>
