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
    nametag: TextBox;
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

    constructor(options: ActorOptions) {
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
        const screen = {
            x: (this.position.x - this.position.y) * 16 - 8,
            y: (this.position.x + this.position.y) * 8 - (this.position.z) * 16 - 8
        };
        return screen;
    }

    updateSprite(): void {
        if (!this.sprite) return;
        
        let metrics;
        let state: string;
        let facing = this.facing;
        
        // Determine state based on movement and talking
        if (this.destination) {
            // Moving - use hopping animation
            state = 'hopping';
        } else if (this.talking) {
            // Talking but not moving - use online state with special facing
            state = 'online';
            // Adjust facing for talking animation as per original code
            facing = facing === 'north' ? 'east' : facing === 'west' ? 'south' : facing;
        } else {
            // Standing - use presence state, but fallback to known states
            state = this.presence;
            
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
        }
        
        // Get base metrics
        if (!this.sheet.map[state] || !this.sheet.map[state][facing]) {
            console.error('Actor: No sprite found for state:', state, 'facing:', facing);
            console.error('Actor: Available states:', Object.keys(this.sheet.map));
            if (this.sheet.map[state]) {
                console.error('Actor: Available facings for', state, ':', Object.keys(this.sheet.map[state]));
            }
            return;
        }
        
        const baseMetrics = this.sheet.map[state][facing];
        metrics = {
            x: baseMetrics.x,
            y: baseMetrics.y,
            w: baseMetrics.w,
            h: baseMetrics.h,
            ox: baseMetrics.ox || 0,
            oy: baseMetrics.oy || 0
        };
        
        // Apply animations
        if (this.destination) {
            // Moving animation: use frame offset
            if (this.frame !== undefined) {
                metrics.x += this.frame * metrics.w;
            }
        } else if (this.talking) {
            // Talking animation: animate Y based on game ticks
            const game = this.game as any;
            if (game && game.ticks !== undefined) {
                const animFrame = Math.floor(game.ticks / 4) % 4;
                metrics.y += animFrame * metrics.h;
            }
        }
        
        // Apply to sprite
        this.sprite.metrics = metrics;
        
        // Set image - always use 'actors' as the base image
        // Role colors should be handled in rendering, not in image selection
        this.sprite.image = 'actors';
        
        // Store role color separately for potential rendering effects
        if (this.roleColor) {
            this.sprite.roleColor = this.roleColor;
        }
    }

    tryMove(x: number, y: number): any {
        const game = this.game as any;
        if (!game.world || !game.world.canWalk) return false;
        const destination: any = { x: this.position.x + x, y: this.position.y + y };
        if (game.world.canWalk(destination.x, destination.y)) {
            destination.z = game.world.getHeight(destination.x, destination.y);
            return destination;
        }
        return false;
    }

    startMove(): void {
        if (!this.destination) return;
        
        // Update facing direction
        const deltaX = this.destination.x - this.position.x;
        const deltaY = this.destination.y - this.position.y;
        
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
            this.facing = deltaX > 0 ? 'east' : 'west';
        } else {
            this.facing = deltaY > 0 ? 'south' : 'north';
        }
        
        // Initialize frame animation
        this.frame = 0;
        
        this.moveTick = this.tickRepeat((progress: any) => {
            if (progress.percent >= 1) {
                // Movement completed
                this.position.x = this.destination.x;
                this.position.y = this.destination.y;
                this.position.z = this.destination.z;
                this.destination = false;
                this.frame = 0; // Reset frame
                this.zDepth = this.calcZDepth();
                this.updateScreen();
                this.preciseScreen = this.toScreenPrecise();
                this.updateSprite(); // Update sprite when movement ends
                this.emit('movecomplete');
                delete this.moveTick;
            } else {
                // Update animation frame based on progress (simple 4-frame cycle)
                this.frame = Math.floor(progress.percent * 4) % 4;
                
                // Interpolate position during movement
                const startX = this.position.x;
                const startY = this.position.y;
                const startZ = this.position.z;
                
                const targetX = this.destination.x;
                const targetY = this.destination.y;
                const targetZ = this.destination.z;
                
                // Linear interpolation
                const currentX = startX + (targetX - startX) * progress.percent;
                const currentY = startY + (targetY - startY) * progress.percent;
                const currentZ = startZ + (targetZ - startZ) * progress.percent;
                
                // Update visual position
                this.preciseScreen = {
                    x: (currentX - currentY) * 16 - 8,
                    y: (currentX + currentY) * 8 - (currentZ) * 16 - 8
                };
                
                // Update sprite every few frames to avoid too much overhead
                if (Math.floor(progress.percent * 20) % 5 === 0) {
                    this.updateSprite();
                }
            }
        }, 20);
        
        this.updateSprite();
    }

    move(x: number, y: number, z?: number, absolute?: boolean): void {
        if (absolute) {
            this.position.x = x;
            this.position.y = y;
            if (typeof z !== 'undefined') this.position.z = z;
        } else {
            this.position.x += x;
            this.position.y += y;
            if (typeof z !== 'undefined') this.position.z += z;
        }
        this.zDepth = this.calcZDepth();
        this.updateScreen();
        this.preciseScreen = this.toScreenPrecise();
    }

    startTalking(message: any, channel?: string, onStop?: () => void): void {
        this.talking = true;
        this.lastMessage = { channel, time: Date.now() };
        this.nametag.sprite.hidden = true;
        this.messageBox = new TextBox(this as any, message, true);
        this.messageBox.addToGame(this.game);
        
        const self = this;
        this.messageBox.scrollMessage(function() {
            delete self.messageBox;
            self.talking = false;
            self.nametag.sprite.hidden = false;
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
        // This can be overridden by behaviors
        console.log(`${this.username} received message:`, message);
    }

    goto(x: number, y: number): void {
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
        
        // Clean up message box
        if (this.messageBox) {
            this.messageBox.remove();
            delete this.messageBox;
        }
        
        // Clean up talk box (legacy)
        if (this.talkBox) {
            this.talkBox.remove();
            delete this.talkBox;
        }
        
        // Clean up placeholder
        if (this.placeholder) {
            this.placeholder.remove();
            delete this.placeholder;
        }
        
        // Clean up nametag
        if (this.nametag) {
            this.nametag.remove();
        }
        
        super.remove();
    }
}