'use strict';

import util from '../common/util.js';
import { EventEmitter } from 'events';
import BetterCanvas from '../common/bettercanvas.js';

interface CanvasOptions {
    id: string;
    game: any; // Will be properly typed later
    backgroundColor: string;
    initialScale: number;
}

interface PanningState {
    buttons: string[];
    origin: { x: number; y: number };
    panned: { x: number; y: number };
}

interface MouseEvent {
    button: string;
    x: number;
    y: number;
}

interface WheelEvent {
    direction: 'up' | 'down';
}

interface ResizeEvent {
    scale: number;
    width: number;
    height: number;
}

interface BGCanvas {
    x: number;
    y: number;
    image: HTMLCanvasElement;
}

interface Sprite {
    image?: string | string[] | HTMLCanvasElement;
    hidden?: boolean;
    position?: { z: number };
    screen: { x: number; y: number };
    metrics: {
        ox?: number;
        oy?: number;
        w: number;
        h: number;
        x: number;
        y: number;
    };
    keepOnScreen?: boolean;
    stay?: boolean;
    parent?: any;
    grid?: string;
}

export class Canvas extends EventEmitter {
    id: string;
    game: any;
    backgroundColor: string;
    scale: number;
    canvases: BetterCanvas[] = [];
    canvas!: BetterCanvas;
    context!: CanvasRenderingContext2D;
    width!: number;
    height!: number;
    halfWidth!: number;
    halfHeight!: number;
    panning: PanningState;
    images?: Record<string, HTMLCanvasElement | Record<string, HTMLCanvasElement>>;

    constructor(options: CanvasOptions) {
        super();
        this.id = options.id;
        this.game = options.game;
        this.backgroundColor = options.backgroundColor;
        this.scale = options.initialScale;
        
        for (let s = 1; s < 5; s++) {
            const newCanvas = new BetterCanvas(1, 1);
            newCanvas.canvas.id = this.id + s;
            document.body.appendChild(newCanvas.canvas);
            newCanvas.canvas.style.transform = `scale(${s}, ${s})`;
            const context = newCanvas.context as any;
            if (context.mozImageSmoothingEnabled !== undefined) {
                context.mozImageSmoothingEnabled = false;
            }
            context.imageSmoothingEnabled = false;
            newCanvas.canvas.addEventListener("contextmenu", (e) => {
                e.preventDefault();
            });
            this.canvases.push(newCanvas);
        }
        
        this.onZoom();
        this.onResize();
        window.addEventListener('resize', this.onResize.bind(this));
        
        this.panning = {
            buttons: [],
            origin: { x: 0, y: 0 },
            panned: { x: 0, y: 32 }
        };

        const self = this;
        
        this.game.on('mousedown', (mouseEvent: MouseEvent) => {
            if (self.game.ui.mouseOnElement) return;
            if (self.panning.buttons.length === 0) {
                self.panning.origin.x = mouseEvent.x;
                self.panning.origin.y = mouseEvent.y;
            }
            self.panning.buttons.push(mouseEvent.button);
        });
        
        this.game.on('mouseup', (mouseEvent: MouseEvent) => {
            util.findAndRemove(mouseEvent.button, self.panning.buttons);
        });
        
        this.game.on('mousemove', (mouseEvent: MouseEvent) => {
            const dx = mouseEvent.x - self.panning.origin.x;
            const dy = mouseEvent.y - self.panning.origin.y;
            if (self.panning.buttons.length > 0) {
                self.panning.panned.x += dx;
                self.panning.panned.y += dy;
            }
            self.panning.origin.x = mouseEvent.x;
            self.panning.origin.y = mouseEvent.y;
        });

        // Touch handling
        this.game.on('touchstart', (mouseEvent: MouseEvent) => {
            if (self.game.ui.mouseOnElement) return;
            if (self.panning.buttons.length === 0) {
                self.panning.origin.x = mouseEvent.x;
                self.panning.origin.y = mouseEvent.y;
            }
            self.panning.buttons.push(mouseEvent.button);
        });

        this.game.on('touchend', (mouseEvent: MouseEvent) => {
            util.findAndRemove(mouseEvent.button, self.panning.buttons);
        });

        this.game.on('touchmove', (mouseEvent: MouseEvent) => {
            const dx = mouseEvent.x - self.panning.origin.x;
            const dy = mouseEvent.y - self.panning.origin.y;
            if (self.panning.buttons.length > 0) {
                self.panning.panned.x += dx;
                self.panning.panned.y += dy;
            }
            self.panning.origin.x = mouseEvent.x;
            self.panning.origin.y = mouseEvent.y;
        });

        this.game.on('mouseout', (mouseEvent: MouseEvent) => {
            // Handle mouseout if needed
        });
        
        this.game.on('mouseover', (mouseEvent: MouseEvent) => {
            self.panning.origin.x = mouseEvent.x;
            self.panning.origin.y = mouseEvent.y;
            if (!mouseEvent.button) self.panning.buttons = [];
        });
        
        this.game.on('mousewheel', (mouseEvent: WheelEvent) => {
            const newScale = util.clamp(self.scale + (mouseEvent.direction === 'up' ? 1 : -1), 1, 4);
            if (newScale === self.scale) return;
            self.scale = newScale;
            self.onZoom();
            self.onResize();
        });
    }

    setRenderer(renderer: any): void {
        this.images = renderer.images;
    }

    onResize(): void {
        this.width = this.canvas.canvas.width = Math.ceil(window.innerWidth / this.scale);
        this.height = this.canvas.canvas.height = Math.ceil(window.innerHeight / this.scale);
        this.halfWidth = Math.round(this.width / 2);
        this.halfHeight = Math.round(this.height / 2);
        this.emit('resize', { scale: this.scale, width: this.width, height: this.height });
    }

