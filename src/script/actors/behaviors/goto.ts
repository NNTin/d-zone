'use strict';

import { geometry } from '../../common/geometry.js';
import { util } from '../../common/util.js';
import Pathfinder from '../pathfinder.js';

interface Position {
    x: number;
    y: number;
    z?: number;
}

export default class GoTo {
    actor: any;
    target: any;
    attempt: number;
    boundResetAttempt: () => void;
    boundStartGoTo: () => void;
    destination?: Position;
    path?: Position[];

    constructor(actor: any, target: any) {
        console.log(`GoTo.Contructor: ${actor.username} starting to go to target at (${target.position.x}, ${target.position.y})`);
        this.actor = actor;
        this.target = target;
        this.attempt = util.randomIntRange(1, 4);
        this.boundResetAttempt = this.resetAttempt.bind(this);
        this.target.on('movecomplete', this.boundResetAttempt); // Reset adjacent attempts if target moves
        this.boundStartGoTo = this.startGoTo.bind(this);
        
        if (this.actor.destination) {
            this.actor.once('movecomplete', this.boundStartGoTo);
        } else {
            this.startGoTo();
        }
    }

    startGoTo(): void {
        if (!this.actor || this.actor.presence != 'online' || this.actor.underneath()) return;
        
        // Add a small delay between movements to prevent visual "skipping"
        this.actor.tickDelay(() => {
            this.performMove();
        }, 2); // 2 tick delay for smoother transitions
    }
    
    performMove(): void {
        if (!this.actor || this.actor.presence != 'online' || this.actor.underneath()) return;
        
        const adjacent = geometry.closestGrids[this.attempt]; // Pick grid next to target
        const targetDistance = geometry.getDistance(this.actor.position, this.target.position);
        
        if (targetDistance <= Math.abs(adjacent[0]) + Math.abs(adjacent[1])) {
            this.actor.stopGoTo(this);
            return;
        }
        
        this.destination = {
            x: this.target.position.x + adjacent[0], 
            y: this.target.position.y + adjacent[1]
        };
        
        const destDelta = { 
            x: this.destination.x - this.actor.position.x, 
            y: this.destination.y - this.actor.position.y 
        };
        
        // Calculate movement direction - ensure only cardinal movement
        var moveDir = { x: 0, y: 0 };
        const absX = Math.abs(destDelta.x);
        const absY = Math.abs(destDelta.y);
        
        if (absX > absY) {
            // X-axis movement is dominant
            moveDir.x = Math.max(-1, Math.min(1, destDelta.x));
            moveDir.y = 0;
        } else if (absY > absX) {
            // Y-axis movement is dominant
            moveDir.x = 0;
            moveDir.y = Math.max(-1, Math.min(1, destDelta.y));
        } else if (absX === absY && absX > 0) {
            // Equal magnitude - prefer X-axis for consistency
            moveDir.x = Math.max(-1, Math.min(1, destDelta.x));
            moveDir.y = 0;
        }
        // If both deltas are 0, moveDir remains {x: 0, y: 0}
        var moveAttempt = this.actor.tryMove(moveDir.x,moveDir.y);
        if(moveAttempt) { // Try to move in the general direction of our target
            this.actor.destination = moveAttempt;
            this.actor.startMove();
            this.actor.once('movecomplete', this.boundStartGoTo);
        } else { // If moving toward target is blocked, find a path
            this.path = Pathfinder.findPath({ start: this.actor.position, end: this.destination });
            if(this.path[0]) { // If there is a path
                const pathDelta = {
                    x: this.path[0].x - this.actor.position.x,
                    y: this.path[0].y - this.actor.position.y
                };
                
                // Ensure pathfinder result is cardinal movement only
                let finalDestination = { x: this.path[0].x, y: this.path[0].y, z: this.path[0].z };
                if (Math.abs(pathDelta.x) > 0 && Math.abs(pathDelta.y) > 0) {
                    // Break diagonal into cardinal movement - prefer the larger magnitude
                    if (Math.abs(pathDelta.x) >= Math.abs(pathDelta.y)) {
                        // Move in X direction first
                        finalDestination = {
                            x: this.actor.position.x + Math.sign(pathDelta.x),
                            y: this.actor.position.y,
                            z: this.path[0].z
                        };
                    } else {
                        // Move in Y direction first
                        finalDestination = {
                            x: this.actor.position.x,
                            y: this.actor.position.y + Math.sign(pathDelta.y),
                            z: this.path[0].z
                        };
                    }
                }
                
                //this.attempt = util.randomIntRange(1,4); // Reset adjacent attempts
                this.actor.destination = finalDestination;
                this.actor.startMove();
                this.actor.once('movecomplete', this.boundStartGoTo);
            } else { // If no path, try next closest tile
                this.attempt++;
                if (this.attempt > 8) { // Prevent infinite recursion
                    console.log(`GoTo: ${this.actor.username} giving up after 8 attempts`);
                    this.actor.stopGoTo(this);
                    return;
                }
                this.startGoTo();
            }
        }
    }

    resetAttempt(): void {
        this.attempt = util.randomIntRange(1, 4);
    }

    detach(): void { // Detach behavior from actor
        if (this.actor) this.actor.removeListener('movecomplete', this.boundStartGoTo);
        if (this.target) this.target.removeListener('movecomplete', this.boundResetAttempt);
        delete this.actor;
        delete this.target;
    }
}