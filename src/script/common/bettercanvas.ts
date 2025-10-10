'use strict';

import { gameLogger } from '../../gameLogger.js';

function isNumeric(n: any): n is number {
    return !isNaN(parseFloat(n)) && isFinite(n);
}

export class BetterCanvas {
    canvas: HTMLCanvasElement;
    context: CanvasRenderingContext2D;

    constructor(width: number, height: number) {
        if (!isNumeric(width) || !isNumeric(height)) {
            gameLogger.error('BetterCanvas: Invalid canvas size', { width, height });
        }
        this.canvas = document.createElement('canvas');
        this.canvas.width = width;
        this.canvas.height = height;
        const context = this.canvas.getContext('2d');
        if (!context) {
            throw new Error('Could not get 2D context from canvas');
        }
        this.context = context;
    }

    drawImage(
        img: CanvasImageSource, 
        sx: number, 
        sy: number, 
        sw: number, 
        sh: number, 
        dx: number, 
        dy: number, 
        dw: number, 
        dh: number, 
        opacity?: number
    ): void {
        if (!img || !(sx >= 0) || !(sy >= 0) || !(sw >= 0) || !(sh >= 0)
            || !isNumeric(dx) || !isNumeric(dy) || !(dw >= 0) || !(dh >= 0)) {
            gameLogger.error('BetterCanvas drawImage: Invalid parameters', { 
                hasImg: !!img, sx, sy, sw, sh, dx, dy, dw, dh 
            });
            if ((window as any).pause) {
                (window as any).pause();
            }
        }
        if (opacity !== undefined) {
            this.context.save();
            this.context.globalAlpha = opacity;
        }
        this.context.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
        if (opacity !== undefined) {
            this.context.restore();
        }
    }

    fill(color: string): void {
        this.context.fillStyle = color;
        this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    clear(): void {
        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    fillRect(color: string, x: number, y: number, w: number, h: number): void {
        if (!isNumeric(x) || !isNumeric(y) || !isNumeric(w) || !isNumeric(h)) {
            gameLogger.error('BetterCanvas fillRect: Invalid parameters', { color, x, y, w, h });
            if ((window as any).pause) {
                (window as any).pause();
            }
        }
        this.context.fillStyle = color;
        this.context.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    }

    clearRect(x: number, y: number, w: number, h: number): void {
        if (!isNumeric(x) || !isNumeric(y) || !isNumeric(w) || !isNumeric(h)) {
            gameLogger.error('BetterCanvas clearRect: Invalid parameters', { x, y, w, h });
            if ((window as any).pause) {
                (window as any).pause();
            }
        }
        this.context.clearRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    }
}

export default BetterCanvas;