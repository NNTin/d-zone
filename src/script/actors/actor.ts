'use strict';

import { geometry } from '../common/geometry.js';
import { util } from '../common/util.js';
import WorldObject from '../engine/worldobject.js';
import Sheet from './sheet.js';
import Placeholder from './placeholder.js';
import Wander from './behaviors/wander.js';
import GoTo from './behaviors/goto.js';
import TextBox from '../common/textbox.js';

interface ActorOptions {
    x: number;
    y: number;
    z: number;
    maxListeners?: number;
    uid: string;
    username: string;
    roleColor?: string;
}

interface WorldObjectOptions {
    position: { x: number; y: number; z: number };
    pixelSize: { x: number; y: number; z: number };
    height: number;
}

export default class Actor extends WorldObject {
    preciseScreen: any;
    uid: string;
    username: string;
    nametag?: TextBox;
    sheet: Sheet;
    presence: string = 'online';
    talking: boolean = false;
    destination: any = false;
    facing: string;
    behaviors: any[] = [];
    boundOnMessage: (message: any) => void;
    roleColor?: string;
    placeholder?: Placeholder;
    moveTick?: any;
    talkBox?: any;
    talkTimeLeft?: number;
    frame: number = 0; // Add frame property for animation
    lastMessage?: { channel?: string; time: number };
    messageBox?: TextBox;
    moveStart?: number; // Track when movement started
    movePlaceholder?: Placeholder; // Placeholder during movement
    destDelta?: { x: number; y: number; z: number }; // Movement deltas
    unWalkable?: boolean; // Prevent others from walking on this tile during movement

    constructor(options: ActorOptions) {
        // Validate input coordinates
        if (isNaN(options.x) || isNaN(options.y) || isNaN(options.z)) {
            console.error('Actor constructor: Invalid coordinates provided', {
                username: options.username,
                uid: options.uid,
                coordinates: { x: options.x, y: options.y, z: options.z }
            });
            // Use fallback coordinates
            options.x = isNaN(options.x) ? 0 : options.x;
            options.y = isNaN(options.y) ? 0 : options.y;
            options.z = isNaN(options.z) ? 0 : options.z;
        }
        
        const worldObjectOptions: WorldObjectOptions = {
            position: { x: options.x, y: options.y, z: options.z },
            pixelSize: { x: 7, y: 7, z: 8 },
            height: 0.5
        };
        super(worldObjectOptions);
        
        this.preciseScreen = this.toScreenPrecise();
        if (options.maxListeners) this.setMaxListeners(options.maxListeners);
        this.uid = options.uid;
        this.username = options.username;
        this.nametag = new TextBox(this as any, this.username, true);
        this.nametag.blotText();
        this.sheet = new Sheet('actor');
        this.frame = 0; // Initialize frame
        
        if (this.sprite) {
            this.sprite.image = 'actors';
            // Ensure sprite screen is properly initialized
            this.sprite.screen = this.screen;
        }
        
        this.facing = util.pickInObject(geometry.DIRECTIONS);
        this.boundOnMessage = this.onMessage.bind(this);
        this.roleColor = options.roleColor;
        
        this.updateSprite();
    }

    onUpdate(): void {
        if (this.talking) this.updateSprite();
        const game = this.game as any;
        if (game.mouseOut || (game.mouseOver
            && (game.mouseOver.zDepth > this.zDepth // Don't override closer objects
            || game.mouseOver.position.z > this.position.z)) // Don't override higher objects
        || game.ui.mouseOnElement) return; // Ignore if mouse on UI element
        
        const mouse = {
            x: game.centerMouseX - game.renderer.canvases[0].panning.panned.x,
            y: game.centerMouseY - game.renderer.canvases[0].panning.panned.y
        };
        const metrics = this.sheet.map.online.north;
        if (mouse.x >= this.preciseScreen.x + metrics.ox
            && mouse.x < this.preciseScreen.x + metrics.ox + metrics.w
            && mouse.y >= this.preciseScreen.y + metrics.oy
            && mouse.y < this.preciseScreen.y + metrics.oy + metrics.h) {
            game.mouseOver = this;
        }
    }

    addToGame(game: any): void {
        super.addToGame(game);
        game.on('update', this.onUpdate.bind(this));
        // Initialize default behavior
        this.behaviors.push(new Wander(this));
        
        // Now that we have access to the renderer, update sprite with role color if needed
        if (this.roleColor) {
            this.updateSprite();
        }
    }

