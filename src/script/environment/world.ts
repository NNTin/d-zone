'use strict';

import { EventEmitter } from 'events';
import { gameLogger } from '../../gameLogger.js';
import BetterCanvas from '../common/bettercanvas.js';
import { geometry } from '../common/geometry.js';
import { util } from '../common/util.js';

// We'll need to convert these dependencies or use dynamic imports
interface Slab {
    grid: string;
    position: { x: number; y: number; z: number };
    style: string;
    border?: boolean;
    height: number;
    addToGame(game: any): void;
    remove(): void;
}

interface Tile {
    screen: { x: number; y: number };
    sprite: {
        image: string;
        metrics: {
            x: number;
            y: number;
            w: number;
            h: number;
            ox?: number;
            oy?: number;
        };
    };
    zDepth: number;
}

interface WorldObject {
    position: { x: number; y: number; z: number };
    height: number;
    unWalkable?: boolean;
}

interface Game {
    world?: World;
    renderer: {
        images: Record<string, HTMLCanvasElement | HTMLImageElement>;
        bgCanvas?: {
            x: number;
            y: number;
            image: HTMLCanvasElement;
        };
    };
    setMaxListeners?(count: number): void;
}

let SlabClass: any;
let TileClass: any;
let TileSheetClass: any;
let PathfinderClass: any;

const testCanvas = new BetterCanvas(200, 100);
let unoccupiedGrids: string[];

export default class World extends EventEmitter {
    game: Game;
    worldSize: number;
    worldRadius: number;
    objects: Record<number, Record<number, Record<number, WorldObject>>> = {};
    map: Record<string, Slab> = {};
    walkable: Record<string, number> = {};
    mapBounds = { xl: 0, yl: 0, xh: 0, yh: 0 };
    staticMap: Tile[] = [];
    islands: Slab[][] = [];
    mainIsland: number = 0;
    tileMap: Record<string, Tile> = {};
    initializationPromise: Promise<void>;
    private debugOverlayRefreshScheduled: boolean = false;

    constructor(game: Game, worldSize: number) {
        super();
        this.game = game;
        this.game.world = this;
        this.worldSize = Math.max(24, Math.floor(worldSize / 2) * 2); // Must be an even number >= 24
        this.worldRadius = Math.floor(this.worldSize / 2);
        
        this.initializationPromise = this.init();
    }

    private async init(): Promise<void> {        
        // Load dependencies dynamically
        try {
            
            const [SlabModule, TileModule, TileSheetModule, PathfinderModule] = await Promise.all([
                import('./slab.js'),
                import('./tile.js'),
                import('./sheet2.js'),
                import('../actors/pathfinder.js')
            ]);

            SlabClass = SlabModule.default;
            TileClass = TileModule.default;
            TileSheetClass = TileSheetModule.default;
            PathfinderClass = PathfinderModule.default;
            
            // Expose classes for E2E testing
            if (typeof window !== 'undefined' && (window as any).__E2E_TEST_MODE) {
                (window as any).__WorldDependencies = {
                    Slab: SlabClass,
                    Tile: TileClass,
                    TileSheet: TileSheetClass,
                    Pathfinder: PathfinderClass,
                    geometry: geometry
                };
                console.log('✅ [E2E] World dependencies exposed');
            }
            
            // Note: generateWorld() is now called explicitly from main.ts after init completes
        } catch (error) {
            gameLogger.error('World: Failed to load world dependencies', {
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined
            });
            // Fall back to simpler world generation or throw error
            throw error;
        }
    }

