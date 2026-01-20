export class Renderer {
  constructor(canvas, ctx, map) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.map = map;

    this.offsetX = 0;
    this.offsetY = 0;
    this.scale = 1.0;

    // Massive Range:
    // 0.001 (1px = 1km) -> 1000px screen = 1000km
    // 20.0 (20px = 1m) -> High detail
    this.minScale = 0.001;
    this.maxScale = 20.0;

    // Level of Detail Threshold
    this.LOD_THRESHOLD = 0.5;

    // Colors
    this.colors = {
      BACKGROUND: "#60a5fa", // Ocean Blue
      LAND: "#4ade80", // Grass Green
      ROAD_CORE: "#ffffff",
      ROAD_BORDER: "#94a3b8",
      BUILDING_RES: "#fca5a5",
      BUILDING_COM: "#93c5fd",
      BUILDING_IND: "#fde047",
      TREE: "#22c55e",
    };
  }

  resize(w, h) {
    if (this.offsetX === 0 && this.offsetY === 0) {
      this.offsetX = w / 2;
      this.offsetY = h / 2;
    }
  }

  pan(dx, dy) {
    this.offsetX += dx;
    this.offsetY += dy;
  }

  zoom(delta, mouseX, mouseY) {
    // Multiplicative Zoom for huge range
    const factor = 1.1;
    let newScale = this.scale;

    if (delta < 0)
      newScale *= factor; // Zoom In
    else newScale /= factor; // Zoom Out

    newScale = Math.max(this.minScale, Math.min(this.maxScale, newScale));

    if (newScale === this.scale) return;

    const worldX = (mouseX - this.offsetX) / this.scale;
    const worldY = (mouseY - this.offsetY) / this.scale;

    this.offsetX = mouseX - worldX * newScale;
    this.offsetY = mouseY - worldY * newScale;
    this.scale = newScale;

    // Notify UI of scale change? (Ideally via callback, but we'll polling in UI or just update text)
  }

  toScreen(x, y) {
    return {
      x: this.offsetX + x * this.scale,
      y: this.offsetY + y * this.scale,
    };
  }

  toWorld(sx, sy) {
    return {
      x: (sx - this.offsetX) / this.scale,
      y: (sy - this.offsetY) / this.scale,
    };
  }

  draw(timestamp = 0, input = null) {
    // Ocean Background
    this.ctx.fillStyle = this.colors.BACKGROUND;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // 0. Adaptive Grid
    this.drawGrid();

    const objects = this.map.getObjects();

    // --- Land Rendering (Composite for Merging) ---
    this.drawLandLayer(objects);

    // 2. Roads
    this.ctx.lineCap = "round";
    this.ctx.lineJoin = "round";
    for (const obj of objects) {
      if (obj.type === "road") this.drawRoad(obj);
    }

    // 3. Buildings & Trees (LOD Check)
    if (this.scale > 0.05) {
      // Only draw details if zoom > 0.05 (approx 1px = 20m)
      for (const obj of objects) {
        if (obj.type === "building") this.drawBuilding(obj);
        if (obj.type === "tree") this.drawTree(obj);
      }
    }

    // 4. Input Preview (Overlay)
    if (input) {
      // Polygon Preview
      if (input.polyPoints && input.polyPoints.length > 0) {
        const points = input.polyPoints;
        const mouseW = input.currentMouseWorld;

        // 1. Fill Preview (Potential Shape)
        this.ctx.fillStyle = "rgba(74, 222, 128, 0.5)"; // Semi-transparent Land
        this.ctx.beginPath();
        const start = this.toScreen(points[0].x, points[0].y);
        this.ctx.moveTo(start.x, start.y);

        for (let i = 1; i < points.length; i++) {
          const p = this.toScreen(points[i].x, points[i].y);
          this.ctx.lineTo(p.x, p.y);
        }

        // Close shape to Mouse
        const mouseS = this.toScreen(mouseW.x, mouseW.y);
        this.ctx.lineTo(mouseS.x, mouseS.y);
        this.ctx.closePath();
        this.ctx.fill();

        // 2. Stroke Line
        let strokeColor = "#ffffff";
        if (input.isSnapped) {
          if (input.snapType === "global")
            strokeColor = "#fde047"; // Yellow
          else if (input.snapType === "relative") strokeColor = "#22d3ee"; // Cyan
        }
        this.ctx.strokeStyle = strokeColor;
        this.ctx.lineWidth = 2 * this.scale;
        this.ctx.stroke(); // Stroke the shape we just filled

        // 3. Draw Dots/Vertices
        this.ctx.fillStyle = "#fff";
        for (const pt of points) {
          const s = this.toScreen(pt.x, pt.y);
          this.ctx.beginPath();
          this.ctx.arc(s.x, s.y, 4, 0, Math.PI * 2);
          this.ctx.fill();
        }

        // 4. Length Labels (For ALL segments)
        const drawLabel = (p1, p2) => {
          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          const midX = (p1.x + p2.x) / 2;
          const midY = (p1.y + p2.y) / 2;
          const midS = this.toScreen(midX, midY);

          let label = `${Math.round(dist)}m`;
          if (dist >= 1000) label = `${(dist / 1000).toFixed(1)}km`;

          this.ctx.font = "12px sans-serif";
          const metrics = this.ctx.measureText(label);
          const pad = 4;

          this.ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
          this.ctx.fillRect(
            midS.x - metrics.width / 2 - pad,
            midS.y - 10 - pad,
            metrics.width + pad * 2,
            20,
          );

          this.ctx.fillStyle = "#fff";
          this.ctx.textAlign = "center";
          this.ctx.textBaseline = "middle";
          this.ctx.fillText(label, midS.x, midS.y - 10);
        };

        // Existing segments
        for (let i = 0; i < points.length - 1; i++) {
          drawLabel(points[i], points[i + 1]);
        }

        // Active segment (Last -> Mouse)
        drawLabel(points[points.length - 1], mouseW);
      }

      // Road Drag Preview
      if (input.dragStart && this.map.getObjects) {
        // Check active tool via Input? Input knows activeTool via Game
        // We don't have activeTool reference here easily unless passed.
        // But input.dragStart is only set for road currently in my logic?
        // Actually dragStart is used for Pan? No, Pan flag is isPanning.

        // Let's assume dragStart means Road for now based on Input.js logic

        // Wait, Input.js:
        // if (this.game.activeTool === 'road') { this.dragStart = w; }

        this.ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
        this.ctx.lineWidth = 20 * this.scale;
        this.ctx.beginPath();
        const s = this.toScreen(input.dragStart.x, input.dragStart.y);
        const e = this.toScreen(
          input.currentMouseWorld.x,
          input.currentMouseWorld.y,
        );
        this.ctx.moveTo(s.x, s.y);
        this.ctx.lineTo(e.x, e.y);
        this.ctx.stroke();
      }
    }
  }

  // Helper to separate Drawing Logic
  drawLandLayer(objects) {
    // We need to render Borders first for everything, then Fills.
    // But Brush "Fill" is actually a Stroke.
    // And Brush "Border" is a Thicker Stroke.

    // PASS 1: Borders
    this.ctx.lineCap = "round";
    this.ctx.lineJoin = "round";
    this.ctx.strokeStyle = "#15803d"; // Dark Green Border

    for (const obj of objects) {
      if (obj.type === "land") {
        this.ctx.lineWidth = 4 * this.scale; // Regular polygon border
        this.drawPolygonPath(obj);
        this.ctx.stroke();
      } else if (obj.type === "land_brush") {
        const s = (obj.size || 20) * this.scale;
        this.ctx.lineWidth = s + 4 * this.scale; // Size + Border
        this.drawBrushPath(obj);
        this.ctx.stroke();
      } else if (obj.type === "land_circle") {
        const r = obj.r * this.scale;
        this.ctx.lineWidth = 4 * this.scale; // Stroke outline
        this.drawCirclePath(obj);
        this.ctx.stroke();
      }
    }

    // PASS 2: Fills
    this.ctx.fillStyle = this.colors.LAND;
    // For brushes, we stroke with land color

    for (const obj of objects) {
      if (obj.type === "land") {
        this.drawPolygonPath(obj);
        // Reduce overlap artifacts by stroking slightly with fill color?
        // No, standard fill is fine if stroke buffer is deep enough.
        this.ctx.fill();
      } else if (obj.type === "land_brush") {
        this.ctx.strokeStyle = this.colors.LAND;
        this.ctx.lineWidth = (obj.size || 20) * this.scale;
        this.drawBrushPath(obj);
        this.ctx.stroke();
      } else if (obj.type === "land_circle") {
        this.drawCirclePath(obj);
        this.ctx.fill();
      }
    }
  }

  drawPolygonPath(poly) {
    if (!poly.points || poly.points.length < 3) return;
    this.ctx.beginPath();
    const start = this.toScreen(poly.points[0].x, poly.points[0].y);
    this.ctx.moveTo(start.x, start.y);
    for (let i = 1; i < poly.points.length; i++) {
      const p = this.toScreen(poly.points[i].x, poly.points[i].y);
      this.ctx.lineTo(p.x, p.y);
    }
    this.ctx.closePath();
  }

  drawBrushPath(brush) {
    if (!brush.points || brush.points.length < 1) return;
    this.ctx.beginPath();
    const start = this.toScreen(brush.points[0].x, brush.points[0].y);
    this.ctx.moveTo(start.x, start.y);
    for (let i = 1; i < brush.points.length; i++) {
      const p = this.toScreen(brush.points[i].x, brush.points[i].y);
      this.ctx.lineTo(p.x, p.y);
    }
    // No closePath for brush
  }

  drawCirclePath(obj) {
    const s = this.toScreen(obj.x, obj.y);
    const r = obj.r * this.scale;
    this.ctx.beginPath();
    this.ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
  }

  drawGrid() {
    // 1. Calculate Grid Step
    // We want a line every ~100 pixels on screen
    const targetPixels = 100;
    const rawStep = targetPixels / this.scale;
    const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
    let step = mag;
    if (rawStep / mag > 5) step = 5 * mag;
    else if (rawStep / mag > 2) step = 2 * mag;

    this.ctx.lineWidth = 1;
    this.ctx.strokeStyle = "rgba(255, 255, 255, 0.2)"; // Faint white grid

    // 2. Visible World Bounds
    // Screen (0,0) to World
    const tl = this.toWorld(0, 0);
    const br = this.toWorld(this.canvas.width, this.canvas.height);

    // 3. Draw Vertical Lines
    // Start from first multiple of step <= tl.x
    const startX = Math.floor(tl.x / step) * step;
    this.ctx.beginPath();
    for (let x = startX; x <= br.x; x += step) {
      const s = this.toScreen(x, 0); // y doesn't matter for x coord
      this.ctx.moveTo(s.x, 0);
      this.ctx.lineTo(s.x, this.canvas.height);
    }

    // 4. Draw Horizontal Lines
    const startY = Math.floor(tl.y / step) * step;
    for (let y = startY; y <= br.y; y += step) {
      const s = this.toScreen(0, y);
      this.ctx.moveTo(0, s.y);
      this.ctx.lineTo(this.canvas.width, s.y);
    }
    this.ctx.stroke();
  }

  drawPolygon(poly, color, onlyStroke = false) {
    if (!poly.points || poly.points.length < 3) return;

    this.ctx.beginPath();
    const start = this.toScreen(poly.points[0].x, poly.points[0].y);
    this.ctx.moveTo(start.x, start.y);
    for (let i = 1; i < poly.points.length; i++) {
      const p = this.toScreen(poly.points[i].x, poly.points[i].y);
      this.ctx.lineTo(p.x, p.y);
    }
    this.ctx.closePath();

    if (!onlyStroke) {
      this.ctx.fillStyle = color;
      this.ctx.fill();
    } else {
      // Subtle external border
      this.ctx.strokeStyle = "#22c55e"; // darker green
      this.ctx.lineWidth = 1 * this.scale;
      this.ctx.stroke();
    }
  }

  drawLandCircle(obj, color, onlyStroke = false) {
    const s = this.toScreen(obj.x, obj.y);
    const r = obj.r * this.scale;

    this.ctx.beginPath();
    this.ctx.arc(s.x, s.y, r, 0, Math.PI * 2);

    if (!onlyStroke) {
      this.ctx.fillStyle = color;
      this.ctx.fill();
    } else {
      this.ctx.strokeStyle = "#22c55e";
      this.ctx.lineWidth = 1 * this.scale;
      this.ctx.stroke();
    }
  }

  drawRoad(road) {
    if (road.points.length < 2) return;
    const width = (road.width || 20) * this.scale;

    this.ctx.beginPath();
    const start = this.toScreen(road.points[0].x, road.points[0].y);
    this.ctx.moveTo(start.x, start.y);
    for (let i = 1; i < road.points.length; i++) {
      const p = this.toScreen(road.points[i].x, road.points[i].y);
      this.ctx.lineTo(p.x, p.y);
    }

    this.ctx.strokeStyle = this.colors.ROAD_BORDER;
    this.ctx.lineWidth = width + 4 * this.scale;
    this.ctx.stroke();

    this.ctx.strokeStyle = this.colors.ROAD_CORE;
    this.ctx.lineWidth = width;
    this.ctx.stroke();

    // Joints
    this.ctx.fillStyle = this.colors.ROAD_CORE;
    for (const pt of road.points) {
      const s = this.toScreen(pt.x, pt.y);
      this.ctx.beginPath();
      this.ctx.arc(s.x, s.y, width / 2, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }

  drawBuilding(b) {
    const s = this.toScreen(b.x, b.y);
    const w = b.width * this.scale;
    const h = b.height * this.scale;

    this.ctx.save();
    this.ctx.translate(s.x, s.y);
    if (b.rotation) this.ctx.rotate(b.rotation);

    this.ctx.fillStyle = "rgba(0,0,0,0.1)";
    this.ctx.fillRect(-w / 2 + 5 * this.scale, -h / 2 + 5 * this.scale, w, h);

    this.ctx.fillStyle = b.color;
    this.ctx.fillRect(-w / 2, -h / 2, w, h);

    this.ctx.restore();
  }

  drawTree(t) {
    const s = this.toScreen(t.x, t.y);
    const r = (t.size || 15) * this.scale;
    this.ctx.fillStyle = this.colors.TREE;
    this.ctx.beginPath();
    this.ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
    this.ctx.fill();
  }
}
