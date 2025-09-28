'use strict';

import { EventEmitter } from 'events';

interface MouseEvent {
    button: string;
    x: number;
    y: number;
}

interface KeyEvent {
    key: string;
}

interface Canvas {
    canvas: {
        canvas: HTMLCanvasElement;
    };
    scale: number;
}

export class Input extends EventEmitter {
    mouseX: number = 0;
    mouseY: number = 0;
    mouseLeft: boolean = false;
    mouseRight: boolean = false;
    mouseOut: boolean = false;
    keys: Record<string, boolean> = {};
    canvas: HTMLCanvasElement | null = null;
    mouseScale: number = 1;

    constructor() {
        super();
        this.setMaxListeners(0);
        document.addEventListener('keydown', this.keydown.bind(this));
        document.addEventListener('keyup', this.keyup.bind(this));
    }

    bindCanvas(canvas: Canvas): void {
        this.canvas = canvas.canvas.canvas; // Canvas element
        this.mouseScale = canvas.scale;
        window.addEventListener('mousemove', this.mousemove.bind(this));
        window.addEventListener('mousedown', this.mousedown.bind(this));
        window.addEventListener('mouseup', this.mouseup.bind(this));

        window.addEventListener('touchmove', this.touchmove.bind(this));
        window.addEventListener('touchstart', this.touchstart.bind(this));
        window.addEventListener('touchend', this.touchend.bind(this));
        window.addEventListener('touchcancel', this.touchend.bind(this)); // this is when someone cuts off your finger midtouch

        document.addEventListener('mouseout', this.mouseout.bind(this));
        document.addEventListener('mouseover', this.mouseover.bind(this));
        const wheelSupport = 'onwheel' in document.createElement('div') ? 'wheel' : 'mousewheel';
        window.addEventListener(wheelSupport, this.mousewheel.bind(this));
    }

    mousemove(e: Event): void {
        const mouseEvent = e as globalThis.MouseEvent;
        if (this.mouseOut) return;
        this.mouseX = Math.floor(mouseEvent.pageX / this.mouseScale);
        this.mouseY = Math.floor(mouseEvent.pageY / this.mouseScale);
        this.emit('mousemove', { x: this.mouseX, y: this.mouseY });
    }

    touchstart(e: TouchEvent): void {
        const touch = e.changedTouches[0];
        this.mouseX = Math.floor(touch.pageX / this.mouseScale);
        this.mouseY = Math.floor(touch.pageY / this.mouseScale);
        this.emit('touchstart', { button: 'touch', x: this.mouseX, y: this.mouseY });
    }

    touchend(e: TouchEvent): void {
        const touch = e.changedTouches[0];
        this.emit('touchend', { button: 'touch', x: touch.pageX, y: touch.pageY });
    }

    touchmove(e: TouchEvent): void {
        const touch = e.changedTouches[0];
        this.mouseX = Math.floor(touch.pageX / this.mouseScale);
        this.mouseY = Math.floor(touch.pageY / this.mouseScale);
        this.emit('touchmove', { button: 'touch', x: this.mouseX, y: this.mouseY });
    }

    mousedown(e: Event): void {
        const mouseEvent = e as globalThis.MouseEvent;
        const button = buttons[mouseEvent.button];
        switch (button) {
            case 'left': 
                this.mouseLeft = true; 
                break;
            case 'right': 
                this.mouseRight = true; 
                break;
        }
        this.emit('mousedown', { button: button, x: this.mouseX, y: this.mouseY });
    }

    mouseup(e: Event): void {
        const mouseEvent = e as globalThis.MouseEvent;
        const button = buttons[mouseEvent.button];
        switch (button) {
            case 'left': 
                this.mouseLeft = false; 
                break;
            case 'right': 
                this.mouseRight = false; 
                break;
        }
        this.emit('mouseup', { button: button, x: this.mouseX, y: this.mouseY });
    }

    mouseout(e: Event): void {
        const mouseEvent = e as globalThis.MouseEvent;
        const button = buttons[mouseEvent.button];
        this.mouseOut = true;
        this.mouseX = Math.floor(mouseEvent.pageX / this.mouseScale);
        this.mouseY = Math.floor(mouseEvent.pageY / this.mouseScale);
        this.emit('mouseout', { x: this.mouseX, y: this.mouseY, button: button });
    }

    mouseover(e: Event): void {
        const mouseEvent = e as globalThis.MouseEvent;
        const buttonNumber = mouseEvent.buttons & 1 ? 1 : mouseEvent.buttons & 2 ? 2 : mouseEvent.buttons & 4 ? 3 : 0;
        const button = buttons[buttonNumber - 1];
        this.mouseOut = false;
        this.mouseX = Math.floor(mouseEvent.pageX / this.mouseScale);
        this.mouseY = Math.floor(mouseEvent.pageY / this.mouseScale);
        this.emit('mouseover', { x: this.mouseX, y: this.mouseY, button: button });
    }

    mousewheel(e: Event): void {
        const wheelEvent = e as WheelEvent;
        if (!wheelEvent.deltaY) return;
        const direction = wheelEvent.deltaY > 0 ? 'down' : 'up';
        this.emit('mousewheel', { direction: direction, x: this.mouseX, y: this.mouseY });
    }

    keydown(e: Event): void {
        const keyEvent = e as KeyboardEvent;
        const key = keyEvent.keyCode >= 48 && keyEvent.keyCode <= 90 ?
            String.fromCharCode(keyEvent.keyCode).toLowerCase() : keyCodes[keyEvent.keyCode];
        if (key === 'backspace') keyEvent.preventDefault();
        if (this.keys[key]) return; // Ignore if key already held
        this.keys[key] = true;
        this.emit('keydown', { key: key });
    }

    keyup(e: Event): void {
        const keyEvent = e as KeyboardEvent;
        const key = keyEvent.keyCode >= 48 && keyEvent.keyCode <= 90 ?
            String.fromCharCode(keyEvent.keyCode).toLowerCase() : keyCodes[keyEvent.keyCode];
        if (!this.keys[key]) return; // Ignore if key already up
        this.keys[key] = false;
        this.emit('keyup', { key: key });
    }
}

const buttons = ['left', 'middle', 'right'];

const keyCodes: Record<number, string> = {
    37: "left",
    38: "up",
    39: "right",
    40: "down",
    45: "insert",
    46: "delete",
    8: "backspace",
    9: "tab",
    13: "enter",
    16: "shift",
    17: "ctrl",
    18: "alt",
    19: "pause",
    20: "capslock",
    27: "escape",
    32: "space",
    33: "pageup",
    34: "pagedown",
    35: "end",
    36: "home",
    112: "f1",
    113: "f2",
    114: "f3",
    115: "f4",
    116: "f5",
    117: "f6",
    118: "f7",
    119: "f8",
    120: "f9",
    121: "f10",
    122: "f11",
    123: "f12",
    144: "numlock",
    145: "scrolllock",
    186: "semicolon",
    187: "equal",
    188: "comma",
    189: "dash",
    190: "period",
    191: "slash",
    192: "graveaccent",
    219: "openbracket",
    220: "backslash",
    221: "closebraket",
    222: "singlequote"
};

export default Input;