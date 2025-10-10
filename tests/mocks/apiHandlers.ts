/**
 * MSW (Mock Service Worker) handlers for API mocking
 * Used primarily in E2E tests
 */

import { http, HttpResponse } from 'msw';
import { mockApiResponse } from '../fixtures/mockData.js';

export const apiHandlers = [
  // Mock Discord OAuth endpoint
  http.get('/auth/discord', () => {
    return HttpResponse.json({
      success: true,
      redirectUrl: 'https://discord.com/oauth2/authorize?client_id=test&response_type=code'
    });
  }),

  // Mock game state endpoint
  http.get('/api/game/state', () => {
    return HttpResponse.json(mockApiResponse);
  }),

  // Mock user presence update
  http.post('/api/user/presence', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({
      success: true,
      data: { ...body, timestamp: Date.now() }
    });
  }),

  // Mock actor position update
  http.post('/api/actor/move', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({
      success: true,
      data: { ...body, timestamp: Date.now() }
    });
  }),

  // Mock error scenario for critical tests
  http.get('/api/critical/endpoint', () => {
    return HttpResponse.json(
      { error: 'Service temporarily unavailable' },
      { status: 503 }
    );
  }),
];

export const wsHandlers = [
  // WebSocket connection mock would go here
  // This is a placeholder for WebSocket mocking setup
];