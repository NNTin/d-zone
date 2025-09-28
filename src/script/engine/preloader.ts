'use strict';

import BetterCanvas from '../common/bettercanvas.js';

const imageList = ['actors', 'environment', 'static-tiles', 'props', 'font'];

export class Preloader {
    images: Record<string, HTMLCanvasElement> = {};
    imagesLoaded: number = 0;
    onComplete: (images: Record<string, HTMLCanvasElement>) => void;

    constructor(onComplete: (images: Record<string, HTMLCanvasElement>) => void) {
        this.onComplete = onComplete;
        for (let i = 0; i < imageList.length; i++) {
            const imageName = imageList[i];
            const fileName = imageName + '.png';
            const image = new Image();
            image.addEventListener('load', () => this.onImageLoad(image, imageName));
            image.src = './img/' + fileName;
        }
    }

    onImageLoad(image: HTMLImageElement, imageName: string): void {
        const canvas = new BetterCanvas(image.width, image.height);
        this.images[imageName] = canvas.canvas;
        canvas.drawImage(image, 0, 0, image.width, image.height, 0, 0, image.width, image.height);
        this.imagesLoaded++;
        if (this.imagesLoaded === imageList.length) {
            this.onComplete(this.images);
        }
    }
}

export default Preloader;