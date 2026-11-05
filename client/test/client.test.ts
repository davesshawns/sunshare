import { describe, it, expect } from 'vitest';
import { formatAddress, formatXlm, getExplorerTxUrl } from '../src/lib/stellar.ts';

describe('SUNSHARE Frontend Library Suite', () => {
  it('formatAddress shortens 56-character Stellar address', () => {
    const address = 'GABCR7EXAMPLE99999999999999999999999999999999999999999999WXYZ';
    const formatted = formatAddress(address);
    expect(formatted).toBe('GABC...WXYZ');
  });

  it('formatAddress handles empty or short addresses', () => {
    expect(formatAddress(null)).toBe('');
    expect(formatAddress('')).toBe('');
    expect(formatAddress('GSHORT')).toBe('GSHORT');
  });

  it('formatXlm formats amounts with fixed decimals', () => {
    expect(formatXlm(15)).toBe('15.00 XLM');
    expect(formatXlm('24.5')).toBe('24.50 XLM');
    expect(formatXlm(0.1234)).toBe('0.1234 XLM');
    expect(formatXlm(null)).toBe('0.00 XLM');
  });

  it('getExplorerTxUrl returns Stellar.Expert testnet tx URL', () => {
    const hash = 'a1b2c3d4e5f6';
    const url = getExplorerTxUrl(hash);
    expect(url).toBe('https://stellar.expert/explorer/testnet/tx/a1b2c3d4e5f6');
  });
});
