// ================================================================
// 🔧 LEGEND UTILS - Display formatting helpers
// ================================================================

export const SYMBOL_NAMES: Record<string, string> = {
    'EURUSD': 'Euro / US Dollar',
    'GBPUSD': 'British Pound / US Dollar',
    'USDJPY': 'US Dollar / Japanese Yen',
    'AUDUSD': 'Australian Dollar / US Dollar',
    'USDCAD': 'US Dollar / Canadian Dollar',
    'USDCHF': 'US Dollar / Swiss Franc',
    'NZDUSD': 'New Zealand Dollar / US Dollar',
    'XAUUSD': 'Gold / US Dollar',
    'BTCUSD': 'Bitcoin / US Dollar',
    'ETHUSD': 'Ethereum / US Dollar',
    'LTCUSD': 'Litecoin / US Dollar',
    'XRPUSD': 'Ripple / US Dollar',
};

/**
 * Get full display name for a symbol
 */
export function getSymbolName(symbol: string): string {
    return SYMBOL_NAMES[symbol] || symbol;
}

/**
 * Format price with precision
 */
export function formatPrice(price: number | null, precision: number = 5): string {
    if (price === null) return '--';
    return price.toFixed(precision);
}

/**
 * Format volume with K/M suffixes
 */
export function formatVolume(volume: number): string {
    if (volume >= 1000000) return (volume / 1000000).toFixed(2) + 'M';
    if (volume >= 1000)    return (volume / 1000).toFixed(1) + 'K';
    return volume.toFixed(0);
}

/**
 * Safe DOM element removal
 */
export function removeElement(element: HTMLElement | null): void {
    if (element && element.parentNode) {
        element.parentNode.removeChild(element);
    }
}