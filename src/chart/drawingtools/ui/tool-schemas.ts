// ================================================================
// 🎨 TOOL PROPERTY SCHEMAS - Defines UI for each tool type
// ================================================================

import { LineStyle } from 'lightweight-charts';

// ==================== SCHEMA TYPES ====================

export type PropertyType = 
  | 'color'
  | 'number'
  | 'range'
  | 'select'
  | 'checkbox'
  | 'text'
  | 'textarea'
  | 'levelArray';

export interface PropertyField {
  key: string;
  label: string;
  type: PropertyType;
  defaultValue?: any;
  min?: number;
  max?: number;
  step?: number;
  options?: Array<{ value: any; label: string }>;
  description?: string;
  section?: string;
}

export interface ToolSchema {
  toolType: string;
  displayName: string;
  icon?: string;
  properties: PropertyField[];
}

// ==================== COMMON PROPERTIES ====================

const commonLineProperties: PropertyField[] = [
  {
    key: 'line.color',
    label: 'Line Color',
    type: 'color',
    defaultValue: '#2962ff',
    section: 'Line Style'
  },
  {
    key: 'line.width',
    label: 'Line Width',
    type: 'range',
    min: 1,
    max: 10,
    step: 1,
    defaultValue: 2,
    section: 'Line Style'
  },
  {
    key: 'line.style',
    label: 'Line Style',
    type: 'select',
    options: [
      { value: LineStyle.Solid, label: 'Solid' },
      { value: LineStyle.Dashed, label: 'Dashed' },
      { value: LineStyle.Dotted, label: 'Dotted' },
      { value: LineStyle.LargeDashed, label: 'Large Dashed' },
      { value: LineStyle.SparseDotted, label: 'Sparse Dotted' }
    ],
    defaultValue: LineStyle.Solid,
    section: 'Line Style'
  }
];

const commonVisibilityProperties: PropertyField[] = [
  {
    key: 'visible',
    label: 'Visible',
    type: 'checkbox',
    defaultValue: true,
    section: 'Visibility'
  },
  {
    key: 'showPriceAxisLabels',
    label: 'Show Price Labels',
    type: 'checkbox',
    defaultValue: true,
    section: 'Visibility'
  }
];

const commonExtendProperties: PropertyField[] = [
  {
    key: 'line.extend.left',
    label: 'Extend Left',
    type: 'checkbox',
    defaultValue: false,
    section: 'Extension'
  },
  {
    key: 'line.extend.right',
    label: 'Extend Right',
    type: 'checkbox',
    defaultValue: false,
    section: 'Extension'
  }
];

const commonTextProperties: PropertyField[] = [
  {
    key: 'text.value',
    label: 'Text Content',
    type: 'textarea',
    defaultValue: '',
    section: 'Text'
  },
  {
    key: 'text.font.size',
    label: 'Font Size',
    type: 'range',
    min: 8,
    max: 48,
    step: 1,
    defaultValue: 12,
    section: 'Text'
  },
  {
    key: 'text.font.color',
    label: 'Text Color',
    type: 'color',
    defaultValue: '#2962ff',
    section: 'Text'
  },
  {
    key: 'text.font.bold',
    label: 'Bold',
    type: 'checkbox',
    defaultValue: false,
    section: 'Text'
  },
  {
    key: 'text.font.italic',
    label: 'Italic',
    type: 'checkbox',
    defaultValue: false,
    section: 'Text'
  }
];

// ==================== TOOL-SPECIFIC SCHEMAS ====================

const trendLineSchema: ToolSchema = {
  toolType: 'TrendLine',
  displayName: 'Trend Line',
  icon: 'chart-line',
  properties: [
    ...commonLineProperties,
    ...commonExtendProperties,
    ...commonTextProperties,
    ...commonVisibilityProperties
  ]
};

const raySchema: ToolSchema = {
  toolType: 'Ray',
  displayName: 'Ray',
  icon: 'arrow-right',
  properties: [
    ...commonLineProperties,
    {
      key: 'line.extend.right',
      label: 'Extend Right',
      type: 'checkbox',
      defaultValue: true,
      section: 'Extension'
    },
    ...commonTextProperties,
    ...commonVisibilityProperties
  ]
};

const arrowSchema: ToolSchema = {
  toolType: 'Arrow',
  displayName: 'Arrow',
  icon: 'arrow-up',
  properties: [
    ...commonLineProperties,
    ...commonExtendProperties,
    ...commonTextProperties,
    ...commonVisibilityProperties
  ]
};

