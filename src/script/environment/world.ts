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

    constructor(game: Game, worldSize: number) {
        super();
        this.game = game;
        this.game.world = this;
        this.worldSize = Math.max(24, Math.floor(worldSize / 2) * 2); // Must be an even number >= 24
        this.worldRadius = Math.floor(this.worldSize / 2);
        
        this.init();
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
            this.generateWorld();
        } catch (error) {
            gameLogger.error('World: Failed to load world dependencies', {
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined
            });
            // Fall back to simpler world generation or throw error
            throw error;
        }
    }

    private generateWorld(): void {
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
        return true;
    }

    removeFromWorld(obj: WorldObject): void {
        if (this.objects[obj.position.x]?.[obj.position.y]?.[obj.position.z]) {
            delete this.objects[obj.position.x][obj.position.y][obj.position.z];
            this.updateWalkable(obj.position.x, obj.position.y);
        }
    }

    moveObject(obj: WorldObject, x: number, y: number, z: number): void {
        this.removeFromWorld(obj);
        obj.position.x = x;
        obj.position.y = y;
        obj.position.z = z;
        this.addToWorld(obj);
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