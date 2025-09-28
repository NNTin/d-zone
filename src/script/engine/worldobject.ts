'use strict';

import Entity from './entity.js';

interface WorldObjectOptions {
    position: {
        x: number;
        y: number;
        z: number;
    };
    height: number;
    pixelSize: {
        x: number;
        y: number;
        z: number;
    };
}

interface Position {
    x: number;
    y: number;
    z: number;
    fakeZ: number;
}

interface PixelSize {
    x: number;
    y: number;
    z: number;
}

interface Screen {
    x: number;
    y: number;
}

interface WorldObjectGame {
    entities: Entity[];
    world: {
        addToWorld(entity: Entity): void;
        removeFromWorld(entity: Entity): void;
        moveObject(obj: WorldObject, x: number, y: number, z: number): void;
        objectAtXYZ(x: number, y: number, z: number): WorldObject | null;
    };
    renderer: {
        addToZBuffer(sprite: any, depth?: number): void;
        removeFromZBuffer(sprite: any, depth?: number): void;
        overlay: any[];
        updateZBuffer(oldDepth: number, sprite: any, newDepth: number): void;
    };
    schedule: Array<{
        type: string;
        tick?: number;
        start?: number;
        count?: number;
        cb: Function;
        afterCB?: Function;
        entity?: Entity;
    }>;
    ticks: number;
}

export default class WorldObject extends Entity {
    declare position: Position;
    height: number;
    zDepth: number;
    pixelSize: PixelSize;
    screen: Screen;
    declare game: WorldObjectGame;

    constructor(options: WorldObjectOptions) {
        super();
        this.position = {
            x: options.position.x,
            y: options.position.y,
            z: options.position.z,
            fakeZ: 0
        };
        this.height = options.height;
        this.zDepth = this.calcZDepth();
        this.pixelSize = {
            x: options.pixelSize.x,
            y: options.pixelSize.y,
            z: options.pixelSize.z
        };
        this.screen = { x: 0, y: 0 };
        this.updateScreen();
        this.sprite.screen = this.screen;
        this.sprite.position = this.position;
    }

    move(x: number, y: number, z: number): void {
        const newX = this.position.x + x;
        const newY = this.position.y + y;
        const newZ = this.position.z + z;
        this.game.world.moveObject(this, newX, newY, newZ);
        this.updateScreen();
        const newZDepth = this.calcZDepth();
        if(newZDepth != this.zDepth) {
            this.game.renderer.updateZBuffer(this.zDepth, this.sprite, newZDepth);
            this.zDepth = newZDepth;
        }
    }

    underneath(): WorldObject | null {
        return this.game.world.objectAtXYZ(this.position.x, this.position.y, this.position.z + this.height);
    }

    calcZDepth(): number {
        return this.position.x + this.position.y;
    }

    updateScreen(): void {
        this.screen.x = (this.position.x - this.position.y) * 16 - this.pixelSize.x;
        this.screen.y = (this.position.x + this.position.y) * 8 - (this.position.z + this.height) * 16;
    }
}