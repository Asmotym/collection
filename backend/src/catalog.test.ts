import assert from 'node:assert/strict';
import test from 'node:test';
import type {
    CatalogAlbumResult,
    CatalogArtistResult,
    CatalogCoverCandidate,
    CatalogEditionResult,
    CatalogSource,
} from '../../shared/types/catalog.types.js';
import {
    CatalogService,
    CatalogUpstreamError,
    DiscogsCatalogProvider,
    FanartCatalogProvider,
    LastFmCatalogProvider,
    type CatalogArtworkProvider,
    type CatalogProvider,
} from './catalog.js';

function mockFetch(handler: (url: string, init?: RequestInit) => Promise<Response>): typeof fetch {
    return handler as unknown as typeof fetch;
}

test('Discogs maps artists, masters, and standalone releases without persisting response objects', async () => {
    const provider = new DiscogsCatalogProvider({
        token: 'secret', enabled: true, userAgent: 'Collection/test', cacheTtlMs: 30_000,
        fetchImplementation: mockFetch(async (url, init) => {
            assert.equal(new Headers(init?.headers).get('Authorization'), 'Discogs token=secret');
            if (url.includes('type=artist')) return Response.json({ results: [{ id: 42, title: 'Artist', type: 'artist', cover_image: 'ignored' }] });
            return Response.json({ results: [
                { id: 10, type: 'master', title: 'Artist - Album', year: 1999, cover_image: 'https://img/master.jpg' },
                { id: 11, type: 'release', title: 'Artist - Demo', year: 2000, thumb: 'https://img/release.jpg' },
            ] });
        }),
    });
    const artists = await provider.searchArtists('Artist');
    assert.deepEqual(artists[0], {
        source: 'discogs', kind: 'artist', externalId: '42', name: 'Artist',
        externalUrl: 'https://www.discogs.com/artist/42', subtitle: 'artist',
    });
    assert.equal('cover' in artists[0], false);
    const albums = await provider.searchAlbums({ artistName: 'Artist', query: 'Album' });
    assert.deepEqual(albums.map((album) => album.kind), ['master', 'release']);
    assert.equal(albums[0]?.cover?.entityId, '10');
});

test('Last.fm drops all image fields and filters album matches to the selected artist', async () => {
    const provider = new LastFmCatalogProvider({
        apiKey: 'key', enabled: true,
        fetchImplementation: mockFetch(async (url) => {
            if (url.includes('artist.search')) return Response.json({ results: { artistmatches: { artist: [{
                name: 'Artist', url: 'https://last.fm/music/Artist', mbid: '', image: [{ '#text': 'forbidden' }],
            }] } } });
            if (url.includes('gettopalbums')) return Response.json({ topalbums: { album: [{
                name: 'Album', url: 'https://last.fm/music/Artist/Album', artist: { name: 'Artist' }, image: [{ '#text': 'forbidden' }],
            }] } });
            return Response.json({ results: { albummatches: { album: [
                { name: 'Album deluxe', url: 'https://last.fm/music/Artist/Album+deluxe', artist: 'Artist', image: [{ '#text': 'forbidden' }] },
                { name: 'Album', url: 'https://last.fm/music/Other/Album', artist: 'Other' },
            ] } } });
        }),
    });
    const artists = await provider.searchArtists('Artist');
    assert.equal('image' in artists[0], false);
    const albums = await provider.searchAlbums({ artistName: 'Artist', query: 'Album' });
    assert.deepEqual(albums.map((album) => album.artistName), ['Artist', 'Artist']);
    assert.equal(albums.some((album) => 'cover' in album), false);
});

