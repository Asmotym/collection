import type {
    CollectionMetadata,
    CollectionTextMetadata,
    CollectionUrlMetadata,
} from '../../../shared/types/database.types';

export const textMetadata = (metadata: CollectionMetadata[], cardsOnly = false): CollectionTextMetadata[] => (
    metadata.filter((entry): entry is CollectionTextMetadata => (
        entry.type === 'text' && (!cardsOnly || entry.showInCards !== false)
    ))
);

export const urlMetadata = (metadata: CollectionMetadata[], cardsOnly = false): CollectionUrlMetadata[] => (
    metadata.filter((entry): entry is CollectionUrlMetadata => (
        entry.type === 'url' && (!cardsOnly || entry.showInCards !== false)
    ))
);

export const cloneMetadata = (metadata: CollectionMetadata[]): CollectionMetadata[] => (
    metadata.map((entry) => ({ ...entry }))
);

export function isOptionalHttpUrl(value: string): boolean {
    if (!value.trim()) return true;
    try {
        return ['http:', 'https:'].includes(new URL(value.trim()).protocol);
    } catch {
        return false;
    }
}

export const isMetadataValid = (metadata: CollectionMetadata[]): boolean => metadata.every((entry) => (
    entry.type === 'text'
        ? entry.value.trim() !== ''
        : entry.name.trim() !== '' && entry.value.trim() !== '' && isOptionalHttpUrl(entry.value)
));
