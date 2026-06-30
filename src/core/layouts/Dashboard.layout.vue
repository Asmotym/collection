<template>
    <HeaderComponent />
    <v-container class="py-6">
        <v-row>
            <v-col cols="12">
                <h1 class="text-h4 mb-4">{{ t('dashboard.title') }}</h1>
                <v-tabs v-model="tab" color="primary">
                    <v-tab value="artists" prepend-icon="mdi-account-music">
                        {{ t('dashboard.tabs.artists') }}
                    </v-tab>
                    <v-tab value="albums" prepend-icon="mdi-album">
                        {{ t('dashboard.tabs.albums') }}
                    </v-tab>
                    <v-tab value="collection" prepend-icon="mdi-view-grid">
                        {{ t('dashboard.tabs.collection') }}
                    </v-tab>
                </v-tabs>

                <v-window v-model="tab" class="mt-4">
                    <v-window-item value="artists">
                        <v-btn
                            class="mb-4"
                            color="primary"
                            prepend-icon="mdi-plus"
                            @click="showArtistForm = true"
                        >
                            {{ t('dashboard.actions.addArtist') }}
                        </v-btn>

                        <v-sheet v-if="showArtistForm" class="pa-4 mb-4" border rounded>
                            <v-row align="center">
                                <v-col cols="12" md="8">
                                    <v-text-field
                                        v-model="artistForm.name"
                                        :label="t('dashboard.fields.artistName')"
                                        hide-details
                                        density="comfortable"
                                    />
                                </v-col>
                                <v-col cols="12" md="4" class="d-flex ga-2">
                                    <v-btn color="primary" :loading="saving" @click="saveArtist">
                                        {{ t('dashboard.actions.save') }}
                                    </v-btn>
                                    <v-btn variant="text" @click="cancelArtist">
                                        {{ t('dashboard.actions.cancel') }}
                                    </v-btn>
                                </v-col>
                            </v-row>
                        </v-sheet>

                        <v-table>
                            <thead>
                                <tr>
                                    <th>{{ t('dashboard.columns.name') }}</th>
                                    <th>{{ t('dashboard.columns.albums') }}</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="artist in artists" :key="artist.id">
                                    <td>{{ artist.name }}</td>
                                    <td>{{ getArtistAlbumCount(artist.id) }}</td>
                                </tr>
                            </tbody>
                        </v-table>
                    </v-window-item>

                    <v-window-item value="albums">
                        <v-btn
                            class="mb-4"
                            color="primary"
                            prepend-icon="mdi-plus"
                            @click="showAlbumForm = true"
                        >
                            {{ t('dashboard.actions.addAlbum') }}
                        </v-btn>

                        <v-sheet v-if="showAlbumForm" class="pa-4 mb-4" border rounded>
                            <v-row align="center">
                                <v-col cols="12" md="4">
                                    <v-text-field
                                        v-model="albumForm.name"
                                        :label="t('dashboard.fields.albumName')"
                                        hide-details
                                        density="comfortable"
                                    />
                                </v-col>
                                <v-col cols="12" md="2">
                                    <v-text-field
                                        v-model.number="albumForm.year"
                                        :label="t('dashboard.fields.year')"
                                        type="number"
                                        hide-details
                                        density="comfortable"
                                    />
                                </v-col>
                                <v-col cols="12" md="3">
                                    <v-text-field
                                        v-model="albumForm.image"
                                        :label="t('dashboard.fields.image')"
                                        hide-details
                                        density="comfortable"
                                    />
                                </v-col>
                                <v-col cols="12" md="3" class="d-flex ga-2">
                                    <v-btn color="primary" :loading="saving" @click="saveAlbum">
                                        {{ t('dashboard.actions.save') }}
                                    </v-btn>
                                    <v-btn variant="text" @click="cancelAlbum">
                                        {{ t('dashboard.actions.cancel') }}
                                    </v-btn>
                                </v-col>
                            </v-row>
                        </v-sheet>

                        <v-table>
                            <thead>
                                <tr>
                                    <th>{{ t('dashboard.columns.name') }}</th>
                                    <th>{{ t('dashboard.columns.year') }}</th>
                                    <th>{{ t('dashboard.columns.image') }}</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="album in albums" :key="album.id">
                                    <td>{{ album.name }}</td>
                                    <td>{{ album.year ?? '-' }}</td>
                                    <td>{{ album.image ?? '-' }}</td>
                                </tr>
                            </tbody>
                        </v-table>
                    </v-window-item>

                    <v-window-item value="collection">
                        <v-btn
                            class="mb-4"
                            color="primary"
                            prepend-icon="mdi-plus"
                            @click="showCollectionForm = true"
                        >
                            {{ t('dashboard.actions.addCollection') }}
                        </v-btn>

                        <v-sheet v-if="showCollectionForm" class="pa-4 mb-4" border rounded>
                            <v-row align="center">
                                <v-col cols="12" md="4">
                                    <v-select
                                        v-model="collectionForm.artist_id"
                                        :items="artists"
                                        item-title="name"
                                        item-value="id"
                                        :label="t('dashboard.fields.artist')"
                                        hide-details
                                        density="comfortable"
                                    />
                                </v-col>
                                <v-col cols="12" md="4">
                                    <v-select
                                        v-model="collectionForm.album_id"
                                        :items="albums"
                                        item-title="name"
                                        item-value="id"
                                        :label="t('dashboard.fields.album')"
                                        hide-details
                                        density="comfortable"
                                    />
                                </v-col>
                                <v-col cols="12" md="4" class="d-flex ga-2">
                                    <v-btn color="primary" :loading="saving" @click="saveCollection">
                                        {{ t('dashboard.actions.save') }}
                                    </v-btn>
                                    <v-btn variant="text" @click="cancelCollection">
                                        {{ t('dashboard.actions.cancel') }}
                                    </v-btn>
                                </v-col>
                            </v-row>
                        </v-sheet>

                        <v-table>
                            <thead>
                                <tr>
                                    <th>{{ t('dashboard.columns.album') }}</th>
                                    <th>{{ t('dashboard.columns.artist') }}</th>
                                    <th>{{ t('dashboard.columns.year') }}</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="item in collection" :key="item.id">
                                    <td>{{ item.album_name }}</td>
                                    <td>{{ item.artist_name }}</td>
                                    <td>{{ item.album_year ?? '-' }}</td>
                                </tr>
                            </tbody>
                        </v-table>
                    </v-window-item>
                </v-window>
            </v-col>
        </v-row>
    </v-container>