    generateWorld(): void {
        geometry.generateClosestGrids(this.worldSize);
        
        testCanvas.clear();
        
        const noiseBig = geometry.buildNoiseMap(this.worldRadius / 3 + 1, this.worldRadius / 3 + 1);
        const noiseSmall = geometry.buildNoiseMap(this.worldRadius / 1.5 + 1, this.worldRadius / 1.5 + 1);
        
        const bigBlur = (noiseBig.length - 1) / this.worldSize;
        const smallBlur = (noiseSmall.length - 1) / this.worldSize;
        
        this.mapBounds = { xl: 0, yl: 0, xh: 0, yh: 0 };
        
        for(let tx = 0; tx < this.worldSize; tx++) {
            for(let ty = 0; ty < this.worldSize; ty++) {
                const bigNoiseValue = geometry.getNoiseMapPoint(noiseBig, tx * bigBlur, ty * bigBlur);
                const smallNoiseValue = geometry.getNoiseMapPoint(noiseSmall, tx * smallBlur, ty * smallBlur);
                const noiseValue = (bigNoiseValue + smallNoiseValue * 2) / 3;
                
                const x = (tx - this.worldRadius);
                const y = (ty - this.worldRadius);
                const farness = (this.worldRadius - (Math.abs(x) + Math.abs(y)) / 2) / this.worldRadius;
                
                if(noiseValue / 1.1 < farness) {
                    this.mapBounds.xl = Math.min(x, this.mapBounds.xl);
                    this.mapBounds.yl = Math.min(y, this.mapBounds.yl);
                    this.mapBounds.xh = Math.max(x, this.mapBounds.xh);
                    this.mapBounds.yh = Math.max(y, this.mapBounds.yh);
                    
                    const grid = new SlabClass('grass', x, y, -0.5) as Slab;
                    grid.grid = x + ':' + y;
                    this.map[x + ':' + y] = grid;
                    grid.addToGame(this.game);
                }
            }
        }
        
        gameLogger.info('World: Generated slab tiles', { 
            tileCount: Object.keys(this.map).length 
        });
        this.staticMap = [];
        this.crawlMap(); // Examine map to determine islands, borders, etc
        this.createTiles(); // Create map tiles from grid intersections
        
        this.createBackground();
        
        // Add debug overlay if debug mode is enabled
        if (gameLogger.isDebugMode()) {
            this.createDebugOverlay();
        }
        
        PathfinderClass.loadMap(this.walkable);
        unoccupiedGrids = Object.keys(this.map);
        const beaconIndex = unoccupiedGrids.indexOf('0:0');
        if (beaconIndex > -1) {
            unoccupiedGrids.splice(beaconIndex, 1); // 0,0 is taken by beacon
        }
        
        // Log world generation completion with spawn positions
        gameLogger.worldGenerated({ 
            totalTiles: Object.keys(this.map).length,
            spawnablePositions: unoccupiedGrids.length,
            worldSize: this.worldSize,
            worldRadius: this.worldRadius,
            mapBounds: this.mapBounds,
            mainIslandSize: this.islands[this.mainIsland]?.length || 0,
            totalIslands: this.islands.length,
            spawnPositions: unoccupiedGrids.slice(0, 10) // Log first 10 spawn positions as sample
        });
        
        gameLogger.info('World: Created world', { 
            tileCount: Object.keys(this.map).length 
        });
    }