    updatePresence(presence: string): void {
        this.presence = presence;
        this.updateSprite();
        
        // Remove wandering behavior if going idle/offline
        if (presence != 'online') {
            for (let i = this.behaviors.length - 1; i >= 0; i--) {
                if (this.behaviors[i] instanceof Wander) {
                    this.behaviors[i].detach();
                    this.behaviors.splice(i, 1);
                }
            }
            if (this.destination) {
                this.destination = false;
                if (this.moveTick) {
                    this.removeFromSchedule(this.moveTick);
                    delete this.moveTick;
                }
            }
        } else {
            // Add wandering behavior if going online
            let hasWander = false;
            for (const behavior of this.behaviors) {
                if (behavior instanceof Wander) {
                    hasWander = true;
                    break;
                }
            }
            if (!hasWander) {
                this.behaviors.push(new Wander(this));
            }
        }
    }

    toScreenPrecise(): any {
        // Validate position coordinates before calculation
        if (isNaN(this.position.x) || isNaN(this.position.y) || isNaN(this.position.z)) {
            console.error('Actor.toScreenPrecise: Position coordinates contain NaN', {
                actor: this.username,
                position: this.position,
                caller: new Error().stack
            });
            // Return fallback coordinates to prevent further NaN propagation
            return { x: 0, y: 0 };
        }
        
        // Use delta-based interpolation if moving
        if (this.destination && this.moveStart !== undefined) {
            const game = this.game as any;
            if (game && game.ticks !== undefined) {
                const xDelta = this.destination.x - this.position.x;
                const yDelta = this.destination.y - this.position.y;
                const zDelta = this.destination.z - this.position.z;
                const tick = game.ticks - this.moveStart;
                const animation = this.sheet.map['hopping'].animation;
                const totalTicks = 3 * animation.frames;
                const progress = Math.min(tick / totalTicks, 1);
                
                const deltaScreen = {
                    x: (xDelta - yDelta) * 16 * progress,
                    y: (xDelta + yDelta) * 8 - zDelta * 16 * progress
                };
                
                return {
                    x: this.screen.x + deltaScreen.x,
                    y: this.screen.y + deltaScreen.y
                };
            }
        }
        
        // Fallback to standard screen calculation
        const screen = {
            x: (this.position.x - this.position.y) * 16 - 8,
            y: (this.position.x + this.position.y) * 8 - (this.position.z) * 16 - 8
        };
        
        // Validate calculated screen coordinates
        if (isNaN(screen.x) || isNaN(screen.y)) {
            console.error('Actor.toScreenPrecise: Calculated screen coordinates are NaN', {
                actor: this.username,
                position: this.position,
                screen: screen,
                calculation: {
                    screenX: `(${this.position.x} - ${this.position.y}) * 16 - 8 = ${(this.position.x - this.position.y) * 16 - 8}`,
                    screenY: `(${this.position.x} + ${this.position.y}) * 8 - (${this.position.z}) * 16 - 8 = ${(this.position.x + this.position.y) * 8 - (this.position.z) * 16 - 8}`
                }
            });
            // Return fallback coordinates
            return { x: 0, y: 0 };
        }
        
        return screen;
    }

