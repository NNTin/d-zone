'use strict';

import { util } from '../common/util.js';
import WorldObject from '../engine/worldobject.js';
import BetterCanvas from '../common/bettercanvas.js';
import Sheet from './sheet.js';

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
        
        // Load sheet synchronously, doing with loadSheet caused errors
        this.sheet = new Sheet('seed');
        if (this.sprite && this.sheet.map) {
            this.sprite.metrics = this.sheet.map.plant;
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