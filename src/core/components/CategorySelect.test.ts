// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { shallowMount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import CategorySelect from './CategorySelect.component.vue';
import type { DatabaseCategory } from '../../../shared/types/database.types';

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en: {
    categories: { assignmentLabel: 'Categories', noCategoriesForAssignment: 'None', manage: 'Manage' },
} } });
const category: DatabaseCategory = {
    id: 1, created_by_user_id: 'user', parent_id: null, name: 'Shelf', position: 0, created_at: '',
};

describe('CategorySelect', () => {
    it('shows a hierarchical multi-select when categories exist', () => {
        const wrapper = shallowMount(CategorySelect, {
            props: { modelValue: [], categories: [category] },
            global: { plugins: [i18n], stubs: { VAutocomplete: { template: '<div data-test="category-select" />' } } },
        });
        expect(wrapper.find('[data-test="category-select"]').exists()).toBe(true);
    });

    it('shows the management empty state when no categories exist', () => {
        const wrapper = shallowMount(CategorySelect, {
            props: { modelValue: [], categories: [] },
            global: { plugins: [i18n], stubs: {
                VAlert: { template: '<div data-test="category-empty"><slot /></div>' },
                VBtn: true,
            } },
        });
        expect(wrapper.find('[data-test="category-empty"]').text()).toContain('None');
    });
});
