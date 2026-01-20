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
                this.isDragging = true;
                this.game.onTileClick(gridX, gridY);
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
            this.game.onTileDrag(gridX, gridY);
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
        this.isDragging = false;
        this.isPanning = false;
        this.canvas.style.cursor = 'crosshair';
    }
}
