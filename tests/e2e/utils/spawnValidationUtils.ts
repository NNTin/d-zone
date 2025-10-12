/**
 * @file Spawn validation utilities for E2E tests
 * @description Reusable validation functions for actor spawning and world coordinate testing
 */

import { expect } from '@playwright/test';
import type { CanvasGameTestUtils, GameLogEvent } from './canvasTestUtils.js';

/**
 * Interface for world generation data
 */
export interface WorldGenData {
  spawnablePositions: number;
  mapBounds: MapBounds;
  worldRadius: number;
  totalTiles: number;
  spawnPositions?: string[];
}

/**
 * Interface for map bounds
 */
export interface MapBounds {
  xl: number;
  xh: number;
  yl: number;
  yh: number;
}

/**
 * Interface for spawn analysis data
 */
export interface SpawnAnalysisData {
  totalPositions: number;
  validSpawnPositions: number;
  invalidSpawnPositions: number;
  validPositions: string[];
  invalidPositions: string[];
}

/**
 * Interface for actor spawn coordinates
 */
export interface ActorCoordinates {
  uid: string;
  username: string;
  x: number;
  y: number;
  z: number;
}

/**
 * Get spawn analysis logs from game utils
 * Will search in both 'world' category and all logs if not found
 */
export function getSpawnAnalysisLogs(gameUtils: CanvasGameTestUtils): GameLogEvent[] {
  const allWorldLogs = gameUtils.getLogsByCategory('world');
  const spawnAnalysisLogs = allWorldLogs.filter(log => log.event === 'spawn_analysis');
  
  if (spawnAnalysisLogs.length === 0) {
    // Try checking all logs for the spawn analysis data
    const allLogs = gameUtils.getAllLogs();
    const anySpawnLogs = allLogs.filter(log => log.event === 'spawn_analysis');
    
    if (anySpawnLogs.length > 0) {
      return anySpawnLogs;
    }
  }
  
  return spawnAnalysisLogs;
}

/**
 * Extract spawn analysis data from logs
 */
export function extractSpawnAnalysisData(logs: GameLogEvent[]): SpawnAnalysisData | null {
  if (logs.length === 0) {
    return null;
  }
  
  return logs[0].data as SpawnAnalysisData;
}

/**
 * Get the most recent spawn analysis data (useful after server switches)
 */
export function getLatestSpawnAnalysisData(gameUtils: CanvasGameTestUtils): SpawnAnalysisData | null {
  const logs = getSpawnAnalysisLogs(gameUtils);
  
  if (logs.length === 0) {
    return null;
  }
  
  // Return the most recent analysis
  return logs[logs.length - 1].data as SpawnAnalysisData;
}

/**
 * Validate world bounds are reasonable
 */
export function validateWorldBounds(mapBounds: MapBounds, worldRadius: number): void {
  expect(mapBounds.xl).toBeLessThanOrEqual(mapBounds.xh);
  expect(mapBounds.yl).toBeLessThanOrEqual(mapBounds.yh);
  expect(Math.abs(mapBounds.xl)).toBeLessThanOrEqual(worldRadius);
  expect(Math.abs(mapBounds.xh)).toBeLessThanOrEqual(worldRadius);
  expect(Math.abs(mapBounds.yl)).toBeLessThanOrEqual(worldRadius);
  expect(Math.abs(mapBounds.yh)).toBeLessThanOrEqual(worldRadius);
}

/**
 * Validate world bounds are valid integers
 */
export function validateWorldBoundsAreIntegers(mapBounds: MapBounds): void {
  expect(Number.isInteger(mapBounds.xl)).toBe(true);
  expect(Number.isInteger(mapBounds.xh)).toBe(true);
  expect(Number.isInteger(mapBounds.yl)).toBe(true);
  expect(Number.isInteger(mapBounds.yh)).toBe(true);
}

/**
 * Validate position string format (e.g., "5:3" or "-2:7")
 */
export function validatePositionStringFormat(position: string): void {
  expect(typeof position).toBe('string');
  expect(position).toMatch(/^-?\d+:-?\d+$/); // Format: "x:y" where x,y are integers
  
  const [x, y] = position.split(':').map(Number);
  expect(Number.isInteger(x)).toBe(true);
  expect(Number.isInteger(y)).toBe(true);
}

/**
 * Validate that a position is not the beacon position (0:0)
 */
export function validateNotBeaconPosition(position: string): void {
  const [x, y] = position.split(':').map(Number);
  expect(!(x === 0 && y === 0)).toBe(true);
}