</template>

<script setup lang="ts">
import HeaderComponent from 'core/components/Header.component.vue';
import { store } from 'core/store/index.store';
import type { CollectionItem } from 'core/store/stores/collection.store';
import type { DatabaseAlbum, DatabaseArtist } from '../../../shared/types/database.types';
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const tab = ref('artists');
const collectionStore = store.collection();
const collection = ref<CollectionItem[]>([]);
const artists = ref<DatabaseArtist[]>([]);
const albums = ref<DatabaseAlbum[]>([]);
const saving = ref(false);
const showArtistForm = ref(false);
const showAlbumForm = ref(false);
const showCollectionForm = ref(false);
const artistForm = ref({ name: '' });
const albumForm = ref<{ name: string; year: number | null; image: string }>({
    name: '',
    year: null,
    image: '',
});
const collectionForm = ref<{ artist_id: number | null; album_id: number | null }>({
    artist_id: null,
    album_id: null,
});

const artistAlbumCounts = computed<Map<number, number>>(() => {
    const counts = new Map<number, number>();

    for (const item of collection.value) {
        counts.set(item.artist_id, (counts.get(item.artist_id) ?? 0) + 1);
    }

    return counts;
});

function getArtistAlbumCount(artistId: number): number {
    return artistAlbumCounts.value.get(artistId) ?? 0;
}

async function refreshDashboard() {
    const [collectionItems, artistRows, albumRows] = await Promise.all([
        collectionStore.getAll(),
        collectionStore.getArtists(),
        collectionStore.getAlbums(),
    ]);

    collection.value = collectionItems;
    artists.value = artistRows;
    albums.value = albumRows;
}

function cancelArtist() {
    artistForm.value = { name: '' };
    showArtistForm.value = false;
}

function cancelAlbum() {
    albumForm.value = { name: '', year: null, image: '' };
    showAlbumForm.value = false;
}

function cancelCollection() {
    collectionForm.value = { artist_id: null, album_id: null };
    showCollectionForm.value = false;
}

async function saveArtist() {
    const name = artistForm.value.name.trim();

    if (!name) {
        return;
    }

    saving.value = true;
    try {
        await collectionStore.createArtist({ name });
        cancelArtist();
    } finally {
        saving.value = false;
    }
}

async function saveAlbum() {
    const name = albumForm.value.name.trim();

    if (!name) {
        return;
    }

    saving.value = true;
    try {
        await collectionStore.createAlbum({
            name,
            year: albumForm.value.year,
            image: albumForm.value.image.trim() || null,
        });
        cancelAlbum();
    } finally {
        saving.value = false;
    }
}

async function saveCollection() {
    const artistId = collectionForm.value.artist_id;
    const albumId = collectionForm.value.album_id;

    if (artistId === null || albumId === null) {
        return;
    }

    saving.value = true;
    try {
        await collectionStore.createCollection({
            artist_id: artistId,
            album_id: albumId,
        });
        cancelCollection();
    } finally {
        saving.value = false;
    }
}

onMounted(async () => {
    await refreshDashboard();
});
</script>
