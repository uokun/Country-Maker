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
            [this.map.TILES.WATER]: '#3b82f6', // Bright Blue
            [this.map.TILES.LAND]: '#86efac',  // Light Green
            [this.map.TILES.ROAD]: '#94a3b8',  // Light Gray
            [this.map.TILES.RAIL]: '#475569',  // Dark Gray slate
            [this.map.TILES.FOREST]: '#166534' // Dark Green
        };
        
        this.hoverX = -1;
        this.hoverY = -1;
        
        // Zoom
        this.scale = 1.0;
        this.minScale = 0.5;
        this.maxScale = 3.0;
    }

    resize(w, h) {
        // Center the map initially if needed, or just keep offset
        const ts = this.tileSize * this.scale;
        this.offsetX = (w - this.map.width * ts) / 2;
        this.offsetY = (h - this.map.height * ts) / 2;
    }

    setHover(gx, gy) {
        this.hoverX = gx;
        this.hoverY = gy;
    }
    
    pan(dx, dy) {
        this.offsetX += dx;
        this.offsetY += dy;
        // Optional: Clamp panning so map doesn't disappear?
    }
    
    zoom(delta, centerScreenX, centerScreenY) {
        const oldScale = this.scale;
        let newScale = oldScale - delta * 0.001;
        
        // Clamp
        newScale = Math.max(this.minScale, Math.min(this.maxScale, newScale));
        
        if (newScale === oldScale) return;
        
        // Zoom towards mouse:
        // worldX = (screenX - offsetX) / oldScale
        // newOffsetX = screenX - worldX * newScale
        
        // Note: My world coords are pixels * scale.
        // realWorldX = (centerScreenX - this.offsetX) / oldScale;
        
        const worldX = (centerScreenX - this.offsetX) / oldScale;
        const worldY = (centerScreenY - this.offsetY) / oldScale;
        
        this.offsetX = centerScreenX - worldX * newScale;
        this.offsetY = centerScreenY - worldY * newScale;
        
        this.scale = newScale;
    }

    draw(timestamp = 0) {
        // Clear screen
        this.ctx.fillStyle = '#0f172a'; 
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        const ts = this.tileSize * this.scale;
        
        // Visible Range Calculation
        const startX = Math.floor(-this.offsetX / ts);
        const startY = Math.floor(-this.offsetY / ts);
        const endX = startX + Math.ceil(this.canvas.width / ts) + 1;
        const endY = startY + Math.ceil(this.canvas.height / ts) + 1;

        const xMin = Math.max(0, startX);
        const yMin = Math.max(0, startY);
        const xMax = Math.min(this.map.width, endX);
        const yMax = Math.min(this.map.height, endY);

        // Render Loop
        // We pass the effective tilesize (ts) to draw methods or use render context transformation?
        // Let's pass 'ts' as an argument or just calculate drawX/drawY using it.
        // Actually, many draw methods use 'this.tileSize'. I should temporarily override it 
        // or refactor draw methods to take size.
        // Simplest refactor without changing everything: Scale Context?
        // If I scale context, I need to handle lineWidths etc. 
        // Better: Pass 'ts' to helper methods or update them to use 'drawX, drawY, w, h'
        
        // Let's go with updating the draw loop to pass width/height
        
        for (let y = yMin; y < yMax; y++) {
            for (let x = xMin; x < xMax; x++) {
                const tile = this.map.getTile(x, y);
                const drawX = Math.floor(this.offsetX + x * ts);
                const drawY = Math.floor(this.offsetY + y * ts);

                // --- Base Layer ---
                if (tile === this.map.TILES.WATER) {
                    this.drawWater(drawX, drawY, ts, x, y, timestamp);
                } else {
                    this.drawLand(drawX, drawY, ts, x, y);
                }

                // --- Object Layer ---
                if (tile === this.map.TILES.ROAD) {
                     this.drawRoadAuto(drawX, drawY, ts, x, y);
                } else if (tile === this.map.TILES.RAIL) {
                    this.drawRailAuto(drawX, drawY, ts, x, y);
                } else if (tile === this.map.TILES.FOREST) {
                    this.drawForestDetail(drawX, drawY, ts, x, y, timestamp);
                } else if (tile === this.map.TILES.RESIDENTIAL) {
                    this.drawBuilding(drawX, drawY, ts, '#fca5a5', '#b91c1c', 1); // Red theme
                } else if (tile === this.map.TILES.COMMERCIAL) {
                    this.drawBuilding(drawX, drawY, ts, '#93c5fd', '#1d4ed8', 2); // Blue theme
                } else if (tile === this.map.TILES.INDUSTRIAL) {
                    this.drawBuilding(drawX, drawY, ts, '#fbbf24', '#b45309', 3); // Yellow/Orange theme
                }
                
                // Grid (Very suble)
                // this.ctx.strokeStyle = 'rgba(0,0,0,0.03)';
                // this.ctx.strokeRect(drawX, drawY, this.tileSize, this.tileSize);
            }
        }

        // Draw Cursor Highlight
        // const ts = this.tileSize * this.scale; // Already declared

        
        if (this.hoverX >= 0 && this.hoverX < this.map.width &&
            this.hoverY >= 0 && this.hoverY < this.map.height) {
            
            const hlX = Math.floor(this.offsetX + this.hoverX * ts);
            const hlY = Math.floor(this.offsetY + this.hoverY * ts);
            
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
            this.ctx.fillRect(hlX, hlY, ts, ts);
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
            this.ctx.lineWidth = 2 * this.scale;
            this.ctx.strokeRect(hlX, hlY, ts, ts);
        }

        // Draw Selection Box
        if (this.selectionStart && this.selectionEnd) {
             const x1 = Math.min(this.selectionStart.x, this.selectionEnd.x);
             const x2 = Math.max(this.selectionStart.x, this.selectionEnd.x);
             const y1 = Math.min(this.selectionStart.y, this.selectionEnd.y);
             const y2 = Math.max(this.selectionStart.y, this.selectionEnd.y);
             
             const sx = Math.floor(this.offsetX + x1 * ts);
             const sy = Math.floor(this.offsetY + y1 * ts);
             const w = (x2 - x1 + 1) * ts;
             const h = (y2 - y1 + 1) * ts;
             
             this.ctx.fillStyle = 'rgba(255, 100, 100, 0.3)'; // Semi-transparent selection
             this.ctx.fillRect(sx, sy, w, h);
             
             this.ctx.strokeStyle = '#ef4444'; // Red border
             this.ctx.lineWidth = 2 * this.scale;
             this.ctx.strokeRect(sx, sy, w, h);
        }
    }
    
    setSelectionBox(start, end) {
        this.selectionStart = start;
        this.selectionEnd = end;
    }
    
    // --- Detailed Drawing Methods ---

    drawWater(dx, dy, size, x, y, time) {
        this.ctx.fillStyle = this.colors[this.map.TILES.WATER];
        this.ctx.fillRect(dx, dy, size + 1, size + 1);
        
        const offset = (x + y) * 500 + time;
        const wave = Math.sin(offset * 0.002);
        if (wave > 0.8) {
            this.ctx.fillStyle = 'rgba(255,255,255,0.2)';
            const s = size * 0.3;
             this.ctx.fillRect(dx + size/2 + Math.sin(time*0.001)*5, dy + size/2, s, s/2);
        }
    }

    drawLand(dx, dy, size, x, y) {
        this.ctx.fillStyle = this.colors[this.map.TILES.LAND];
        this.ctx.fillRect(dx, dy, size + 1, size + 1);
    }
    
    getNeighbors(x, y, type) {
        // Same as before
        const n = [0, 0, 0, 0];
        if (this.map.getTile(x, y-1) === type) n[0] = 1;
        if (this.map.getTile(x+1, y) === type) n[1] = 1;
        if (this.map.getTile(x, y+1) === type) n[2] = 1;
        if (this.map.getTile(x-1, y) === type) n[3] = 1;
        return n;
    }

    drawRoadAuto(dx, dy, size, x, y) {
        const n = this.getNeighbors(x, y, this.map.TILES.ROAD);
        const roadColor = this.colors[this.map.TILES.ROAD];
        const half = size / 2;
        const roadW = size * 0.6;
        const offset = (size - roadW) / 2;

        this.ctx.fillStyle = roadColor;
        this.ctx.fillRect(dx + offset, dy + offset, roadW, roadW);

        if (n[0]) this.ctx.fillRect(dx + offset, dy, roadW, offset + 1);
        if (n[1]) this.ctx.fillRect(dx + offset + roadW - 1, dy + offset, offset + 1, roadW);
        if (n[2]) this.ctx.fillRect(dx + offset, dy + offset + roadW - 1, roadW, offset + 1);
        if (n[3]) this.ctx.fillRect(dx, dy + offset, offset + 1, roadW);
        
        this.ctx.fillStyle = '#f8fafc';
        const dashW = 4 * this.scale;
        const dashL = 8 * this.scale;
        
        if ((n[0] && n[2]) || (!n[1] && !n[3])) {
            this.ctx.fillRect(dx + half - dashW/2, dy + half - dashL/2, dashW, dashL);
        }
        if (n[1] && n[3]) {
             this.ctx.fillRect(dx + half - dashL/2, dy + half - dashW/2, dashL, dashW);
        }
    }
    
    drawRailAuto(dx, dy, size, x, y) {
        const n = this.getNeighbors(x, y, this.map.TILES.RAIL);
        const cx = dx + size / 2;
        const cy = dy + size / 2;
        
        this.ctx.strokeStyle = '#cbd5e1';
        this.ctx.lineWidth = 4 * this.scale;
        this.ctx.lineCap = 'butt';
        
        this.ctx.beginPath();
        if (n.every(v => v === 0)) {
            this.ctx.moveTo(dx + 4*this.scale, cy);
            this.ctx.lineTo(dx + size - 4*this.scale, cy);
            this.drawSleepers(dx, dy, size, true);
        } else {
            if (n[0]) { this.ctx.moveTo(cx, cy); this.ctx.lineTo(cx, dy); }
            if (n[1]) { this.ctx.moveTo(cx, cy); this.ctx.lineTo(dx + size, cy); }
            if (n[2]) { this.ctx.moveTo(cx, cy); this.ctx.lineTo(cx, dy + size); }
            if (n[3]) { this.ctx.moveTo(cx, cy); this.ctx.lineTo(dx, cy); }
            this.ctx.stroke();
            
            this.ctx.strokeStyle = '#78350f';
            this.ctx.lineWidth = 4 * this.scale;
            this.ctx.beginPath();
            
            const step = size / 3;
            // Simplified sleepers drawing for junctions
            if (n[0]) { this.ctx.moveTo(cx - 5, dy + step); this.ctx.lineTo(cx + 5, dy + step); }
            if (n[2]) { this.ctx.moveTo(cx - 5, dy + size - step); this.ctx.lineTo(cx + 5, dy + size - step); }
            if (n[1]) { this.ctx.moveTo(dx + size - step, cy - 5); this.ctx.lineTo(dx + size - step, cy + 5); }
            if (n[3]) { this.ctx.moveTo(dx + step, cy - 5); this.ctx.lineTo(dx + step, cy + 5); }
            if (n.some(v=>v)) {
                this.ctx.fillRect(cx - 3, cy - 3, 6, 6);
            }
        }
        this.ctx.stroke();
        
        this.ctx.strokeStyle = '#cbd5e1'; 
        this.ctx.lineWidth = 3 * this.scale;
        this.ctx.beginPath();
        // Simplified rail lines for brevity
        if (n[0]) { this.ctx.moveTo(cx-3, cy); this.ctx.lineTo(cx-3, dy); this.ctx.moveTo(cx+3, cy); this.ctx.lineTo(cx+3, dy); }
        if (n[2]) { this.ctx.moveTo(cx-3, cy); this.ctx.lineTo(cx-3, dy+size); this.ctx.moveTo(cx+3, cy); this.ctx.lineTo(cx+3, dy+size); }
        this.ctx.stroke();
    }
    
    drawSleepers(x, y, size, horizontal) {
         this.ctx.save();
         this.ctx.strokeStyle = '#78350f';
         this.ctx.lineWidth = 4 * this.scale;
         this.ctx.beginPath();
         const sleeperCount = 3;
         const step = size / sleeperCount;
         
         for(let i=0; i<sleeperCount; i++) {
             if (horizontal) {
                 let sx = x + i * step + step/2;
                 this.ctx.moveTo(sx, y + size/2 - 6*this.scale);
                 this.ctx.lineTo(sx, y + size/2 + 6*this.scale);
             }
         }
         this.ctx.stroke();
         this.ctx.restore();
    }

    drawForestDetail(dx, dy, size, x, y, time) {
        this.ctx.fillStyle = this.colors[this.map.TILES.LAND];
        this.ctx.fillRect(dx, dy, size+1, size+1);
        
        const cx = dx + size / 2;
        const cy = dy + size * 0.8;
        
        this.ctx.fillStyle = '#78350f';
        this.ctx.fillRect(cx - 2*this.scale, cy - 8*this.scale, 4*this.scale, 8*this.scale);
        
        this.ctx.fillStyle = '#15803d';
        const sway = Math.sin(time * 0.003 + x + y) * 2;
        this.drawTriangle(cx + sway, cy - 8*this.scale, 14*this.scale);
        this.drawTriangle(cx + sway, cy - 14*this.scale, 12*this.scale);
        this.drawTriangle(cx + sway, cy - 20*this.scale, 10*this.scale);
    }
    
    drawTriangle(x, y, w) {
        this.ctx.beginPath();
        this.ctx.moveTo(x - w/2, y);
        this.ctx.lineTo(x + w/2, y);
        this.ctx.lineTo(x, y - w*0.8);
        this.ctx.fill();
    }
    
    drawBuilding(dx, dy, size, wallColor, roofColor, type) {
        this.ctx.fillStyle = this.colors[this.map.TILES.LAND];
        this.ctx.fillRect(dx, dy, size+1, size+1);
        
        const pad = 4 * this.scale;
        const w = size - pad*2;
        const h = size - pad*2;
        const x = dx + pad;
        const y = dy + pad;
        
        this.ctx.fillStyle = 'rgba(0,0,0,0.2)';
        this.ctx.fillRect(x+2*this.scale, y+2*this.scale, w, h);
        
        this.ctx.fillStyle = wallColor;
        this.ctx.fillRect(x, y, w, h);
        
        if (type === 1) { 
            this.ctx.fillStyle = roofColor;
            this.ctx.beginPath();
            this.ctx.moveTo(x, y);
            this.ctx.lineTo(x + w/2, y - 6*this.scale);
            this.ctx.lineTo(x + w, y);
            this.ctx.fill();
        } else if (type === 2) { 
             this.ctx.fillStyle = roofColor;
             this.ctx.fillRect(x, y, w, 4*this.scale); 
        }
    }
}