    private createBackground(): void {
        gameLogger.debug('World: Creating background', { 
            staticMapCount: this.staticMap.length 
        });
        
        let lowestScreenX = 0, lowestScreenY = 0, highestScreenX = 0, highestScreenY = 0;
        
        for(let i = 0; i < this.staticMap.length; i++) {
            const preTile = this.staticMap[i];
            const preScreen = { x: preTile.screen.x, y: preTile.screen.y };
            preScreen.x += preTile.sprite.metrics.ox || 0;
            preScreen.y += preTile.sprite.metrics.oy || 0;
            lowestScreenX = lowestScreenX < preScreen.x ? lowestScreenX : preScreen.x;
            lowestScreenY = lowestScreenY < preScreen.y ? lowestScreenY : preScreen.y;
            highestScreenX = highestScreenX > preScreen.x ? highestScreenX : preScreen.x;
            highestScreenY = highestScreenY > preScreen.y ? highestScreenY : preScreen.y;
        }
        
        gameLogger.debug('World: Calculated screen bounds', {
            lowestScreenX, lowestScreenY, highestScreenX, highestScreenY
        });
        
        const bgCanvas = new BetterCanvas(
            (highestScreenX - lowestScreenX) + 32 + 1,
            (highestScreenY - lowestScreenY) + 32 + 9
        );
        
        let tilesDrawn = 0;
        for(let j = 0; j < this.staticMap.length; j++) {
            const tile = this.staticMap[j];
            const screen = { x: tile.screen.x, y: tile.screen.y };
            
            // Debug: Log tile data for the first few tiles or any with NaN values
            const hasNaN = !isFinite(tile.screen.x) || !isFinite(tile.screen.y) || 
                          !isFinite(tile.sprite.metrics.ox || 0) || !isFinite(tile.sprite.metrics.oy || 0);
            
            if (j < 3 || hasNaN) {
                gameLogger.debug('World: Background tile data', {
                    tileIndex: j,
                    tileScreen: tile.screen,
                    spriteMetrics: tile.sprite.metrics,
                    screenBeforeOffset: { x: screen.x, y: screen.y },
                    hasNaN: hasNaN
                });
            }
            
            screen.x += tile.sprite.metrics.ox || 0;
            screen.y += tile.sprite.metrics.oy || 0;
            screen.x -= lowestScreenX;
            screen.y -= lowestScreenY;
            
            // Check for NaN after calculations
            if (!isFinite(screen.x) || !isFinite(screen.y)) {
                gameLogger.error('World: NaN detected in background tile', {
                    tileIndex: j,
                    originalScreen: { x: tile.screen.x, y: tile.screen.y },
                    spriteOffsetX: tile.sprite.metrics.ox,
                    spriteOffsetY: tile.sprite.metrics.oy,
                    lowestScreenX: lowestScreenX,
                    lowestScreenY: lowestScreenY,
                    finalScreen: screen
                });
                continue; // Skip this tile
            }
            
            const tileImage = this.game.renderer.images[tile.sprite.image];
            if (!tileImage) {
                gameLogger.error('World: Missing image for background tile', {
                    tileImage: tile.sprite.image,
                    tileIndex: j
                });
                continue;
            }
            
            bgCanvas.drawImage(
                tileImage,
                tile.sprite.metrics.x, tile.sprite.metrics.y,
                tile.sprite.metrics.w, tile.sprite.metrics.h,
                Math.round(screen.x), Math.round(screen.y),
                tile.sprite.metrics.w, tile.sprite.metrics.h
            );
            tilesDrawn++;
            
            if (j < 5) { // Log first few tiles for debugging
                gameLogger.debug('World: Drew background tile', {
                    tileIndex: j,
                    image: tile.sprite.image,
                    sourceRect: `${tile.sprite.metrics.x},${tile.sprite.metrics.y} ${tile.sprite.metrics.w}x${tile.sprite.metrics.h}`,
                    destPos: `${Math.round(screen.x)},${Math.round(screen.y)}`
                });
            }
        }
        
        this.game.renderer.bgCanvas = {
            x: lowestScreenX, y: lowestScreenY, image: bgCanvas.canvas
        };
    }

