/**
 * Product Lifecycle Step Types
 * These define the various events that can occur in a product's lifecycle
 */

// System-generated step types
export const SYSTEM_LIFECYCLE_STEPS = {
  discovered: 'discovered',
  tracked: 'tracked',
  price_changed: 'price_changed',
  sustainability_improved: 'sustainability_improved',
  alternative_found: 'alternative_found',
  stock_alert: 'stock_alert',
  certification_added: 'certification_added',
  manufacturer_update: 'manufacturer_update',
} as const;

// User-generated step types (via Telegram bot)
export const USER_LIFECYCLE_STEPS = {
  purchased: 'purchased',
  unboxed: 'unboxed',
  first_use: 'first_use',
  malfunction: 'malfunction',
  repair: 'repair',
  upgrade: 'upgrade',
  modification: 'modification',
  maintenance: 'maintenance',
  cleaning: 'cleaning',
  storage: 'storage',
  gifted: 'gifted',
  sold: 'sold',
  recycled: 'recycled',
  disposed: 'disposed',
  donated: 'donated',
  replaced: 'replaced',
  working_well: 'working_well',
  performance_issue: 'performance_issue',
  wear_and_tear: 'wear_and_tear',
} as const;

// All step types combined
export const LIFECYCLE_STEP_TYPES = {
  ...SYSTEM_LIFECYCLE_STEPS,
  ...USER_LIFECYCLE_STEPS,
} as const;

export type LifecycleStepType = typeof LIFECYCLE_STEP_TYPES[keyof typeof LIFECYCLE_STEP_TYPES];

// Step type categories for UI organization
export const STEP_TYPE_CATEGORIES = {
  acquisition: ['discovered', 'tracked', 'purchased', 'unboxed'] as LifecycleStepType[],
  usage: ['first_use', 'working_well', 'maintenance', 'cleaning'] as LifecycleStepType[],
  issues: ['malfunction', 'performance_issue', 'wear_and_tear'] as LifecycleStepType[],
  improvements: ['repair', 'upgrade', 'modification', 'sustainability_improved'] as LifecycleStepType[],
  monitoring: ['price_changed', 'stock_alert', 'alternative_found', 'certification_added', 'manufacturer_update'] as LifecycleStepType[],
  transitions: ['gifted', 'sold', 'donated', 'storage'] as LifecycleStepType[],
  end_of_life: ['recycled', 'disposed', 'replaced'] as LifecycleStepType[],
} as const;

