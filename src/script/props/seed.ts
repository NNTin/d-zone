'use strict';

import { util } from '../common/util.js';
import WorldObject from '../engine/worldobject.js';
import BetterCanvas from '../common/bettercanvas.js';

interface SeedOptions {
    destination: { x: number; y: number; z: number };
    origin: { x: number; y: number; z: number };
}

interface WorldObjectOptions {
    position: { x: number; y: number; z: number };
    pixelSize: { x: number; y: number; z: number };
    height: number;
}

export default class Seed extends WorldObject {
    unwalkable: boolean = true;
    origin: { x: number; y: number; z: number };
    sheet: any;
    boundGrow: () => void;
    boundWither: () => void;
    growTime: number = 80;
    growStage: number = 0;
    growthStage?: number;

    constructor(options: SeedOptions) {
        const worldObjectOptions: WorldObjectOptions = {
            position: { x: options.destination.x, y: options.destination.y, z: options.destination.z },
            pixelSize: { x: 12, y: 12, z: 16 },
            height: 1
        };
        super(worldObjectOptions);
        
        this.origin = options.origin;
        
        this.on('draw', (canvas: any) => {
            if (this.exists) canvas.drawEntity(this);
        });
        
        if (this.sprite) {
            this.sprite.image = 'props';
        }
        
        this.boundGrow = this.grow.bind(this);
        this.boundWither = this.wither.bind(this);
        
        this.loadSheet();
    }

    private async loadSheet(): Promise<void> {
        try {
            const SheetModule = await import('./sheet.js');
            this.sheet = new SheetModule.default('seed');
            if (this.sprite && this.sheet.map) {
                this.sprite.metrics = this.sheet.map.plant;
            }
        } catch (error) {
            console.error('Failed to load Sheet module:', error);
            // Fallback metrics
            this.sheet = { 
                map: { 
                    plant: { x: 0, y: 0, w: 12, h: 12, ox: 0, oy: 0 },
                    orb: { x: 0, y: 0, w: 12, h: 12, ox: 0, oy: 0 }
                } 
            };
            if (this.sprite) {
                this.sprite.metrics = this.sheet.map.plant;
            }
        }
    }

    addToGame(game: any): void {
        super.addToGame(game);
        this.tickDelay(this.boundGrow, this.growTime + util.randomIntRange(this.growTime / -6, this.growTime / 6));
    }

    grow(): void {
        this.growStage++;
        const metrics = JSON.parse(JSON.stringify(this.sheet.map.plant));
        metrics.x += this.sprite.metrics.w * this.growStage;
        this.sprite.metrics = metrics;
        
        const nextGrowth = this.growTime + util.randomIntRange(this.growTime / -6, this.growTime / 6);
        if (this.growStage < 5) {
            this.tickDelay(this.boundGrow, nextGrowth);
        } else {
            this.tickDelay(this.boundWither, Math.floor(nextGrowth / 2));
        }
    }

    wither(): void {
        const metrics = this.sheet.map.orb;
        this.sprite.metrics = JSON.parse(JSON.stringify(metrics));
        
        this.tickRepeat((progress: any) => {
            this.sprite.metrics.oy = Math.round(metrics.oy + progress.ticks / 2);
            if (progress.percent >= 1) this.growthStage = 6;
        }, 26);
    }
}