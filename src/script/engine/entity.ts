'use strict';

import { EventEmitter } from 'events';
import { util } from '../common/util.js';
import { gameLogger } from '../../gameLogger.js';

interface EntitySprite {
    [key: string]: any;
}

interface Game {
    entities: Entity[];
    world: {
        addToWorld(entity: Entity): void;
        removeFromWorld(entity: Entity): void;
    };
    renderer: {
        addToZBuffer(sprite: EntitySprite, depth?: number): void;
        removeFromZBuffer(sprite: EntitySprite, depth?: number): void;
        overlay: EntitySprite[];
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

export default class Entity extends EventEmitter {
    sprite: EntitySprite = {};
    game?: Game;
    position?: any;
    zDepth?: number;
    invisible?: boolean;
    exists?: boolean;

    constructor() {
        super();
        this.sprite = {};
    }

    addToGame(game: Game): void {
        this.game = game;
        this.game.entities.push(this);
        
        if(this.position && typeof this.position.x === 'number' && typeof this.position.y === 'number' && typeof this.position.z === 'number') {
            this.game.world.addToWorld(this);
            if(!this.invisible) this.game.renderer.addToZBuffer(this.sprite, this.zDepth);
        } else {
            this.game.renderer.overlay.push(this.sprite);
        }
        this.exists = true;
    }

    remove(): void {
        this.exists = false;
        if(this.position && typeof this.position.x === 'number' && typeof this.position.y === 'number' && typeof this.position.z === 'number') {
            if(!this.invisible && this.game) this.game.renderer.removeFromZBuffer(this.sprite, this.zDepth);
            if(this.game) this.game.world.removeFromWorld(this);
        } else {
            if(this.game) util.findAndRemove(this, this.game.renderer.overlay);
        }
        if(this.game) util.findAndRemove(this, this.game.entities);
    }

    tickDelay(cb: Function, ticks: number): void { // Execute callback after X ticks
        if(!this.game) return;
        this.game.schedule.push({ type: 'once', tick: this.game.ticks + ticks, cb: cb, entity: this });
    }

    tickRepeat(cb: Function, ticks: number, afterCB?: Function): void { // Execute callback every tick for X ticks
        if(!this.game) return;
        
        // Validate ticks parameter to prevent NaN in progress.percent calculation
        if (!isFinite(ticks) || ticks <= 0) {
            gameLogger.error('Entity tickRepeat: Invalid ticks parameter', {
                ticks,
                entity: this.constructor.name,
                isFinite: isFinite(ticks),
                isPositive: ticks > 0
            });
            return;
        }
        
        this.game.schedule.push({ type: 'repeat', start: this.game.ticks, count: ticks, cb: cb, afterCB: afterCB, entity: this });
    }

    removeFromSchedule(cb: Function): void {
        if(!this.game) return;
        for(let i = 0; i < this.game.schedule.length; i++) {
            if(this.game.schedule[i].entity === this && this.game.schedule[i].cb === cb) {
                this.game.schedule[i].type = 'deleted';
                break;
            }
        }
    }
}