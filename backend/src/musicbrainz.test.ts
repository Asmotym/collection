import assert from 'node:assert/strict';
import test from 'node:test';
import { isPostgresUniqueViolation } from './database-errors.js';
import {
    buildArtistSearchQuery,
    buildReleaseGroupSearchQuery,
    buildReleaseGroupArtistNameQuery,
    isMusicBrainzArtist,
    isMusicBrainzRelease,
    isMusicBrainzReleaseGroup,
    MusicBrainzClient,
    UpstreamServiceError,
} from './musicbrainz.js';

function mockFetch(handler: (url: string, init?: RequestInit) => Promise<Response>): typeof fetch {
    return handler as unknown as typeof fetch;
}

test('builds escaped, constrained MusicBrainz queries', () => {
    assert.equal(buildArtistSearchQuery('AC/DC'), 'artist:"AC\\/DC"');
    assert.equal(
        buildReleaseGroupSearchQuery('410c9baf-5469-44f6-9852-826524b80c61', 'Album (Deluxe)'),
        'arid:410c9baf-5469-44f6-9852-826524b80c61 AND primarytype:album AND releasegroup:"Album \\(Deluxe\\)"',
    );
    assert.equal(
        buildReleaseGroupArtistNameQuery('AC/DC', 'Album'),
        'artist:"AC\\/DC" AND primarytype:album AND releasegroup:"Album"',
    );
});

