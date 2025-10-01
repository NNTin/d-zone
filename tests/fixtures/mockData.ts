/**
 * Mock data fixtures for testing
 * Centralized location for all test data
 */

export const mockUser = {
  id: 'user-123',
  username: 'testuser',
  roleColor: '#FF5733',
  presence: 'online' as const,
  position: { x: 0, y: 0, z: 0 },
  uid: 'discord-user-123'
};

export const mockActor = {
  uid: 'actor-456',
  username: 'testactor',
  x: 5,
  y: 5,
  z: 0,
  roleColor: '#33FF57',
  presence: 'online' as const,
  talking: false,
  facing: 'north' as const
};

export const mockMessage = {
  id: 'msg-789',
  content: 'Hello, world!',
  channel: 'general',
  user: mockUser,
  timestamp: Date.now()
};

export const mockGameState = {
  ticks: 1000,
  players: [mockUser],
  actors: [mockActor],
  world: {
    width: 100,
    height: 100,
    tiles: []
  }
};

export const mockWebSocketMessage = {
  type: 'user_message',
  data: mockMessage
};

export const mockApiResponse = {
  success: true,
  data: mockGameState,
  error: null
};