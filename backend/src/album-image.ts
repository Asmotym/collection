import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_REDIRECTS = 5;
const IMAGE_TIMEOUT_MS = 15_000;
const ALLOWED_IMAGE_TYPES = new Set([
    'image/avif',
    'image/gif',
    'image/jpeg',
    'image/png',
    'image/webp',
]);

export interface StoredAlbumImage {
    data: Buffer;
    mimeType: string;
}

function isPrivateIp(address: string): boolean {
    const normalized = address.toLowerCase();
    if (isIP(normalized) === 4) {
        const [a, b] = normalized.split('.').map(Number);
        return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254)
            || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
            || (a === 100 && b >= 64 && b <= 127) || (a === 198 && [18, 19].includes(b))
            || a >= 224;
    }
    if (isIP(normalized) === 6) {
        return normalized === '::' || normalized === '::1' || normalized.startsWith('fc')
            || normalized.startsWith('fd') || /^fe[89ab]/.test(normalized)
            || normalized.startsWith('ff') || normalized.startsWith('::ffff:')
            || normalized.startsWith('2001:db8:');
    }
    return true;
}

async function assertPublicImageUrl(url: URL): Promise<void> {
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Image URL must use HTTP or HTTPS');
    if (url.username || url.password) throw new Error('Image URL must not contain credentials');
    if (url.hostname === 'localhost' || url.hostname.endsWith('.localhost')) {
        throw new Error('Image URL must use a public host');
    }
    const addresses = await lookup(url.hostname, { all: true });
    if (!addresses.length || addresses.some(({ address }) => isPrivateIp(address))) {
        throw new Error('Image URL must use a public host');
    }
}

async function readLimitedBody(response: Response): Promise<Buffer> {
    if (!response.body) throw new Error('Image response was empty');
    const declaredLength = Number(response.headers.get('content-length'));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_IMAGE_BYTES) {
        throw new Error('Album image must be smaller than 10 MB');
    }
    const reader = response.body.getReader();
    const chunks: Buffer[] = [];
    let size = 0;
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_IMAGE_BYTES) {
            await reader.cancel();
            throw new Error('Album image must be smaller than 10 MB');
        }
        chunks.push(Buffer.from(value));
    }
    if (!size) throw new Error('Image response was empty');
    return Buffer.concat(chunks, size);
}

function matchesImageSignature(data: Buffer, mimeType: string): boolean {
    if (mimeType === 'image/jpeg') return data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
    if (mimeType === 'image/png') return data.length >= 8 && data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    if (mimeType === 'image/gif') return data.length >= 6 && ['GIF87a', 'GIF89a'].includes(data.toString('ascii', 0, 6));
    if (mimeType === 'image/webp') return data.length >= 12
        && data.toString('ascii', 0, 4) === 'RIFF' && data.toString('ascii', 8, 12) === 'WEBP';
    if (mimeType === 'image/avif') return data.length >= 12 && data.toString('ascii', 4, 8) === 'ftyp'
        && (data.subarray(8, Math.min(data.length, 32)).includes('avif')
            || data.subarray(8, Math.min(data.length, 32)).includes('avis'));
    return false;
}

export async function downloadAlbumImage(imageUrl: string | null): Promise<StoredAlbumImage | null> {
    if (!imageUrl) return null;
    let url = new URL(imageUrl);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), IMAGE_TIMEOUT_MS);
    try {
        for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
            await assertPublicImageUrl(url);
            const response = await fetch(url, {
                headers: { Accept: 'image/avif,image/webp,image/png,image/jpeg,image/gif' },
                redirect: 'manual',
                signal: controller.signal,
            });
            if ([301, 302, 303, 307, 308].includes(response.status)) {
                const location = response.headers.get('location');
                if (!location || redirects === MAX_REDIRECTS) throw new Error('Album image redirected too many times');
                url = new URL(location, url);
                continue;
            }
            if (!response.ok) throw new Error(`Album image returned HTTP ${response.status}`);
            const mimeType = response.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase() ?? '';
            if (!ALLOWED_IMAGE_TYPES.has(mimeType)) throw new Error('URL did not return a supported image');
            const data = await readLimitedBody(response);
            if (!matchesImageSignature(data, mimeType)) throw new Error('URL returned invalid image data');
            return { data, mimeType };
        }
        throw new Error('Album image redirected too many times');
    } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') throw new Error('Album image download timed out');
        throw error;
    } finally {
        clearTimeout(timeout);
    }
}
