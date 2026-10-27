import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadLyrics, releaseTracks } from './collection-details';
import type { CollectionItem } from '../store/stores/collection.store';

afterEach(() => vi.unstubAllGlobals());
describe('collection details', () => {
    it('preserves discs and uses recording names and lengths when track fields are absent', () => {
        expect(releaseTracks({ id: 'release', title: 'Album', media: [
            { tracks: [{ id: 'one', number: '1', recording: { title: 'Opening', length: 61000 } }] },
            { tracks: [{ id: 'two', number: '1', title: 'Finale', length: 90000 }] },
        ] })).toEqual([
            { id: '0:one', number: '1', title: 'Opening', length: 61000, disc: 1 },
            { id: '1:two', number: '1', title: 'Finale', length: 90000, disc: 2 },
        ]);
    });
    it('treats missing lyrics as unavailable and includes the album and duration in matching', async () => {
        const fetcher = vi.fn().mockResolvedValue({ status: 404 });
        vi.stubGlobal('fetch', fetcher);
        expect(await loadLyrics({ artist_name: 'Artist', album_name: 'Album' } as CollectionItem,
            { id: '1', title: 'Song', number: '1', disc: 1, length: 61000 }, new AbortController().signal)).toBeNull();
        const url = new URL(fetcher.mock.calls[0]![0]);
        expect(Object.fromEntries(url.searchParams)).toEqual({ artist_name: 'Artist', album_name: 'Album', track_name: 'Song', duration: '61' });
    });
    it('reports upstream failures separately from missing lyrics', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 503, ok: false }));
        await expect(loadLyrics({ artist_name: 'Artist', album_name: 'Album' } as CollectionItem,
            { id: '1', title: 'Song', number: '1', disc: 1 }, new AbortController().signal)).rejects.toThrow('unavailable');
    });
});
