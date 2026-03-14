// ================================================================
// 🎨 DRAWING TOOLS - Shapes Group
// ================================================================

// @ts-ignore
import { LineToolRectangle } from 'lightweight-charts-line-tools-rectangle';
// @ts-ignore
import { LineToolCircle } from 'lightweight-charts-line-tools-circle';
import { LineToolTriangle } from 'lightweight-charts-line-tools-triangle';

export const SHAPE_TOOLS = {
  Rectangle: LineToolRectangle,
  Circle:    LineToolCircle,
  Triangle:  LineToolTriangle,
};

export type ShapeToolKey = keyof typeof SHAPE_TOOLS;
export const SHAPE_TOOL_NAMES = Object.keys(SHAPE_TOOLS) as ShapeToolKey[];