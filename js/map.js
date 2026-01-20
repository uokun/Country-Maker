export class Map {
    constructor() {
        this.CHUNK_SIZE = 32;
        this.chunks = {}; // Key format: "chunkX,chunkY" -> 2D array [y][x]
        
        // Define Tile Types
        this.TILES = {
            WATER: 0,
            LAND: 1,
            ROAD: 2,
            RAIL: 3,
            FOREST: 4,
            RESIDENTIAL: 5,
            COMMERCIAL: 6,
            INDUSTRIAL: 7
        };

        this.initialize();
    }

    initialize() {
        // Initialize a small island around 0,0
        const radius = 5;
        for (let y = -radius; y <= radius; y++) {
            for (let x = -radius; x <= radius; x++) {
                if (x*x + y*y <= radius*radius) {
                    this.setTile(x, y, this.TILES.LAND);
                }
            }
        }
    }

    _getChunkKey(cx, cy) {
        return `${cx},${cy}`;
    }

    getChunk(cx, cy, createIfMissing = false) {
        const key = this._getChunkKey(cx, cy);
        if (this.chunks[key]) {
            return this.chunks[key];
        }
        
        if (createIfMissing) {
            // Create new chunk filled with WATER
            const chunk = [];
            for (let y = 0; y < this.CHUNK_SIZE; y++) {
                const row = new Array(this.CHUNK_SIZE).fill(this.TILES.WATER);
                chunk.push(row);
            }
            this.chunks[key] = chunk;
            return chunk;
        }
        
        return null;
    }

    // specific helper for negative coords modulo
    _getChunkCoords(x, y) {
        const cx = Math.floor(x / this.CHUNK_SIZE);
        const cy = Math.floor(y / this.CHUNK_SIZE);
        
        // localized x,y within the chunk (0 to CHUNK_SIZE-1)
        let lx = x % this.CHUNK_SIZE;
        let ly = y % this.CHUNK_SIZE;
        
        if (lx < 0) lx += this.CHUNK_SIZE;
        if (ly < 0) ly += this.CHUNK_SIZE;
        
        return { cx, cy, lx, ly };
    }

    getTile(x, y) {
        const { cx, cy, lx, ly } = this._getChunkCoords(x, y);
        const chunk = this.getChunk(cx, cy);
        
        if (chunk) {
            return chunk[ly][lx];
        }
        
        // Default to water if chunk doesn't exist
        return this.TILES.WATER;
    }

    setTile(x, y, type) {
        const { cx, cy, lx, ly } = this._getChunkCoords(x, y);
        const chunk = this.getChunk(cx, cy, true); // Create if missing
        
        chunk[ly][lx] = type;
        return true;
    }
    
    exportData() {
        // Simple serialization of chunks
        return JSON.stringify(this.chunks);
    }
    
    importData(jsonString) {
        try {
            this.chunks = JSON.parse(jsonString);
            return true;
        } catch (e) {
            console.error("Failed to load map data", e);
            return false;
        }
    }
}
