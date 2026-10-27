<template>
    <v-dialog :model-value="modelValue" max-width="1240" @update:model-value="emit('update:modelValue', $event)" @after-leave="emit('closed')">
        <v-card v-if="item" class="collection-detail">
            <v-btn class="close-detail" icon="mdi-close" variant="tonal" :aria-label="t('home.details.close')" @click="emit('update:modelValue', false)" />
            <div class="detail-layout">
                <main class="album-panel">
                    <div v-if="item.album_image" class="album-colors" :style="{ backgroundImage: `url(${JSON.stringify(item.album_image)})` }" />
                    <Transition name="compact-header">
                        <header v-if="compactAlbumHeader" class="compact-album-header">
                            <div v-if="item.album_image" class="compact-album-colors" :style="{ backgroundImage: `url(${JSON.stringify(item.album_image)})` }" aria-hidden="true" />
                            <div class="compact-cover">
                                <ImagePreview v-if="item.album_image" :src="item.album_image" :source-url="item.album_image_url" :alt="item.album_name" full-width />
                                <div v-else class="image-placeholder"><v-icon>mdi-album</v-icon></div>
                            </div>
                            <div class="compact-album-heading">
                                <h2>{{ item.album_name }}</h2>
                                <p>{{ item.artist_name }}<span v-if="item.album_year"> · {{ item.album_year }}</span></p>
                            </div>
                        </header>
                    </Transition>
                    <div class="album-content panel-scroll" :class="{ 'is-scrolling': scrolling.album }" tabindex="0" :aria-label="t('details.albumInformation')" @scroll.passive="onAlbumScroll" @touchstart.passive="showScrollbar('album')" @touchend.passive="showScrollbar('album')">
                        <header ref="albumHeader" class="album-header">
                            <div class="cover-stage" :style="coverTilt" @pointermove="tiltCover" @pointerleave="resetCoverTilt" @pointercancel="resetCoverTilt">
                                <div class="cover">
                                <ImagePreview v-if="item.album_image" :src="item.album_image" :source-url="item.album_image_url" :alt="item.album_name" full-width />
                                <div v-else class="image-placeholder"><v-icon size="64">mdi-album</v-icon></div>
                                </div>
                            </div>
                            <div class="album-heading"><p class="eyebrow">{{ t('musicbrainzDetails.album') }}</p><h1>{{ item.album_name }}</h1><p class="artist-byline">{{ item.artist_name }}</p><p v-if="item.album_year">{{ item.album_year }}</p></div>
                        </header>
                        <section class="detail-section">
                            <MusicBrainzDetails panel="album" :artist="null" :album="item.album_musicbrainz_data" :release="albumRelease" />
                            <div class="provider-links"><v-btn v-for="reference in providerLinks" :key="`${reference.source}:${reference.externalId}`" :href="reference.externalUrl" target="_blank" rel="noopener noreferrer" variant="tonal" size="small" prepend-icon="mdi-open-in-new">{{ reference.source === 'discogs' ? 'Data provided by Discogs' : reference.source === 'lastfm' ? 'Last.fm' : 'MusicBrainz' }}</v-btn></div>
                        </section>
                        <section v-if="tracks.length || loadingTracks || trackError" class="detail-section">
                            <h2>{{ t('details.tracklist') }}</h2>
                            <p v-if="loadingTracks" role="status">{{ t('details.loading') }}</p>
                            <p v-else-if="trackError" role="status">{{ t('details.tracksUnavailable') }}</p>
                            <ol v-else class="tracklist">
                                <li v-for="track in tracks" :key="track.id">
                                    <div class="track-row"><span class="track-number">{{ tracks.some(entry => entry.disc > 1) ? `${track.disc}.` : '' }}{{ track.number }}</span><span class="track-title">{{ track.title }}</span><span class="track-time">{{ duration(track.length) }}</span><v-btn size="small" variant="text" :loading="lyrics[track.id]?.status === 'loading'" :aria-expanded="expanded === track.id" :aria-label="`${t('details.lyrics')}: ${track.title}`" @click="toggleLyrics(track)">{{ t('details.lyrics') }}</v-btn></div>
                                    <div v-if="expanded === track.id" class="lyrics" aria-live="polite"><p v-if="lyrics[track.id]?.status === 'missing'">{{ t('details.noLyrics') }}</p><p v-else-if="lyrics[track.id]?.status === 'error'">{{ t('details.lyricsError') }}</p><template v-else-if="lyrics[track.id]?.text"><p class="lyrics-text">{{ lyrics[track.id]?.text }}</p><a href="https://lrclib.net" target="_blank" rel="noopener noreferrer">LRCLIB</a></template></div>
                                </li>
                            </ol>
                            <a v-if="tracks.length" href="https://musicbrainz.org" target="_blank" rel="noopener noreferrer" class="source">MusicBrainz</a>
                        </section>
                        <section v-if="notes.length || links.length" class="detail-section">
                            <h2>{{ t('metadata.title') }}</h2>
                            <div v-for="(entry, index) in notes" :key="index" class="detail-note"><h3 v-if="entry.title">{{ entry.title }}</h3><p>{{ entry.value }}</p></div>
                            <div class="provider-links"><v-btn v-for="(entry, index) in links" :key="index" :href="entry.value" target="_blank" rel="noopener noreferrer" variant="tonal" prepend-icon="mdi-open-in-new">{{ entry.name }}</v-btn></div>
                        </section>
                    </div>
                </main>
                <aside class="artist-panel panel-scroll" :class="{ 'is-scrolling': scrolling.artist }" tabindex="0" :aria-label="t('musicbrainzDetails.artist')" @scroll.passive="showScrollbar('artist')" @touchstart.passive="showScrollbar('artist')" @touchend.passive="showScrollbar('artist')">
                    <p class="eyebrow">{{ t('musicbrainzDetails.artist') }}</p>
                    <img v-if="artistImage && !artistImageFailed" :src="artistImage" :alt="item.artist_name" class="artist-image" @error="artistImageFailed = true">
                    <h2 class="artist-name">{{ item.artist_name }}</h2>
                    <p v-if="summary.description" class="artist-description">{{ summary.description }}</p>
                    <a v-if="summary.url" :href="summary.url" target="_blank" rel="noopener noreferrer">Wikipedia</a>
                    <MusicBrainzDetails class="mt-6" panel="artist" :artist="item.artist_musicbrainz_data" :album="null" :release="null" />
                </aside>
            </div>
        </v-card>
    </v-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount } from 'vue';
