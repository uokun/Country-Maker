import { Map } from "./map.js";
import { Renderer } from "./renderer.js";
import { Input } from "./input.js";
import { UI } from "./ui.js";
import { Simulation } from "./simulation.js";

export class Game {
  constructor() {
    this.canvas = document.getElementById("gameCanvas");
    this.ctx = this.canvas.getContext("2d");

    this.map = new Map();
    this.renderer = new Renderer(this.canvas, this.ctx, this.map);
    this.simulation = new Simulation(this.map);
    this.input = new Input(this.canvas, this);
    this.ui = new UI(this);

    this.lastTime = 0;
    this.activeTool = "cursor";
  }

  start() {
    this.resize();
    window.addEventListener("resize", () => this.resize());
    requestAnimationFrame((ts) => this.loop(ts));
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.renderer.resize(this.canvas.width, this.canvas.height);
  }

  loop(timestamp) {
    this.lastTime = timestamp;
    if (this.simulation.update(timestamp)) {
      this.ui.updateStatus();
    }
    const speed = 10;
    if (this.input.keys["KeyW"] || this.input.keys["ArrowUp"])
      this.renderer.pan(0, speed);
    if (this.input.keys["KeyS"] || this.input.keys["ArrowDown"])
      this.renderer.pan(0, -speed);
    if (this.input.keys["KeyA"] || this.input.keys["ArrowLeft"])
      this.renderer.pan(speed, 0);
    if (this.input.keys["KeyD"] || this.input.keys["ArrowRight"])
      this.renderer.pan(-speed, 0);

    this.renderer.draw(timestamp, this.input);
    requestAnimationFrame((ts) => this.loop(ts));
  }

  setTool(toolName) {
    this.activeTool = toolName;
  }

  createRoad(start, end) {
    this.map.addObject({
      type: "road",
      points: [start, end],
      width: 20,
    });
  }

  createLand(points) {
    this.map.addObject({
      type: "land",
      points: points,
    });
  }

  createLandCircle(x, y, r) {
    this.map.addObject({
      type: "land_circle",
      x,
      y,
      r,
    });
  }

  // New Brush Logic
  startBrush(x, y) {
    const brushObj = {
      type: "land_brush",
      points: [{ x, y }],
      size: 40,
    };
    this.currentBrush = brushObj;
    this.map.addObject(brushObj);
  }

  addBrushPoint(x, y) {
    if (this.currentBrush) {
      // simple distance check to avoid too many points
      const last =
        this.currentBrush.points[this.currentBrush.points.length - 1];
      const dx = x - last.x;
      const dy = y - last.y;
      if (dx * dx + dy * dy > 20) {
        // must move 4-5 pixels
        this.currentBrush.points.push({ x, y });
      }
    }
  }

  endBrush() {
    this.currentBrush = null;
  }

  placeObject(type, x, y) {
    if (type === "forest") {
      for (let i = 0; i < 5; i++) {
        this.map.addObject({
          type: "tree",
          x: x + (Math.random() - 0.5) * 50,
          y: y + (Math.random() - 0.5) * 50,
          size: 10 + Math.random() * 10,
        });
      }
      return;
    }

    let width = 30,
      height = 30;
    let color = "#ccc";
    if (type === "residential") {
      color = "#fca5a5";
      width = 25;
      height = 25;
    }
    if (type === "commercial") {
      color = "#93c5fd";
      width = 40;
      height = 40;
    }
    if (type === "industrial") {
      color = "#fde047";
      width = 50;
      height = 50;
    }

    this.map.addObject({
      type: "building",
      category: type,
      x,
      y,
      width,
      height,
      rotation: Math.random() * Math.PI * 0.5,
      color,
    });
  }

  saveGame() {
    localStorage.setItem("countryMakerMap", this.map.exportData());
    alert("Saved!");
  }

  clearMap() {
    if (confirm("Reset map?")) {
      this.map.clear();
    }
  }
}

// Start the game
document.addEventListener("DOMContentLoaded", () => {
  const game = new Game();
  game.start();
  // Expose for debugging
  window.game = game;
});
