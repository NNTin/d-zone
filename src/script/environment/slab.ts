'use strict';

import { util } from '../common/util.js';
import WorldObject from '../engine/worldobject.js';

interface SlabOptions {
    position: { x: number; y: number; z: number };
    pixelSize: { x: number; y: number; z: number };
    height: number;
}

export default class Slab extends WorldObject {
    invisible: boolean = true;
    style: string;

    constructor(style: string, x: number, y: number, z: number) {
        const options: SlabOptions = {
            position: { x: x, y: y, z: z },
            pixelSize: { x: 16, y: 16, z: 1 },
            height: 0.5
        };
        super(options);
        this.style = style;
    }
}