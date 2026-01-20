export class Simulation {
  constructor(map) {
    this.map = map;
    this.population = 0;
    this.lastUpdate = 0;
  }

  update(timestamp) {
    if (timestamp - this.lastUpdate > 1000) {
      this.calculatePopulation();
      this.lastUpdate = timestamp;
      return true;
    }
    return false;
  }

  calculatePopulation() {
    let pop = 0;
    const objects = this.map.getObjects();

    for (const obj of objects) {
      if (obj.type === "building" && obj.category === "residential") {
        pop += 4; // 1 house = 4 people
      }
    }
    this.population = pop;
  }

  getPopulation() {
    return this.population;
  }
}
