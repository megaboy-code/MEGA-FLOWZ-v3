// ================================================================
// 🎨 DRAWING TOOLS - Advanced Group
// ================================================================

import { LineToolParallelChannel } from 'lightweight-charts-line-tools-parallel-channel';
import { LineToolFibRetracement } from 'lightweight-charts-line-tools-fib-retracement';
import { LineToolPriceRange } from 'lightweight-charts-line-tools-price-range';
import { LineToolPath } from 'lightweight-charts-line-tools-path';

export const ADVANCED_TOOLS = {
  ParallelChannel: LineToolParallelChannel,
  FibRetracement:  LineToolFibRetracement,
  PriceRange:      LineToolPriceRange,
  Path:            LineToolPath,
};

export type AdvancedToolKey = keyof typeof ADVANCED_TOOLS;
export const ADVANCED_TOOL_NAMES = Object.keys(ADVANCED_TOOLS) as AdvancedToolKey[];