const extendedLineSchema: ToolSchema = {
  toolType: 'ExtendedLine',
  displayName: 'Extended Line',
  icon: 'arrows-alt-h',
  properties: [
    ...commonLineProperties,
    ...commonTextProperties,
    ...commonVisibilityProperties
  ]
};

const horizontalLineSchema: ToolSchema = {
  toolType: 'HorizontalLine',
  displayName: 'Horizontal Line',
  icon: 'minus',
  properties: [
    ...commonLineProperties,
    ...commonTextProperties,
    ...commonVisibilityProperties
  ]
};

const horizontalRaySchema: ToolSchema = {
  toolType: 'HorizontalRay',
  displayName: 'Horizontal Ray',
  icon: 'arrow-right',
  properties: [
    ...commonLineProperties,
    ...commonTextProperties,
    ...commonVisibilityProperties
  ]
};

const verticalLineSchema: ToolSchema = {
  toolType: 'VerticalLine',
  displayName: 'Vertical Line',
  icon: 'grip-lines-vertical',
  properties: [
    ...commonLineProperties,
    ...commonTextProperties,
    ...commonVisibilityProperties
  ]
};

const crossLineSchema: ToolSchema = {
  toolType: 'CrossLine',
  displayName: 'Cross Line',
  icon: 'plus',
  properties: [
    ...commonLineProperties,
    // ❌ NO text properties - CrossLine is pure geometric
    ...commonVisibilityProperties
  ]
};

const calloutSchema: ToolSchema = {
  toolType: 'Callout',
  displayName: 'Callout',
  icon: 'comment',
  properties: [
    {
      key: 'text.value',
      label: 'Text Content',
      type: 'textarea',
      defaultValue: 'this is some text',
      section: 'Text'
    },
    ...commonLineProperties,
    {
      key: 'text.font.size',
      label: 'Font Size',
      type: 'range',
      min: 8,
      max: 32,
      step: 1,
      defaultValue: 14,
      section: 'Text Style'
    },
    {
      key: 'text.font.color',
      label: 'Text Color',
      type: 'color',
      defaultValue: 'rgba(255,255,255,1)',
      section: 'Text Style'
    },
    {
      key: 'text.font.bold',
      label: 'Bold',
      type: 'checkbox',
      defaultValue: false,
      section: 'Text Style'
    },
    {
      key: 'text.font.italic',
      label: 'Italic',
      type: 'checkbox',
      defaultValue: false,
      section: 'Text Style'
    },
    {
      key: 'text.box.border.color',
      label: 'Border Color',
      type: 'color',
      defaultValue: 'rgba(74,144,226,1)',
      section: 'Box Style'
    },
    {
      key: 'text.box.border.width',
      label: 'Border Width',
      type: 'range',
      min: 0,
      max: 5,
      step: 1,
      defaultValue: 1,
      section: 'Box Style'
    },
    {
      key: 'text.box.border.radius',
      label: 'Border Radius',
      type: 'range',
      min: 0,
      max: 30,
      step: 1,
      defaultValue: 20,
      section: 'Box Style'
    },
    {
      key: 'text.box.background.color',
      label: 'Background Color',
      type: 'color',
      defaultValue: 'rgba(19,73,133,1)',
      section: 'Box Style'
    },
    ...commonVisibilityProperties
  ]
};

const rectangleSchema: ToolSchema = {
  toolType: 'Rectangle',
  displayName: 'Rectangle',
  icon: 'square',
  properties: [
    {
      key: 'rectangle.border.color',
      label: 'Border Color',
      type: 'color',
      defaultValue: '#9c27b0',
      section: 'Border'
    },
    {
      key: 'rectangle.border.width',
      label: 'Border Width',
      type: 'range',
      min: 0,
      max: 10,
      step: 1,
      defaultValue: 1,
      section: 'Border'
    },
    {
      key: 'rectangle.border.style',
      label: 'Border Style',
      type: 'select',
      options: [
        { value: LineStyle.Solid, label: 'Solid' },
        { value: LineStyle.Dashed, label: 'Dashed' },
        { value: LineStyle.Dotted, label: 'Dotted' }
      ],
      defaultValue: LineStyle.Solid,
      section: 'Border'
    },
    {
      key: 'rectangle.border.radius',
      label: 'Corner Radius',
      type: 'range',
      min: 0,
      max: 20,
      step: 1,
      defaultValue: 0,
      section: 'Border'
    },
    {
      key: 'rectangle.background.color',
      label: 'Fill Color',
      type: 'color',
      defaultValue: 'rgba(156,39,176,0.2)',
      section: 'Fill'
    },
    {
      key: 'rectangle.extend.left',
      label: 'Extend Left',
      type: 'checkbox',
      defaultValue: false,
      section: 'Extension'
    },
    {
      key: 'rectangle.extend.right',
      label: 'Extend Right',
      type: 'checkbox',
      defaultValue: false,
      section: 'Extension'
    },
    {
      key: 'text.value',
      label: 'Text Content',
      type: 'textarea',
      defaultValue: '',
      section: 'Text'
    },
    {
      key: 'text.font.size',
      label: 'Font Size',
      type: 'range',
      min: 8,
      max: 32,
      step: 1,
      defaultValue: 12,
      section: 'Text'
    },
    {
      key: 'text.font.color',
      label: 'Text Color',
      type: 'color',
      defaultValue: '#FFFFFF',
      section: 'Text'
    },
    ...commonVisibilityProperties
  ]
};

