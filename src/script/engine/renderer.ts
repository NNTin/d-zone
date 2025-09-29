'use strict';

import { EventEmitter } from 'events';
import { ColorUtil } from '../common/colorutil.js';

interface RendererOptions {
    game: any;
    images: Record<string, HTMLCanvasElement>;
}

interface Sprite {
    position?: {
        z: number;
        fakeZ: number;
    };
}

export class Renderer extends EventEmitter {
    game: any;
    images: Record<string, any>;
    updateDrawn: boolean = false;
    zBuffer: Record<string, Sprite[]> = {};
    zBufferKeys: string[] = [];
    overlay: any[] = [];
    frames: number = 0;
    canvases?: any[];
    bgCanvas?: any;

    constructor(options: RendererOptions) {
        super();
        this.game = options.game;
        this.images = options.images;

        const self = this;
        this.game.on('render', function () {
            self.updateDrawn = false;
        });

        const draw = () => {
            if (self.updateDrawn === false) {
                if (self.canvases) {
                    const timeThis = self.game.timeRenders && (self.game.ticks & 511) === 0;
                    if (timeThis) console.time('render');
                    
                    for (let c = 0; c < self.canvases.length; c++) {
                        const canvas = self.canvases[c];
                        // Clear canvas first
                        canvas.canvas.fill(canvas.backgroundColor);
                        
                        // Draw background tiles before entities
                        if (self.bgCanvas) {
                            canvas.drawBG(self.bgCanvas);
                        }
                        
                        // Draw connecting message if no servers
                        if (!self.game.servers) {
                            canvas.context.fillStyle = '#d4cfb6';
                            canvas.context.font = '14px Arial';
                            canvas.context.textAlign = 'center';
                            canvas.context.fillText('connecting...', Math.round(canvas.width / 2), Math.round(canvas.height / 2 - 4));
                        }
                        
                        // Draw entities
                        let entityCount = 0;
                        for (let z = 0; z < self.zBufferKeys.length; z++) {
                            const zBufferDepth = self.zBuffer[self.zBufferKeys[z]];
                            for (let zz = 0; zz < zBufferDepth.length; zz++) {
                                canvas.drawEntity(zBufferDepth[zz]);
                                entityCount++;
                            }
                        }
                        for (let o = 0; o < self.overlay.length; o++) {
                            canvas.drawEntity(self.overlay[o]);
                            entityCount++;
                        }
                        
                        if (self.game.ui) self.game.ui.emit('draw', canvas);
                    }
                    if (timeThis) console.timeEnd('render');
                }
                self.updateDrawn = true;
            }
            requestAnimationFrame(draw);
        };
        requestAnimationFrame(draw);
    }

    addCanvas(canvas: any): void {
        canvas.setRenderer(this);
        if (!this.canvases) this.canvases = [];
        this.canvases.push(canvas);
    }

    addToZBuffer(sprite: Sprite, newZDepth: string): void {
        const zBufferDepth = this.zBuffer[newZDepth];
        if (zBufferDepth) {
            zBufferDepth.push(sprite);
            zBufferDepth.sort((a, b) => {
                const aZ = (a.position?.z || 0) + (a.position?.fakeZ || 0);
                const bZ = (b.position?.z || 0) + (b.position?.fakeZ || 0);
                return aZ - bZ;
            });
        } else {
            this.zBuffer[newZDepth] = [sprite];
        }
        this.zBufferKeys = Object.keys(this.zBuffer);
        this.zBufferKeys.sort((a, b) => parseInt(a) - parseInt(b));
    }

    updateZBuffer(oldZDepth: string, obj: Sprite, newZDepth: string): void {
        this.removeFromZBuffer(obj, oldZDepth);
        this.addToZBuffer(obj, newZDepth);
    }

    removeFromZBuffer(obj: Sprite, zDepth: string): void {
        const zBufferDepth = this.zBuffer[zDepth];
        if (zBufferDepth) {
            for (let i = 0; i < zBufferDepth.length; i++) {
                if (zBufferDepth[i] === obj) {
                    zBufferDepth.splice(i, 1);
                    break;
                }
            }
        }
    }

    addColorSheet(options: any): void {
        if (!this.images[options.color]) this.images[options.color] = {};
        if (this.images[options.color][options.sheet]) {
            return;
        }
        options.image = this.images[options.sheet];
        
        if (!options.image) {
            console.error('Renderer.addColorSheet - Base image not found:', options.sheet);
            console.error('Available images:', Object.keys(this.images));
            return;
        }
        
        this.images[options.color][options.sheet] = ColorUtil.colorize(options);
    }

    clear(): void {
        this.zBuffer = {};
        this.zBufferKeys = [];
        this.overlay = [];
    }
}

export default Renderer;