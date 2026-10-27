import { isCollectionSort, type UserPreferences } from '../../shared/types/database.types.js';

export function normalizeUserPreferences(value: unknown): Partial<UserPreferences> {
    const raw = value && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown> : {};
    const preferences: Partial<UserPreferences> = {};
    for (const key of ['leftPanelOpen', 'rightPanelOpen'] as const) {
        if (key in raw) {
            if (typeof raw[key] !== 'boolean') throw new Error(`${key} must be a boolean`);
            preferences[key] = raw[key];
        }
    }
    if ('cardSize' in raw) {
        if (raw.cardSize !== 'large' && raw.cardSize !== 'medium' && raw.cardSize !== 'small') {
            throw new Error('Card size must be large, medium, or small');
        }
        preferences.cardSize = raw.cardSize;
    }
    if ('sortBy' in raw) {
        if (!isCollectionSort(raw.sortBy)) throw new Error('Invalid collection sort order');
        preferences.sortBy = raw.sortBy;
    }
    if (!Object.keys(preferences).length) throw new Error('No supported preferences provided');
    return preferences;
}
