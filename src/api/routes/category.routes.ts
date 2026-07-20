import { ApiClient } from '../client.api';
import type {
    CreateCategoryPayload,
    DatabaseCategory,
    MoveCategoryPayload,
    UpdateCategoryPayload,
} from '../../../shared/types/database.types';

export const getAll = (userId: string) => ApiClient.request<DatabaseCategory[]>(
    `/categories?${new URLSearchParams({ created_by_user_id: userId })}`,
);

export const create = (payload: CreateCategoryPayload) => ApiClient.request<DatabaseCategory>('/categories', {
    method: 'POST', body: JSON.stringify(payload),
});

export const update = (id: number, payload: UpdateCategoryPayload) => ApiClient.request<DatabaseCategory>(
    `/categories/${id}`, { method: 'PATCH', body: JSON.stringify(payload) },
);

export const move = (id: number, payload: MoveCategoryPayload) => ApiClient.request<DatabaseCategory>(
    `/categories/${id}/move`, { method: 'POST', body: JSON.stringify(payload) },
);

export const remove = (id: number, userId: string) => ApiClient.request<{ id: number }>(
    `/categories/${id}?${new URLSearchParams({ created_by_user_id: userId })}`, { method: 'DELETE' },
);
