/**
 * Mock Export Hub
 * 
 * This module serves as the central export point for all E2E test mocks,
 * providing a clean API for importing mock functionality across test files.
 * 
 * The mocks are organized thematically:
 * - Actor mocks: Interface definitions and actor generation utilities
 * - WebSocket mocks: WebSocket communication simulation
 * - World mocks: World generation and configuration
 */

// Export all actor-related functionality
export {
    generateCustomMockActors,
    generateDefaultMockActors,
    getMockActorPositioningScript,
    type MockActor, type MockActorPosition,
    type MockActorPositioning, type MockServerConfig
} from './actorMock.js';

// Export all WebSocket-related functionality  
export {
    getMockWebSocketScript,
    getMockWebSocketScriptWithActors
} from './websocketMock.js';

// Export all world generation functionality
export {
    MOCK_WORLDS, getMockWorldGenerationScript, type MockWorldConfig
} from './worldGenerationMock.js';