    updateSprite(): void {
        if (!this.sprite) return;
        
        let facing = this.facing;
        let state: string = this.destination ? 'hopping' : this.presence;
        
        if (!this.destination && this.talking) {
            state = 'online';
            facing = facing === 'north' ? 'east' : facing === 'west' ? 'south' : facing;
        }
        
        // Get base metrics
        if (!this.sheet.map[state] || !this.sheet.map[state][facing]) {
            // Handle unknown presence states by mapping them to known states
            if (!this.sheet.map[state]) {
                switch (state) {
                    case 'dnd':
                    case 'busy':
                        state = 'idle'; // DND/busy users appear idle
                        break;
                    case 'away':
                    case 'invisible':
                        state = 'offline'; // Away/invisible users appear offline
                        break;
                    default:
                        state = 'online'; // Default fallback
                        break;
                }
            }
            
            if (!this.sheet.map[state] || !this.sheet.map[state][facing]) {
                console.error('Actor: No sprite found for state:', state, 'facing:', facing);
                console.error('Actor: Available states:', Object.keys(this.sheet.map));
                if (this.sheet.map[state]) {
                    console.error('Actor: Available facings for', state, ':', Object.keys(this.sheet.map[state]));
                }
                return;
            }
        }
        
        const baseMetrics = this.sheet.map[state][facing];
        const metrics = {
            x: baseMetrics.x,
            y: baseMetrics.y,
            w: baseMetrics.w,
            h: baseMetrics.h,
            ox: baseMetrics.ox || 0,
            oy: baseMetrics.oy || 0
        };
        
        // Apply animations
        if (!this.destination && this.talking) {
            // Talking animation: animate Y based on game ticks
            const game = this.game as any;
            if (game && game.ticks !== undefined) {
                metrics.y += (Math.floor(game.ticks / 4) % 4) * metrics.h;
            }
        } else if (this.destination) {
            // Moving animation: use frame offset
            metrics.x += (this.frame || 0) * metrics.w;
            
            // Z-level animation for hopping
            const animation = this.sheet.map['hopping'].animation;
            if (this.frame >= animation.zStartFrame) {
                const zDiff = this.destination.z - this.position.z;
                if (zDiff > 0) {
                    metrics.oy -= Math.min(8, this.frame - animation.zStartFrame);
                } else if (zDiff < 0) {
                    metrics.oy += Math.min(8, this.frame - animation.zStartFrame);
                }
            }
        }
        
        // Update messageBox screen when talking
        if (this.talking && this.messageBox) {
            this.messageBox.updateScreen();
        }
        
        // Apply to sprite
        this.sprite.metrics = metrics;
        
        // Set image with role color support
        if (this.roleColor) {
            // Ensure colored sprite exists
            const game = this.game as any;
            if (game && game.renderer && game.renderer.addColorSheet) {
                game.renderer.addColorSheet({
                    color: this.roleColor,
                    sheet: 'actors',
                    alpha: 1
                });
                this.sprite.image = [this.roleColor, 'actors'];
            } else {
                // Game/renderer not available yet, use base image for now
                // Will be updated when addToGame is called
                this.sprite.image = 'actors';
            }
        } else {
            this.sprite.image = 'actors';
        }
    }

    tryMove(x: number, y: number): any {
        const game = this.game as any;
        if (!game.world || !game.world.canWalk) return false;
        
        // Validate movement deltas
        if (isNaN(x) || isNaN(y)) {
            console.error('Actor.tryMove: Movement deltas contain NaN', {
                actor: this.username,
                deltaX: x,
                deltaY: y,
                currentPosition: this.position
            });
            return false;
        }
        
        // Validate current position before calculating destination
        if (isNaN(this.position.x) || isNaN(this.position.y)) {
            console.error('Actor.tryMove: Current position contains NaN', {
                actor: this.username,
                position: this.position,
                movementDeltas: { x, y }
            });
            return false;
        }
        
        const destination: any = { x: this.position.x + x, y: this.position.y + y };
        
        // Validate calculated destination
        if (isNaN(destination.x) || isNaN(destination.y)) {
            console.error('Actor.tryMove: Calculated destination contains NaN', {
                actor: this.username,
                destination,
                currentPosition: this.position,
                movementDeltas: { x, y }
            });
            return false;
        }
        
        if (game.world.canWalk(destination.x, destination.y)) {
            const height = game.world.getHeight(destination.x, destination.y);
            
            // Validate height from world
            if (isNaN(height)) {
                console.error('Actor.tryMove: World.getHeight returned NaN', {
                    actor: this.username,
                    destination,
                    height,
                    worldExists: !!game.world
                });
                return false;
            }
            
            destination.z = height;
            return destination;
        }
        return false;
    }

