'use strict';

import UIElement from './uielement.js';

interface PanelOptions {
    ui: any;
    parent: any;
    w?: number;
    h?: number;
    top?: number | 'auto';
    bottom?: number;
    left?: number | 'auto';
    right?: number;
}

export default class Panel extends UIElement {
    constructor(options: PanelOptions) {
        super(options);
        this.draw();
    }

    draw(): void {
        this.canvas.clear();
        this.canvas.fillRect('rgba(255,255,255,0.8)', 0, 0, this.w, this.h);
        this.canvas.clearRect(1, 1, this.w - 2, this.h - 2);
        this.canvas.fillRect('rgba(0,0,0,0.8)', 1, 1, this.w - 2, this.h - 2);
        this.emit('redraw');
    }
}