const circleSchema: ToolSchema = {
  toolType: 'Circle',
  displayName: 'Circle',
  icon: 'circle',
  properties: [
    {
      key: 'circle.border.color',
      label: 'Border Color',
      type: 'color',
      defaultValue: '#9c27b0',
      section: 'Border'
    },
    {
      key: 'circle.border.width',
      label: 'Border Width',
      type: 'range',
      min: 0,
      max: 10,
      step: 1,
      defaultValue: 1,
      section: 'Border'
    },
    {
      key: 'circle.border.style',
      label: 'Border Style',
      type: 'select',
      options: [
        { value: LineStyle.Solid, label: 'Solid' },
        { value: LineStyle.Dashed, label: 'Dashed' },
        { value: LineStyle.Dotted, label: 'Dotted' }
      ],
      defaultValue: LineStyle.Solid,
      section: 'Border'
    },
    {
      key: 'circle.background.color',
      label: 'Fill Color',
      type: 'color',
      defaultValue: 'rgba(156,39,176,0.2)',
      section: 'Fill'
    },
    {
      key: 'text.value',
      label: 'Text Content',
      type: 'textarea',
      defaultValue: '',
      section: 'Text'
    },
    {
      key: 'text.font.size',
      label: 'Font Size',
      type: 'range',
      min: 8,
      max: 32,
      step: 1,
      defaultValue: 12,
      section: 'Text'
    },
    {
      key: 'text.font.color',
      label: 'Text Color',
      type: 'color',
      defaultValue: '#FFFFFF',
      section: 'Text'
    },
    ...commonVisibilityProperties
  ]
};

const triangleSchema: ToolSchema = {
  toolType: 'Triangle',
  displayName: 'Triangle',
  icon: 'play',
  properties: [
    {
      key: 'triangle.border.color',
      label: 'Border Color',
      type: 'color',
      defaultValue: '#f57c00',
      section: 'Border'
    },
    {
      key: 'triangle.border.width',
      label: 'Border Width',
      type: 'range',
      min: 0,
      max: 10,
      step: 1,
      defaultValue: 1,
      section: 'Border'
    },
    {
      key: 'triangle.border.style',
      label: 'Border Style',
      type: 'select',
      options: [
        { value: LineStyle.Solid, label: 'Solid' },
        { value: LineStyle.Dashed, label: 'Dashed' },
        { value: LineStyle.Dotted, label: 'Dotted' }
      ],
      defaultValue: LineStyle.Solid,
      section: 'Border'
    },
    {
      key: 'triangle.background.color',
      label: 'Fill Color',
      type: 'color',
      defaultValue: 'rgba(245,123,0,0.2)',
      section: 'Fill'
    },
    // ❌ NO text properties - Triangle is pure geometric
    ...commonVisibilityProperties
  ]
};

const textSchema: ToolSchema = {
  toolType: 'Text',
  displayName: 'Text',
  icon: 'font',
  properties: [
    {
      key: 'text.value',
      label: 'Text Content',
      type: 'textarea',
      defaultValue: 'Text',
      section: 'Text'
    },
    {
      key: 'text.font.size',
      label: 'Font Size',
      type: 'range',
      min: 8,
      max: 48,
      step: 1,
      defaultValue: 12,
      section: 'Text'
    },
    {
      key: 'text.font.color',
      label: 'Text Color',
      type: 'color',
      defaultValue: '#2962ff',
      section: 'Text'
    },
    {
      key: 'text.font.bold',
      label: 'Bold',
      type: 'checkbox',
      defaultValue: false,
      section: 'Text'
    },
    {
      key: 'text.font.italic',
      label: 'Italic',
      type: 'checkbox',
      defaultValue: false,
      section: 'Text'
    },
    ...commonVisibilityProperties
  ]
};

