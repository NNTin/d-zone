'use strict';

import { EventEmitter } from 'events';
import BetterCanvas from '../common/bettercanvas.js';
import { TextBlotter } from '../common/textblotter.js';
import Button from './button.js';
import Input from './input.js';
import Label from './label.js';
import Panel from './panel.js';
import UIElement from './uielement.js';

interface UIOptions {
    [key: string]: any;
}

interface MouseEvent {
    x: number;
    y: number;
    [key: string]: any;
}

interface KeyEvent {
    [key: string]: any;
}

interface Game {
    renderer?: {
        images: {
            font: HTMLImageElement | HTMLCanvasElement;
        };
    };
    mouseButtons: any[];
    mouseOver: boolean;
    on(event: string, callback: Function): void;
}

interface Resize {
    width: number;
    height: number;
}

export default class UI extends EventEmitter {
    game: Game;
    elements: UIElement[] = [];
    x: number = 0;
    y: number = 0;
    w?: number;
    h?: number;
    canvas: BetterCanvas;
    mouseOnElement: UIElement | false = false;
    boundRedraw: () => void;
    boundOnMouseOnElement: (elem: UIElement) => void;
    boundOnMouseOffElement: (elem: UIElement) => void;

    constructor(game: Game) {
        super();
        this.game = game;
        if (this.game.renderer?.images?.font) {
            TextBlotter.loadImage(this.game.renderer.images.font);
        }
        this.game.on('resize', this.onResize.bind(this));
        this.game.on('mousemove', this.onMouseMove.bind(this));
        this.game.on('mousedown', this.onMouseDown.bind(this));
        this.game.on('mouseup', this.onMouseUp.bind(this));
        this.game.on('keydown', this.onKeyDown.bind(this));
        this.game.on('keyup', this.onKeyUp.bind(this));
        this.elements = [];
    this.x = 0; 
    this.y = 0;
    this.w = 1;  // Initialize with default dimensions
    this.h = 1;  // These will be updated by the first onResize event
    this.canvas = new BetterCanvas(1, 1);
    const self = this;
    this.on('draw', function(canvas: any) {
        // Skip drawing if UI canvas hasn't been properly sized yet
        if (self.canvas.canvas.width <= 1 || self.canvas.canvas.height <= 1) {
            return;
        }
        canvas.drawStatic(self.canvas.canvas); 
    });
    this.boundRedraw = this.redraw.bind(this);
    this.boundOnMouseOnElement = this.onMouseOnElement.bind(this);
    this.boundOnMouseOffElement = this.onMouseOffElement.bind(this);
}    // TODO: Abstract these different add methods into one
    addButton(options: UIOptions): Button {
        if(!options.parent) options.parent = this;
        options.ui = this;
        const newButton = new Button(options as any);
        options.parent.elements.push(newButton);
        if(options.parent !== this) this.elements.push(newButton);
        newButton.on('redraw', this.boundRedraw);
        newButton.on('mouse-on-element', this.boundOnMouseOnElement);
        newButton.on('mouse-off-element', this.boundOnMouseOffElement);
        return newButton;
    }

    addPanel(options: UIOptions): Panel {
        if(!options.parent) options.parent = this;
        options.ui = this;
        const newPanel = new Panel(options as any);
        options.parent.elements.push(newPanel);
        if(options.parent !== this) this.elements.push(newPanel);
        newPanel.on('redraw', this.boundRedraw);
        return newPanel;
    }

    addInput(options: UIOptions): Input {
        if(!options.parent) options.parent = this;
        options.ui = this;
        const newInput = new Input(options as any);
        options.parent.elements.push(newInput);
        if(options.parent !== this) this.elements.push(newInput);
        newInput.on('redraw', this.boundRedraw);
        newInput.on('mouse-on-element', this.boundOnMouseOnElement);
        newInput.on('mouse-off-element', this.boundOnMouseOffElement);
        return newInput;
    }

    addLabel(options: UIOptions): Label {
        if(!options.parent) options.parent = this;
        options.ui = this;
        const newLabel = new Label(options as any);
        options.parent.elements.push(newLabel);
        if(options.parent !== this) this.elements.push(newLabel);
        newLabel.on('redraw', this.boundRedraw);
        newLabel.on('mouse-on-element', this.boundOnMouseOnElement);
        newLabel.on('mouse-off-element', this.boundOnMouseOffElement);
        return newLabel;
    }

    redraw(): void {
        this.canvas.clear();
        for(let i = 0; i < this.elements.length; i++) {
            this.elements[i].redraw(this.canvas);
        }
    }

    onMouseMove(mouseEvent: MouseEvent): void {
        if(this.game.mouseButtons.length > 0) return;
        for(let i = 0; i < this.elements.length; i++) {
            const elem = this.elements[i];
            if(mouseEvent.x >= elem.x && mouseEvent.x < elem.x + elem.w
                && mouseEvent.y >= elem.y && mouseEvent.y < elem.y + elem.h) {
                elem.emit('mouse-on', mouseEvent);
            } else {
                elem.emit('mouse-off', mouseEvent);
            }
        }
    }

    onMouseDown(mouseEvent: MouseEvent): void {
        for(let i = 0; i < this.elements.length; i++) {
            this.elements[i].emit('mouse-down', mouseEvent);
        }
    }

    onMouseUp(mouseEvent: MouseEvent): void {
        for(let i = 0; i < this.elements.length; i++) {
            this.elements[i].emit('mouse-up', mouseEvent);
        }
    }

    onKeyDown(keyEvent: KeyEvent): void {
        for(let i = 0; i < this.elements.length; i++) {
            this.elements[i].emit('key-down', keyEvent);
        }
    }

    onKeyUp(keyEvent: KeyEvent): void {
        for(let i = 0; i < this.elements.length; i++) {
            this.elements[i].emit('key-up', keyEvent);
        }
    }

    onMouseOnElement(elem: UIElement): void {
        this.mouseOnElement = elem;
        this.game.mouseOver = false;
    }

    onMouseOffElement(elem: UIElement): void {
        this.mouseOnElement = this.mouseOnElement === elem ? false : this.mouseOnElement;
    }

    onResize(resize: Resize): void {
        this.w = resize.width; 
        this.h = resize.height;
        this.canvas.canvas.width = this.w;
        this.canvas.canvas.height = this.h;
        for(let i = 0; i < this.elements.length; i++) {
            this.elements[i].reposition();
        }
        this.redraw();
    }
}