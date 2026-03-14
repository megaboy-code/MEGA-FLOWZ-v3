// ================================================================
// 🎨 DRAWING TOOLS - Position Group
// ================================================================

import { LineToolLongShortPosition } from 'lightweight-charts-line-tools-long-short-position';

export const POSITION_TOOLS = {
  LongShortPosition: LineToolLongShortPosition,
};

export type PositionToolKey = keyof typeof POSITION_TOOLS;
export const POSITION_TOOL_NAMES = Object.keys(POSITION_TOOLS) as PositionToolKey[];