const fibRetracementSchema: ToolSchema = {
  toolType: 'FibRetracement',
  displayName: 'Fibonacci Retracement',
  icon: 'chart-area',
  properties: [
    {
      key: 'levels',
      label: 'Fibonacci Levels',
      type: 'levelArray',
      section: 'Levels',
      description: 'Edit individual Fibonacci levels'
    },
    {
      key: 'line.width',
      label: 'Line Width',
      type: 'range',
      min: 1,
      max: 10,
      step: 1,
      defaultValue: 1,
      section: 'Line Style'
    },
    {
      key: 'line.style',
      label: 'Line Style',
      type: 'select',
      options: [
        { value: LineStyle.Solid, label: 'Solid' },
        { value: LineStyle.Dashed, label: 'Dashed' },
        { value: LineStyle.Dotted, label: 'Dotted' }
      ],
      defaultValue: LineStyle.Solid,
      section: 'Line Style'
    },
    // ✅ FIXED: Fibonacci uses 'extend' not 'line.extend'
    {
      key: 'extend.left',
      label: 'Extend Left',
      type: 'checkbox',
      defaultValue: false,
      section: 'Extension'
    },
    {
      key: 'extend.right',
      label: 'Extend Right',
      type: 'checkbox',
      defaultValue: false,
      section: 'Extension'
    },
    ...commonVisibilityProperties
  ]
};

const longShortPositionSchema: ToolSchema = {
  toolType: 'LongShortPosition',
  displayName: 'Long/Short Position',
  icon: 'chart-line',
  properties: [
    // Auto Text Toggle
    {
      key: 'showAutoText',
      label: 'Show Auto Text (R:R Calculation)',
      type: 'checkbox',
      defaultValue: true,
      section: 'Labels'
    },
    
    // Risk Rectangle
    {
      key: 'entryStopLossRectangle.background.color',
      label: 'Risk Zone Fill Color',
      type: 'color',
      defaultValue: 'rgba(255, 0, 0, 0.2)',
      section: 'Risk Zone'
    },
    {
      key: 'entryStopLossRectangle.border.color',
      label: 'Risk Zone Border Color',
      type: 'color',
      defaultValue: 'red',
      section: 'Risk Zone'
    },
    {
      key: 'entryStopLossRectangle.border.width',
      label: 'Risk Zone Border Width',
      type: 'range',
      min: 0,
      max: 10,
      step: 1,
      defaultValue: 1,
      section: 'Risk Zone'
    },
    {
      key: 'entryStopLossRectangle.extend.left',
      label: 'Extend Risk Zone Left',
      type: 'checkbox',
      defaultValue: false,
      section: 'Risk Zone'
    },
    {
      key: 'entryStopLossRectangle.extend.right',
      label: 'Extend Risk Zone Right',
      type: 'checkbox',
      defaultValue: false,
      section: 'Risk Zone'
    },
    
    // Reward Rectangle
    {
      key: 'entryPtRectangle.background.color',
      label: 'Reward Zone Fill Color',
      type: 'color',
      defaultValue: 'rgba(0, 128, 0, 0.2)',
      section: 'Reward Zone'
    },
    {
      key: 'entryPtRectangle.border.color',
      label: 'Reward Zone Border Color',
      type: 'color',
      defaultValue: 'green',
      section: 'Reward Zone'
    },
    {
      key: 'entryPtRectangle.border.width',
      label: 'Reward Zone Border Width',
      type: 'range',
      min: 0,
      max: 10,
      step: 1,
      defaultValue: 1,
      section: 'Reward Zone'
    },
    {
      key: 'entryPtRectangle.extend.left',
      label: 'Extend Reward Zone Left',
      type: 'checkbox',
      defaultValue: false,
      section: 'Reward Zone'
    },
    {
      key: 'entryPtRectangle.extend.right',
      label: 'Extend Reward Zone Right',
      type: 'checkbox',
      defaultValue: false,
      section: 'Reward Zone'
    },
    
    // Risk Text Styling
    {
      key: 'entryStopLossText.value',
      label: 'Risk Zone Custom Note',
      type: 'text',
      defaultValue: '',
      section: 'Risk Text'
    },
    {
      key: 'entryStopLossText.font.size',
      label: 'Risk Text Size',
      type: 'range',
      min: 8,
      max: 32,
      step: 1,
      defaultValue: 12,
      section: 'Risk Text'
    },
    {
      key: 'entryStopLossText.font.color',
      label: 'Risk Text Color',
      type: 'color',
      defaultValue: 'white',
      section: 'Risk Text'
    },
    {
      key: 'entryStopLossText.font.bold',
      label: 'Risk Text Bold',
      type: 'checkbox',
      defaultValue: false,
      section: 'Risk Text'
    },
    
    // Reward Text Styling
    {
      key: 'entryPtText.value',
      label: 'Reward Zone Custom Note',
      type: 'text',
      defaultValue: '',
      section: 'Reward Text'
    },
    {
      key: 'entryPtText.font.size',
      label: 'Reward Text Size',
      type: 'range',
      min: 8,
      max: 32,
      step: 1,
      defaultValue: 12,
      section: 'Reward Text'
    },
    {
      key: 'entryPtText.font.color',
      label: 'Reward Text Color',
      type: 'color',
      defaultValue: 'white',
      section: 'Reward Text'
    },
    {
      key: 'entryPtText.font.bold',
      label: 'Reward Text Bold',
      type: 'checkbox',
      defaultValue: false,
      section: 'Reward Text'
    },
    
    ...commonVisibilityProperties
  ]
};

