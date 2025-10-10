import { EventEmitter } from 'events';
import { gameLogger } from '../../gameLogger.js';
import util from '../common/util.js';
import { Input } from './input.js';

interface GameOptions {
    step?: number;
}

interface Task {
    type: 'repeat' | 'once' | 'deleted';
    start?: number;
    count?: number;
    cb: (data?: any) => void;
    afterCB?: () => void;
    tick?: number;
}

interface MouseEvent {
    button: string;
    x: number;
    y: number;
    centerMouseX?: number;
    centerMouseY?: number;
}

interface KeyEvent {
    key: string;
}

interface ResizeEvent {
    width: number;
    height: number;
    scale: number;
}

interface GameCanvas {
    canvas: {
        canvas: HTMLCanvasElement;
    };
    scale: number;
    width: number;
    height: number;
    on(event: string, callback: (data: any) => void): void;
}

// Performance timing function
const now = (() => {
    if (typeof performance !== 'undefined' && performance.now) {
        return () => performance.now();
    }
    return () => Date.now();
})();

export class Game extends EventEmitter {
    step: number;
    lastUpdate: number = 0;
    dt: number = 0;
    ticks: number = 0;
    crashed?: boolean;
    paused?: boolean;
    
    input: Input;
    mouseButtons: string[] = [];
    centerMouseX: number = -999;
    centerMouseY: number = -999;
    mouseX?: number;
    mouseY?: number;
    mouseOut?: boolean;
    mouseOver?: any;
    
    entities: any[] = [];
    schedule: Task[] = [];
    
    viewWidth?: number;
    viewHeight?: number;
    
    interval: NodeJS.Timeout;
    
    // Optional properties that may be set externally
    renderer?: any;
    ui?: any;
    users?: any;
    servers?: Record<string, any>;
    server?: string;
    world?: any;
    timeUpdates?: boolean;
    timeRenders?: boolean;
    showGrid?: boolean;
    helpPanel?: any;
    helpButton?: any;
    serverListPanel?: any;
    pendingServerJoin?: any;
    decorator?: any;
    hideZ?: number;

    constructor(options: GameOptions = {}) {
        super();
        this.setMaxListeners(0);
        this.step = options.step || 1000 / 60;

        this.input = new Input();
        this.input.on('keydown', this.keydown.bind(this));
        this.input.on('keyup', this.keyup.bind(this));

        const self = this;
        this.interval = setInterval(function() {
            if (self.crashed) return;
            const rightNow = now();
            self.dt += rightNow - self.lastUpdate;
            if (self.lastUpdate > 0 && self.dt > 60000) {
                gameLogger.error('Game engine: Too many updates missed, crashing', {
                    deltaTime: self.dt,
                    lastUpdate: self.lastUpdate,
                    currentTime: rightNow
                });
                self.crashed = true; 
                self.paused = true;
            }
            if (self.dt > self.step) {
                while (self.dt >= self.step) {
                    self.dt -= self.step;
                    if (self.paused) continue;
                    self.ticks++;
                    self.update();
                }
            }
            self.lastUpdate = now();
        }, this.step);
    }

    update(): void {
        const timeThis = this.timeUpdates && (this.ticks & 255) === 0;
        if (timeThis) console.time('update');
        
        this.emit('update');
        
        // TODO: Move scheduling to entity?
        for (let i = 0; i < this.schedule.length; i++) {
            const task = this.schedule[i];
            let endTick: number | undefined;
            
            if (task.type === 'repeat') {
                endTick = task.start! + task.count!;
                if (task.start! <= this.ticks) {
                    const ticks = this.ticks - task.start!;
                    const percent = task.count! > 0 ? ticks / task.count! : 1; // Prevent division by zero
                    
                    // Additional safety check
                    if (!isFinite(percent)) {
                        gameLogger.error('Game update: Invalid progress calculation', {
                            ticks,
                            taskCount: task.count,
                            taskStart: task.start,
                            gameTicks: this.ticks,
                            percent
                        });
                        // Mark task for deletion to prevent further issues
                        task.type = 'deleted';
                        continue;
                    }
                    
                    task.cb({ ticks: ticks, percent: percent });
                }
            } else if (task.type === 'once') {
                endTick = task.tick;
            }
            
            if (task.type === 'deleted' || (endTick !== undefined && endTick <= this.ticks)) {
                if (task.type === 'once') task.cb();
                else if (task.type === 'repeat' && task.afterCB) task.afterCB();
                this.schedule.splice(i, 1);
                i--;
            }
        }
        
        this.emit('render');
        if (timeThis) console.timeEnd('update');
    }

