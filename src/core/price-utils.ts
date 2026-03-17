// ================================================================
// ⚡ PRICE UTILS - Shared price formatting for non-chart modules
// ================================================================

const CRYPTO_SYMBOLS = ['BTC', 'ETH', 'XRP', 'LTC', 'ADA', 'DOT', 'LINK', 'SOL', 'BNB', 'XLM', 'DOGE', 'SHIB'];

const MAJOR_FOREX_PAIRS = [
    'EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD',
    'NZDUSD', 'USDCAD', 'EURGBP', 'EURJPY', 'EURCHF',
    'GBPJPY', 'GBPCHF', 'CHFJPY', 'AUDJPY', 'CADJPY',
    'NZDJPY', 'AUDCAD', 'AUDCHF', 'AUDNZD', 'CADCHF',
    'EURAUD', 'EURCAD', 'EURNZD', 'GBPAUD', 'GBPCAD',
    'GBPNZD', 'NZDCAD', 'NZDCHF'
];

const INDICES = ['US30', 'SPX', 'NAS', 'DJI', 'DAX', 'FTSE', 'NIKKEI', 'JPN', 'CAC', 'HSI'];

// ==================== PRECISION ====================

export function getDecimalPrecision(symbol: string): number {
    if (!symbol) return 5;
    const sym = symbol.toUpperCase().replace('/', '');

    const isCrypto = CRYPTO_SYMBOLS.some(crypto => sym.includes(crypto));

    if (isCrypto) {
        if (sym.endsWith('USD') || sym.endsWith('USDT')) return 2;
        return 8;
    }

    if (MAJOR_FOREX_PAIRS.includes(sym)) return 5;
    if (sym.includes('JPY'))                             return 3;
    if (sym.includes('XAU') || sym.includes('GOLD'))    return 2;
    if (sym.includes('XAG') || sym.includes('SILVER'))  return 3;
    if (INDICES.some(idx => sym.includes(idx)))          return 1;

    return 5;
}

// ==================== PIP SIZE ====================

export function getPipSize(symbol: string): number {
    if (!symbol) return 0.0001;
    const sym = symbol.toUpperCase().replace('/', '');

    const isCrypto = CRYPTO_SYMBOLS.some(crypto => sym.includes(crypto));

    if (isCrypto)                                        return 1;
    if (sym.includes('XAU') || sym.includes('GOLD'))    return 0.1;
    if (sym.includes('XAG') || sym.includes('SILVER'))  return 0.001;
    if (sym.includes('JPY'))                             return 0.01;
    if (INDICES.some(idx => sym.includes(idx)))          return 1;

    return 0.0001; // standard forex
}

// ==================== PIP VALUE ====================
// Dollar value per pip per standard lot

export function getPipValue(symbol: string): number {
    if (!symbol) return 10;
    const sym = symbol.toUpperCase().replace('/', '');

    const isCrypto = CRYPTO_SYMBOLS.some(crypto => sym.includes(crypto));

    if (isCrypto)                                        return 1;
    if (sym.includes('XAU') || sym.includes('GOLD'))    return 1;
    if (sym.includes('XAG') || sym.includes('SILVER'))  return 5;
    if (INDICES.some(idx => sym.includes(idx)))          return 1;

    return 10; // standard forex
}

// ==================== CONTRACT SIZE ====================
// Units per 1 standard lot

export function getContractSize(symbol: string): number {
    if (!symbol) return 100_000;
    const sym = symbol.toUpperCase().replace('/', '');

    const isCrypto = CRYPTO_SYMBOLS.some(crypto => sym.includes(crypto));

    if (isCrypto)                                        return 1;
    if (sym.includes('XAU') || sym.includes('GOLD'))    return 100;
    if (sym.includes('XAG') || sym.includes('SILVER'))  return 5_000;
    if (INDICES.some(idx => sym.includes(idx)))          return 1;

    return 100_000; // standard forex
}

// ==================== FORMAT ====================

export function formatPrice(symbol: string, price: number): string {
    if (!price && price !== 0) return '—';
    return price.toFixed(getDecimalPrecision(symbol));
}