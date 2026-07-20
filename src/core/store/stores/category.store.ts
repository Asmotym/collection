import { defineStore } from 'pinia';
import { api } from 'api/api';
import type {
    CreateCategoryPayload,
    DatabaseCategory,
    MoveCategoryPayload,
    UpdateCategoryPayload,
} from '../../../../shared/types/database.types';

export const useCategoryStore = defineStore('category', {
    state: () => ({ categories: [] as DatabaseCategory[] }),
    actions: {
        async getAll(userId: string) {
            this.categories = await api.category.getAll(userId);
            return this.categories;
        },
        async create(payload: CreateCategoryPayload) {
            const category = await api.category.create(payload);
            this.categories.push(category);
            return category;
        },
        async update(id: number, payload: UpdateCategoryPayload) {
            const category = await api.category.update(id, payload);
            const index = this.categories.findIndex((item) => item.id === id);
            if (index !== -1) this.categories[index] = category;
            return category;
        },
        async move(id: number, payload: MoveCategoryPayload) {
            await api.category.move(id, payload);
            return this.getAll(payload.created_by_user_id);
        },
        async remove(id: number, userId: string) {
            await api.category.remove(id, userId);
            return this.getAll(userId);
        },
    },
});