// ==================== SCHEMA REGISTRY ====================

export const toolSchemas: Record<string, ToolSchema> = {
  'TrendLine': trendLineSchema,
  'Ray': raySchema,
  'Arrow': arrowSchema,
  'ExtendedLine': extendedLineSchema,
  'Rectangle': rectangleSchema,
  'Text': textSchema,
  'Callout': calloutSchema,
  'FibRetracement': fibRetracementSchema,
  'HorizontalLine': horizontalLineSchema,
  'HorizontalRay': horizontalRaySchema,
  'VerticalLine': verticalLineSchema,
  'CrossLine': crossLineSchema,
  'Circle': circleSchema,
  'Triangle': triangleSchema,
  'LongShortPosition': longShortPositionSchema
};

// ==================== HELPER FUNCTIONS ====================

export function getSchemaForTool(toolType: string): ToolSchema | null {
  return toolSchemas[toolType] || null;
}

export function hasSchema(toolType: string): boolean {
  return toolType in toolSchemas;
}

export function getPropertyValue(obj: any, path: string): any {
  const keys = path.split('.');
  let value = obj;
  
  for (const key of keys) {
    if (value && typeof value === 'object' && key in value) {
      value = value[key];
    } else {
      return undefined;
    }
  }
  
  return value;
}

export function setPropertyValue(obj: any, path: string, value: any): void {
  const keys = path.split('.');
  const lastKey = keys.pop();
  
  if (!lastKey) return;
  
  let target = obj;
  for (const key of keys) {
    if (!(key in target) || typeof target[key] !== 'object') {
      target[key] = {};
    }
    target = target[key];
  }
  
  target[lastKey] = value;
}

// ==================== TEMPLATE SYSTEM ====================

const TEMPLATE_STORAGE_KEY = 'drawing_tool_templates';

export interface ToolTemplate {
  toolType: string;
  options: any;
  timestamp: number;
}

export function saveToolTemplate(toolType: string, options: any): void {
  try {
    const templates = loadAllTemplates();
    templates[toolType] = {
      toolType,
      options: JSON.parse(JSON.stringify(options)),
      timestamp: Date.now()
    };
    localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(templates));
    console.log(`✅ Template saved for ${toolType}`);
  } catch (error) {
    console.error('❌ Failed to save template:', error);
  }
}

export function loadToolTemplate(toolType: string): any | null {
  try {
    const templates = loadAllTemplates();
    const template = templates[toolType];
    if (template) {
      console.log(`✅ Template loaded for ${toolType}`);
      return JSON.parse(JSON.stringify(template.options));
    }
    return null;
  } catch (error) {
    console.error('❌ Failed to load template:', error);
    return null;
  }
}

export function loadAllTemplates(): Record<string, ToolTemplate> {
  try {
    const stored = localStorage.getItem(TEMPLATE_STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch (error) {
    console.error('❌ Failed to load templates:', error);
    return {};
  }
}

export function deleteToolTemplate(toolType: string): void {
  try {
    const templates = loadAllTemplates();
    delete templates[toolType];
    localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(templates));
    console.log(`✅ Template deleted for ${toolType}`);
  } catch (error) {
    console.error('❌ Failed to delete template:', error);
  }
}

export function hasTemplate(toolType: string): boolean {
  const templates = loadAllTemplates();
  return toolType in templates;
}

export function getToolDefaults(toolType: string): any {
  const schema = getSchemaForTool(toolType);
  if (!schema) return {};
  
  const defaults: any = {};
  schema.properties.forEach(prop => {
    if (prop.defaultValue !== undefined) {
      setPropertyValue(defaults, prop.key, prop.defaultValue);
    }
  });
  
  return defaults;
}