test('Fanart.tv resolves the most-liked album cover by MusicBrainz release-group ID', async () => {
    let requestedUrl = '';
    const provider = new FanartCatalogProvider({
        apiKey: 'fanart-secret', enabled: true,
        fetchImplementation: mockFetch(async (url) => {
            requestedUrl = url;
            return Response.json({
                mbid_id: 'artist-mbid',
                albums: [{
                    release_group_id: 'release-group-mbid',
                    cdart: [{ id: 'disc', url: 'https://assets.fanart.tv/disc.png', likes: '99' }],
                    albumcover: [
                        { id: 'first', url: 'https://assets.fanart.tv/first.jpg', likes: '2' },
                        { id: 'preferred', url: 'https://assets.fanart.tv/preferred.jpg', likes: '10' },
                    ],
                }],
            });
        }),
    });

    const covers = await provider.getCovers({
        artistName: 'Artist', albumTitle: 'Album', references: [{
            source: 'musicbrainz', kind: 'release-group', externalId: 'release-group-mbid',
            externalUrl: 'https://musicbrainz.org/release-group/release-group-mbid',
        }],
    });

    assert.equal(requestedUrl, 'https://webservice.fanart.tv/v3.2/music/albums/release-group-mbid?api_key=fanart-secret');
    assert.deepEqual(covers, [{
        source: 'fanart', entityType: 'release-group', entityId: 'release-group-mbid',
        previewUrl: 'https://assets.fanart.tv/preferred.jpg', externalUrl: 'https://fanart.tv/artist/artist-mbid/',
    }]);
});

test('Fanart.tv treats a missing album as an empty cover result', async () => {
    const provider = new FanartCatalogProvider({
        apiKey: 'key', enabled: true,
        fetchImplementation: mockFetch(async () => new Response(null, { status: 404 })),
    });
    const covers = await provider.getCovers({
        artistName: 'Artist', albumTitle: 'Album', references: [{
            source: 'musicbrainz', kind: 'release-group', externalId: 'missing-mbid',
            externalUrl: 'https://musicbrainz.org/release-group/missing-mbid',
        }],
    });
    assert.deepEqual(covers, []);
});

test('catalog orchestration preserves provider order and returns partial failures', async () => {
    const provider = (source: CatalogSource, behavior: 'ok' | 'error' | 'disabled'): CatalogProvider => ({
        source, enabled: behavior !== 'disabled',
        searchArtists: async () => {
            if (behavior === 'error') throw new Error('offline');
            return [{ source, kind: 'artist', externalId: `${source}:1`, externalUrl: `https://example.test/${source}`, name: 'Same name' }];
        },
        searchAlbums: async () => [] as CatalogAlbumResult[],
        getEditions: async () => [] as CatalogEditionResult[],
        getCovers: async () => [] as CatalogCoverCandidate[],
    });
    const service = new CatalogService([
        provider('musicbrainz', 'ok'), provider('discogs', 'error'), provider('lastfm', 'disabled'),
    ]);
    const sections = await service.searchArtists('same');
    assert.deepEqual(sections.map((section) => [section.source, section.status]), [
        ['musicbrainz', 'ok'], ['discogs', 'error'], ['lastfm', 'disabled'],
    ]);
    assert.equal((sections[0]?.items[0] as CatalogArtistResult).name, 'Same name');
});

test('cover lookup stops after Cover Art Archive returns an image', async () => {
    let discogsCalls = 0;
    const cover: CatalogCoverCandidate = {
        source: 'cover-art-archive', entityType: 'release-group', entityId: 'mb-release-group',
        previewUrl: 'https://coverartarchive.org/cover.jpg', externalUrl: 'https://musicbrainz.org/release-group/mb-release-group',
    };
    const provider = (source: CatalogSource, getCovers: () => Promise<CatalogCoverCandidate[]>): CatalogProvider => ({
        source, enabled: true,
        searchArtists: async () => [], searchAlbums: async () => [], getEditions: async () => [], getCovers,
    });
    const service = new CatalogService([
        provider('musicbrainz', async () => [cover]),
        provider('discogs', async () => { discogsCalls += 1; return []; }),
    ]);

    const sections = await service.getCovers({ artistName: 'Artist', albumTitle: 'Album', references: [] });

    assert.equal(discogsCalls, 0);
    assert.deepEqual(sections.map((section) => [section.source, section.status, section.items.length]), [
        ['musicbrainz', 'ok', 1], ['discogs', 'ok', 0],
    ]);
});