    startMove(): void {
        if (!this.destination) return;
        
        const game = this.game as any;
        if (!game || !game.world) {
            console.error('Actor.startMove: Game or world not available');
            return;
        }
        
        // Set up movement tracking
        this.moveStart = game.ticks;
        
        // Check if destination coordinates are actually free before creating placeholder
        const existingObject = game.world.objectAtXYZ(this.destination.x, this.destination.y, this.destination.z);
        if (existingObject) {
            // Actor.startMove: Destination already occupied, cancelling movement
            this.destination = false;
            return;
        }
        
        // Create placeholder at destination
        this.movePlaceholder = new Placeholder(this as any, {
            x: this.destination.x,
            y: this.destination.y, 
            z: this.destination.z
        });
        
        // Make current position unwalkable during movement
        this.unWalkable = true;
        delete game.world.walkable[this.position.x + ':' + this.position.y];
        
        // Calculate movement deltas
        this.destDelta = {
            x: this.destination.x - this.position.x,
            y: this.destination.y - this.position.y,
            z: this.destination.z - this.position.z
        };
        
        // Update facing direction
        this.facing = this.destDelta.x < 0 ? 'west' : this.destDelta.x > 0 ? 'east'
            : this.destDelta.y < 0 ? 'north' : 'south';
        
        // Initialize frame animation
        this.frame = 0;
        
        const animation = this.sheet.map['hopping'].animation;
        const halfZDepth = (this.position.x + this.position.y + (this.destDelta.x + this.destDelta.y) / 2);
        
        this.moveTick = this.tickRepeat((progress: any) => {
            if (!this.exists) {
                if (this.movePlaceholder) {
                    this.movePlaceholder.remove();
                    delete this.movePlaceholder;
                }
                return;
            }
            
            let newFrame = false;
            if (progress.ticks > 0 && progress.ticks % 3 === 0) {
                this.frame++;
                newFrame = true;
            }
            
            // Handle Z-depth changes during movement
            if (newFrame && this.frame === 6) {
                // Move zDepth half-way between tiles
                game.renderer.updateZBuffer(this.zDepth, this.sprite, halfZDepth);
                this.zDepth = halfZDepth;
            } else if (newFrame && this.frame === 8) {
                // Move zDepth all the way
                const newZDepth = this.destination.x + this.destination.y;
                game.renderer.updateZBuffer(halfZDepth, this.sprite, newZDepth);
                this.zDepth = newZDepth;
            }
            
            // Update visual position and sprite (always do this during animation)
            this.preciseScreen = this.toScreenPrecise();
            if (this.nametag) {
                this.nametag.updateScreen();
            }
            this.updateSprite();
            
            if (this.frame >= animation.frames) {
                // Movement completed - update actual position
                if (this.movePlaceholder) {
                    this.movePlaceholder.remove();
                    delete this.movePlaceholder;
                }
                this.unWalkable = false;
                
                // Move to destination (absolute positioning)
                this.move(this.destination.x, this.destination.y, this.destination.z, true);
                this.destination = false;
                this.frame = 0; // Reset frame instead of delete
                delete this.moveStart;
                delete this.destDelta;
                
                // Update sprite to reflect current presence state after movement
                this.updateSprite();
                
                this.emit('movecomplete');
                delete this.moveTick;
            }
        }, 3 * animation.frames);
        
        this.updateSprite();
    }

    move(x: number, y: number, z?: number, absolute?: boolean): void {
        // Validate input parameters
        if (isNaN(x) || isNaN(y) || (typeof z !== 'undefined' && isNaN(z))) {
            console.error('Actor.move: Invalid coordinates provided', {
                actor: this.username,
                parameters: { x, y, z, absolute },
                currentPosition: this.position
            });
            return;
        }
        
        if (absolute) {
            this.position.x = x;
            this.position.y = y;
            if (typeof z !== 'undefined') this.position.z = z;
        } else {
            // Validate current position before relative movement
            if (isNaN(this.position.x) || isNaN(this.position.y) || isNaN(this.position.z)) {
                console.error('Actor.move: Current position contains NaN before relative movement', {
                    actor: this.username,
                    position: this.position,
                    movement: { x, y, z }
                });
                return;
            }
            
            this.position.x += x;
            this.position.y += y;
            if (typeof z !== 'undefined') this.position.z += z;
        }
        
        // Validate final position
        if (isNaN(this.position.x) || isNaN(this.position.y) || isNaN(this.position.z)) {
            console.error('Actor.move: Final position contains NaN after movement', {
                actor: this.username,
                finalPosition: this.position,
                movement: { x, y, z, absolute }
            });
            return;
        }
        
        this.zDepth = this.calcZDepth();
        this.updateScreen();
        this.preciseScreen = this.toScreenPrecise();
    }

