export class Input {
    constructor(canvas, game, tileSize) {
        this.canvas = canvas;
        this.game = game;
        this.renderer = game.renderer;
        this.tileSize = tileSize;
        
        this.isDragging = false;
        this.isPanning = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;

        // Selection State
        this.selectionStart = null; // {x, y}
        this.selectionEnd = null;   // {x, y}
        
        this.keys = {}; // Track active keys

        this.setupListeners();
    }

    setupListeners() {
        this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
        this.canvas.addEventListener('mouseleave', (e) => this.onMouseUp(e));
        this.canvas.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
        
        window.addEventListener('keydown', (e) => { this.keys[e.code] = true; });
        window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    }

    getGridCoords(e) {
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        // gridX = (mouseX - offsetX) / (tileSize * scale)
        const ts = this.renderer.tileSize * this.renderer.scale;
        const gridX = Math.floor((mouseX - this.renderer.offsetX) / ts);
        const gridY = Math.floor((mouseY - this.renderer.offsetY) / ts);
        
        return { gridX, gridY, mouseX, mouseY };
    }
    
    onWheel(e) {
        e.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        this.renderer.zoom(e.deltaY, mouseX, mouseY);
        
        // Update highlight after zoom
        const vals = this.getGridCoords(e);
        this.renderer.setHover(vals.gridX, vals.gridY);
    }

    onMouseDown(e) {
        if (e.button === 0) { // Left Click
            const { gridX, gridY } = this.getGridCoords(e);
            
            if (this.game.activeTool === 'cursor') {
                this.isPanning = true;
                this.lastMouseX = e.clientX;
                this.lastMouseY = e.clientY;
                this.canvas.style.cursor = 'grabbing';
            } else {
                // Start Selection
                this.isDragging = true;
                this.selectionStart = { x: gridX, y: gridY };
                this.selectionEnd = { x: gridX, y: gridY };
                // Also trigger single click immediately? No, wait for up or just start region.
                // Usually builders show the box first.
                // But for single click feeling, we can just apply on 'up' if same tile.
            }
        }
    }

    onMouseMove(e) {
        const { gridX, gridY } = this.getGridCoords(e);
        
        // Update Hover
        this.renderer.setHover(gridX, gridY);
        
        // Update UI info
        const display = document.getElementById('coords-display');
        if(display) display.textContent = `X: ${gridX}, Y: ${gridY}`;

        if (this.isDragging) {
             if (this.game.activeTool !== 'cursor') {
                 this.selectionEnd = { x: gridX, y: gridY };
                 // Pass selection to renderer for drawing
                 this.game.setSelection(this.selectionStart, this.selectionEnd);
             }
        }
        
        if (this.isPanning) {
            const dx = e.clientX - this.lastMouseX;
            const dy = e.clientY - this.lastMouseY;
            this.renderer.pan(dx, dy);
            this.lastMouseX = e.clientX;
            this.lastMouseY = e.clientY;
        }
    }

    onMouseUp(e) {
        if (this.isDragging && this.game.activeTool !== 'cursor') {
            const { gridX, gridY } = this.getGridCoords(e);
            this.selectionEnd = { x: gridX, y: gridY };
            
            this.game.onAreaSelect(this.selectionStart, this.selectionEnd);
            
            // Reset
            this.selectionStart = null;
            this.selectionEnd = null;
            this.game.setSelection(null, null);
        }

        this.isDragging = false;
        this.isPanning = false;
        this.canvas.style.cursor = 'crosshair';
    }
}
