'use strict';

import { geometry } from '../../common/geometry.js';
import { util } from '../../common/util.js';

export default class Wander {
    actor: any;
    state: string = 'idle';
    impulseCompleteBound: () => void;
    impulseInterval: number = 300;
    impulseBound: () => void;

    constructor(actor: any) {
        console.log('Wander: Creating behavior for actor', actor.uid);
        this.actor = actor;
        this.impulseCompleteBound = this.impulseComplete.bind(this);
        this.impulseBound = this.impulse.bind(this);
        this.wait();
    }

    wait(): void {
        if (!this.actor) return;
        console.log('Wander: Scheduling next impulse for actor', this.actor.uid);
        this.actor.tickDelay(this.impulseBound, 20 + Math.round(Math.random() * this.impulseInterval));
    }

    impulse(): void {
        console.log('Wander: impulse() called for actor', this.actor?.uid, 'presence:', this.actor?.presence);
        if (!this.actor || this.actor.presence != 'online') return;
        if (this.actor.destination) { // Busy
            console.log('Wander: Actor busy, waiting...');
            this.wait();
        } else {
            const direction = util.pickInObject(geometry.DIRECTIONS);
            //direction = util.pickInArray(['east','south']);
            const moveXY = geometry.DIRECTIONS[direction];
            const canMove = this.actor.tryMove(moveXY.x, moveXY.y);
            console.log('Wander: Trying to move', direction, 'canMove:', canMove);
            if (canMove) {
                this.actor.destination = canMove;
                this.actor.startMove();
                this.actor.once('movecomplete', this.impulseCompleteBound);
            } else {
                console.log('Wander: Cannot move, waiting...');
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