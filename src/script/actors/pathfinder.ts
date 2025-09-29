'use strict';

interface Point {
    x: number;
    y: number;
}

interface PathPoint extends Point {
    z: number;
}

interface PathNode extends Point {
    grid: string;
    g: number;
    h: number;
    f: number;
    parent?: string;
}

interface PathfindingOptions {
    start: Point;
    end: Point;
}

let map: Record<string, number>;

const calcH = (a: Point, b: Point): number => {
    const x = Math.abs(a.x - b.x);
    const y = Math.abs(a.y - b.y);
    if (x > y) return 8 * y + 5 * x;
    else return 8 * x + 5 * y;
};

const getBest = (list: Record<string, PathNode>): PathNode | undefined => {
    let best: PathNode | undefined;
    for (const key in list) {
        if (!list.hasOwnProperty(key)) continue;
        if (!best || best.f > list[key].f) best = list[key];
    }
    return best;
};

const constructPath = (start: Point, current: PathNode, closed: Record<string, PathNode>): PathPoint[] => {
    const path: PathPoint[] = [];
    let cur = current;
    while (true) {
        if (cur.x == start.x && cur.y == start.y) break;
        path.push({ x: cur.x, y: cur.y, z: map[cur.x + ':' + cur.y] });
        cur = closed[cur.parent!];
    }
    return path.reverse();
};

export default {
    loadMap: function(m: Record<string, number>): void { 
        map = m; 
    },
    
    findPath: function(options: PathfindingOptions): PathPoint[] {
        const start = options.start;
        const end = options.end;
        
        if (start.x == end.x && start.y == end.y || !(map[end.x + ':' + end.y] >= 0)) {
            return [];
        }
        
        const startH = calcH(end, start);
        let current: PathNode = { 
            x: start.x, 
            y: start.y, 
            grid: start.x + ':' + start.y, 
            g: 0, 
            h: startH, 
            f: startH 
        };
        
        let startIsCurrent = true;
        let openCount = 0;
        const open: Record<string, PathNode> = {};
        const closed: Record<string, PathNode> = {};
        
        // Add starting grid to open list
        open[current.grid] = current;
        openCount++;
        
        while (openCount > 0) {
            closed[current.grid] = current;
            delete open[current.grid];
            openCount--;
            
            // Check if ending reached
            if (current.x == end.x && current.y == end.y) {
                return constructPath(start, current, closed);
            }
            
            // Check neighbors
            for (let xDir = -1; xDir <= 1; xDir++) {
                for (let yDir = -1; yDir <= 1; yDir++) {
                    if (xDir == 0 && yDir == 0) continue;
                    
                    const neighborX = current.x + xDir;
                    const neighborY = current.y + yDir;
                    const neighborGrid = neighborX + ':' + neighborY;
                    
                    // Skip if neighbor is blocked or closed
                    if (!(map[neighborGrid] >= 0) || closed[neighborGrid]) continue;
                    
                    const moveCost = (xDir == 0 || yDir == 0) ? 5 : 8;
                    const neighborG = current.g + moveCost;
                    
                    if (open[neighborGrid]) { // Neighbor already in open list
                        const existing = open[neighborGrid];
                        if (neighborG < existing.g) { // This path is better
                            existing.g = neighborG;
                            existing.f = existing.g + existing.h;
                            existing.parent = current.grid;
                        }
                    } else { // Neighbor is a new square
                        const neighbor: PathNode = {
                            x: neighborX,
                            y: neighborY,
                            grid: neighborGrid,
                            g: neighborG,
                            h: calcH(end, { x: neighborX, y: neighborY }),
                            f: 0,
                            parent: current.grid
                        };
                        neighbor.f = neighbor.g + neighbor.h;
                        open[neighbor.grid] = neighbor;
                        openCount++;
                    }
                }
            }
            
            const nextCurrent = getBest(open);
            if (!nextCurrent) break;
            current = nextCurrent;
            startIsCurrent = false;
        }
        
        return [];
    }
};