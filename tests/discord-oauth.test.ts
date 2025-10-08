import { beforeEach, describe, expect, it, vi } from 'vitest';
import { util } from '../src/websocket-utils';

// Mock localStorage
const mockLocalStorage = {
  storage: {} as Record<string, string>,
  getItem(key: string) { return this.storage[key] || null; },
  setItem(key: string, value: string) { this.storage[key] = value; },
  clear() { this.storage = {}; }
};

describe('Discord OAuth utility functions @normal @active', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    vi.stubGlobal('localStorage', mockLocalStorage);
  });

  it('util.getURLParameter returns correct value @normal @active', () => {
    // Simulate window.location.search
    vi.stubGlobal('location', { search: '?foo=bar&baz=qux' });
    
    expect(util.getURLParameter('foo')).toBe('bar');
    expect(util.getURLParameter('baz')).toBe('qux');
    expect(util.getURLParameter('missing')).toBe(null);
  });

  it('util.getURLParameter handles empty values @normal @active', () => {
    vi.stubGlobal('location', { search: '?empty=&filled=value' });
    
    expect(util.getURLParameter('empty')).toBe(null);
    expect(util.getURLParameter('filled')).toBe('value');
  });

  it('util.getURLParameter handles URL decoding @normal @active', () => {
    vi.stubGlobal('location', { search: '?encoded=hello%20world&special=%26%3D%3F' });
    
    expect(util.getURLParameter('encoded')).toBe('hello world');
    expect(util.getURLParameter('special')).toBe('&=?');
  });
});
