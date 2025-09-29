'use strict';

export const util = {
    randomIntRange(min: number, max: number): number {
        return Math.floor(Math.random() * (+max - +min + 1)) + +min;
    },
    
    pickInArray<T>(arr: T[]): T {
        return arr[this.randomIntRange(0, arr.length - 1)];
    },
    
    pickInObject(obj: Record<string, any>): string {
        return this.pickInArray(Object.keys(obj));
    },
    
    findAndRemove<T>(elem: T, arr: T[]): void {
        for (let i = 0; i < arr.length; i++) {
            if (arr[i] === elem) { 
                arr.splice(i, 1);
                i--;
            }
        }
    },
    
    right(text: string, length: number): string { 
        return text.substring(text.length - length, text.length); 
    },
    
    clamp(val: number, min: number, max: number): number { 
        return Math.min(max, Math.max(min, val)); 
    },
    
    clampWrap(val: number, min: number, max: number): number {
        const wrap = (val - min) % (max + 1 - min);
        return wrap >= 0 ? min + wrap : max + 1 + wrap;
    },
    
    fractionalArrayIndex(arr: number[], index: number): number {
        const floorX = Math.floor(index);
        const lower = arr[floorX];
        if (floorX === index) return lower;
        const upper = arr[Math.ceil(index)];
        const fraction = index - Math.floor(index);
        return (lower + ((upper - lower) * fraction)); 
    },
    
    getURLParameter(name: string): string | null {
        return decodeURIComponent(
            (new RegExp('[?|&]' + name + '=' + '([^&;]+?)(&|#|;|$)')
                .exec(location.search) || [,""])[1].replace(/\+/g, '%20')) || null;
    },
    
    abbreviate(text: string, blacklist?: string[]): string {
        const split = text.split(' ');
        const alpha = /[a-z0-9]/i;
        let result = '';
        for (let w = 0; w < split.length; w++) {
            for (let l = 0; l < split[w].length; l++) {
                if (alpha.test(split[w][l])) {
                    result += split[w][l];
                    break;
                }
            }
        }
        if (result.trim() === '') result = '1';
        if (blacklist && blacklist.indexOf(result) >= 0) {
            let variation = 0;
            result += variation;
            do {
                variation++;
                result = result.substring(0, result.length - 1) + variation;
            } while (blacklist.indexOf(result) >= 0);
        }
        return result;
    },
    
    alphabet: ['a','b','c','d','e','f','g','h','i','j','k','l','m',
        'n','o','p','q','r','s','t','u','v','w','x','y','z'] as const,
    vowels: ['a','e','i','o','u'] as const,
    consonants: ['b','c','d','f','g','h','j','k','l','m','n','p','q','r','s','t','v','w','x','y','z'] as const,
    hex: ['0','1','2','3','4','5','6','7','8','9','a','b','c','d','e','f'] as const
};

export default util;