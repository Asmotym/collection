// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent } from 'vue';
import CategoryNavigationList from './CategoryNavigationList.component.vue';
import type { CategoryTreeNode } from 'core/utils/category-tree.utils';

const node = (id: number, name: string, children: CategoryTreeNode[] = []): CategoryTreeNode => ({
    id, name, children, created_by_user_id: 'user', parent_id: null, position: 0, created_at: '',
});

describe('CategoryNavigationList', () => {
    it('expands a parent and displays its subcategory', async () => {
        const VListGroup = defineComponent({
            data: () => ({ open: false }),
            methods: { toggle() { this.open = !this.open; } },
            template: '<div><slot name="activator" :props="{ onClick: toggle }" />'
                + '<div v-if="open" data-test="children"><slot /></div></div>',
        });
        const VListItem = defineComponent({
            emits: ['click'],
            template: '<button class="v-list-item" @click="$emit(\'click\', $event)">{{ title }}<slot /></button>',
            props: { title: String },
        });
        const wrapper = mount(CategoryNavigationList, {
            props: { nodes: [node(1, 'Parent', [node(2, 'Subcategory')])], selectedId: null },
            global: { stubs: {
                VListGroup,
                VListItem,
                VListItemTitle: { template: '<span><slot /></span>' },
            } },
        });

        expect(wrapper.find('[data-test="children"]').exists()).toBe(false);
        await wrapper.get('.v-list-item').trigger('click');

        expect(wrapper.get('[data-test="children"]').text()).toContain('Subcategory');
        wrapper.unmount();
    });
});
