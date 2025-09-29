'use strict';

import { util } from '../common/util.js';
import WorldObject from '../engine/worldobject.js';
import Sheet from './sheet.js';

interface HalfBlockOptions {
    position: { x: number; y: number; z: number };
    pixelSize: { x: number; y: number; z: number };
    height: number;
}

export default class HalfBlock extends WorldObject {
    style: string;
    sheet: Sheet;
    variation: number = 0;

    constructor(style: string, x: number, y: number, z: number) {
        const options: HalfBlockOptions = {
            position: { x: x, y: y, z: z },
            pixelSize: { x: 16, y: 16, z: 9 },
            height: 0.5
        };
        super(options);
        
        this.style = style;
        this.sheet = new Sheet('halfBlock');
        
        const self = this;
        this.on('draw', function(canvas: any) { 
            if (self.exists) canvas.drawEntity(self); 
        });
    }

    getSprite(): any {
        return { 
            metrics: this.sheet.map[this.style], 
            image: 'environment' 
        };
    }
}