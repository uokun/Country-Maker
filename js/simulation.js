export class Simulation {
    constructor(map) {
        this.map = map;
        this.population = 0;
        this.lastUpdate = 0;
    }

    update(timestamp) {
        // Update population every 1 second (approx)
        if (timestamp - this.lastUpdate > 1000) {
            this.calculatePopulation();
            this.lastUpdate = timestamp;
            return true; // Updated
        }
        return false;
    }

    calculatePopulation() {
        let pop = 0;
        const width = this.map.width;
        const height = this.map.height;

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const tile = this.map.getTile(x, y);
                if (tile === this.map.TILES.RESIDENTIAL) {
                    pop += 4; // 1 house = 4 people
                } else if (tile === this.map.TILES.COMMERCIAL) {
                    // Commercial doesn't add residents directly in this simple model, 
                    // or maybe it adds "workers" which we count as day-time population?
                    // For now, let's keep it simple: Total Pop = Residents.
                }
            }
        }
        this.population = pop;
    }

    getPopulation() {
        return this.population;
    }
}
