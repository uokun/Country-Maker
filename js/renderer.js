export class Renderer {
    constructor(canvas, ctx, map, tileSize) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.map = map;
        this.tileSize = tileSize;
        
        // Camera / Viewport
        this.offsetX = 0;
        this.offsetY = 0;
        
        // Graphics Colors
        this.colors = {
            WATER: '#3b82f6',
            LAND: '#dcfce7', // Lighter, seamless grass
            ROAD: '#64748b', // Smooth Asphalt
            RAIL: '#475569',
            FOREST_BASE: '#166534',
            FOREST_LIGHT: '#22c55e'
        };
        
        this.hoverX = -1;
        this.hoverY = -1;
        
        // Zoom
        this.scale = 1.0;
        this.minScale = 0.05;
        this.maxScale = 3.0;
    }

    resize(w, h) {
        if (this.offsetX === 0 && this.offsetY === 0) {
            this.offsetX = w / 2;
            this.offsetY = h / 2;
        }
    }

    setHover(gx, gy) {
        this.hoverX = gx;
        this.hoverY = gy;
    }
    
    pan(dx, dy) {
        this.offsetX += dx;
        this.offsetY += dy;
    }
    
    zoom(delta, centerScreenX, centerScreenY) {
        const oldScale = this.scale;
        let newScale = oldScale - delta * 0.001;
        newScale = Math.max(this.minScale, Math.min(this.maxScale, newScale));
        
        if (newScale === oldScale) return;
        
        const worldX = (centerScreenX - this.offsetX) / oldScale;
        const worldY = (centerScreenY - this.offsetY) / oldScale;
        
        this.offsetX = centerScreenX - worldX * newScale;
        this.offsetY = centerScreenY - worldY * newScale;
        
        this.scale = newScale;
    }

    draw(timestamp = 0) {
        // Clear screen with water color (background is water)
        this.ctx.fillStyle = this.colors.WATER; 
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        const ts = this.tileSize * this.scale;
        
        // Visible Range Calculation
        const startX = Math.floor(-this.offsetX / ts);
        const startY = Math.floor(-this.offsetY / ts);
        
        const widthTiles = Math.ceil(this.canvas.width / ts) + 1;
        const heightTiles = Math.ceil(this.canvas.height / ts) + 1;
        
        const endX = startX + widthTiles;
        const endY = startY + heightTiles;

        // --- Layer 1: Land Mass ---
        // To make it look "one piece", we just draw connected squares without borders
        // Ideally we would march squares, but for now simple seamless blocks work if colors match perfectly.
        this.ctx.fillStyle = this.colors.LAND;
        this.ctx.beginPath();
        for (let y = startY; y < endY; y++) {
            for (let x = startX; x < endX; x++) {
                const tile = this.map.getTile(x, y);
                if (tile !== this.map.TILES.WATER) {
                    // Draw land rect, slightly overlapped to prevent cracks
                    const drawX = this.offsetX + x * ts;
                    const drawY = this.offsetY + y * ts;
                    this.ctx.rect(drawX, drawY, ts + 0.5, ts + 0.5);
                }
            }
        }
        this.ctx.fill();

        // --- Layer 2: Infrastructure (Roads, Rails) ---
        // We render these as connected paths
        for (let y = startY; y < endY; y++) {
            for (let x = startX; x < endX; x++) {
                const tile = this.map.getTile(x, y);
                const drawX = this.offsetX + x * ts;
                const drawY = this.offsetY + y * ts;

                if (tile === this.map.TILES.ROAD) {
                    this.drawRoadSmooth(drawX, drawY, ts, x, y);
                } else if (tile === this.map.TILES.RAIL) {
                    this.drawRailSmooth(drawX, drawY, ts, x, y);
                }
            }
        }

        // --- Layer 3: Objects/Buildings ---
        for (let y = startY; y < endY; y++) {
            for (let x = startX; x < endX; x++) {
                const tile = this.map.getTile(x, y);
                const drawX = this.offsetX + x * ts;
                const drawY = this.offsetY + y * ts;

                if (tile === this.map.TILES.FOREST) {
                    this.drawForestSmooth(drawX, drawY, ts, x, y, timestamp);
                } else if (tile === this.map.TILES.RESIDENTIAL) {
                    this.drawBuildingSmooth(drawX, drawY, ts, x, y, '#fca5a5', '#ef4444');
                } else if (tile === this.map.TILES.COMMERCIAL) {
                    this.drawBuildingSmooth(drawX, drawY, ts, x, y, '#93c5fd', '#3b82f6');
                } else if (tile === this.map.TILES.INDUSTRIAL) {
                    this.drawBuildingSmooth(drawX, drawY, ts, x, y, '#fde047', '#eab308');
                }
            }
        }

        // --- Layer 4: UI/Highlights ---
        
        // Hover
        if (true) {
            const hx = Math.floor(this.offsetX + this.hoverX * ts);
            const hy = Math.floor(this.offsetY + this.hoverY * ts);
            
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            this.ctx.beginPath();
            this.ctx.roundRect(hx, hy, ts, ts, ts * 0.2); // Rounded cursor
            this.ctx.fill();
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
            this.ctx.lineWidth = 2 * this.scale;
            this.ctx.stroke();
        }

        // Selection
        if (this.selectionStart && this.selectionEnd) {
             const x1 = Math.min(this.selectionStart.x, this.selectionEnd.x);
             const x2 = Math.max(this.selectionStart.x, this.selectionEnd.x);
             const y1 = Math.min(this.selectionStart.y, this.selectionEnd.y);
             const y2 = Math.max(this.selectionStart.y, this.selectionEnd.y);
             
             const sx = this.offsetX + x1 * ts;
             const sy = this.offsetY + y1 * ts;
             const w = (x2 - x1 + 1) * ts;
             const h = (y2 - y1 + 1) * ts;
             
             this.ctx.fillStyle = 'rgba(50, 150, 255, 0.3)';
             this.ctx.strokeStyle = '#3b82f6';
             this.ctx.lineWidth = 2 * this.scale;
             
             this.ctx.beginPath();
             this.ctx.roundRect(sx, sy, w, h, ts * 0.2);
             this.ctx.fill();
             this.ctx.stroke();
        }
    }
    
    setSelectionBox(start, end) {
        this.selectionStart = start;
        this.selectionEnd = end;
    }
    
    getNeighbors(x, y, type) {
        const n = [0, 0, 0, 0]; // Up, Right, Down, Left
        if (this.map.getTile(x, y-1) === type) n[0] = 1;
        if (this.map.getTile(x+1, y) === type) n[1] = 1;
        if (this.map.getTile(x, y+1) === type) n[2] = 1;
        if (this.map.getTile(x-1, y) === type) n[3] = 1;
        return n;
    }

    drawRoadSmooth(dx, dy, size, x, y) {
        const n = this.getNeighbors(x, y, this.map.TILES.ROAD);
        const cx = dx + size / 2;
        const cy = dy + size / 2;
        const rW = size * 0.5; // Road width

        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        
        // Draw Border (Outline)
        this.ctx.strokeStyle = '#475569'; // Darker border
        this.ctx.lineWidth = rW + 4 * this.scale;
        this.drawRoadPath(cx, cy, size, n);
        this.ctx.stroke();

        // Draw Pavement
        this.ctx.strokeStyle = this.colors.ROAD;
        this.ctx.lineWidth = rW;
        this.drawRoadPath(cx, cy, size, n);
        this.ctx.stroke();
        
        // Center Lines
        if ((n[0] && n[2]) || (!n[1] && !n[3])) {
            // Vertical simple
             this.drawDashedLine(cx, dy, cx, dy + size, size);
        } else if (n[1] && n[3]) {
            // Horizontal simple
             this.drawDashedLine(dx, cy, dx + size, cy, size);
        } else {
            // Corner/Intersection Center Dot or mini-dashes?
            // For now, keep it clean without complex curve dashes
        }
    }
    
    drawRoadPath(cx, cy, size, n) {
        // Draw a cross based on neighbors
        this.ctx.beginPath();
        // If no neighbors, just a dot
        if (!n.some(v=>v)) {
            this.ctx.moveTo(cx, cy);
            this.ctx.lineTo(cx, cy);
            return;
        }

        // Draw arms
        const len = size; // Go fully to edge and beyond to overlap neighbors
        if (n[0]) { this.ctx.moveTo(cx, cy); this.ctx.lineTo(cx, cy - len); }
        if (n[1]) { this.ctx.moveTo(cx, cy); this.ctx.lineTo(cx + len, cy); }
        if (n[2]) { this.ctx.moveTo(cx, cy); this.ctx.lineTo(cx, cy + len); }
        if (n[3]) { this.ctx.moveTo(cx, cy); this.ctx.lineTo(cx - len, cy); }
    }
    
    drawDashedLine(x1, y1, x2, y2, size) {
        this.ctx.beginPath();
        this.ctx.strokeStyle = '#e2e8f0';
        this.ctx.lineWidth = 2 * this.scale;
        this.ctx.setLineDash([8 * this.scale, 8 * this.scale]);
        this.ctx.moveTo(x1, y1);
        this.ctx.lineTo(x2, y2);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
    }

    drawRailSmooth(dx, dy, size, x, y) {
        const n = this.getNeighbors(x, y, this.map.TILES.RAIL);
        const cx = dx + size / 2;
        const cy = dy + size / 2;
        
        // Ballast (Gravel)
        this.ctx.strokeStyle = '#78716c';
        this.ctx.lineWidth = size * 0.6;
        this.ctx.lineCap = 'round';
        this.drawRoadPath(cx, cy, size, n); // Reuse path logic
        this.ctx.stroke();
        
        // Rails
        this.ctx.strokeStyle = '#cbd5e1'; // Metal
        this.ctx.lineWidth = size * 0.4;
        this.drawRoadPath(cx, cy, size, n);
        this.ctx.stroke();
        
        // Inner Gap
        this.ctx.strokeStyle = '#78716c'; // Back to ballast color
        this.ctx.lineWidth = size * 0.25;
        this.drawRoadPath(cx, cy, size, n);
        this.ctx.stroke();
        
        // Sleepers (Simulated by dashed line in gap?)
        // Hard to do smooth sleepers on curves without complex math.
        // Let's rely on the "track" look of double lines.
    }

    drawForestSmooth(dx, dy, size, x, y, time) {
        // Draw multiple trees scattered
        const seed = (x * 3 + y * 7); // Pseudo random
        const count = 3 + (seed % 3); 
        
        for(let i=0; i<count; i++) {
             const ox = ((seed + i*13) % 10) / 10 * size;
             const oy = ((seed + i*23) % 10) / 10 * size;
             
             const tx = dx + ox;
             const ty = dy + oy;
             
             // Simple Circle/Blob trees
             const r = size * 0.25 * (0.8 + Math.sin(time*0.002 + x + i)*0.2);
             
             this.ctx.fillStyle = this.colors.FOREST_BASE;
             this.ctx.beginPath();
             this.ctx.arc(tx, ty, r, 0, Math.PI*2);
             this.ctx.fill();
             
             this.ctx.fillStyle = this.colors.FOREST_LIGHT;
             this.ctx.beginPath();
             this.ctx.arc(tx - r*0.3, ty - r*0.3, r*0.4, 0, Math.PI*2);
             this.ctx.fill();
        }
    }
    
    drawBuildingSmooth(dx, dy, size, x, y, wallColor, roofColor) {
        // Randomize building size/pos slightly
        const seed = (x * 123 + y * 456);
        const w = size * (0.5 + (seed % 40)/100);
        const h = size * (0.5 + ((seed*2) % 40)/100);
        
        const bx = dx + (size - w) / 2;
        const by = dy + (size - h) / 2;
        
        // Shadow
        this.ctx.fillStyle = 'rgba(0,0,0,0.1)';
        this.ctx.beginPath();
        this.ctx.roundRect(bx + 4*this.scale, by + 4*this.scale, w, h, 4*this.scale);
        this.ctx.fill();

        // Building
        this.ctx.fillStyle = wallColor;
        this.ctx.beginPath();
        this.ctx.roundRect(bx, by, w, h, 2*this.scale);
        this.ctx.fill();
        
        // Roof detail (Simple)
        this.ctx.fillStyle = roofColor;
        this.ctx.beginPath();
        this.ctx.roundRect(bx + w*0.1, by + h*0.1, w*0.8, h*0.8, 2*this.scale);
        this.ctx.fill();
    }
}
