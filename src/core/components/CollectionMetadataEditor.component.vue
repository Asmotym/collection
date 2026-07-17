<template>
    <div>
        <div class="d-flex align-center justify-space-between flex-wrap ga-2 mb-3">
            <span class="text-subtitle-1">{{ t('metadata.title') }}</span>
            <div class="d-flex ga-2">
                <v-btn size="small" variant="tonal" prepend-icon="mdi-link-plus" @click="addUrl">
                    {{ t('metadata.addUrl') }}
                </v-btn>
                <v-btn size="small" variant="tonal" prepend-icon="mdi-text-box-plus" @click="addText">
                    {{ t('metadata.addText') }}
                </v-btn>
            </div>
        </div>

        <p v-if="modelValue.length === 0" class="text-body-2 text-medium-emphasis mb-0">
            {{ t('metadata.emptyEditor') }}
        </p>

        <v-sheet
            v-for="(entry, index) in modelValue"
            :key="index"
            class="pa-3 mb-3"
            border
            rounded
        >
            <div class="d-flex align-center justify-space-between mb-2">
                <span class="text-subtitle-2">{{ t(`metadata.types.${entry.type}`) }}</span>
                <div class="d-flex align-center ga-1">
                    <v-btn
                        icon="mdi-arrow-up"
                        variant="text"
                        size="small"
                        :disabled="index === 0"
                        :aria-label="t('metadata.moveUp')"
                        @click="moveEntry(index, -1)"
                    />
                    <v-btn
                        icon="mdi-arrow-down"
                        variant="text"
                        size="small"
                        :disabled="index === modelValue.length - 1"
                        :aria-label="t('metadata.moveDown')"
                        @click="moveEntry(index, 1)"
                    />
                    <v-btn
                        icon="mdi-delete"
                        color="error"
                        variant="text"
                        size="small"
                        :aria-label="t('metadata.remove')"
                        @click="removeEntry(index)"
                    />
                </div>
            </div>

            <v-tooltip location="top">
                <template #activator="{ props: tooltipProps }">
                    <v-checkbox-btn
                        v-bind="tooltipProps"
                        class="mb-3"
                        color="primary"
                        density="compact"
                        :model-value="entry.showInCards !== false"
                        :label="t('metadata.showInCards')"
                        @update:model-value="updateCardVisibility(index, Boolean($event))"
                    />
                </template>
                {{ t('metadata.showInCardsTooltip') }}
            </v-tooltip>

            <v-row v-if="entry.type === 'url'">
                <v-col cols="12" md="5">
                    <v-text-field
                        :model-value="entry.name"
                        :label="t('metadata.name')"
                        :rules="[requiredRule]"
                        @update:model-value="updateUrlEntry(index, 'name', $event)"
                    />
                </v-col>
                <v-col cols="12" md="7">
                    <v-text-field
                        :model-value="entry.value"
                        :label="t('metadata.url')"
                        :rules="[requiredRule, httpUrlRule]"
                        @update:model-value="updateUrlEntry(index, 'value', $event)"
                    />
                </v-col>
            </v-row>
            <template v-else>
                <v-text-field
                    :model-value="entry.title ?? ''"
                    :label="t('metadata.textTitle')"
                    @update:model-value="updateTextEntry(index, 'title', $event)"
                />
                <v-textarea
                    :model-value="entry.value"
                    :label="t('metadata.text')"
                    :rules="[requiredRule]"
                    rows="3"
                    auto-grow
                    @update:model-value="updateTextEntry(index, 'value', $event)"
                />
            </template>
        </v-sheet>
    </div>
</template>

<script setup lang="ts">
import type { CollectionMetadata } from '../../../shared/types/database.types';
import { useI18n } from 'vue-i18n';

const props = defineProps<{
    modelValue: CollectionMetadata[];
}>();

const emit = defineEmits<{
    'update:modelValue': [value: CollectionMetadata[]];
}>();

const { t } = useI18n();

function requiredRule(value: unknown): true | string {
    return typeof value === 'string' && value.trim() ? true : t('metadata.validation.required');
}

function httpUrlRule(value: unknown): true | string {
    if (typeof value !== 'string' || !value.trim()) {
        return true;
    }

    try {
        const url = new URL(value.trim());
        return url.protocol === 'http:' || url.protocol === 'https:'
            ? true
            : t('metadata.validation.url');
    } catch {
        return t('metadata.validation.url');
    }
}

function addUrl() {
    emit('update:modelValue', [...props.modelValue, { type: 'url', name: '', value: '', showInCards: true }]);
}

function addText() {
    emit('update:modelValue', [...props.modelValue, {
        type: 'text',
        title: '',
        value: '',
        showInCards: true,
    }]);
}

function removeEntry(index: number) {
    emit('update:modelValue', props.modelValue.filter((_, entryIndex) => entryIndex !== index));
}

function moveEntry(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;

    if (targetIndex < 0 || targetIndex >= props.modelValue.length) {
        return;
    }

    const entries = [...props.modelValue];
    [entries[index], entries[targetIndex]] = [entries[targetIndex], entries[index]];
    emit('update:modelValue', entries);
}

function updateCardVisibility(index: number, showInCards: boolean) {
    const entries = [...props.modelValue];
    const entry = entries[index];

    if (entry) {
        entries[index] = { ...entry, showInCards };
        emit('update:modelValue', entries);
    }
}

function updateUrlEntry(index: number, field: 'name' | 'value', value: string) {
    const entries = [...props.modelValue];
    const entry = entries[index];

    if (entry?.type === 'url') {
        entries[index] = { ...entry, [field]: value };
        emit('update:modelValue', entries);
    }
}

function updateTextEntry(index: number, field: 'title' | 'value', value: string) {
    const entries = [...props.modelValue];
    const entry = entries[index];

    if (entry?.type === 'text') {
        entries[index] = { ...entry, [field]: value };
        emit('update:modelValue', entries);
    }
}
</script>