    bindCanvas(canvas: GameCanvas): void {
        this.input.bindCanvas(canvas);
        this.viewWidth = canvas.width;
        this.viewHeight = canvas.height;
        this.input.on('mousemove', this.mousemove.bind(this));
        this.input.on('mousedown', this.mousedown.bind(this));
        this.input.on('mouseup', this.mouseup.bind(this));
        this.input.on('mouseout', this.mouseout.bind(this));
        this.input.on('mouseover', this.mouseover.bind(this));
        this.input.on('mousewheel', this.mousewheel.bind(this));

        this.input.on('touchmove', this.touchmove.bind(this));
        this.input.on('touchstart', this.touchstart.bind(this));
        this.input.on('touchend', this.touchend.bind(this));
        this.input.on('touchcancel', this.touchcancel.bind(this));
        canvas.on('resize', this.viewResize.bind(this));
    }

    viewResize(resize: ResizeEvent): void {
        this.viewWidth = resize.width;
        this.viewHeight = resize.height;
        this.input.mouseScale = resize.scale;
        
        // Log canvas resize event for E2E testing
        gameLogger.canvasResize(resize.width, resize.height);
        
        this.emit('resize', resize);
    }

    mousemove(mouseEvent: MouseEvent): void {
        if (this.mouseOut) return;
        this.mouseX = mouseEvent.x;
        this.mouseY = mouseEvent.y;
        this.centerMouseX = Math.floor(mouseEvent.x - (this.viewWidth || 0) / 2);
        this.centerMouseY = Math.floor(mouseEvent.y - (this.viewHeight || 0) / 2);
        mouseEvent.centerMouseX = this.centerMouseX;
        mouseEvent.centerMouseY = this.centerMouseY;
        this.emit('mousemove', mouseEvent);
    }

    mousedown(mouseEvent: MouseEvent): void {
        if (this.mouseOver) {
            gameLogger.debug('Game mousedown: Target selected', {
                target: this.mouseOver.constructor?.name || 'unknown',
                position: this.mouseOver.position || null
            });
            (window as any).actor = this.mouseOver;
        }
        this.mouseButtons.push(mouseEvent.button);
        this.emit('mousedown', mouseEvent);
    }

    touchend(mouseEvent: MouseEvent): void {
        util.findAndRemove(mouseEvent.button, this.mouseButtons);
        this.emit('touchend', mouseEvent);
    }

    touchmove(mouseEvent: MouseEvent): void {
        if (this.mouseOut) return;
        this.mouseOut = false;
        this.mouseX = mouseEvent.x;
        this.mouseY = mouseEvent.y;
        this.centerMouseX = Math.floor(mouseEvent.x - (this.viewWidth || 0) / 2);
        this.centerMouseY = Math.floor(mouseEvent.y - (this.viewHeight || 0) / 2);
        mouseEvent.centerMouseX = this.centerMouseX;
        mouseEvent.centerMouseY = this.centerMouseY;
        this.emit('touchmove', mouseEvent);
    }

    touchcancel(mouseEvent: MouseEvent): void {
        this.mouseOut = true;
        this.mouseOver = false;
        this.emit('touchcancel', mouseEvent);
    }

    touchstart(mouseEvent: MouseEvent): void {
        if (this.mouseOver) {
            gameLogger.debug('Game touchstart: Target selected', {
                target: this.mouseOver.constructor?.name || 'unknown',
                position: this.mouseOver.position || null
            });
            (window as any).actor = this.mouseOver;
        }
        this.mouseButtons.push(mouseEvent.button);
        this.emit('touchstart', mouseEvent);
    }

    mouseup(mouseEvent: MouseEvent): void {
        util.findAndRemove(mouseEvent.button, this.mouseButtons);
        this.emit('mouseup', mouseEvent);
    }

    mouseout(mouseEvent: MouseEvent): void {
        this.mouseOut = true;
        this.mouseOver = false;
        this.emit('mouseout', mouseEvent);
    }

    mouseover(mouseEvent: MouseEvent): void {
        this.mouseOut = false;
        this.emit('mouseover', mouseEvent);
    }

    mousewheel(mouseEvent: any): void {
        this.emit('mousewheel', mouseEvent);
    }

    keydown(keyEvent: KeyEvent): void {
        this.emit('keydown', keyEvent);
    }

    keyup(keyEvent: KeyEvent): void {
        this.emit('keyup', keyEvent);
    }

    reset(): void {
        this.emit('destroy');
        this.removeAllListeners('update');
        this.schedule = [];
        while (this.entities.length > 0) {
            if (this.entities[0].remove) {
                this.entities[0].remove();
            } else {
                this.entities.splice(0, 1);
            }
        }
    }
}

export default Game;