test('maps valid artist results and reuses an in-flight cached request', async () => {
    let calls = 0;
    const client = new MusicBrainzClient('Collection/0.1 (test@example.com)', {
        fetchImplementation: mockFetch(async () => {
            calls += 1;
            return new Response(JSON.stringify({
                artists: [
                    { id: 'b10bbbfc-cf9e-42e0-be17-e2c3e1d2600d', name: 'The Beatles', score: 100 },
                    { id: 'invalid', name: 'Invalid' },
                ],
            }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }),
        requestIntervalMs: 0,
    });

    const [first, second] = await Promise.all([client.searchArtists('Beatles'), client.searchArtists('Beatles')]);
    assert.equal(calls, 1);
    assert.deepEqual(first, second);
    assert.equal(first.length, 1);
    assert.equal(first[0]?.name, 'The Beatles');
});

test('serializes distinct MusicBrainz requests at the configured interval', async () => {
    let currentTime = 0;
    const starts: number[] = [];
    const sleeps: number[] = [];
    const client = new MusicBrainzClient('Collection/0.1 (test@example.com)', {
        now: () => currentTime,
        sleep: async (milliseconds) => {
            sleeps.push(milliseconds);
            currentTime += milliseconds;
        },
        requestIntervalMs: 1000,
        fetchImplementation: mockFetch(async (url) => {
            starts.push(currentTime);
            const body = url.includes('release-group') ? { 'release-groups': [] } : { artists: [] };
            return new Response(JSON.stringify(body), { status: 200 });
        }),
    });

    await Promise.all([
        client.searchArtists('one'),
        client.searchReleaseGroups('410c9baf-5469-44f6-9852-826524b80c61', 'two'),
    ]);
    assert.deepEqual(starts, [0, 1000]);
    assert.deepEqual(sleeps, [1000]);
});

test('browses and sorts up to 100 album release groups for the selected artist', async () => {
    let requestedUrl = '';
    const client = new MusicBrainzClient('Collection/0.1 (test@example.com)', {
        requestIntervalMs: 0,
        fetchImplementation: mockFetch(async (url) => {
            requestedUrl = url;
            return new Response(JSON.stringify({
                'release-groups': [
                    { id: '48140466-cff6-3222-bd55-63c27e43190d', title: 'Zulu', 'primary-type': 'Album' },
                    { id: '9162580e-5df4-32de-80cc-f45a8d8a9b1d', title: 'Abbey Road', 'primary-type': 'Album' },
                ],
            }), { status: 200 });
        }),
    });

    const results = await client.browseReleaseGroups('b10bbbfc-cf9e-42e0-be17-e2c3e1d2600d');
    const url = new URL(requestedUrl);
    assert.equal(url.searchParams.get('artist'), 'b10bbbfc-cf9e-42e0-be17-e2c3e1d2600d');
    assert.equal(url.searchParams.get('type'), 'album');
    assert.equal(url.searchParams.get('limit'), '100');
    assert.deepEqual(results.map((item) => item.title), ['Abbey Road', 'Zulu']);
});

test('browses official releases with label and media details', async () => {
    let requestedUrl = '';
    const client = new MusicBrainzClient('Collection/0.1 (test@example.com)', {
        requestIntervalMs: 0,
        fetchImplementation: mockFetch(async (url) => {
            requestedUrl = url;
            return new Response(JSON.stringify({
                releases: [
                    {
                        id: 'f268b8bc-2768-426b-901b-c7966e76de29',
                        title: 'Album',
                        date: '2000-01-01',
                        country: 'US',
                        media: [{ format: 'CD' }],
                        'release-group': { id: '48140466-cff6-3222-bd55-63c27e43190d', title: 'Album' },
                    },
                ],
            }), { status: 200 });
        }),
    });

    const results = await client.browseReleases('48140466-cff6-3222-bd55-63c27e43190d');
    const url = new URL(requestedUrl);
    assert.equal(url.searchParams.get('release-group'), '48140466-cff6-3222-bd55-63c27e43190d');
    assert.equal(url.searchParams.get('status'), 'official');
    assert.match(url.searchParams.get('inc') ?? '', /labels/);
    assert.equal(results[0]?.media?.[0]?.format, 'CD');
});

test('maps Cover Art Archive availability, missing art, and outages', async () => {
    const mbid = '48140466-cff6-3222-bd55-63c27e43190d';
    const available = new MusicBrainzClient('Collection/0.1 (test@example.com)', {
        fetchImplementation: mockFetch(async () => new Response(null, { status: 307 })),
    });
    assert.equal((await available.getReleaseGroupCover(mbid)).imageUrl?.endsWith(`/release-group/${mbid}/front-500`), true);

    const missing = new MusicBrainzClient('Collection/0.1 (test@example.com)', {
        fetchImplementation: mockFetch(async () => new Response(null, { status: 404 })),
    });
    assert.deepEqual(await missing.getReleaseGroupCover(mbid), { imageUrl: null });

    const unavailable = new MusicBrainzClient('Collection/0.1 (test@example.com)', {
        fetchImplementation: mockFetch(async () => new Response(null, { status: 503 })),
    });
    await assert.rejects(() => unavailable.getReleaseGroupCover(mbid), (error) => {
        assert.equal(error instanceof UpstreamServiceError && error.statusCode, 503);
        return true;
    });
});

test('validates stored snapshots and recognizes duplicate database errors', () => {
    assert.equal(isMusicBrainzArtist({ id: 'b10bbbfc-cf9e-42e0-be17-e2c3e1d2600d', name: 'The Beatles' }), true);
    assert.equal(isMusicBrainzArtist({ id: 'invalid', name: 'The Beatles' }), false);
    assert.equal(isMusicBrainzReleaseGroup({
        id: '48140466-cff6-3222-bd55-63c27e43190d', title: 'Album', 'primary-type': 'Album',
    }), true);
    assert.equal(isMusicBrainzReleaseGroup({
        id: '48140466-cff6-3222-bd55-63c27e43190d', title: 'Single', 'primary-type': 'Single',
    }), false);
    assert.equal(isMusicBrainzRelease({
        id: 'f268b8bc-2768-426b-901b-c7966e76de29', title: 'Album',
    }), true);
    assert.equal(isPostgresUniqueViolation({ code: '23505' }), true);
    assert.equal(isPostgresUniqueViolation({ code: '23503' }), false);
});