    startTalking(message: any, channel?: string, onStop?: () => void): void {
        this.talking = true;
        this.lastMessage = { channel, time: Date.now() };
        if (this.nametag) {
            this.nametag.sprite.hidden = true;
        }
        this.messageBox = new TextBox(this as any, message, true);
        this.messageBox.addToGame(this.game);
        
        const self = this;
        this.messageBox.scrollMessage(function() {
            delete self.messageBox;
            self.talking = false;
            if (self.nametag) {
                self.nametag.sprite.hidden = false;
            }
            self.updateSprite();
            self.emit('donetalking');
            //if(!self.lastSeed || self.game.ticks - self.lastSeed > 60*60) {
            //    self.lastSeed = self.game.ticks;
            //    self.game.decorator.sewSeed({ origin: self.position });
            //}
            if (onStop) onStop();
        });
    }

    onMessage(message: any): void {
        console.log(`Actor.onMessage: ${this.username} received message in channel ${message.channel} from ${message.user.username}`);
        // Move this to the GoTo behavior - original CommonJS logic
        const lastMessage = this.lastMessage as { channel?: string; time: number } || { time: 0 };
        if (message.channel !== lastMessage.channel) return; // Not my active channel
        if (lastMessage.time < Date.now() - 3 * 60 * 1000) return; // Haven't spoken in 3 minutes
        if (message.user === this || this.presence !== 'online') return; // Ignore if self or not online
        
        const self = this;
        function readyToMove() {
            for (let i = 0; i < self.behaviors.length; i++) {
                self.behaviors[i].detach();
            }
            self.behaviors = [new GoTo(self, message.user)];
        }
        
        this.tickDelay(function() {
            if (geometry.getDistance(self.position, message.user.position) < 3 // If already nearby
                || self.isUnderneath()) return; // Or if something on top of actor
            if (self.destination) {
                self.once('movecomplete', readyToMove);
            } else {
                readyToMove();
            }
        }, util.randomIntRange(0, 60)); // To prevent everyone pathfinding on the same tick
    }

    goto(x: number, y: number): void {
        console.log(`Actor.goto: ${this.username} going to (${x}, ${y})`);
        const target = { position: { x: x, y: y, z: (this.game as any).world.getHeight(x, y) } };
        
        // Remove existing GoTo behaviors
        for (let i = this.behaviors.length - 1; i >= 0; i--) {
            if (this.behaviors[i] instanceof GoTo) {
                this.behaviors[i].detach();
                this.behaviors.splice(i, 1);
            }
        }
        
        // Add new GoTo behavior
        this.behaviors.push(new GoTo(this, target));
    }

    stopGoTo(gotoBehavior?: any): void {
        for (let i = this.behaviors.length - 1; i >= 0; i--) {
            if (this.behaviors[i] instanceof GoTo) {
                if (!gotoBehavior || this.behaviors[i] === gotoBehavior) {
                    this.behaviors[i].detach();
                    this.behaviors.splice(i, 1);
                }
            }
        }
    }

    isUnderneath(): boolean {
        return this.placeholder !== undefined;
    }

    remove(): void {
        // Clean up behaviors
        for (const behavior of this.behaviors) {
            if (behavior.detach) behavior.detach();
        }
        this.behaviors = [];
        
        // Clean up movement placeholder
        if (this.movePlaceholder) {
            try {
                this.movePlaceholder.remove();
            } catch (error) {
                console.error('Actor.remove: Error removing movePlaceholder:', error);
            }
            delete this.movePlaceholder;
        }
        
        // Clean up message box first (talking takes priority)
        if (this.messageBox) {
            try {
                // Cancel any ongoing message animations before removal
                this.messageBox.remove();
            } catch (error) {
                console.error('Actor.remove: Error removing messageBox:', error);
            }
            delete this.messageBox;
        }
        
        // Clean up talk box (legacy)
        if (this.talkBox) {
            try {
                this.talkBox.remove();
            } catch (error) {
                console.error('Actor.remove: Error removing talkBox:', error);
            }
            delete this.talkBox;
        }
        
        // Clean up nametag
        if (this.nametag) {
            try {
                this.nametag.remove();
            } catch (error) {
                console.error('Actor.remove: Error removing nametag:', error);
            }
            delete this.nametag;
        }
        
        // Clean up placeholder
        if (this.placeholder) {
            try {
                this.placeholder.remove();
            } catch (error) {
                console.error('Actor.remove: Error removing placeholder:', error);
            }
            delete this.placeholder;
        }
        
        super.remove();
    }
}