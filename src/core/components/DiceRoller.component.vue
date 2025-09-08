<template>
  <div class="dice-roller">
    <v-card class="pa-4">
      <v-card-title class="text-h5 mb-4">
        🎲 RPG Dice Roller
      </v-card-title>
      
      <!-- Quick Dice Buttons -->
      <div class="mb-4">
        <v-card-subtitle class="px-0">Quick Roll</v-card-subtitle>
        <div class="d-flex flex-wrap gap-2">
          <v-btn
            v-for="(notation, label) in COMMON_DICE"
            :key="label"
            variant="outlined"
            size="small"
            @click="quickRoll(notation)"
            :color="getDiceColor(notation)"
          >
            {{ label }}
          </v-btn>
        </div>
      </div>

      <!-- Custom Dice Input -->
      <div class="mb-4">
        <v-card-subtitle class="px-0">Custom Roll</v-card-subtitle>
        <div class="d-flex gap-2 align-center">
          <v-text-field
            v-model="customDice"
            label="Dice Notation (e.g., 2d6+3)"
            placeholder="1d20"
            variant="outlined"
            density="compact"
            class="flex-grow-1"
            @keyup.enter="rollCustomDice"
          />
          <v-btn
            @click="rollCustomDice"
            color="primary"
            :disabled="!customDice"
          >
            Roll
          </v-btn>
        </div>
      </div>

      <!-- Results Display -->
      <div v-if="rollHistory.length > 0" class="mb-4">
        <v-card-subtitle class="px-0">Roll History</v-card-subtitle>
        <div class="roll-history">
          <div
            v-for="(roll, index) in rollHistory"
            :key="index"
            class="roll-result pa-2 mb-2 rounded"
            :class="getRollResultClass(roll)"
          >
            <div class="d-flex justify-space-between align-center">
              <span class="text-body-1">{{ formatDiceRoll(roll) }}</span>
              <v-btn
                icon="mdi-delete"
                size="small"
                variant="text"
                @click="removeRoll(index)"
                color="error"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Clear Button -->
      <div v-if="rollHistory.length > 0" class="text-center">
        <v-btn
          @click="clearHistory"
          variant="outlined"
          color="error"
          size="small"
        >
          Clear History
        </v-btn>
      </div>
    </v-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import {
  rollDiceNotation,
  formatDiceRoll,
  COMMON_DICE,
  type DiceRoll,
  type DiceRollOptions
} from 'core/utils/dice.utils';

// Reactive data
const customDice = ref('1d20');
const modifier = ref(0);
const rollHistory = ref<DiceRoll[]>([]);
const rollOptions = ref<DiceRollOptions>({
    advantage: false,
    disadvantage: false,    
    modifier: 0,
    criticalRange: 10,
    fumbleRange: 91
})

// Computed properties
const totalModifier = computed(() => modifier.value || 0);

// Methods
function quickRoll(notation: string) {
  try {
    const roll = rollDiceNotation(notation, { ...rollOptions.value, ...{ modifier: totalModifier.value } });
    addRollToHistory(roll);
  } catch (error) {
    console.error('Invalid dice notation:', error);
  }
}

function rollCustomDice() {
  if (!customDice.value.trim()) return;
  
  try {
    const roll = rollDiceNotation(customDice.value, { ...rollOptions.value, ...{ modifier: totalModifier.value } });
    addRollToHistory(roll);
  } catch (error) {
    console.error('Invalid dice notation:', error);
  }
}

function addRollToHistory(roll: DiceRoll) {
  rollHistory.value.unshift(roll);
  // Keep only last 10 rolls
  if (rollHistory.value.length > 10) {
    rollHistory.value = rollHistory.value.slice(0, 10);
  }
}

function removeRoll(index: number) {
  rollHistory.value.splice(index, 1);
}

function clearHistory() {
  rollHistory.value = [];
}

function getDiceColor(notation: string): string {
  const diceColors: Record<string, string> = {
    '1d4': 'purple',
    '1d6': 'blue',
    '1d8': 'green',
    '1d10': 'orange',
    '1d12': 'red',
    '1d20': 'indigo',
    '1d100': 'brown'
  };
  
  return diceColors[notation] || 'primary';
}

function getRollResultClass(roll: DiceRoll): string {
  if (roll.critical) return 'bg-grey-darken-4 border-success';
  if (roll.fumble) return 'bg-grey-darken-4 border-error';
  return 'bg-grey-darken-4';
}
</script>

<style scoped>
.dice-roller {
  max-width: 600px;
  margin: 0 auto;
}

.roll-history {
  max-height: 300px;
  overflow-y: auto;
}

.roll-result {
  border: 1px solid #e0e0e0;
  background-color: rgba(var(--v-theme-on-surface), var(--v-high-emphasis-opacity));
}

.border-success {
  border-color: #4caf50 !important;
}

.border-error {
  border-color: #f44336 !important;
}

.gap-2 {
  gap: 8px;
}
</style>
