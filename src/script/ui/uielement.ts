'use strict';

import { EventEmitter } from 'events';
import BetterCanvas from '../common/bettercanvas.js';
import { util } from '../common/util.js';

interface UIElementOptions {
    ui: any;
    parent: any;
    w?: number;
    h?: number;
    top?: number | 'auto';
    bottom?: number;
    left?: number | 'auto';
    right?: number;
}

export default class UIElement extends EventEmitter {
    ui: any;
    parent: any;
    elements: UIElement[];
    w: number;
    h: number;
    autosize?: boolean;
    top?: number | 'auto';
    bottom?: number;
    left?: number | 'auto';
    right?: number;
    x: number = 0;
    y: number = 0;
    canvas: BetterCanvas;

    constructor(options: UIElementOptions) {
        super();
        this.ui = options.ui;
        this.parent = options.parent;
        this.elements = [];
        this.w = 1; 
        this.h = 1;
        if(options.hasOwnProperty('w')) this.w = options.w!; else this.autosize = true;
        if(options.hasOwnProperty('h')) this.h = options.h!; else this.autosize = true;
        if(options.hasOwnProperty('top')) this.top = options.top;
        if(options.hasOwnProperty('bottom')) this.bottom = options.bottom;
        if(options.hasOwnProperty('left')) this.left = options.left;
        if(options.hasOwnProperty('right')) this.right = options.right;
        this.canvas = new BetterCanvas(this.w || 1, this.h || 1);
        this.reposition();
    }

    reposition(): void {
        if(this.hasOwnProperty('top')) {
            if(this.top == 'auto') {
                this.y = Math.round(this.parent.y + this.parent.h/2 - this.h/2);
            } else {
                this.y = this.parent.y + (this.top as number);
            }
        }
        if(this.hasOwnProperty('bottom')) this.y = this.parent.y + this.parent.h - this.h - this.bottom!;
        if(this.hasOwnProperty('left')) {
            if(this.left == 'auto') {
                this.x = Math.round(this.parent.x + this.parent.w/2 - this.w/2);
            } else {
                this.x = this.parent.x + (this.left as number);
            }
        }
        if(this.hasOwnProperty('right')) this.x = this.parent.x + this.parent.w - this.w - this.right!;
        if(this.elements) {
            for(let i = 0; i < this.elements.length; i++) {
                this.elements[i].reposition();
            }
        }
    }

    redraw(canvas: any): void {
        canvas.drawImage(this.canvas.canvas || this.canvas, 0, 0, this.w, this.h, this.x, this.y, this.w, this.h);
    }

    remove(): void {
        if(this.ui.mouseOnElement === this) this.ui.mouseOnElement = false;
        this.removeAllListeners('redraw');
        this.removeAllListeners('mouse-on-element');
        this.removeAllListeners('mouse-off-element');
        util.findAndRemove(this, this.ui.elements);
        if(this.elements) {
            for(let i = 0; i < this.elements.length; i++) {
                this.elements[i].remove();
            }
        }
        this.ui.redraw();
    }

    resize(width: number, height: number): void {
        this.w = this.canvas.canvas.width = width;
        this.h = this.canvas.canvas.height = height;
        if((this as any).draw) (this as any).draw();
    }

    resizeChildren(width: number, height: number): void {
        if(this.elements) {
            for(let i = 0; i < this.elements.length; i++) {
                this.elements[i].resize(width, height);
            }
        }
    }
}