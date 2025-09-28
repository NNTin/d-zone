'use strict';

import WorldObject from '../engine/worldobject.js';
import BetterCanvas from '../common/bettercanvas.js';

interface BeaconOptions {
    position: { x: number; y: number; z: number };
    pixelSize: { x: number; y: number; z: number };
    height: number;
}

export default class Beacon extends WorldObject {
    unWalkable: boolean = true;
    imageName: string = 'props';
    sheet: any;
    pinging: number = 0;

    constructor(x: number, y: number, z: number) {
        const options: BeaconOptions = {
            position: { x: x, y: y, z: z },
            pixelSize: { x: 15, y: 16, z: 45 },
            height: 2.5
        };
        super(options);
        
        this.on('draw', (canvas: any) => {
            if (this.exists) canvas.drawEntity(this);
        });
        
        this.loadSheet();
    }

    private async loadSheet(): Promise<void> {
        try {
            const SheetModule = await import('./sheet.js');
            this.sheet = new SheetModule.default('beacon');
            if (this.sprite && this.sheet.map) {
                this.sprite.metrics = this.sheet.map.main;
            }
        } catch (error) {
            console.error('Failed to load Sheet module:', error);
            // Fallback metrics
            this.sheet = { map: { main: { x: 0, y: 0, w: 15, h: 16, ox: 0, oy: 0 } } };
            if (this.sprite) {
                this.sprite.metrics = this.sheet.map.main;
            }
        }
    }

    addToGame(game: any): void {
        super.addToGame(game);
        game.on('update', this.onUpdate.bind(this));
        this.drawSprite();
    }

    drawSprite(): void {
        if (!this.sheet?.map?.main || !(this.game as any)?.renderer?.images?.[this.imageName]) {
            return;
        }

        const canvas = new BetterCanvas(this.sheet.map.main.w, this.sheet.map.main.h);
        canvas.drawImage(
            (this.game as any).renderer.images[this.imageName],
            this.sheet.map.main.x, this.sheet.map.main.y, this.sheet.map.main.w, this.sheet.map.main.h,
            0, 0, this.sheet.map.main.w, this.sheet.map.main.h
        );

        if (this.pinging && this.sheet.map.light) {
            canvas.drawImage(
                (this.game as any).renderer.images[this.imageName],
                this.sheet.map.light.x, this.sheet.map.light.y, this.sheet.map.light.w, this.sheet.map.light.h,
                this.sheet.map.light.ox, 0, this.sheet.map.light.w, this.sheet.map.light.h, 
                this.pinging / 100
            );
        }

        if (this.sprite) {
            this.sprite.image = canvas.canvas;
        }
    }

    onUpdate(): void {
        if (this.pinging) {
            this.pinging = Math.max(0, this.pinging - 1);
            this.drawSprite();
        }
    }

    ping(): void {
        this.pinging = 100;
    }
}