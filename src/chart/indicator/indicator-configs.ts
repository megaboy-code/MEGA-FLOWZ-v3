// ================================================================
// 📊 INDICATOR UI CONFIGURATIONS 
// ================================================================

export type FieldType = 'number' | 'select' | 'checkbox' | 'color';

export interface IndicatorFieldConfig {
  key:          string;
  label:        string;
  type:         FieldType;
  defaultValue: any;
  options?:     string[] | { min: number; max: number; step: number };
  validation?:  {
    min?:      number;
    max?:      number;
    required?: boolean;
  };
}

export interface IndicatorUIConfig {
  name:   string;
  fields: IndicatorFieldConfig[];
}

// ==================== BASE FIELDS (shared by all indicators) ====================

const BASE_FIELDS: IndicatorFieldConfig[] = [
  {
    key:          'lineWidth',
    label:        'Line Width',
    type:         'number',
    defaultValue: 2,
    options:      { min: 1, max: 5, step: 1 },
    validation:   { min: 1, max: 5 }
  },
  {
    key:          'priceLineVisible',
    label:        'Price Line',
    type:         'checkbox',
    defaultValue: true
  },
  {
    key:          'lastValueVisible',
    label:        'Last Value Label',
    type:         'checkbox',
    defaultValue: true
  },
  {
    key:          'crosshairMarkerVisible',
    label:        'Crosshair Marker',
    type:         'checkbox',
    defaultValue: true
  }
];

// ==================== INDICATOR CONFIGS ====================

export const INDICATOR_CONFIGS: Record<string, IndicatorUIConfig> = {
  'SMA': {
    name: 'Simple Moving Average',
    fields: [
      {
        key:          'period',
        label:        'Period',
        type:         'number',
        defaultValue: 20,
        options:      { min: 1, max: 200, step: 1 },
        validation:   { min: 1, max: 200, required: true }
      },
      {
        key:          'source',
        label:        'Source',
        type:         'select',
        defaultValue: 'close',
        options:      ['close', 'open', 'high', 'low', 'hl2', 'hlc3', 'ohlc4']
      },
      ...BASE_FIELDS
    ]
  },

  'EMA': {
    name: 'Exponential Moving Average',
    fields: [
      {
        key:          'period',
        label:        'Period',
        type:         'number',
        defaultValue: 20,
        options:      { min: 1, max: 200, step: 1 },
        validation:   { min: 1, max: 200, required: true }
      },
      {
        key:          'source',
        label:        'Source',
        type:         'select',
        defaultValue: 'close',
        options:      ['close', 'open', 'high', 'low', 'hl2', 'hlc3', 'ohlc4']
      },
      ...BASE_FIELDS
    ]
  },

  'RSI': {
    name: 'Relative Strength Index',
    fields: [
      {
        key:          'period',
        label:        'Period',
        type:         'number',
        defaultValue: 14,
        options:      { min: 2, max: 100, step: 1 },
        validation:   { min: 2, max: 100, required: true }
      },
      {
        key:          'source',
        label:        'Source',
        type:         'select',
        defaultValue: 'close',
        options:      ['close', 'open', 'high', 'low']
      },
      {
        key:          'overbought',
        label:        'Overbought Level',
        type:         'number',
        defaultValue: 70,
        options:      { min: 50, max: 100, step: 1 },
        validation:   { min: 50, max: 100 }
      },
      {
        key:          'oversold',
        label:        'Oversold Level',
        type:         'number',
        defaultValue: 30,
        options:      { min: 0, max: 50, step: 1 },
        validation:   { min: 0, max: 50 }
      },
      ...BASE_FIELDS
    ]
  }

  // ==================== FUTURE INDICATORS ====================
  // 'MACD': {
  //   name: 'MACD',
  //   fields: [
  //     { key: 'fastPeriod',   label: 'Fast Period',   type: 'number', defaultValue: 12 },
  //     { key: 'slowPeriod',   label: 'Slow Period',   type: 'number', defaultValue: 26 },
  //     { key: 'signalPeriod', label: 'Signal Period', type: 'number', defaultValue: 9  },
  //     ...BASE_FIELDS
  //   ]
  // },
  // 'BOLLINGER': {
  //   name: 'Bollinger Bands',
  //   fields: [
  //     { key: 'period',     label: 'Period',          type: 'number', defaultValue: 20  },
  //     { key: 'stdDev',     label: 'Std Deviation',   type: 'number', defaultValue: 2   },
  //     { key: 'source',     label: 'Source',          type: 'select', defaultValue: 'close', options: ['close', 'open', 'high', 'low'] },
  //     ...BASE_FIELDS
  //   ]
  // },
  // 'STOCHASTIC': {
  //   name: 'Stochastic',
  //   fields: [
  //     { key: 'kPeriod',    label: 'K Period',        type: 'number', defaultValue: 14  },
  //     { key: 'dPeriod',    label: 'D Period',        type: 'number', defaultValue: 3   },
  //     { key: 'smoothing',  label: 'Smoothing',       type: 'number', defaultValue: 3   },
  //     ...BASE_FIELDS
  //   ]
  // }
};

// ==================== HELPER FUNCTIONS ====================

export function getIndicatorConfig(indicatorType: string): IndicatorUIConfig | null {
  return INDICATOR_CONFIGS[indicatorType] || null;
}

export function getDefaultSettings(indicatorType: string): Record<string, any> {
  const config = getIndicatorConfig(indicatorType);
  if (!config) return {};

  const defaults: Record<string, any> = {};
  config.fields.forEach(field => {
    defaults[field.key] = field.defaultValue;
  });

  return defaults;
}

export function validateField(
  field: IndicatorFieldConfig,
  value: any
): { valid: boolean; error?: string } {
  if (!field.validation) return { valid: true };

  const validation = field.validation;

  if (validation.required && (value === null || value === undefined || value === '')) {
    return { valid: false, error: `${field.label} is required` };
  }

  if (field.type === 'number') {
    const numValue = Number(value);

    if (isNaN(numValue)) {
      return { valid: false, error: `${field.label} must be a number` };
    }

    if (validation.min !== undefined && numValue < validation.min) {
      return { valid: false, error: `${field.label} must be >= ${validation.min}` };
    }

    if (validation.max !== undefined && numValue > validation.max) {
      return { valid: false, error: `${field.label} must be <= ${validation.max}` };
    }
  }

  return { valid: true };
}