import { useI18n } from 'vue-i18n';
import type { MusicBrainzRelease } from '../../../shared/types/database.types';
import type { CollectionItem } from 'core/store/stores/collection.store';
import ImagePreview from 'core/components/ImagePreview.component.vue';
import MusicBrainzDetails from 'core/components/MusicBrainzDetails.component.vue';
import { textMetadata, urlMetadata } from 'core/utils/collection-metadata.utils';
import { loadRelease, releaseTracks, loadArtistSummary, loadLyrics, type Track, type ArtistSummary } from '../services/collection-details';
const props = defineProps<{ modelValue: boolean; item: CollectionItem | null }>();
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; closed: [] }>();
const { t } = useI18n();
const notes = computed(() => textMetadata(props.item?.metadata ?? []).filter(entry => entry.value.trim()));
const links = computed(() => urlMetadata(props.item?.metadata ?? []).filter(entry => entry.value.trim()));
const providerLinks = computed(() => props.item?.album_external_references ?? []);
const fetchedRelease = ref<MusicBrainzRelease | null>(null);
const albumRelease = computed(() => {
    const selection = props.item?.musicbrainz_release_data;
    return selection?.source === 'common' || selection?.source === 'discogs'
        ? selection : fetchedRelease.value ?? selection ?? null;
});
const tracks = ref<Track[]>([]);
const loadingTracks = ref(false);
const trackError = ref(false);
const summary = ref<ArtistSummary>({});
const artistImageFailed = ref(false);
const artistImage = computed(() => props.item?.artist_image || summary.value.image);
const expanded = ref<string | null>(null);
const lyrics = ref<Record<string, { status: 'loading' | 'found' | 'missing' | 'error'; text?: string }>>({});
const coverTilt = ref({ '--cover-rotate-x': '0deg', '--cover-rotate-y': '0deg' });
function tiltCover(event: PointerEvent) {
    if (event.pointerType !== 'mouse') return;
    const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const x = Math.max(-1, Math.min(1, (event.clientX - bounds.left) / bounds.width * 2 - 1));
    const y = Math.max(-1, Math.min(1, (event.clientY - bounds.top) / bounds.height * 2 - 1));
    coverTilt.value = { '--cover-rotate-x': `${-y * 8}deg`, '--cover-rotate-y': `${x * 8}deg` };
}
function resetCoverTilt() {
    coverTilt.value = { '--cover-rotate-x': '0deg', '--cover-rotate-y': '0deg' };
}
const albumHeader = ref<HTMLElement | null>(null);
const compactAlbumHeader = ref(false);
function onAlbumScroll(event: Event) {
    showScrollbar('album');
    const scroller = event.currentTarget as HTMLElement;
    const header = albumHeader.value;
    if (!header) return;
    // Keep the full-size header in the flow so switching sizes never shifts scroll position.
    const headerBottom = header.getBoundingClientRect().bottom - scroller.getBoundingClientRect().top;
    compactAlbumHeader.value = scroller.scrollTop > 0 && headerBottom <= 84;
}
const scrolling = ref({ album: false, artist: false });
const scrollTimers: Partial<Record<'album' | 'artist', ReturnType<typeof setTimeout>>> = {};
function showScrollbar(panel: 'album' | 'artist') {
    scrolling.value[panel] = true;
    clearTimeout(scrollTimers[panel]);
    scrollTimers[panel] = setTimeout(() => { scrolling.value[panel] = false; }, 1000);
}
let controller = new AbortController();
watch(() => [props.modelValue, props.item] as const, async ([open, item]) => {
    resetCoverTilt();
    compactAlbumHeader.value = false;
    controller.abort(); controller = new AbortController();
    const signal = controller.signal;
    fetchedRelease.value = null; tracks.value = []; summary.value = {}; lyrics.value = {}; expanded.value = null; artistImageFailed.value = false; trackError.value = false; loadingTracks.value = false;
    if (!open || !item) return;
    if (item.artist_musicbrainz_data) void loadArtistSummary(item.artist_musicbrainz_data, signal).then(data => { if (!signal.aborted) summary.value = data; }).catch(() => {});
    loadingTracks.value = true;
    try { const release = await loadRelease(item); if (!signal.aborted) { fetchedRelease.value = release; tracks.value = releaseTracks(release); } }
    catch { if (!signal.aborted) trackError.value = true; }
    finally { if (!signal.aborted) loadingTracks.value = false; }
}, { immediate: true });
onBeforeUnmount(() => {
    controller.abort();
    Object.values(scrollTimers).forEach(clearTimeout);
});
function duration(milliseconds?: number | null) { if (!milliseconds) return ''; const seconds = Math.round(milliseconds / 1000); return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`; }
async function toggleLyrics(track: Track) {
    if (expanded.value === track.id) { expanded.value = null; return; }
    expanded.value = track.id;
    if (!props.item || (lyrics.value[track.id] && lyrics.value[track.id]?.status !== 'error')) return;
    const signal = controller.signal;
    lyrics.value[track.id] = { status: 'loading' };
    try { const text = await loadLyrics(props.item, track, signal); if (!signal.aborted) lyrics.value[track.id] = text ? { status: 'found', text } : { status: 'missing' }; }
    catch { if (!signal.aborted) lyrics.value[track.id] = { status: 'error' }; }
}
</script>

<style scoped>
.collection-detail { position: relative; border-radius: 16px !important; overflow: hidden !important; }
.close-detail { position: absolute; right: 12px; top: 12px; z-index: 3; }
.detail-layout { height: min(86dvh, 960px); min-height: 0; display: grid; grid-template-columns: minmax(0, 7fr) minmax(0, 3fr); }
.album-panel { min-height: 0; display: flex; flex-direction: column; position: relative; overflow: hidden; isolation: isolate; color: #fff; background: #202127; }
.album-colors { position: absolute; inset: -100px; z-index: -2; background-size: cover; background-position: center; filter: blur(75px) saturate(1.4); opacity: .65; pointer-events: none; }
.album-panel::after { content: ''; position: absolute; inset: 0; z-index: -1; background: linear-gradient(150deg, rgba(10,12,18,.32), rgba(10,12,18,.88)); pointer-events: none; }
.album-content { min-height: 0; padding: 36px; scroll-padding-top: 100px; }
.compact-album-header { position: absolute; inset: 0 0 auto; z-index: 2; display: flex; align-items: center; gap: 16px; min-height: 84px; padding: 14px 36px; background: #202127; isolation: isolate; overflow: hidden; border-bottom: 1px solid #ffffff26; box-shadow: 0 6px 20px #0003; }
.compact-album-colors { position: absolute; inset: -60px; z-index: -2; background-size: cover; background-position: center; filter: blur(35px) saturate(1.5); pointer-events: none; }
.compact-album-header::after { content: ''; position: absolute; inset: 0; z-index: -1; background: linear-gradient(120deg, rgba(10, 12, 18, .35), rgba(10, 12, 18, .65)); pointer-events: none; }
.compact-cover { width: 56px; flex: 0 0 56px; border-radius: 5px; overflow: hidden; }
.compact-album-heading { min-width: 0; }
.compact-album-heading h2 { font-size: 1.1rem; line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; overflow-wrap: anywhere; }
.compact-album-heading p { font-size: .85rem; opacity: .7; margin-top: 4px; }
.compact-header-enter-active, .compact-header-leave-active { transition: opacity 180ms ease, transform 180ms ease; }
.compact-header-enter-from, .compact-header-leave-to { opacity: 0; transform: translateY(-8px); }
@media (max-width: 760px) { .compact-album-header { padding-inline: 20px 64px; } }
@media (prefers-reduced-motion: reduce) { .compact-header-enter-active, .compact-header-leave-active { transition: none; } }
.panel-scroll { overflow-y: auto; overflow-x: hidden; overscroll-behavior: contain; scrollbar-width: thin; scrollbar-color: transparent transparent; }
.panel-scroll.is-scrolling { scrollbar-color: rgba(160, 160, 160, .65) transparent; }
.panel-scroll::-webkit-scrollbar { width: 6px; }
.panel-scroll::-webkit-scrollbar-track { background: transparent; }
.panel-scroll::-webkit-scrollbar-thumb { background: transparent; border-radius: 6px; }
.panel-scroll.is-scrolling::-webkit-scrollbar-thumb { background: rgba(160, 160, 160, .65); }
.panel-scroll:focus-visible { outline: 2px solid currentColor; outline-offset: -3px; }
.album-header { display: grid; grid-template-columns: minmax(0, 42%) minmax(0, 1fr); gap: 26px; align-items: center; margin-bottom: 36px; }
.cover-stage { perspective: 900px; min-width: 0; }
.cover { overflow: hidden; border-radius: 8px; box-shadow: 0 12px 32px #0005; transition: transform 350ms ease-out, box-shadow 350ms ease-out; }
@media (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference) {
    .cover-stage:hover .cover {
        transform: rotateX(var(--cover-rotate-x, 0deg)) rotateY(var(--cover-rotate-y, 0deg)) translateZ(12px);
        box-shadow: 0 20px 40px #0007;
        transition-duration: 150ms;
    }
}
@media (prefers-reduced-motion: reduce) {
    .cover { transition: none; }
}
.image-placeholder { aspect-ratio: 1; display: grid; place-items: center; background: #ffffff12; }
.album-heading { min-width: 0; }
h1 { font-size: clamp(1.7rem, 3vw, 3rem); line-height: 1.12; overflow-wrap: anywhere; margin: 8px 0 18px; }
.eyebrow { font-size: .75rem; text-transform: uppercase; letter-spacing: .14em; opacity: .7; margin-bottom: 14px; }
.artist-byline { font-size: 1.15rem; margin-bottom: 8px; }
.detail-section { border-top: 1px solid #ffffff26; padding-top: 24px; margin-top: 24px; }
.detail-section h2 { font-size: 1.2rem; margin-bottom: 20px; }
dt { opacity: .7; } dd { margin: 0; overflow-wrap: anywhere; }
.provider-links { display: flex; flex-wrap: wrap; gap: 8px; }
.artist-panel { min-height: 0; padding: 60px 28px 28px; background: rgb(var(--v-theme-surface)); min-width: 0; }
.artist-image { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 10px; margin-bottom: 20px; }
.artist-name { font-size: 1.7rem; overflow-wrap: anywhere; margin-bottom: 20px; line-height: 1.2; }
.artist-description { line-height: 1.7; margin-bottom: 12px; }
a { color: inherit; text-underline-offset: 3px; }
.tracklist { list-style: none; padding: 0; }
.tracklist li { border-bottom: 1px solid #ffffff14; }
.track-row { display: flex; align-items: center; gap: 12px; min-height: 52px; padding-inline: 10px; transition: background-color 160ms ease; }
.tracklist li:first-child .track-row { border-radius: 6px 6px 0 0; }
.track-row:focus-within { background-color: rgba(255, 255, 255, .06); }
@media (hover: hover) {
    .track-row:hover { background-color: rgba(255, 255, 255, .06); }
}
@media (prefers-reduced-motion: reduce) {
    .track-row { transition: none; }
}
.track-number, .track-time { opacity: .65; font-size: .85rem; font-variant-numeric: tabular-nums; }
.track-number { min-width: 22px; } .track-title { flex: 1; overflow-wrap: anywhere; }
.lyrics { padding: 12px 0 24px 34px; } .lyrics-text, .detail-note p { white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.7; }
.detail-note { margin-bottom: 20px; } .source { display: inline-block; font-size: .8rem; opacity: .65; margin-top: 14px; }
@media (max-width: 760px) { .detail-layout { grid-template-columns: 1fr; grid-template-rows: minmax(0, 7fr) minmax(0, 3fr); } .album-content { padding: 56px 20px 24px; } .album-header { gap: 16px; } .artist-panel { min-height: 0; padding: 28px 20px; } .artist-image { max-width: 240px; } h1 { font-size: clamp(1.4rem, 5vw, 2.4rem); } .track-row { gap: 8px; } }
</style>
