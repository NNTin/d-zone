'use strict';

import { util } from '../common/util.js';
import Sheet from './sheet2.js';

interface TileOptions {
    game: any;
    grid: string;
    tileCode: string;
    position: { x: number; y: number; z: number };
}

interface SpriteMetrics {
    x: number;
    y: number;
    w: number;
    h: number;
    ox: number;
    oy: number;
}

interface Sprite {
    metrics: SpriteMetrics;
    image: string;
    position: { x: number; y: number; z: number };
    screen: { x: number; y: number };
}

export default class Tile {
    game: any;
    grid: string;
    tileCode: string;
    position: { x: number; y: number; z: number };
    zDepth: number;
    screen: { x: number; y: number };
    imageName: string;
    sheet: any;
    sprite: Sprite;

    constructor(options: TileOptions) {
        this.game = options.game;
        this.grid = options.grid;
        this.tileCode = options.tileCode;
        this.position = options.position;
        this.zDepth = this.position.x + this.position.y;
        this.screen = {
            x: (this.position.x - this.position.y) * 16 - 16,
            y: (this.position.x + this.position.y) * 8 - (this.position.z) * 16 - 8
        };
        this.imageName = 'static-tiles';
        
        // Load sheet synchronously like in the original CommonJS version
        this.sheet = new Sheet('tile');
        
        // Get sprite metrics from the loaded sheet
        const spriteMap = this.sheet.map[this.tileCode] || { 
            x: 0, y: 0, w: 16, h: 16, ox: 0, oy: 0 
        };
        
        // Ensure ox and oy are numbers, not undefined
        this.sprite = {
            metrics: {
                x: spriteMap.x || 0,
                y: spriteMap.y || 0,
                w: spriteMap.w || 16,
                h: spriteMap.h || 16,
                ox: spriteMap.ox || 0,
                oy: spriteMap.oy || 0
            },
            image: this.imageName, 
            position: this.position, 
            screen: this.screen
        };

        console.log(`Tile ${this.grid}: Created with screen(${this.screen.x}, ${this.screen.y}) metrics.ox=${this.sprite.metrics.ox} metrics.oy=${this.sprite.metrics.oy}`);

        if (this.tileCode == 'G-G-G-G') {
            let variation = util.randomIntRange(0, 2);
            const random = Math.random();
            if (Math.random() > 0.98) variation = 8;
            else if (Math.random() > 0.95) variation = util.randomIntRange(5, 7);
            else if (random > 0.6) variation = util.randomIntRange(3, 4);
            this.sprite.metrics.x += variation * this.sprite.metrics.w;
        }
    }

}