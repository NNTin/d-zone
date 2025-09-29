'use strict';

import UIElement from './uielement.js';
import { TextBlotter } from '../common/textblotter.js';
import { util } from '../common/util.js';

interface InputOptions {
    ui: any;
    parent: any;
    w?: number;
    h?: number;
    top?: number | 'auto';
    bottom?: number;
    left?: number | 'auto';
    right?: number;
    text?: string;
    onSubmit?: (text: string) => void;
}

interface MouseEvent {
    [key: string]: any;
}

interface KeyEvent {
    key: string;
    [key: string]: any;
}

export default class Input extends UIElement {
    text: string = '';
    textCanvas?: HTMLCanvasElement;
    onSubmit?: (text: string) => void;
    focused?: boolean;
    mouseOn?: boolean;
    onMouseOnBound: (event: MouseEvent) => void;
    onMouseOffBound: (event: MouseEvent) => void;
    onMouseDownBound: (event: MouseEvent) => void;
    onMouseUpBound: (event: MouseEvent) => void;
    onKeyDownBound: (event: KeyEvent) => void;

    constructor(options: InputOptions) {
        super(options);
        this.changeText(options.text || '');
        if(options.onSubmit) this.onSubmit = options.onSubmit;
        this.onMouseOnBound = this.onMouseOn.bind(this);
        this.on('mouse-on', this.onMouseOnBound);
        this.onMouseOffBound = this.onMouseOff.bind(this);
        this.on('mouse-off', this.onMouseOffBound);
        this.onMouseDownBound = this.onMouseDown.bind(this);
        this.on('mouse-down', this.onMouseDownBound);
        this.onMouseUpBound = this.onMouseUp.bind(this);
        this.on('mouse-up', this.onMouseUpBound);
        this.onKeyDownBound = this.onKeyDown.bind(this);
        this.on('key-down', this.onKeyDownBound);
    }

    changeText(text: string): void {
        this.text = text;
        const showText = text + (this.focused ? '_' : '');
        this.textCanvas = TextBlotter.blot({ text: showText });
        if(this.autosize) {
            this.w = this.canvas.canvas.width = this.textCanvas.width + 2;
            this.h = this.canvas.canvas.height = this.textCanvas.height + 2;
        }
        this.draw();
    }

    draw(): void {
        this.canvas.clear();
        let borderColor = this.mouseOn ? 'rgba(220,220,220,0.8)' : 'rgba(255,255,255,0.8)';
        borderColor = this.focused ? 'rgba(115,138,215,0.8)' : borderColor;
        this.canvas.fillRect(borderColor, 0, 0, this.w, this.h);
        this.canvas.clearRect(1, 1, this.w - 2, this.h - 2);
        this.canvas.fillRect('rgba(0,0,0,0.8)', 1, 1, this.w - 2, this.h - 2);
        if (this.textCanvas) {
            this.canvas.drawImage(this.textCanvas, 0, 0, this.textCanvas.width, this.textCanvas.height,
                1, 1, this.textCanvas.width, this.textCanvas.height);
        }
        this.emit('redraw');
    }

    focus(setTo?: boolean): void {
        this.focused = setTo !== false;
        this.changeText(this.text);
    }

    submit(): void {
        if (this.onSubmit) {
            this.onSubmit(this.text);
        }
    }

    onMouseOn(mouseEvent: MouseEvent): void {
        if(this.mouseOn) return;
        this.mouseOn = true;
        this.emit('mouse-on-element', this);
        this.draw();
    }

    onMouseOff(mouseEvent: MouseEvent): void {
        if(!this.mouseOn) return;
        this.mouseOn = false;
        this.emit('mouse-off-element', this);
        this.draw();
    }

    onMouseDown(mouseEvent: MouseEvent): void {
        if(!this.mouseOn) this.focus(false);
    }

    onMouseUp(mouseEvent: MouseEvent): void {
        if(this.mouseOn) this.focus();
    }

    onKeyDown(keyEvent: KeyEvent): void {
        if(!this.focused) return;
        if(keyEvent.key == 'enter') this.submit();
        // TODO: Move this stuff into a typing event in engine/input.js
        let typed = keyEvent.key;
        if(keyEvent.key == 'backspace') {
            this.changeText(this.text.substring(0, Math.max(0, this.text.length - 1)));
        } else {
            if(keyEvent.key == 'period') typed = '.';
            if(keyEvent.key == 'dash') typed = '-';
            if(typed != '.' && typed != '-' 
                && (util.alphabet as readonly string[]).indexOf(typed) < 0 && (util.hex as readonly string[]).indexOf(typed) < 0) return;
            this.changeText(this.text + ((this.ui.game.input.keys.shift) ? typed.toUpperCase() : typed));
        }
    }
}