    onZoom(): void {
        for (let s = 0; s < this.canvases.length; s++) {
            if (s + 1 === this.scale) {
                this.canvases[s].canvas.style.zIndex = '5';
                this.canvas = this.canvases[s];
                this.context = this.canvas.context;
            } else {
                this.canvases[s].canvas.style.zIndex = '1';
            }
        }
    }

    draw(): void {
        // This method is now simplified - actual rendering logic moved to renderer
        // Kept for compatibility but actual rendering now happens in renderer.ts
    }

    drawStatic(staticCanvas: HTMLCanvasElement): void {
        this.context.drawImage(staticCanvas, 0, 0);
    }

    drawBG(bgCanvas: BGCanvas): void {
        if (!bgCanvas || !bgCanvas.image) {
            console.error('Canvas: No bgCanvas or bgCanvas.image');
            return;
        }
        
        const x = bgCanvas.x + this.halfWidth + this.panning.panned.x;
        const y = bgCanvas.y + this.halfHeight + this.panning.panned.y;

        if (x >= this.width || y >= this.height
            || x * -1 >= bgCanvas.image.width || y * -1 >= bgCanvas.image.height) {
            return; // BG canvas is out of frame
        }
        
        const canvasStart = {
            x: Math.max(0, x), 
            y: Math.max(0, y)
        };
        
        const canvasClipped = {
            w: Math.min(bgCanvas.image.width, this.width, this.width - x),
            h: Math.min(bgCanvas.image.height, this.height, this.height - y)
        };
        
        const bgStart = {
            x: Math.max(0, x * -1), 
            y: Math.max(0, y * -1)
        };
        
        const bgEnd = {
            x: Math.min(bgCanvas.image.width, bgStart.x + canvasClipped.w),
            y: Math.min(bgCanvas.image.height, bgStart.y + canvasClipped.h)
        };
        
        const clipped = {
            x: bgEnd.x - bgStart.x, 
            y: bgEnd.y - bgStart.y
        };
        
        this.context.drawImage(
            bgCanvas.image, bgStart.x, bgStart.y, clipped.x, clipped.y,
            canvasStart.x, canvasStart.y, clipped.x, clipped.y
        );
    }

    drawEntity(sprite: Sprite): void {
        if (!sprite || !sprite.image || sprite.hidden) return;
        if (sprite.position && sprite.position.z > this.game.hideZ) return;
                
        const screen = {
            x: sprite.screen.x + this.halfWidth + this.panning.panned.x + (sprite.metrics.ox || 0),
            y: sprite.screen.y + this.halfHeight + this.panning.panned.y + (sprite.metrics.oy || 0)
        };
        
        if (sprite.keepOnScreen) {
            screen.x = Math.min(this.width - sprite.metrics.w, Math.max(0, screen.x));
            screen.y = Math.min(this.height - sprite.metrics.h, Math.max(0, screen.y));
        }
        
        if (screen.x >= this.width || screen.y >= this.height
            || screen.x + sprite.metrics.w <= 0 || screen.y + sprite.metrics.h <= 0) return;

        let image: HTMLCanvasElement;
        if (Array.isArray(sprite.image)) {
            image = (this.images![sprite.image[0]] as Record<string, HTMLCanvasElement>)[sprite.image[1]];
        } else if (typeof sprite.image === 'string') {
            image = this.images![sprite.image] as HTMLCanvasElement;
        } else {
            image = sprite.image;
        }
        
        const highlight = sprite === this.game.mouseOver?.sprite;
        if (highlight) {
            this.context.save();
            this.context.shadowColor = 'rgba(255,255,255,1)';
            this.context.shadowBlur = 3;
        }
        
        if (!sprite.stay && sprite.parent && this.game.mouseOver !== sprite.parent) return;
        
        // Debug: Check for NaN values before drawing
        const hasNaNValues = !isFinite(screen.x) || !isFinite(screen.y) || 
                            !isFinite(sprite.metrics.x) || !isFinite(sprite.metrics.y) || 
                            !isFinite(sprite.metrics.w) || !isFinite(sprite.metrics.h);
        
        if (hasNaNValues) {
            console.error('Canvas.drawEntity - NaN detected:', {
                spriteType: sprite.constructor?.name || 'unknown',
                spriteParent: sprite.parent?.constructor?.name || 'no parent',
                spriteParentUsername: sprite.parent?.username || 'no username',
                spriteParentPosition: sprite.parent?.position || 'no position',
                spriteImage: typeof sprite.image === 'string' ? sprite.image : 'canvas object',
                screen: { x: screen.x, y: screen.y },
                metrics: sprite.metrics,
                drawImageParams: [
                    sprite.metrics.x, sprite.metrics.y, sprite.metrics.w, sprite.metrics.h,
                    Math.round(screen.x), Math.round(screen.y), sprite.metrics.w, sprite.metrics.h
                ]
            });
        }
        
        this.canvas.drawImage(
            image, sprite.metrics.x, sprite.metrics.y, sprite.metrics.w, sprite.metrics.h,
            Math.round(screen.x), Math.round(screen.y), sprite.metrics.w, sprite.metrics.h
        );
        
        if (highlight) {
            this.context.restore();
        }
        
        if (this.game.showGrid && sprite.grid) { // Show tile grid
            this.context.fillStyle = '#bbbbbb';
            this.context.font = '9px Arial';
            this.context.fillText(sprite.grid, Math.round(screen.x) + 5, Math.round(screen.y) + 9);
        }
    }
}

export default Canvas;