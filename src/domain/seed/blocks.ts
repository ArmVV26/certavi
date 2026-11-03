// Seed optional blocks: ankle rehab (rutina-actual.md §8) and an empty stretching block.
import { SEED_UPDATED_AT, textKey } from '../model/envelope';
import { WEEKDAYS } from '../model/enums';
import type { BlockItem, OptionalBlock } from '../model/block';

export const ANKLE_REHAB_BLOCK_ID = 'block-ankle-rehab';
export const STRETCHING_BLOCK_ID = 'block-stretching';

/** Pain must never go above 3/10. */
export const PAIN_THRESHOLD = 3;

const k = (key: string) => textKey(`blocks.${key}`);

const mobility = (id: string, name: string): BlockItem => ({
  id,
  name: k(`items.${name}`),
  dose: k('doses.twoBy30sPerLeg'),
});

const strength = (id: string, name: string, dose: string): BlockItem => ({
  id,
  name: k(`items.${name}`),
  dose: k(`doses.${dose}`),
  timesPerWeek: '3-5',
});

export const ANKLE_REHAB_BLOCK: OptionalBlock = {
  id: ANKLE_REHAB_BLOCK_ID,
  type: 'block',
  updatedAt: SEED_UPDATED_AT,
  name: k('names.ankleRehab'),
  blockType: 'rehab',
  items: [
    // Daily mobility.
    mobility('foam-roll', 'foamRoll'),
    mobility('wall-ankle', 'wallAnkle'),
    mobility('ankle-sit', 'ankleSit'),
    mobility('band-mobilization', 'bandMobilization'),
    mobility('box-drop', 'boxDrop'),
    // Strength, 3–5 days a week.
    strength('heel-raise', 'heelRaise', 'threeBy10PerLeg'),
    strength('split-heel-raise', 'splitHeelRaise', 'threeBy10PerLeg'),
    strength('pogos', 'pogos', 'threeBy20'),
  ],
  days: [...WEEKDAYS],
  metrics: [
    { id: 'stairs', name: k('metrics.stairs'), min: 0, max: 10, threshold: PAIN_THRESHOLD },
    { id: 'max-pain', name: k('metrics.maxPain'), min: 0, max: 10, threshold: PAIN_THRESHOLD },
    { id: 'pogos', name: k('metrics.pogos'), min: 0, max: 10, threshold: PAIN_THRESHOLD },
  ],
  weeklyMetrics: [
    {
      id: 'wall-test',
      name: k('weeklyMetrics.wallTest'),
      unit: 'cm',
      parts: [
        { id: 'left', name: k('sides.left') },
        { id: 'right', name: k('sides.right') },
      ],
    },
  ],
  active: true,
  custom: false,
};

/** Created empty, to be filled in Phase 7. */
export const STRETCHING_BLOCK: OptionalBlock = {
  id: STRETCHING_BLOCK_ID,
  type: 'block',
  updatedAt: SEED_UPDATED_AT,
  name: k('names.stretching'),
  blockType: 'stretching',
  items: [],
  days: [],
  metrics: [],
  weeklyMetrics: [],
  active: false,
  custom: false,
};

export const SEED_BLOCKS: readonly OptionalBlock[] = [ANKLE_REHAB_BLOCK, STRETCHING_BLOCK];
