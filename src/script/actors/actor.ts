'use strict';

import { gameLogger } from '../../gameLogger.js';
import { geometry } from '../common/geometry.js';
import TextBox from '../common/textbox.js';
import { util } from '../common/util.js';
import WorldObject from '../engine/worldobject.js';
import GoTo from './behaviors/goto.js';
import Wander from './behaviors/wander.js';
import Placeholder from './placeholder.js';
import Sheet from './sheet.js';

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
            gameLogger.error('Actor constructor: Invalid coordinates provided', {
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
            && mouse.x < this.preciseScreen.x + metrics.w + metrics.ox
            && mouse.y >= this.preciseScreen.y + metrics.oy
            && mouse.y < this.preciseScreen.y + metrics.h + metrics.oy) {
            game.mouseOver = this;
            // Show nametag when mouse is over this actor (unless talking)
            if (this.nametag && !this.talking) {
                this.nametag.sprite.hidden = false;
            }
        } else if (game.mouseOver === this) {
            game.mouseOver = false;
            // Hide nametag when mouse leaves this actor (unless talking)
            if (this.nametag && !this.talking) {
                this.nametag.sprite.hidden = true;
            }
        }
    }

    addToGame(game: any): void {
        super.addToGame(game);
        
        // Add role color sheet if needed
        if (this.roleColor) {
            game.renderer.addColorSheet({
                sheet: 'actors', 
                color: this.roleColor, 
                alpha: 0.8,
                regions: [{ alpha: 0.4, x: 70, y: 0, w: 28, h: 14 }] // Less colorizing for offline sprites
            });
        }
        
        // Add nametag to game
        if (this.nametag) {
            this.nametag.addToGame(game);
            // Initially hide nametag - it will be shown on mouse hover
            this.nametag.sprite.hidden = true;
        }
        
        // Set up update listener
        game.on('update', this.onUpdate.bind(this));
        
        // Connect to users message events (moved from users.ts)
        if (game.users) {
            game.users.on('message', this.boundOnMessage);
        }
        
        // Initialize default behavior
        this.behaviors.push(new Wander(this));
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
                // Only cancel movement if no movement is in progress
                if (this.moveTick) {
                    gameLogger.info('Actor cancelling movement due to presence change', {
                        username: this.username,
                        newPresence: presence
                    });
                    this.removeFromSchedule(this.moveTick);
                    delete this.moveTick;
                    // Clean up movement state
                    if (this.movePlaceholder) {
                        this.movePlaceholder.remove();
                        delete this.movePlaceholder;
                    }
                    this.unWalkable = false;
                    delete this.moveStart;
                    delete this.destDelta;
                }
                this.destination = false;
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
            gameLogger.error('Actor toScreenPrecise: Position coordinates contain NaN', {
                actor: this.username,
                position: this.position,
                uid: this.uid
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
            gameLogger.error('Actor toScreenPrecise: Calculated screen coordinates are NaN', {
                actor: this.username,
                position: this.position,
                screen: screen,
                uid: this.uid
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
                gameLogger.error('Actor sprite not found', {
                    actor: this.username,
                    state: state,
                    facing: facing,
                    availableStates: Object.keys(this.sheet.map),
                    availableFacingsForState: this.sheet.map[state] ? Object.keys(this.sheet.map[state]) : null
                });
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
            const baseX = metrics.x;
            const baseY = metrics.y;
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
        
        if (this.underneath()) {
            gameLogger.debug('Actor movement blocked: object on top', { actor: this.username });
            this.emit('getoffme');
            return false; // Can't move with object on top
        }
        
        // Validate movement deltas
        if (isNaN(x) || isNaN(y)) {
            gameLogger.error('Actor tryMove: Movement deltas contain NaN', {
                actor: this.username,
                deltaX: x,
                deltaY: y,
                currentPosition: this.position
            });
            return false;
        }
        
        // Validate current position before calculating destination
        if (isNaN(this.position.x) || isNaN(this.position.y)) {
            gameLogger.error('Actor tryMove: Current position contains NaN', {
                actor: this.username,
                position: this.position,
                movementDeltas: { x, y }
            });
            return false;
        }
        
        const destination: any = { x: this.position.x + x, y: this.position.y + y };
        
        // Validate calculated destination
        if (isNaN(destination.x) || isNaN(destination.y)) {
            gameLogger.error('Actor tryMove: Calculated destination contains NaN', {
                actor: this.username,
                destination,
                currentPosition: this.position,
                movementDeltas: { x, y }
            });
            return false;
        }

        if (game.world.canWalk(destination.x, destination.y)) {
            const walkable = game.world.getHeight(destination.x, destination.y);
            if (walkable >= 0 && Math.abs(this.position.z - walkable) <= 0.5) {
                return { x: destination.x, y: destination.y, z: walkable };
            }
            gameLogger.error('Actor tryMove: Destination not walkable or invalid height', {
                actor: this.username,
                destination,
                walkable,
                currentPosition: this.position,
                movementDeltas: { x, y }
            });
        }
        return false;
    }

    startMove(): void {
        if (!this.destination) return;
        
        // Prevent starting a new move if one is already in progress
        if (this.moveTick) {
            gameLogger.warn('Actor startMove: Movement already in progress', {
                actor: this.username,
                currentDestination: this.destination,
                frame: this.frame,
                moveStart: this.moveStart
            });
            return;
        }
        
        const game = this.game as any;
        if (!game || !game.world) {
            gameLogger.error('Actor startMove: Game or world not available', {
                actor: this.username
            });
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
        
        // Update facing direction based on the actual movement direction
        // Movement should always be exactly 1 tile in a cardinal direction
        if (this.destDelta.x > 0) {
            this.facing = 'east';
        } else if (this.destDelta.x < 0) {
            this.facing = 'west';
        } else if (this.destDelta.y > 0) {
            this.facing = 'south';
        } else if (this.destDelta.y < 0) {
            this.facing = 'north';
        }
        // If no X/Y movement, keep current facing direction
        
        // Validate that movement is cardinal (not diagonal)
        if (this.destDelta.x !== 0 && this.destDelta.y !== 0) {
            gameLogger.warn('Actor diagonal movement detected', {
                actor: this.username,
                destDelta: this.destDelta,
                destination: this.destination,
                position: this.position
            });
        }
        
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
            gameLogger.error('Actor move: Invalid coordinates provided', {
                actor: this.username,
                parameters: { x, y, z, absolute },
                currentPosition: this.position
            });
            return;
        }
        
        if (absolute) {
            // For absolute positioning, use world.moveObject to ensure walkable updates
            const game = this.game as any;
            if (game && game.world && game.world.moveObject) {
                game.world.moveObject(this, x, y, z !== undefined ? z : this.position.z);
            } else {
                // Fallback if world not available
                this.position.x = x;
                this.position.y = y;
                if (typeof z !== 'undefined') this.position.z = z;
            }
        } else {
            // For relative movement, use WorldObject's move method which calls moveObject
            if (typeof z !== 'undefined') {
                super.move(x, y, z);
            } else {
                super.move(x, y, 0);
            }
            return; // super.move handles everything including screen updates
        }
        
        // Validate final position
        if (isNaN(this.position.x) || isNaN(this.position.y) || isNaN(this.position.z)) {
            gameLogger.error('Actor move: Final position contains NaN after movement', {
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
            // Don't automatically show nametag after talking - let onUpdate handle visibility based on mouse hover
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
                || self.underneath()) return; // Or if something on top of actor
            if (self.destination) {
                self.once('movecomplete', readyToMove);
            } else {
                readyToMove();
            }
        }, util.randomIntRange(0, 60)); // To prevent everyone pathfinding on the same tick
    }

    goto(x: number, y: number): void {
        gameLogger.debug('Actor goto command', {
            actor: this.username,
            targetX: x,
            targetY: y
        });
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

    remove(): void {
        // Disconnect from users message events
        const game = this.game as any;
        if (game && game.users) {
            game.users.off('message', this.boundOnMessage);
        }
        
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
                gameLogger.error('Actor remove: Error removing movePlaceholder', {
                    actor: this.username,
                    error: error instanceof Error ? error.message : String(error)
                });
            }
            delete this.movePlaceholder;
        }
        
        // Clean up message box first (talking takes priority)
        if (this.messageBox) {
            try {
                // Cancel any ongoing message animations before removal
                this.messageBox.remove();
            } catch (error) {
                gameLogger.error('Actor remove: Error removing messageBox', {
                    actor: this.username,
                    error: error instanceof Error ? error.message : String(error)
                });
            }
            delete this.messageBox;
        }
        
        // Clean up talk box (legacy)
        if (this.talkBox) {
            try {
                this.talkBox.remove();
            } catch (error) {
                gameLogger.error('Actor remove: Error removing talkBox', {
                    actor: this.username,
                    error: error instanceof Error ? error.message : String(error)
                });
            }
            delete this.talkBox;
        }
        
        // Clean up nametag
        if (this.nametag) {
            try {
                this.nametag.remove();
            } catch (error) {
                gameLogger.error('Actor remove: Error removing nametag', {
                    actor: this.username,
                    error: error instanceof Error ? error.message : String(error)
                });
            }
            delete this.nametag;
        }
        
        // Clean up placeholder
        if (this.placeholder) {
            try {
                this.placeholder.remove();
            } catch (error) {
                gameLogger.error('Actor remove: Error removing placeholder', {
                    actor: this.username,
                    error: error instanceof Error ? error.message : String(error)
                });
            }
            delete this.placeholder;
        }
        
        super.remove();
    }
}