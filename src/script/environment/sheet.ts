'use strict';

interface SpriteMetrics {
    x: number;
    y: number;
    w: number;
    h: number;
    ox: number;
    oy: number;
}

interface SlabMap {
    plain: Record<number, SpriteMetrics>;
    grass: Record<number, SpriteMetrics>;
}

interface BlockMap {
    plain: SpriteMetrics;
    grass: SpriteMetrics;
    grass_top: SpriteMetrics;
}

interface TileMap {
    grass: Record<string, SpriteMetrics>;
}

interface SheetMap {
    slab: SlabMap;
    block: BlockMap;
    tile: TileMap;
}

const map: SheetMap = {
    slab: {
        plain: {
            0: {x: 165, y: 0, w: 33, h: 24, ox: -1, oy: -1},
            16: {x: 165, y: 24, w: 33, h: 24, ox: -1, oy: -1},
            64: {x: 165, y: 48, w: 33, h: 24, ox: -1, oy: -1},
            80: {x: 165, y: 72, w: 33, h: 24, ox: -1, oy: -1},
            32: {x: 165, y: 96, w: 33, h: 39, ox: -1, oy: -1},
            128: {x: 165, y: 135, w: 33, h: 39, ox: -1, oy: -1},
            160: {x: 165, y: 174, w: 33, h: 39, ox: -1, oy: -1},
            96: {x: 165, y: 213, w: 33, h: 39, ox: -1, oy: -1},
            144: {x: 165, y: 252, w: 33, h: 39, ox: -1, oy: -1}
        },
        grass: {
            0: {x: 0, y: 0, w: 33, h: 18, ox: -1, oy: -2},
            1: {x: 0, y: 18, w: 33, h: 18, ox: -1, oy: -2}, 
            4: {x: 0, y: 36, w: 33, h: 18, ox: -1, oy: -2},
            5: {x: 0, y: 54, w: 33, h: 18, ox: -1, oy: -2},
            16: {x: 0, y: 0, w: 33, h: 18, ox: -1, oy: -2},
            32: {x: 0, y: 0, w: 33, h: 18, ox: -1, oy: -2},
            64: {x: 0, y: 0, w: 33, h: 18, ox: -1, oy: -2},
            80: {x: 0, y: 0, w: 33, h: 18, ox: -1, oy: -2},
            96: {x: 0, y: 0, w: 33, h: 18, ox: -1, oy: -2},
            128: {x: 0, y: 0, w: 33, h: 18, ox: -1, oy: -2},
            144: {x: 0, y: 0, w: 33, h: 18, ox: -1, oy: -2},
            160: {x: 0, y: 0, w: 33, h: 18, ox: -1, oy: -2}
        }
    },
    block: {
        plain: {x: 132, y: 0, w: 33, h: 39, ox: -1, oy: -1},
        grass: {x: 99, y: 0, w: 33, h: 39, ox: -1, oy: -1},
        grass_top: {x: 33, y: 72, w: 33, h: 28, ox: -1, oy: -2}
    },
    tile: {
        grass: {
            'G-G-G-G': {x: 33, y: 0, w: 33, h: 18, ox: -1, oy: -2},
            'G-G-G-S': {x: 0, y: 72, w: 33, h: 18, ox: -1, oy: -2},
            'G-G-S-G': {x: 33, y: 18, w: 33, h: 18, ox: -1, oy: -2},
            'G-G-S-S': {x: 33, y: 36, w: 33, h: 18, ox: -1, oy: -2},
            'G-S-G-G': {x: 0, y: 90, w: 33, h: 18, ox: -1, oy: -2},
            'G-S-G-S': {x: 33, y: 54, w: 33, h: 18, ox: -1, oy: -2},
            'G-S-S-G': {x: 66, y: 0, w: 33, h: 18, ox: -1, oy: -2},
            'G-S-S-S': {x: 66, y: 18, w: 33, h: 18, ox: -1, oy: -2},
            'S-G-G-G': {x: 66, y: 36, w: 33, h: 18, ox: -1, oy: -2},
            'S-G-G-S': {x: 66, y: 54, w: 33, h: 18, ox: -1, oy: -2},
            'S-G-S-G': {x: 99, y: 18, w: 33, h: 18, ox: -1, oy: -2},
            'S-G-S-S': {x: 99, y: 36, w: 33, h: 18, ox: -1, oy: -2},
            'S-S-G-G': {x: 99, y: 54, w: 33, h: 18, ox: -1, oy: -2},
            'S-S-G-S': {x: 132, y: 18, w: 33, h: 18, ox: -1, oy: -2},
            'S-S-S-G': {x: 132, y: 36, w: 33, h: 18, ox: -1, oy: -2},
            'S-S-S-S': {x: 132, y: 54, w: 33, h: 18, ox: -1, oy: -2}
        }
    }
};

export default class Sheet {
    type: string;
    map: any;

    constructor(type: string) {
        this.type = type;
        this.map = (map as any)[type];
    }
}