/**
 * Validate basic coordinate types and finiteness
 */
export function validateBasicCoordinateTypes(coords: ActorCoordinates): void {
  expect(typeof coords.x).toBe('number');
  expect(typeof coords.y).toBe('number');
  expect(typeof coords.z).toBe('number');
  
  expect(Number.isFinite(coords.x)).toBe(true);
  expect(Number.isFinite(coords.y)).toBe(true);
  expect(Number.isFinite(coords.z)).toBe(true);
}

/**
 * Validate coordinates are not NaN
 */
export function validateCoordinatesNotNaN(coords: ActorCoordinates): void {
  expect(Number.isNaN(coords.x)).toBe(false);
  expect(Number.isNaN(coords.y)).toBe(false);
  expect(Number.isNaN(coords.z)).toBe(false);
}

/**
 * Validate X and Y coordinates are integers (grid-based world)
 */
export function validateCoordinatesAreIntegers(coords: ActorCoordinates): void {
  expect(Number.isInteger(coords.x)).toBe(true);
  expect(Number.isInteger(coords.y)).toBe(true);
}

/**
 * Validate coordinates are within world bounds
 */
export function validateCoordinatesWithinBounds(
  coords: ActorCoordinates,
  mapBounds: MapBounds
): void {
  expect(coords.x).toBeGreaterThanOrEqual(mapBounds.xl - 1);
  expect(coords.x).toBeLessThanOrEqual(mapBounds.xh + 1);
  expect(coords.y).toBeGreaterThanOrEqual(mapBounds.yl - 1);
  expect(coords.y).toBeLessThanOrEqual(mapBounds.yh + 1);
}

/**
 * Validate Z coordinate is reasonable
 */
export function validateZCoordinate(z: number, minZ: number = -10, maxZ: number = 10): void {
  expect(z).toBeGreaterThanOrEqual(minZ);
  expect(z).toBeLessThanOrEqual(maxZ);
}

/**
 * Validate actor is not spawned at beacon position
 */
export function validateNotAtBeaconPosition(coords: ActorCoordinates): void {
  expect(!(coords.x === 0 && coords.y === 0)).toBe(true);
}

/**
 * Validate coordinates are not infinity values
 */
export function validateCoordinatesNotInfinity(coords: ActorCoordinates): void {
  expect(coords.x).not.toBe(Infinity);
  expect(coords.x).not.toBe(-Infinity);
  expect(coords.y).not.toBe(Infinity);
  expect(coords.y).not.toBe(-Infinity);
  expect(coords.z).not.toBe(Infinity);
  expect(coords.z).not.toBe(-Infinity);
}

/**
 * Validate coordinates are not extremely large (might indicate calculation errors)
 */
export function validateCoordinatesNotExtreme(
  coords: ActorCoordinates,
  maxXY: number = 1000,
  maxZ: number = 100
): void {
  expect(Math.abs(coords.x)).toBeLessThan(maxXY);
  expect(Math.abs(coords.y)).toBeLessThan(maxXY);
  expect(Math.abs(coords.z)).toBeLessThan(maxZ);
}

/**
 * Validate actor spawned in a valid position according to spawn analysis
 * Throws an error if spawn analysis data is not available
 * Returns true if valid, false if invalid
 */
export function validateActorSpawnedInValidPosition(
  coords: ActorCoordinates,
  validSpawnPositions: string[],
  requireSpawnAnalysis: boolean = true
): boolean {
  if (validSpawnPositions.length === 0) {
    const errorMsg = `No spawn position analysis data available for ${coords.username} at (${coords.x}, ${coords.y}, ${coords.z})`;
    console.log(`❌ ${errorMsg}`);
    
    if (requireSpawnAnalysis) {
      throw new Error(errorMsg);
    }
    
    return true; // Can't validate without data
  }
  
  const actorPosition = `${coords.x}:${coords.y}`;
  const isValidPosition = validSpawnPositions.includes(actorPosition);
  
  if (!isValidPosition) {
    console.log(`❌ Actor ${coords.username} spawned at INVALID position (${coords.x}, ${coords.y}, ${coords.z}) - not in valid spawn list`);
    console.log(`📍 Valid positions sample: ${validSpawnPositions.slice(0, 10).join(', ')}`);
  } else {
    console.log(`✓ Actor ${coords.username} spawned at VALID position (${coords.x}, ${coords.y}, ${coords.z})`);
  }
  
  return isValidPosition;
}