    // Debounced refresh to avoid double-drawing during move (remove + add)
    private scheduleDebugOverlayRefresh(): void {
        if (!gameLogger.isDebugMode()) return;
        if (this.debugOverlayRefreshScheduled) return;
        this.debugOverlayRefreshScheduled = true;
        const run = () => {
            try {
                // Rebuild background, then paint overlay on top
                this.createBackground();
                this.createDebugOverlay();
            } catch (e) {
                gameLogger.warn('Debug: Overlay refresh failed', { error: (e as Error)?.message });
            } finally {
                this.debugOverlayRefreshScheduled = false;
            }
        };
        if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
            window.requestAnimationFrame(run);
        } else {
            setTimeout(run, 0);
        }
    }

    private createDebugOverlay(): void {
        if (!this.game.renderer.bgCanvas) {
            gameLogger.warn('Debug: Cannot create debug overlay - no background canvas available');
            return;
        }

        gameLogger.info('Debug: Creating walkable tile overlay');
        
        // Get the existing background canvas
        const bgCanvas = this.game.renderer.bgCanvas;
        const canvas = bgCanvas.image;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
            gameLogger.error('Debug: Cannot get canvas context for debug overlay');
            return;
        }

        // Set drawing style for debug markers
        ctx.strokeStyle = '#FF0000'; // Red color for walkable tiles
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.8;

        let walkableCount = 0;
        let actorCount = 0; 
        let totalTiles = 0;

        // Iterate through all map positions and draw X marks on walkable tiles
        for (const gridKey in this.map) {
            if (!this.map.hasOwnProperty(gridKey)) continue;
            
            const slab = this.map[gridKey];
            const x = slab.position.x;
            const y = slab.position.y;
            totalTiles++;
            
            // Determine if this tile is occupied by an Actor
            let actorHere = false;
            const yObjects = this.objects[x]?.[y];
            if (yObjects) {
                for (const zKey in yObjects) {
                    if (!yObjects.hasOwnProperty(zKey)) continue;
                    const obj: any = yObjects[zKey];
                    if (obj && obj.constructor && obj.constructor.name === 'Actor') {
                        actorHere = true;
                        break;
                    }
                }
            }

            // Convert world coordinates to screen coordinates (tile center)
            // Use the same isometric transform as actors, then adjust by bgCanvas origin
            const z = slab.position.z;
            const eastShift = 8; // slight eastward pixel tweak for alignment
            const centerX = ((x - y) * 16 - 8 + eastShift) - bgCanvas.x;
            const centerY = ((x + y) * 8 - (z) * 16 - 8) - bgCanvas.y;
            const size = 4; // Size of the X mark

            if (actorHere) {
                // Draw blue marker for actor-occupied tiles (even if temporarily unwalkable)
                actorCount++;
                ctx.strokeStyle = '#007BFF';
                ctx.beginPath();
                ctx.moveTo(centerX - size, centerY - size);
                ctx.lineTo(centerX + size, centerY + size);
                ctx.moveTo(centerX + size, centerY - size);
                ctx.lineTo(centerX - size, centerY + size);
                ctx.stroke();
                // Restore default red for subsequent tiles
                ctx.strokeStyle = '#FF0000';
            } else if (this.canWalk(x, y)) {
                // Draw red marker for walkable tiles without actors
                walkableCount++;
                ctx.beginPath();
                ctx.moveTo(centerX - size, centerY - size);
                ctx.lineTo(centerX + size, centerY + size);
                ctx.moveTo(centerX + size, centerY - size);
                ctx.lineTo(centerX - size, centerY + size);
                ctx.stroke();
            }
        }

        // Draw isometric compass (N/E/S/W) to indicate world directions on screen
        // In isometric projection used here:
        //  - North (0,-1) maps to roughly up-right (dx=+16, dy=-8)
        //  - East  (+1,0) maps to down-right (dx=+16, dy=+8)
        //  - South (0,+1) maps to down-left (dx=-16, dy=+8)
        //  - West  (-1,0) maps to up-left (dx=-16, dy=-8)
        try {
            const originX = 40;
            const originY = 40;
            const scale = 3; // enlarge the directional vectors for visibility

            // Save state for compass styling
            ctx.save();
            ctx.globalAlpha = 0.95;
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#00AAFF';
            ctx.fillStyle = '#00AAFF';
            ctx.font = '12px sans-serif';

            // Helper to draw an arrow from (x1,y1) to (x2,y2)
            const drawArrow = (x1: number, y1: number, x2: number, y2: number) => {
                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.stroke();
                // Arrow head
                const angle = Math.atan2(y2 - y1, x2 - x1);
                const headLen = 6;
                ctx.beginPath();
                ctx.moveTo(x2, y2);
                ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6));
                ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6));
                ctx.lineTo(x2, y2);
                ctx.fill();
            };

            // Direction vectors (screen deltas per grid step)
            const dirs = {
                N: { dx: 16, dy: -8 },
                E: { dx: 16, dy: 8 },
                S: { dx: -16, dy: 8 },
                W: { dx: -16, dy: -8 }
            } as const;

            // Draw crosshair at origin
            ctx.beginPath();
            ctx.arc(originX, originY, 2, 0, Math.PI * 2);
            ctx.fill();

            // Draw arrows and labels
            const endN = { x: originX + dirs.N.dx * scale, y: originY + dirs.N.dy * scale };
            const endE = { x: originX + dirs.E.dx * scale, y: originY + dirs.E.dy * scale };
            const endS = { x: originX + dirs.S.dx * scale, y: originY + dirs.S.dy * scale };
            const endW = { x: originX + dirs.W.dx * scale, y: originY + dirs.W.dy * scale };
            drawArrow(originX, originY, endN.x, endN.y);
            drawArrow(originX, originY, endE.x, endE.y);
            drawArrow(originX, originY, endS.x, endS.y);
            drawArrow(originX, originY, endW.x, endW.y);

            // Labels slightly past arrow tips
            ctx.fillText('N', endN.x + 6, endN.y - 2);
            ctx.fillText('E', endE.x + 6, endE.y + 12);
            ctx.fillText('S', endS.x - 14, endS.y + 12);
            ctx.fillText('W', endW.x - 14, endW.y - 2);

            // Restore context state after compass
            ctx.restore();
        } catch (e) {
            gameLogger.warn('Debug: Failed to draw compass overlay', { error: (e as Error)?.message });
        }

        // Reset alpha
        ctx.globalAlpha = 1.0;

        gameLogger.info('Debug: Walkable tile overlay complete', {
            totalTiles: totalTiles,
            walkableTiles: walkableCount,
            unwalkableTiles: totalTiles - walkableCount,
            actorTiles: actorCount
        });
    }

    crawlMap(): void {
        this.islands = [];
        const crawled: Record<string, Slab> = {};
        let thisIsland = 0;
        
        for(let x = this.mapBounds.xl; x <= this.mapBounds.xh; x++) {
            for(let y = this.mapBounds.yl; y <= this.mapBounds.yh; y++) {
                let currentTile = this.map[x + ':' + y];
                if(!currentTile) continue;
                if(crawled[currentTile.grid]) continue; // Skip already-crawled tiles
                
                const neighborsToCrawl: Slab[] = [];
                while(true) { // Keep crawling outward until no neighbors are left
                    crawled[currentTile.grid] = currentTile;
                    if(this.islands[thisIsland]) {
                        this.islands[thisIsland].push(currentTile);
                    } else {
                        this.islands.push([currentTile]);
                    }
                    
                    const currentNeighbors = geometry.getNeighbors(currentTile.grid);
                    for(const iKey in currentNeighbors) {
                        if (!currentNeighbors.hasOwnProperty(iKey)) continue;
                        const neighbor = this.map[currentNeighbors[iKey as keyof typeof currentNeighbors]];
                        if(!neighbor) {
                            currentTile.border = true;
                            continue;
                        }
                        if(!crawled[neighbor.grid]) neighborsToCrawl.push(neighbor);
                    }
                    
                    if(neighborsToCrawl.length > 0) {
                        currentTile = neighborsToCrawl.pop()!;
                    } else {
                        thisIsland++;
                        break; // No more neighbors, this island is done
                    }
                }
            }
        }
        
        this.mainIsland = 0;
        for(let i = 1; i < this.islands.length; i++) {
            this.mainIsland = this.islands[i].length > this.islands[this.mainIsland].length ?
                i : this.mainIsland;
        }
        
        for(let i2 = 0; i2 < this.islands.length; i2++) {
            if(i2 == this.mainIsland) continue;
            for(let it = 0; it < this.islands[i2].length; it++) {
                delete this.map[this.islands[i2][it].grid];
                this.islands[i2][it].remove();
            }
        }
        
        // Set border tiles to slab
        for(const gKey in this.map) {
            if(!this.map.hasOwnProperty(gKey)) continue;
            const finalTile = this.map[gKey];
            if(finalTile.border) {
                finalTile.style = 'plain';
            } else {
                const finalNeighbors = geometry.get8Neighbors(finalTile.grid);
                for(const nKey in finalNeighbors) {
                    if (!finalNeighbors.hasOwnProperty(nKey)) continue;
                    if(!this.map[finalNeighbors[nKey as keyof typeof finalNeighbors]]) {
                        finalTile.style = 'plain';
                        break;
                    }
                }
            }
        }
        
        // Slab around beacon
        if (this.map['0:0']) this.map['0:0'].style = 'plain';
        if (this.map['1:0']) this.map['1:0'].style = 'plain';
        if (this.map['-1:0']) this.map['-1:0'].style = 'plain';
        if (this.map['0:1']) this.map['0:1'].style = 'plain';
        if (this.map['0:-1']) this.map['0:-1'].style = 'plain';
        
        this.createFlowerPatches();
    }

    private createFlowerPatches(): void {
        // Create flower patches
        for(let fp = 0; fp < Math.ceil(Math.pow(this.worldRadius, 2) / 80); fp++) {
            let safety = 0;
            let grid: Slab;
            let valid: boolean;
            
            do {
                valid = true;
                grid = this.map[util.pickInObject(this.map)];
                if (!grid) continue;
                
                const flowerNeighbors = geometry.get8Neighbors(grid.grid);
                for(const fKey in flowerNeighbors) {
                    if (!flowerNeighbors.hasOwnProperty(fKey)) continue;
                    const fNeighbor = this.map[flowerNeighbors[fKey as keyof typeof flowerNeighbors]];
                    if(!fNeighbor || fNeighbor.style != 'grass') {
                        valid = false;
                        break;
                    }
                }
                safety++;
            } while(safety < 1000 && (grid.style != 'grass' || !valid));
            
            if(safety == 1000) continue;
            grid.style = 'flowers';
            
            const spread = util.randomIntRange(1, 4);
            for(let s = 0; s < spread; s++) {
                let canSpread = true;
                const spreadX = grid.position.x + util.randomIntRange(-1, 1);
                const spreadY = grid.position.y + util.randomIntRange(-1, 1);
                const spreadGrid = this.map[spreadX + ':' + spreadY];
                
                if (!spreadGrid) continue;
                
                const spreadNeighbors = geometry.get8Neighbors(spreadGrid.grid);
                for(const sKey in spreadNeighbors) {
                    if (!spreadNeighbors.hasOwnProperty(sKey)) continue;
                    const sNeighbor = this.map[spreadNeighbors[sKey as keyof typeof spreadNeighbors]];
                    if(!sNeighbor || (sNeighbor.style != 'grass' && sNeighbor.style != 'flowers')) {
                        canSpread = false;
                        break;
                    }
                }
                if(canSpread) spreadGrid.style = 'flowers';
            }
        }
    }

    createTiles(): void {
        // Tile types:
        //   Grass     G
        //   Slab      S
        //   Flowers   F
        //   Empty     E
        // Tile code constructed as NW-NE-SE-SW (eg. "S-X-X-B")

        this.tileMap = {};
        const self = this;
        
        function tileType(grid: string): string {
            return self.map[grid].style[0].replace(/p/, 's').toUpperCase();
        }
        
        function getTileCode(oGrid: string, nGrid: string): string {
            if(oGrid == nGrid) return tileType(oGrid);
            const neighbor = self.map[nGrid];
            if(!neighbor) return 'E';
            return tileType(nGrid);
        }
        
        function generateTile(oGrid: string, tile: any, grid: string, game: Game): any {
            const nGrids = tile.grids;
            const tileCode = getTileCode(oGrid, nGrids[0]) + '-' + getTileCode(oGrid, nGrids[1])
                + '-' + getTileCode(oGrid, nGrids[2]) + '-' + getTileCode(oGrid, nGrids[3]);
            const tileSprite = (new TileSheetClass('tile')).map[tileCode];
            if(!tileSprite) {
                gameLogger.error('World: Unknown tile code', {
                    tileCode: tileCode,
                    neighborGrids: nGrids,
                    originalGrid: oGrid
                });
            }
            return {
                tileCode: tileCode, position: tile, grid: grid, game: game
            };
        }
        
        for(const key in this.map) {
            if(!this.map.hasOwnProperty(key)) continue;
            const x = +key.split(':')[0];
            const y = +key.split(':')[1];
            const z = this.map[key].position.z;
            const neighbors = geometry.get8Neighbors(key);
            
            const nw = { x: x - 0.5, y: y - 0.5, z: z, grids: [neighbors.nw, neighbors.n, key, neighbors.w] };
            const ne = { x: x + 0.5, y: y - 0.5, z: z, grids: [neighbors.n, neighbors.ne, neighbors.e, key] };
            const se = { x: x + 0.5, y: y + 0.5, z: z, grids: [key, neighbors.e, neighbors.se, neighbors.s] };
            const sw = { x: x - 0.5, y: y + 0.5, z: z, grids: [neighbors.w, key, neighbors.s, neighbors.sw] };
            const tiles = [nw, ne, se, sw];
            
            for(let i = 0; i < tiles.length; i++) {
                const tileGrid = z + ':' + tiles[i].x + ':' + tiles[i].y;
                if(this.tileMap[tileGrid]) continue;
                this.tileMap[tileGrid] = new TileClass(generateTile(key, tiles[i], tileGrid, this.game)) as Tile;
                this.staticMap.push(this.tileMap[tileGrid]);
            }
        }
        this.staticMap.sort(function(a, b) { return a.zDepth - b.zDepth; });
        
        // Log tile map for E2E testing
        this.logTileMap();
        
        // Log valid spawn positions for E2E testing
        this.logValidSpawnPositions();
    }

    private logTileMap(): void {
        // Create complete tile map data for E2E testing
        const completeTileMap: Record<string, { 
            tileCode: string; 
            x: number; 
            y: number; 
            z: number;
            grid: string;
        }> = {};
        
        const tileCodeCounts: Record<string, number> = {};
        
        for (const tileGrid in this.tileMap) {
            if (!this.tileMap.hasOwnProperty(tileGrid)) continue;
            
            const tile = this.tileMap[tileGrid] as any; // Access the generated tile data
            const tileCode = tile.tileCode || 'UNKNOWN';
            const position = tile.position;
            
            // Store complete tile information
            completeTileMap[tileGrid] = {
                tileCode: tileCode,
                x: position.x,
                y: position.y,
                z: position.z,
                grid: tileGrid
            };
            
            // Count tile codes for summary
            tileCodeCounts[tileCode] = (tileCodeCounts[tileCode] || 0) + 1;
        }
        
        // Also create a simple grid-based representation showing what tile type is at each coordinate
        const gridTileTypes: Record<string, string> = {};
        for (const gridKey in this.map) {
            if (!this.map.hasOwnProperty(gridKey)) continue;
            const slab = this.map[gridKey];
            gridTileTypes[gridKey] = slab.style; // grass, plain, or flowers
        }
        
        gameLogger.worldTileMap({
            totalTiles: Object.keys(this.tileMap).length,
            uniqueTileCodes: Object.keys(tileCodeCounts).length,
            tilesByCode: tileCodeCounts,
            gridTileTypes: gridTileTypes, // Map of "x:y" -> "grass"|"plain"|"flowers"
            tileMap: completeTileMap // Complete tile map: "z:x:y" -> { tileCode, x, y, z, grid }
        });
    }

    private logValidSpawnPositions(): void {
        const validSpawnPositions: string[] = [];
        const invalidSpawnPositions: string[] = [];
        
        // Check each grid position to see if actors can spawn there
        for (const gridKey in this.map) {
            if (!this.map.hasOwnProperty(gridKey)) continue;
            
            const slab = this.map[gridKey];
            const x = slab.position.x;
            const y = slab.position.y;
            
            // Skip beacon position (0,0) as it's reserved
            if (x === 0 && y === 0) {
                invalidSpawnPositions.push(`${x}:${y} (beacon)`);
                continue;
            }
            
            // Actors can spawn on grass, slab (plain), or flowers
            // They cannot spawn on empty tiles
            const canSpawn = slab.style === 'grass' || slab.style === 'plain' || slab.style === 'flowers';
            
            if (canSpawn) {
                validSpawnPositions.push(`${x}:${y}`);
            } else {
                invalidSpawnPositions.push(`${x}:${y} (${slab.style})`);
            }
        }
        
        gameLogger.worldSpawnAnalysis({
            totalPositions: Object.keys(this.map).length,
            validSpawnPositions: validSpawnPositions.length,
            invalidSpawnPositions: invalidSpawnPositions.length,
            validPositions: validSpawnPositions, // Log ALL valid positions
            invalidPositions: invalidSpawnPositions // Log ALL invalid positions
        });
    }

    addToWorld(obj: WorldObject): boolean {
        if(this.objects[obj.position.x]) {
            if(this.objects[obj.position.x][obj.position.y]) {
                if(this.objects[obj.position.x][obj.position.y][obj.position.z]) {
                    gameLogger.error('World: Position occupied', {
                        position: obj.position,
                        newObject: obj.constructor?.name || 'unknown',
                        existingObject: this.objects[obj.position.x][obj.position.y][obj.position.z].constructor?.name || 'unknown'
                    });
                    return false;
                }
            } else {
                this.objects[obj.position.x][obj.position.y] = {};
            }
        } else {
            this.objects[obj.position.x] = {};
            this.objects[obj.position.x][obj.position.y] = {};
        }
        this.objects[obj.position.x][obj.position.y][obj.position.z] = obj;
        this.updateWalkable(obj.position.x, obj.position.y);
        // If an Actor is added, refresh debug overlay (in debug mode)
        if ((obj as any)?.constructor?.name === 'Actor') {
            this.scheduleDebugOverlayRefresh();
        }
        return true;
    }

    removeFromWorld(obj: WorldObject): void {
        if (this.objects[obj.position.x]?.[obj.position.y]?.[obj.position.z]) {
            delete this.objects[obj.position.x][obj.position.y][obj.position.z];
            this.updateWalkable(obj.position.x, obj.position.y);
            // If an Actor is removed, refresh debug overlay (in debug mode)
            if ((obj as any)?.constructor?.name === 'Actor') {
                this.scheduleDebugOverlayRefresh();
            }
        }
    }

    moveObject(obj: WorldObject, x: number, y: number, z: number): void {
        this.removeFromWorld(obj);
        obj.position.x = x;
        obj.position.y = y;
        obj.position.z = z;
        this.addToWorld(obj);
        // Do not trigger here to avoid double refresh; add/remove already schedule a refresh
    }

    updateWalkable(x: number, y: number): void {
        const objects = this.objects[x]?.[y];
        if(!objects || Object.keys(objects).length == 0) {
            delete this.walkable[x + ':' + y];
            return;
        }
        const zKeys = Object.keys(objects).sort(function(a, b) { return +a - +b; });
        const topObject = objects[+zKeys[zKeys.length - 1]];
        if(topObject.unWalkable) {
            delete this.walkable[x + ':' + y];
        } else {
            const walkableHeight = topObject.position.z + topObject.height;
            this.walkable[x + ':' + y] = walkableHeight;
        }
    }

    canWalk(x: number, y: number): boolean {
        // Check if the grid exists in the world map (is there a slab here?)
        const slab = this.map[x + ':' + y];
        if (!slab) {
            return false;
        }
        
        // Check the walkable status
        const walkableHeight = this.walkable[x + ':' + y];
        
        // If no entry in walkable, it's an empty slab - walkable at slab height
        // If entry exists, there are objects and the top one is walkable
        // If entry was deleted due to unWalkable objects, walkableHeight would be undefined
        // but we still need to check the actual objects to be sure
        
        const objects = this.objects[x]?.[y];
        if (!objects || Object.keys(objects).length === 0) {
            // Empty slab - always walkable
            return true;
        }
        
        // Has objects - check if top object is walkable
        const zKeys = Object.keys(objects).sort((a, b) => +a - +b);
        const topObject = objects[+zKeys[zKeys.length - 1]];
        const canWalk = !topObject.unWalkable;
        return canWalk;
    }

    getHeight(x: number, y: number): number {
        // Return the walkable height at this position
        const walkableHeight = this.walkable[x + ':' + y];
        if (walkableHeight !== undefined) {
            return walkableHeight;
        }
        
        // If no walkable height (empty slab), return the slab height + slab's height value
        const slab = this.map[x + ':' + y];
        if (slab) {
            const slabTop = slab.position.z + slab.height;
            return slabTop;
        }
        return -0.5;
    }

    randomEmptyGrid(): string {
        return unoccupiedGrids.splice(util.randomIntRange(0, unoccupiedGrids.length - 1), 1)[0];
    }

    objectAtXYZ(x: number, y: number, z: number): WorldObject | null {
        return this.objects[x]?.[y]?.[z] || null;
    }

    objectUnderXYZ(x: number, y: number, z: number): WorldObject | null {
        const yObjects = this.objects[x]?.[y];
        if(!yObjects) return null;
        
        let highest = -1000;
        for(const zKey in yObjects) {
            if(!yObjects.hasOwnProperty(zKey)) continue;
            if(+zKey > z) continue;
            highest = +zKey > highest ? +zKey : highest;
        }
        return yObjects[highest] || null;
    }

    findObject(obj: WorldObject): [string, string, string] | null { // For debugging
        for(const xKey in this.objects) {
            if (!this.objects.hasOwnProperty(xKey)) continue;
            const xObjects = this.objects[xKey];
            for(const yKey in xObjects) {
                if (!xObjects.hasOwnProperty(yKey)) continue;
                const yObjects = xObjects[yKey];
                for(const zKey in yObjects) {
                    if (!yObjects.hasOwnProperty(zKey)) continue;
                    if(obj === yObjects[zKey]) return [xKey, yKey, zKey];
                }
            }
        }
        return null;
    }
}

// Expose World class for E2E testing as soon as it's defined
if (typeof window !== 'undefined' && (window as any).__E2E_TEST_MODE) {
    (window as any).__WorldClass = World;
    
    // Expose unoccupiedGrids for testing and mocking
    (window as any).__unoccupiedGrids = () => unoccupiedGrids;
    (window as any).__setUnoccupiedGrids = (grids: string[]) => { unoccupiedGrids = grids; };
    
    console.log('✅ [E2E] World class exposed on window.__WorldClass');
    
    // Dispatch event so mocks can patch immediately (synchronously)
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('__worldClassReady', { detail: { World } }));
    }
}