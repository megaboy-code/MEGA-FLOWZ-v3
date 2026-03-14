// ================================================================
// 🎨 DRAWING TOOLS - Freehand Group
// ================================================================

import { LineToolBrush, LineToolHighlighter } from 'lightweight-charts-line-tools-freehand';

export const FREEHAND_TOOLS = {
  Brush:       LineToolBrush,
  Highlighter: LineToolHighlighter,
};

export type FreehandToolKey = keyof typeof FREEHAND_TOOLS;
export const FREEHAND_TOOL_NAMES = Object.keys(FREEHAND_TOOLS) as FreehandToolKey[];