test('cover lookup falls back to Discogs when Cover Art Archive has no image', async () => {
    let discogsCalls = 0;
    const discogsCover: CatalogCoverCandidate = {
        source: 'discogs', entityType: 'master', entityId: '42',
        previewUrl: 'https://i.discogs.com/cover.jpg', externalUrl: 'https://www.discogs.com/master/42',
    };
    const provider = (source: CatalogSource, getCovers: () => Promise<CatalogCoverCandidate[]>): CatalogProvider => ({
        source, enabled: true,
        searchArtists: async () => [], searchAlbums: async () => [], getEditions: async () => [], getCovers,
    });
    const service = new CatalogService([
        provider('musicbrainz', async () => []),
        provider('discogs', async () => { discogsCalls += 1; return [discogsCover]; }),
    ]);

    const sections = await service.getCovers({ artistName: 'Artist', albumTitle: 'Album', references: [] });

    assert.equal(discogsCalls, 1);
    assert.deepEqual(sections.map((section) => [section.source, section.status, section.items.length]), [
        ['musicbrainz', 'ok', 0], ['discogs', 'ok', 1],
    ]);
    assert.deepEqual(sections[1]?.items[0], discogsCover);
});

test('cover lookup falls back to Discogs when Cover Art Archive is unavailable', async () => {
    const provider = (source: CatalogSource, getCovers: () => Promise<CatalogCoverCandidate[]>): CatalogProvider => ({
        source, enabled: true,
        searchArtists: async () => [], searchAlbums: async () => [], getEditions: async () => [], getCovers,
    });
    const service = new CatalogService([
        provider('musicbrainz', async () => { throw new CatalogUpstreamError('request_failed', 'CAA offline'); }),
        provider('discogs', async () => [{
            source: 'discogs', entityType: 'release', entityId: '7', previewUrl: 'https://i.discogs.com/7.jpg',
            externalUrl: 'https://www.discogs.com/release/7',
        }]),
    ]);

    const sections = await service.getCovers({ artistName: 'Artist', albumTitle: 'Album', references: [] });

    assert.deepEqual(sections.map((section) => [section.source, section.status, section.items.length]), [
        ['musicbrainz', 'error', 0], ['discogs', 'ok', 1],
    ]);
});

test('cover lookup falls back to Fanart.tv after Cover Art Archive and Discogs miss', async () => {
    const provider = (source: CatalogSource): CatalogProvider => ({
        source, enabled: true,
        searchArtists: async () => [], searchAlbums: async () => [], getEditions: async () => [], getCovers: async () => [],
    });
    let fanartCalls = 0;
    const fanart: CatalogArtworkProvider = {
        source: 'fanart', enabled: true,
        getCovers: async () => {
            fanartCalls += 1;
            return [{ source: 'fanart', entityType: 'release-group', entityId: 'mbid',
                previewUrl: 'https://assets.fanart.tv/cover.jpg', externalUrl: 'https://fanart.tv/' }];
        },
    };
    const service = new CatalogService([provider('musicbrainz'), provider('discogs')], [fanart]);

    const sections = await service.getCovers({ artistName: 'Artist', albumTitle: 'Album', references: [] });

    assert.equal(fanartCalls, 1);
    assert.deepEqual(sections.map((section) => [section.source, section.status, section.items.length]), [
        ['musicbrainz', 'ok', 0], ['discogs', 'ok', 0], ['fanart', 'ok', 1],
    ]);
});

test('Discogs cache TTL is capped below the six-hour freshness limit', async () => {
    let now = 0;
    let calls = 0;
    const provider = new DiscogsCatalogProvider({
        token: 'secret', enabled: true, userAgent: 'Collection/test', cacheTtlMs: 24 * 60 * 60 * 1000,
        now: () => now,
        fetchImplementation: mockFetch(async () => { calls += 1; return Response.json({ results: [] }); }),
    });
    await provider.searchArtists('Artist');
    now = 4 * 60 * 60 * 1000;
    await provider.searchArtists('Artist');
    assert.equal(calls, 1);
    now = 5 * 60 * 60 * 1000 + 1;
    await provider.searchArtists('Artist');
    assert.equal(calls, 2);
});
