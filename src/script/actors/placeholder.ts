'use strict';

import WorldObject from '../engine/worldobject.js';

interface PlaceholderOptions {
    x: number;
    y: number;
    z: number;
}

interface WorldObjectOptions {
    position: { x: number; y: number; z: number };
    pixelSize: { x: number; y: number; z: number };
    height: number;
}

export default class Placeholder extends WorldObject {
    parent: any;
    invisible: boolean = true;
    unWalkable: boolean = true;

    constructor(parent: any, options: PlaceholderOptions) {
        const worldObjectOptions: WorldObjectOptions = {
            position: { x: options.x, y: options.y, z: options.z },
            pixelSize: { x: 0, y: 0, z: 0 },
            height: 0.5
        };
        super(worldObjectOptions);
        
        this.parent = parent;
        this.addToGame(this.parent.game);
    }
}