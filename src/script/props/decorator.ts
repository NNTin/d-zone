'use strict';

import { EventEmitter } from 'events';

import { geometry } from '../common/geometry.js';

interface SewSeedOptions {
    origin: { x: number; y: number; z: number };
}

interface World {
    map: Record<string, {
        position: { x: number; y: number; z: number };
        style: string;
        height: number;
    }>;
    objectAtXYZ(x: number, y: number, z: number): any;
}

interface Game {
    decorator?: Decorator;
}

interface Beacon {
    addToGame(game: Game): void;
    ping(): void;
}

interface Seed {
    addToGame(game: Game): void;
}

let BeaconClass: any;
let SeedClass: any;

export default class Decorator extends EventEmitter {
    game: Game;
    world: World;
    beacon!: Beacon;

    constructor(game: Game, world: World) {
        super();
        this.game = game;
        this.world = world;
        this.game.decorator = this;
        this.init();
    }

    private async init(): Promise<void> {
        try {
            const [BeaconModule, SeedModule] = await Promise.all([
                import('./beacon.js'),
                import('./seed.js')
            ]);

            BeaconClass = BeaconModule.default;
            SeedClass = SeedModule.default;

            this.createBeacon();
        } catch (error) {
            console.error('Failed to load decorator dependencies:', error);
            throw error;
        }
    }

    sewSeed(options: SewSeedOptions): void {
        if (!SeedClass) {
            console.error('Seed class not loaded yet');
            return;
        }

        let destination: { x: number; y: number; z: number } | undefined;
        
        for(let i = 0; i < geometry.closestGrids.length; i++) {
            const close = geometry.closestGrids[i];
            const grid = this.world.map[(options.origin.x + close[0]) + ':' + (options.origin.y + close[1])];
            if(!grid || grid.style == 'plain') continue;
            if(this.world.objectAtXYZ(grid.position.x, grid.position.y, grid.position.z + grid.height)) continue;
            destination = grid.position;
            break;
        }
        
        if(!destination) return;
        
        const talkSeed = new SeedClass({
            origin: options.origin,
            destination: { x: destination.x, y: destination.y, z: destination.z + 0.5 }
        }) as Seed;
        
        talkSeed.addToGame(this.game);
    }

    private createBeacon(): void {
        if (!BeaconClass) {
            console.error('Beacon class not loaded yet');
            return;
        }

        // Commented out original beacon location logic for simplicity
        // The beacon is now always placed at 0,0,0
        this.beacon = new BeaconClass(0, 0, 0) as Beacon;
        this.beacon.addToGame(this.game);
    }
}