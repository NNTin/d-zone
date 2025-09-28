'use strict';

import UIElement from './uielement.js';
import { TextBlotter } from '../common/textblotter.js';

interface LabelOptions {
    ui: any;
    parent: any;
    w?: number;
    h?: number;
    top?: number | 'auto';
    bottom?: number;
    left?: number | 'auto';
    right?: number;
    text?: string;
    onPress?: () => void;
    hyperlink?: string;
    maxWidth?: number;
}

interface MouseEvent {
    [key: string]: any;
}

export default class Label extends UIElement {
    text?: string;
    textCanvas?: HTMLCanvasElement;
    onPress?: () => void;
    hyperlink?: string;
    maxWidth?: number;
    mouseOn?: boolean;
    pressed?: boolean;
    onMouseOnBound: (event: MouseEvent) => void;
    onMouseOffBound: (event: MouseEvent) => void;
    onMouseDownBound: (event: MouseEvent) => void;
    onMouseUpBound: (event: MouseEvent) => void;

    constructor(options: LabelOptions) {
        super(options);
        if(options.onPress) this.onPress = options.onPress;
        if(options.hyperlink) this.hyperlink = options.hyperlink;
        if(options.maxWidth) this.maxWidth = options.maxWidth;
        if(options.text) this.changeText(options.text);
        this.onMouseOnBound = this.onMouseOn.bind(this);
        this.on('mouse-on', this.onMouseOnBound);
        this.onMouseOffBound = this.onMouseOff.bind(this);
        this.on('mouse-off', this.onMouseOffBound);
        this.onMouseDownBound = this.onMouseDown.bind(this);
        this.on('mouse-down', this.onMouseDownBound);
        this.onMouseUpBound = this.onMouseUp.bind(this);
        this.on('mouse-up', this.onMouseUpBound);
    }

    changeText(text: string): void {
        this.text = text;
        this.textCanvas = TextBlotter.blot({ text: this.text, maxWidth: this.maxWidth });
        if(this.autosize) {
            this.w = this.canvas.canvas.width = this.textCanvas.width;
            this.h = this.canvas.canvas.height = this.textCanvas.height;
        }
        this.reposition();
        this.draw();
    }

    draw(): void {
        this.canvas.clear();
        if (this.textCanvas) {
            this.canvas.drawImage(this.textCanvas, 0, 0, this.textCanvas.width, this.textCanvas.height,
                0, 0, this.textCanvas.width, this.textCanvas.height);
        }
        this.emit('redraw');
    }

    onMouseOn(mouseEvent: MouseEvent): void {
        if(this.mouseOn) return;
        this.mouseOn = true;
        if(this.hyperlink) document.body.style.cursor = 'pointer';
        this.emit('mouse-on-element', this);
        this.draw();
    }

    onMouseOff(mouseEvent: MouseEvent): void {
        if(!this.mouseOn) return;
        this.mouseOn = false;
        if(this.hyperlink) document.body.style.cursor = 'default';
        this.pressed = false;
        this.emit('mouse-off-element', this);
        this.draw();
    }

    onMouseDown(mouseEvent: MouseEvent): void {
        if(!this.mouseOn) return;
        this.pressed = true;
        this.draw();
    }

    onMouseUp(mouseEvent: MouseEvent): void {
        if(!this.mouseOn) return;
        this.pressed = false;
        if(this.onPress) this.onPress();
        // Only open hyperlink if it's not a placeholder value
        if(this.hyperlink && this.hyperlink !== '#' && this.hyperlink !== 'javascript:void(0)') {
            window.open(this.hyperlink);
        }
        this.draw();
    }
}