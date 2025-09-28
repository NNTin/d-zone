'use strict';

import UIElement from './uielement.js';
import { TextBlotter } from '../common/textblotter.js';

interface ButtonOptions {
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
    disabled?: boolean;
}

interface MouseEvent {
    [key: string]: any;
}

export default class Button extends UIElement {
    text?: string;
    textCanvas?: HTMLCanvasElement;
    onPress?: () => void;
    disabled?: boolean;
    mouseOn?: boolean;
    pressed?: boolean;
    onMouseOnBound: (event: MouseEvent) => void;
    onMouseOffBound: (event: MouseEvent) => void;
    onMouseDownBound: (event: MouseEvent) => void;
    onMouseUpBound: (event: MouseEvent) => void;

    constructor(options: ButtonOptions) {
        super(options);
        if(options.text) this.changeText(options.text);
        if(options.onPress) this.onPress = options.onPress;
        if(options.disabled) this.disabled = true;
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
        this.textCanvas = TextBlotter.blot({ text: this.text });
        if(this.autosize) {
            this.w = this.canvas.canvas.width = this.textCanvas.width + 2;
            this.h = this.canvas.canvas.height = this.textCanvas.height + 2;
        }
        this.draw();
    }

    draw(): void {
        this.canvas.clear();
        this.canvas.fillRect('rgba(255,255,255,0.8)', 0, 0, this.w, this.h);
        this.canvas.clearRect(1, 1, this.w - 2, this.h - 2);
        const buttonColor = 'rgba(' + (this.mouseOn ? '77,102,184,0.9)' : this.disabled ? '245,240,213,0.3)' : '0,0,0,0.8)');
        this.canvas.fillRect(buttonColor, 1, 1, this.w - 2, this.h - 2);
        if (this.textCanvas) {
            const textOffset = Math.floor((this.canvas.canvas.width - this.textCanvas.width) / 2);
            this.canvas.drawImage(this.textCanvas, 0, 0, this.textCanvas.width, this.textCanvas.height,
                textOffset, 1, this.textCanvas.width, this.textCanvas.height);
        }
        this.emit('redraw');
    }

    onMouseOn(mouseEvent: MouseEvent): void {
        if(this.disabled || this.mouseOn) return;
        this.mouseOn = true;
        this.emit('mouse-on-element', this);
        this.draw();
    }

    onMouseOff(mouseEvent: MouseEvent): void {
        if(this.disabled || !this.mouseOn) return;
        this.mouseOn = false;
        this.pressed = false;
        this.emit('mouse-off-element', this);
        this.draw();
    }

    onMouseDown(mouseEvent: MouseEvent): void {
        if(this.disabled || !this.mouseOn) return;
        this.pressed = true;
        this.draw();
    }

    onMouseUp(mouseEvent: MouseEvent): void {
        if(this.disabled || !this.mouseOn) return;
        this.pressed = false;
        if(this.onPress) this.onPress();
        this.draw();
    }
}