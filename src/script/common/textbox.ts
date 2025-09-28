'use strict';

import { inherits } from 'util';
import Entity from '../engine/entity.js';
import { TextBlotter } from './textblotter.js';

const TEXTBOX_MAX_WIDTH = 96;
const TEXTBOX_LINES_PER_PAGE = 4;
const TEXTBOX_SCROLL_SPEEDS: Array<[number, number]> = [ [0, 3], [75, 2], [150, 1] ];
const TEXTBOX_PAGE_DELAY = 5;
const TEXTBOX_FINAL_DELAY = 60;
const TEXTBOX_OPEN_TIME = 10;
const TEXTBOX_CLOSE_TIME = 8;
const TEXTBOX_BG_COLOR = 'rgba(0, 0, 0, 0.7)';

interface TextBoxParent {
    preciseScreen: { x: number; y: number };
    pixelSize: { x: number; y: number };
    username?: string;
}

interface TextBoxSprite {
    keepOnScreen: boolean;
    screen: { x: number; y: number };
    parent: TextBoxParent;
    stay: boolean;
    metrics: { x: number; y: number; w: number; h: number };
    image?: HTMLCanvasElement;
    hidden?: boolean;
}

function cleanString(text: string): string {
    if(!text) return text;
    for(let i = 0; i < text.length; i++) {
        if(!TextBlotter.fontMap[text[i]]) {
            const charArray = text.split('');
            charArray.splice(i, 1);
            text = charArray.join('');
            i--;
        }
    }
    return text;
}

function calcScrollSpeed(text: string): number {
    let speed = 1;
    for(let i = 0; i < TEXTBOX_SCROLL_SPEEDS.length; i++) {
        if(text.length >= TEXTBOX_SCROLL_SPEEDS[i][0]) speed = TEXTBOX_SCROLL_SPEEDS[i][1];
        else if(text.length < TEXTBOX_SCROLL_SPEEDS[i][0]) break;
    }
    return speed;
}

export default class TextBox extends Entity {
    parent: TextBoxParent;
    text: string;
    screen: { x: number; y: number };
    sprite: TextBoxSprite;
    canvas?: HTMLCanvasElement;
    textMetrics?: any;

    constructor(parent: TextBoxParent, text: string, stay: boolean) {
        super();
        this.parent = parent;
        this.text = text;
        this.screen = { x: 0, y: 0 };
        this.sprite = { 
            keepOnScreen: true,
            screen: this.screen, 
            parent: this.parent, 
            stay: stay, 
            metrics: { x: 0, y: 0, w: 0, h: 0 }
        };
    }

    updateScreen(): void {
        if(!this.canvas) return;
        this.screen.x = this.parent.preciseScreen.x - this.canvas.width/2 + this.parent.pixelSize.x;
        this.screen.y = this.parent.preciseScreen.y - this.canvas.height + 2;
    }

    updateSprite(): void {
        this.sprite.image = this.canvas;
        if (this.sprite.image) {
            this.sprite.metrics.w = this.sprite.image.width;
            this.sprite.metrics.h = this.sprite.image.height;
        }
    }

    blotText(options?: any): void {
        if(!options) options = {};
        options.bg = options.bg || TEXTBOX_BG_COLOR;
        options.text = options.text || this.text;
        if(!options.text) return;
        this.canvas = TextBlotter.blot(options);
        this.updateScreen();
        this.updateSprite();
    }

    scrollMessage(cb: () => void): void {
        const self = this;
        function complete() {
            self.remove();
            cb();
        }
        this.textMetrics = TextBlotter.calculateMetrics({ text: this.text, maxWidth: TEXTBOX_MAX_WIDTH });
        if(this.text.trim() === '' || this.textMetrics.lines.length === 0 
            || this.textMetrics.lines[0].chars.length === 0) { // No message to show
            complete();
            return;
        }
        const scrollSpeed = calcScrollSpeed(this.text);
        let lineNumber = 0;
        let lineChar = 0;
        let lineChars = self.textMetrics.lines[lineNumber].chars.length;
        for(let nl = 1; nl < TEXTBOX_LINES_PER_PAGE; nl++) {
            const nextLine = self.textMetrics.lines[lineNumber + nl];
            if(nextLine) lineChars += nextLine.chars.length; else break;
        }
        //console.log(this.parent.username,'says:',this.text);
        const addLetter = function(): void {
            lineChar++;
            self.blotText({ 
                text: self.text, metrics: self.textMetrics, maxChars: lineChar,
                lineStart: lineNumber, lineCount: TEXTBOX_LINES_PER_PAGE
            });
            if(lineChar === lineChars) { // Line set finished?
                lineNumber += TEXTBOX_LINES_PER_PAGE;
                if(lineNumber >= self.textMetrics.lines.length) { // Last line complete?
                    self.tickDelay(function() {
                        self.tickRepeat(function(progress: any) {
                            self.canvas = TextBlotter.transition({
                                bg: TEXTBOX_BG_COLOR, metrics: self.textMetrics, progress: 1 - progress.percent, 
                                lineCount : Math.min(self.textMetrics.lines.length, TEXTBOX_LINES_PER_PAGE)
                            });
                            self.updateScreen();
                            self.updateSprite();
                        }, TEXTBOX_CLOSE_TIME, complete);
                    }, scrollSpeed * TEXTBOX_FINAL_DELAY);
                } else { // Still more lines
                    lineChar = 0;
                    lineChars = self.textMetrics.lines[lineNumber].chars.length;
                    for(let nl = 1; nl < TEXTBOX_LINES_PER_PAGE; nl++) {
                        const nextLine = self.textMetrics.lines[lineNumber + nl];
                        if(nextLine) lineChars += nextLine.chars.length; else break;
                    }
                    self.tickDelay(addLetter, scrollSpeed * TEXTBOX_PAGE_DELAY); // Begin next line
                }
            } else { // Line not finished, continue
                self.tickDelay(addLetter, scrollSpeed);
            }
        };
        this.tickRepeat(function(progress: any) {
            self.canvas = TextBlotter.transition({
                bg: TEXTBOX_BG_COLOR, metrics: self.textMetrics, progress: progress.percent,
                lineCount : Math.min(self.textMetrics.lines.length, TEXTBOX_LINES_PER_PAGE)
            });
            self.updateScreen();
            self.updateSprite();
        }, TEXTBOX_OPEN_TIME, function() {
            self.tickDelay(addLetter, scrollSpeed);
        });
    }
}