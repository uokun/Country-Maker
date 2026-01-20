import { Map } from "./map.js";
import { Renderer } from "./renderer.js";
import { Input } from "./input.js";
import { UI } from "./ui.js";
import { Simulation } from "./simulation.js";

export class Game {
  constructor() {
    this.canvas = document.getElementById("gameCanvas");
    this.ctx = this.canvas.getContext("2d");

    // Game Settings
    this.tileSize = 40;
    this.mapWidth = 64;
    this.mapHeight = 64;

    // Systems
    this.map = new Map(this.mapWidth, this.mapHeight);
    this.renderer = new Renderer(
      this.canvas,
      this.ctx,
      this.map,
      this.tileSize,
    );
    this.simulation = new Simulation(this.map); // Init Sim
    this.input = new Input(this.canvas, this, this.tileSize);
    this.ui = new UI(this);

    // State
    this.lastTime = 0;
    this.activeTool = "cursor"; // cursor, land, water, road, rail, forest
  }

  start() {
    this.resize();
    window.addEventListener("resize", () => this.resize());

    // Start Loop
    requestAnimationFrame((ts) => this.loop(ts));
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.renderer.resize(this.canvas.width, this.canvas.height);
    this.renderer.draw(); // Force redraw
  }

  loop(timestamp) {
    // const deltaTime = timestamp - this.lastTime;
    this.lastTime = timestamp;

    // Simulation Update
    if (this.simulation.update(timestamp)) {
      this.ui.updateStatus(); // Refresh UI if sim updated
    }

    // Camera Movement (WASD)
    const speed = 10; // Pixels per frame
    if (this.input.keys["KeyW"] || this.input.keys["ArrowUp"])
      this.renderer.pan(0, speed);
    if (this.input.keys["KeyS"] || this.input.keys["ArrowDown"])
      this.renderer.pan(0, -speed);
    if (this.input.keys["KeyA"] || this.input.keys["ArrowLeft"])
      this.renderer.pan(speed, 0);
    if (this.input.keys["KeyD"] || this.input.keys["ArrowRight"])
      this.renderer.pan(-speed, 0);

    // Draw
    this.renderer.draw(timestamp);

    requestAnimationFrame((ts) => this.loop(ts));
  }

  // Called by Input module
  onTileClick(gridX, gridY) {
    this.applyTool(gridX, gridY);
  }

  // Called when dragging
  onTileDrag(gridX, gridY) {
    // Some tools work on drag (Paint), some might not (Buildings, maybe?)
    // For now, allow painting everything
    this.applyTool(gridX, gridY);
  }

  applyTool(x, y) {
    const currentTile = this.map.getTile(x, y);

    switch (this.activeTool) {
      case "land":
        this.map.setTile(x, y, this.map.TILES.LAND);
        break;
      case "water":
        this.map.setTile(x, y, this.map.TILES.WATER);
        break;
      case "road":
        if (currentTile !== this.map.TILES.WATER) {
          this.map.setTile(x, y, this.map.TILES.ROAD);
        }
        break;
      case "rail":
        if (currentTile !== this.map.TILES.WATER) {
          this.map.setTile(x, y, this.map.TILES.RAIL);
        }
        break;
      case "forest":
        if (
          currentTile !== this.map.TILES.WATER &&
          currentTile !== this.map.TILES.ROAD &&
          currentTile !== this.map.TILES.RAIL
        ) {
          this.map.setTile(x, y, this.map.TILES.FOREST);
        }
        break;
      case "residential":
        if (currentTile === this.map.TILES.LAND)
          this.map.setTile(x, y, this.map.TILES.RESIDENTIAL);
        break;
      case "commercial":
        if (currentTile === this.map.TILES.LAND)
          this.map.setTile(x, y, this.map.TILES.COMMERCIAL);
        break;
      case "industrial":
        if (currentTile === this.map.TILES.LAND)
          this.map.setTile(x, y, this.map.TILES.INDUSTRIAL);
        break;
    }
  }

  // Called by UI module
  setTool(toolName) {
    console.log(`Tool selected: ${toolName}`);
    this.activeTool = toolName;
  }

  saveGame() {
    localStorage.setItem("countryMakerMap", this.map.exportData());
    alert("保存しました！");
  }

  clearMap() {
    if (confirm("地図を全て海に戻してリセットしますか？")) {
      this.map.initialize();
    }
  }
}
