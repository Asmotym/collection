<template>
    <div role="status" :aria-label="label" aria-live="polite">
        <v-row v-if="variant === 'cards'">
            <v-col v-for="index in count" :key="index" cols="12" sm="6" md="3">
                <v-card>
                    <v-skeleton-loader type="heading, subtitle, image, paragraph, actions" />
                </v-card>
            </v-col>
        </v-row>
        <v-table v-else-if="variant === 'table'">
            <tbody>
                <tr v-for="index in count" :key="index">
                    <td><v-skeleton-loader type="avatar" /></td>
                    <td colspan="5"><v-skeleton-loader type="text" /></td>
                    <td><v-skeleton-loader type="button" /></td>
                </tr>
            </tbody>
        </v-table>
        <v-skeleton-loader v-else :type="type" />
    </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
    variant?: 'cards' | 'table' | 'content';
    count?: number;
    label: string;
    type?: string;
}>(), {
    variant: 'content',
    count: 4,
    type: 'heading, paragraph',
});
</script>
