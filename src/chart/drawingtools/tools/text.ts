// ================================================================
// 🎨 DRAWING TOOLS - Text Group
// ================================================================

import { LineToolText } from 'lightweight-charts-line-tools-text';

export const TEXT_TOOLS = {
  Text: LineToolText,
};

export type TextToolKey = keyof typeof TEXT_TOOLS;
export const TEXT_TOOL_NAMES = Object.keys(TEXT_TOOLS) as TextToolKey[];