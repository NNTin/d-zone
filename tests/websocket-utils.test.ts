/**
 * @file Unit tests for websocket communication logic
 * @tags @normal @active
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createJoinServerMessage, getStartupServer, util, type DiscordAuth, type GameState } from '../src/websocket-utils.js';
import { MockLocalStorage } from './utils/testHelpers.js';

// Create instance of mock localStorage
const mockLocalStorage = new MockLocalStorage();

describe('WebSocket logic @normal @active', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    // Mock window.location.search
    vi.stubGlobal('location', { search: '' });
  });

  it('should create correct joinServer message for non-passworded server @normal @active', () => {
    const gameState: GameState = { 
      servers: { foo: { id: 'foo', passworded: false, name: 'Test Server' } } 
    };
    const discordAuth: DiscordAuth = { 
      isLoggedIn: () => false,
      getUser: () => null 
    };
    
    const message = createJoinServerMessage({ id: 'foo' }, gameState, discordAuth);
    
    expect(message.type).toBe('connect');
    expect(message.data.server).toBe('foo');
    expect(message.data.discordToken).toBeUndefined();
  });

  it('should send Discord OAuth data for passworded server if logged in @normal @active', () => {
    const gameState: GameState = { 
      servers: { bar: { id: 'bar', passworded: true, name: 'Private Server' } } 
    };
    const discordAuth: DiscordAuth = {
      isLoggedIn: () => true,
      accessToken: 'abc123',
      getUser: () => ({ username: 'testuser' })
    };
    
    const message = createJoinServerMessage({ id: 'bar' }, gameState, discordAuth);
    
    expect(message.type).toBe('connect');
    expect(message.data.server).toBe('bar');
    expect(message.data.discordToken).toBe('abc123');
    expect(message.data.discordUser.username).toBe('testuser');
  });

  it('should not send Discord OAuth data for passworded server if not logged in @normal @active', () => {
    const gameState: GameState = { 
      servers: { baz: { id: 'baz', passworded: true, name: 'Private Server' } } 
    };
    const discordAuth: DiscordAuth = {
      isLoggedIn: () => false,
      getUser: () => null
    };
    
    const message = createJoinServerMessage({ id: 'baz' }, gameState, discordAuth);
    
    expect(message.type).toBe('connect');
    expect(message.data.server).toBe('baz');
    expect(message.data.discordToken).toBeUndefined();
    expect(message.data.discordUser).toBeUndefined();
  });
});

describe('Startup server logic @normal @active', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    vi.stubGlobal('localStorage', mockLocalStorage);
  });

  it('should return URL parameter server if available @normal @active', () => {
    vi.stubGlobal('location', { search: '?s=testserver&other=param' });
    
    const server = getStartupServer();
    expect(server.id).toBe('testserver');
  });

  it('should return localStorage server if no URL parameter @normal @active', () => {
    vi.stubGlobal('location', { search: '' });
    mockLocalStorage.setItem('dzone-default-server', JSON.stringify({ id: 'stored-server' }));
    
    const server = getStartupServer();
    expect(server.id).toBe('stored-server');
  });

  it('should return default server if no URL parameter or localStorage @normal @active', () => {
    vi.stubGlobal('location', { search: '' });
    
    const server = getStartupServer();
    expect(server.id).toBe('default');
  });
});

describe('URL utility functions @normal @active', () => {
  it('should extract URL parameters correctly @normal @active', () => {
    // Mock window.location.search
    vi.stubGlobal('location', { search: '?foo=bar&baz=qux&empty=' });
    
    expect(util.getURLParameter('foo')).toBe('bar');
    expect(util.getURLParameter('baz')).toBe('qux');
    expect(util.getURLParameter('empty')).toBe(null);
    expect(util.getURLParameter('missing')).toBe(null);
  });
});