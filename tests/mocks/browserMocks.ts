/**
 * Vitest mock setup for unit tests
 */

import { vi } from 'vitest';

// Mock Canvas API for browser environment simulation
export const mockCanvas = {
  getContext: vi.fn(() => ({
    fillRect: vi.fn(),
    drawImage: vi.fn(),
    getImageData: vi.fn(),
    putImageData: vi.fn(),
    clearRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    rotate: vi.fn(),
  })),
  width: 800,
  height: 600,
  toDataURL: vi.fn(() => 'data:image/png;base64,mock'),
};

// Mock WebSocket for unit tests
export const mockWebSocket = {
  send: vi.fn(),
  close: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  readyState: 1, // OPEN
};

// Mock local storage
export const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

// Mock DOM elements
export const mockElement = {
  appendChild: vi.fn(),
  removeChild: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  getAttribute: vi.fn(),
  setAttribute: vi.fn(),
  getBoundingClientRect: vi.fn(() => ({
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    top: 0,
    left: 0,
    bottom: 100,
    right: 100,
  })),
};

// Setup global mocks
export function setupGlobalMocks() {
  // Mock HTMLCanvasElement
  global.HTMLCanvasElement = vi.fn(() => mockCanvas) as any;
  
  // Mock WebSocket
  global.WebSocket = vi.fn(() => mockWebSocket) as any;
  
  // Mock localStorage
  global.localStorage = mockLocalStorage as any;
  
  // Mock window.requestAnimationFrame
  global.requestAnimationFrame = vi.fn((cb) => setTimeout(cb, 16));
  global.cancelAnimationFrame = vi.fn();
}