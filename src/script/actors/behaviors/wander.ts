'use strict';

import { gameLogger } from '../../../gameLogger.js';
import { geometry } from '../../common/geometry.js';
import { util } from '../../common/util.js';

export default class Wander {
    actor: any;
    state: string = 'idle';
    impulseCompleteBound: () => void;
    impulseInterval: number = 300;
    impulseBound: () => void;

    constructor(actor: any) {
        this.actor = actor;
        this.impulseCompleteBound = this.impulseComplete.bind(this);
        this.impulseBound = this.impulse.bind(this);
        this.wait();
    }

    wait(): void {
        if (!this.actor) return;
        this.actor.tickDelay(this.impulseBound, 20 + Math.round(Math.random() * this.impulseInterval));
    }

    impulse(): void {
        if (!this.actor || this.actor.presence != 'online') return;
        if (this.actor.destination) { // Busy
            this.wait();
        } else {
            const direction = util.pickInObject(geometry.DIRECTIONS);
            //direction = util.pickInArray(['east','south']);
            const moveXY = geometry.DIRECTIONS[direction];
            const canMove = this.actor.tryMove(moveXY.x, moveXY.y);
            if (canMove) {
                // Validate destination coordinates
                if (isNaN(canMove.x) || isNaN(canMove.y) || isNaN(canMove.z)) {
                    gameLogger.error('Wander behavior: tryMove returned NaN destination', {
                        actor: this.actor.username,
                        canMove: canMove,
                        direction: direction,
                        moveXY: moveXY,
                        currentPosition: this.actor.position
                    });
                    this.wait();
                    return;
                }
                this.actor.destination = canMove;
                this.actor.startMove();
                this.actor.once('movecomplete', this.impulseCompleteBound);
            } else {
                this.wait();
            }
        }
    }

    impulseComplete(): void {
        this.wait();
    }

    detach(): void { // Detach behavior from actor
        this.actor.removeListener('movecomplete', this.impulseCompleteBound);
        this.actor.removeFromSchedule(this.impulseBound);
        delete this.actor;
    }
}