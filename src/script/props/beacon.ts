'use strict';

import WorldObject from '../engine/worldobject.js';
import BetterCanvas from '../common/bettercanvas.js';
import Sheet from './sheet.js';

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
        
        // Load sheet synchronously, doing with loadSheet caused errors
        this.sheet = new Sheet('beacon');
        if (this.sprite && this.sheet.map) {
            this.sprite.metrics = this.sheet.map.main;
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