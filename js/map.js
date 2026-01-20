export class Map {
  constructor() {
    // Store all game objects in a flat list for now (easy to iterate)
    // types: 'road', 'building', 'tree', 'zone' (if we do zones like poly)
    this.objects = [];

    // Define Types for reference
    this.TYPES = {
      ROAD: "road",
      BUILDING: "building",
      TREE: "tree",
    };

    this.initialize();
  }

  initialize() {
    // Start empty or with a demo setup
  }

  addObject(obj) {
    // validation or ID generation could go here
    this.objects.push(obj);
  }

  getObjects() {
    return this.objects;
  }

  // Simple hit test (naive O(N))
  // radius: how close the click needs to be
  hitTest(x, y, radius = 10) {
    // Check objects in reverse order (top first)
    for (let i = this.objects.length - 1; i >= 0; i--) {
      const obj = this.objects[i];

      if (obj.type === this.TYPES.BUILDING || obj.type === this.TYPES.TREE) {
        // Circle distance check for simplicity
        const dx = obj.x - x;
        const dy = obj.y - y;
        if (Math.sqrt(dx * dx + dy * dy) < obj.size / 2) {
          return obj;
        }
      }
      // For roads (lines), we need point-to-segment distance.
      // Implement later if selecting roads is needed.
    }
    return null;
  }

  // Clear map
  clear() {
    this.objects = [];
  }

  exportData() {
    return JSON.stringify(this.objects);
  }

  importData(jsonString) {
    try {
      this.objects = JSON.parse(jsonString);
      return true;
    } catch (e) {
      console.error("Failed to load map data", e);
      return false;
    }
  }
}