/**
 * Comprehensive validation of actor spawn coordinates
 * Performs all basic validations and returns detailed results
 * @param requireSpawnAnalysis - If true, validation will fail if spawn analysis data is missing
 */
export function validateActorSpawnCoordinates(
  coords: ActorCoordinates,
  mapBounds: MapBounds,
  validSpawnPositions: string[] = [],
  requireSpawnAnalysis: boolean = true
): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  try {
    validateBasicCoordinateTypes(coords);
  } catch (e) {
    errors.push('Invalid coordinate types');
  }
  
  try {
    validateCoordinatesNotNaN(coords);
  } catch (e) {
    errors.push('Coordinates contain NaN');
  }
  
  try {
    validateCoordinatesAreIntegers(coords);
  } catch (e) {
    errors.push('Coordinates are not integers');
  }
  
  try {
    validateCoordinatesWithinBounds(coords, mapBounds);
  } catch (e) {
    errors.push('Coordinates outside world bounds');
  }
  
  try {
    validateZCoordinate(coords.z);
  } catch (e) {
    errors.push('Invalid Z coordinate');
  }
  
  try {
    validateNotAtBeaconPosition(coords);
  } catch (e) {
    errors.push('Actor spawned at beacon position (0,0)');
  }
  
  // Check spawn position validation
  if (requireSpawnAnalysis && validSpawnPositions.length === 0) {
    errors.push('No spawn position analysis data available');
  } else if (validSpawnPositions.length > 0) {
    try {
      const isValid = validateActorSpawnedInValidPosition(coords, validSpawnPositions, requireSpawnAnalysis);
      if (!isValid) {
        errors.push('Actor spawned at position not in valid spawn list');
      }
    } catch (e) {
      errors.push('Spawn position validation failed: ' + (e instanceof Error ? e.message : String(e)));
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Get world generation data from game utils
 */
export function getWorldGenerationData(gameUtils: CanvasGameTestUtils): WorldGenData | null {
  const worldGenLogs = gameUtils.getLogsByCategory('world')
    .filter(log => log.event === 'generated');
  
  if (worldGenLogs.length === 0) {
    return null;
  }
  
  return worldGenLogs[0].data as WorldGenData;
}

/**
 * Get actor spawn logs from game utils
 */
export function getActorSpawnLogs(gameUtils: CanvasGameTestUtils): GameLogEvent[] {
  return gameUtils.getLogsByCategory('actor')
    .filter(log => log.event === 'spawned');
}

/**
 * Check for coordinate-related errors in logs
 */
export function findCoordinateErrors(gameUtils: CanvasGameTestUtils): GameLogEvent[] {
  const allLogs = gameUtils.getAllLogs();
  return allLogs.filter((log: GameLogEvent) => 
    log.level === 'error' && 
    (log.data?.hasNaN === true || 
     (typeof log.data === 'object' && 
      log.data !== null && 
      Object.values(log.data).some((value: any) => 
        typeof value === 'number' && (Number.isNaN(value) || !Number.isFinite(value))
      )))
  );
}

/**
 * Validate all spawned actors in the current logs
 * Returns summary of validation results
 * @param requireSpawnAnalysis - If true, validation will fail if spawn analysis data is missing
 */
export function validateAllSpawnedActors(
  gameUtils: CanvasGameTestUtils,
  mapBounds: MapBounds,
  validSpawnPositions: string[] = [],
  requireSpawnAnalysis: boolean = true
): {
  totalActors: number;
  validActors: number;
  invalidActors: number;
  errors: Array<{ actor: string; errors: string[] }>;
} {
  const spawnLogs = getActorSpawnLogs(gameUtils);
  
  let validActors = 0;
  let invalidActors = 0;
  const allErrors: Array<{ actor: string; errors: string[] }> = [];
  
  for (const log of spawnLogs) {
    const coords: ActorCoordinates = {
      uid: log.data.uid,
      username: log.data.username,
      x: log.data.x,
      y: log.data.y,
      z: log.data.z
    };
    
    const result = validateActorSpawnCoordinates(coords, mapBounds, validSpawnPositions, requireSpawnAnalysis);
    
    if (result.valid) {
      validActors++;
    } else {
      invalidActors++;
      allErrors.push({
        actor: coords.username,
        errors: result.errors
      });
    }
  }
  
  return {
    totalActors: spawnLogs.length,
    validActors,
    invalidActors,
    errors: allErrors
  };
}