// Step type display information
export const STEP_TYPE_INFO: Record<LifecycleStepType, {
  label: string;
  description: string;
  icon: string;
  color: string;
  priority: number; // 1-10, higher = more important
}> = {
  // System-generated
  discovered: {
    label: 'Discovered',
    description: 'Product found in system catalog',
    icon: '🔍',
    color: 'blue',
    priority: 3,
  },
  tracked: {
    label: 'Started Tracking',
    description: 'Added to sustainability tracking',
    icon: '📍',
    color: 'green',
    priority: 8,
  },
  price_changed: {
    label: 'Price Changed',
    description: 'Significant price change detected',
    icon: '💰',
    color: 'orange',
    priority: 5,
  },
  sustainability_improved: {
    label: 'Sustainability Improved',
    description: 'Eco-score or certifications updated',
    icon: '🌱',
    color: 'green',
    priority: 9,
  },
  alternative_found: {
    label: 'Better Alternative Found',
    description: 'More sustainable option discovered',
    icon: '🔄',
    color: 'purple',
    priority: 7,
  },
  stock_alert: {
    label: 'Stock Alert',
    description: 'Stock availability changed',
    icon: '📦',
    color: 'blue',
    priority: 4,
  },
  certification_added: {
    label: 'Certification Added',
    description: 'New sustainability certification',
    icon: '🏆',
    color: 'green',
    priority: 8,
  },
  manufacturer_update: {
    label: 'Manufacturer Update',
    description: 'Manufacturer improved practices',
    icon: '🏭',
    color: 'blue',
    priority: 6,
  },

  // User-generated (Telegram bot)
  purchased: {
    label: 'Purchased',
    description: 'Product acquired by user',
    icon: '🛒',
    color: 'green',
    priority: 9,
  },
  unboxed: {
    label: 'Unboxed',
    description: 'Product unboxed and inspected',
    icon: '📦',
    color: 'blue',
    priority: 6,
  },
  first_use: {
    label: 'First Use',
    description: 'Product used for the first time',
    icon: '✨',
    color: 'purple',
    priority: 7,
  },
  malfunction: {
    label: 'Malfunction',
    description: 'Product stopped working properly',
    icon: '⚠️',
    color: 'red',
    priority: 9,
  },
  repair: {
    label: 'Repaired',
    description: 'Product fixed or serviced',
    icon: '🔧',
    color: 'green',
    priority: 8,
  },
  upgrade: {
    label: 'Upgraded',
    description: 'Product enhanced or improved',
    icon: '⬆️',
    color: 'blue',
    priority: 7,
  },
  modification: {
    label: 'Modified',
    description: 'Product customized or altered',
    icon: '🔨',
    color: 'orange',
    priority: 6,
  },
  maintenance: {
    label: 'Maintenance',
    description: 'Regular upkeep performed',
    icon: '🧰',
    color: 'blue',
    priority: 5,
  },
  cleaning: {
    label: 'Cleaned',
    description: 'Product cleaned or maintained',
    icon: '🧽',
    color: 'blue',
    priority: 3,
  },
  storage: {
    label: 'Put in Storage',
    description: 'Product stored away temporarily',
    icon: '📦',
    color: 'gray',
    priority: 4,
  },
  gifted: {
    label: 'Gifted',
    description: 'Product given to someone else',
    icon: '🎁',
    color: 'purple',
    priority: 7,
  },
  sold: {
    label: 'Sold',
    description: 'Product sold to another user',
    icon: '💵',
    color: 'green',
    priority: 8,
  },
  recycled: {
    label: 'Recycled',
    description: 'Product recycled responsibly',
    icon: '♻️',
    color: 'green',
    priority: 9,
  },
  disposed: {
    label: 'Disposed',
    description: 'Product thrown away',
    icon: '🗑️',
    color: 'red',
    priority: 6,
  },
  donated: {
    label: 'Donated',
    description: 'Product donated to charity',
    icon: '❤️',
    color: 'red',
    priority: 8,
  },
  replaced: {
    label: 'Replaced',
    description: 'Product replaced with newer model',
    icon: '🔄',
    color: 'orange',
    priority: 7,
  },
  working_well: {
    label: 'Working Well',
    description: 'Product performing as expected',
    icon: '✅',
    color: 'green',
    priority: 4,
  },
  performance_issue: {
    label: 'Performance Issue',
    description: 'Product not performing optimally',
    icon: '📉',
    color: 'orange',
    priority: 6,
  },
  wear_and_tear: {
    label: 'Wear and Tear',
    description: 'Normal aging and wear observed',
    icon: '⏰',
    color: 'gray',
    priority: 3,
  },
};

// Helper functions
export function getStepTypeInfo(stepType: string) {
  return STEP_TYPE_INFO[stepType as LifecycleStepType] || {
    label: stepType,
    description: 'Custom lifecycle step',
    icon: '📝',
    color: 'gray',
    priority: 5,
  };
}

export function isUserGeneratedStep(stepType: string): boolean {
  return Object.values(USER_LIFECYCLE_STEPS).includes(stepType as any);
}

export function isSystemGeneratedStep(stepType: string): boolean {
  return Object.values(SYSTEM_LIFECYCLE_STEPS).includes(stepType as any);
}

export function getCategoryForStepType(stepType: string): string {
  for (const [category, steps] of Object.entries(STEP_TYPE_CATEGORIES)) {
    if (steps.includes(stepType as LifecycleStepType)) {
      return category;
    }
  }
  return 'other';
}