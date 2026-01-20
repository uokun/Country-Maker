export class Map {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.data = [];
        
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
        // Initialize with all water
        for (let y = 0; y < this.height; y++) {
            const row = [];
            for (let x = 0; x < this.width; x++) {
                row.push(this.TILES.WATER);
            }
            this.data.push(row);
        }

        // Initialize a small island in the center for convenience
        const centerX = Math.floor(this.width / 2);
        const centerY = Math.floor(this.height / 2);
        const radius = 5;

        for (let y = -radius; y <= radius; y++) {
            for (let x = -radius; x <= radius; x++) {
                if (x*x + y*y <= radius*radius) {
                    this.setTile(centerX + x, centerY + y, this.TILES.LAND);
                }
            }
        }
    }

    getTile(x, y) {
        if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
            return this.data[y][x];
        }
        return null;
    }

    setTile(x, y, type) {
        if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
            this.data[y][x] = type;
            return true;
        }
        return false;
    }
    
    // For future: save/load functionality
    exportData() {
        return JSON.stringify(this.data);
    }
    
    importData(jsonString) {
        try {
            this.data = JSON.parse(jsonString);
            return true;
        } catch (e) {
            console.error("Failed to load map data", e);
            return false;
        }
    }
}
