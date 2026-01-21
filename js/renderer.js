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

        if (input.landMode === "rect") {
            // High-End Visual Style Helper
            const drawStyledLabel = (str, x, y, align = "center", baseline = "middle") => {
                this.ctx.font = "bold 13px 'Segoe UI', sans-serif";
                const metrics = this.ctx.measureText(str);
                const padx = 6;
                const pady = 4;
                const w = metrics.width + padx * 2;
                const h = 20; // fixed height approx
                
                let bgX = x;
                let bgY = y - h/2;
                
                if (align === "center") bgX = x - w/2;
                // Adjust as needed
                
                // Dark Grey Background Box
                this.ctx.fillStyle = "rgba(30, 41, 59, 0.9)"; // Slate-800
                this.ctx.fillRect(bgX, bgY, w, h);
                
                // Text
                this.ctx.fillStyle = "#ffffff";
                this.ctx.textAlign = "left"; // Draw relative to box
                this.ctx.textBaseline = "middle";
                this.ctx.fillText(str, bgX + padx, bgY + h/2);
            };

            const drawVertex = (x, y) => {
                this.ctx.beginPath();
                this.ctx.arc(x, y, 4, 0, Math.PI * 2);
                this.ctx.fillStyle = "#ffffff";
                this.ctx.fill();
                this.ctx.lineWidth = 1.5;
                this.ctx.strokeStyle = "#1e293b";
                this.ctx.stroke();
            };

            // 1 Point: Draw Line to Mouse (Base)
            if (points.length === 1) {
                const p1 = points[0];
                const s1 = this.toScreen(p1.x, p1.y);
                const s2 = this.toScreen(mouseW.x, mouseW.y);
                
                this.ctx.beginPath();
                this.ctx.moveTo(s1.x, s1.y);
                this.ctx.lineTo(s2.x, s2.y);
                this.ctx.strokeStyle = "#facc15"; // Yellow-400
                this.ctx.lineWidth = 3; 
                this.ctx.stroke();

                drawVertex(s1.x, s1.y);
                drawVertex(s2.x, s2.y);

                // Label
                const dist = Math.hypot(mouseW.x - p1.x, mouseW.y - p1.y);
                drawStyledLabel(`${Math.round(dist)}m`, (s1.x + s2.x)/2, (s1.y + s2.y)/2);
            }
            // 2 Points: Draw Base + Projected Height Box
            else if (points.length === 2) {
                const p1 = points[0];
                const p2 = points[1];
                
                // Base Vector
                const vBaseX = p2.x - p1.x;
                const vBaseY = p2.y - p1.y;
                
                // Perpendicular Unit Vector
                const perpX = -vBaseY;
                const perpY = vBaseX;
                const len = Math.hypot(perpX, perpY);
                if (len > 0) {
                    const uPerpX = perpX / len;
                    const uPerpY = perpY / len;
                    
                    // Project Mouse P3 onto Perp
                    const v3X = mouseW.x - p2.x;
                    const v3Y = mouseW.y - p2.y;
                    const dist = v3X * uPerpX + v3Y * uPerpY;
                    
                    const offX = uPerpX * dist;
                    const offY = uPerpY * dist;
                    
                    // Calc 4 corners
                    const c1 = this.toScreen(p1.x, p1.y);
                    const c2 = this.toScreen(p2.x, p2.y);
                    const c3 = this.toScreen(p2.x + offX, p2.y + offY);
                    const c4 = this.toScreen(p1.x + offX, p1.y + offY);
                    
                    this.ctx.beginPath();
                    this.ctx.moveTo(c1.x, c1.y);
                    this.ctx.lineTo(c2.x, c2.y);
                    this.ctx.lineTo(c3.x, c3.y);
                    this.ctx.lineTo(c4.x, c4.y);
                    this.ctx.closePath();
                    
                    this.ctx.fillStyle = "rgba(45, 212, 191, 0.5)"; // Teal-400, 50%
                    this.ctx.fill();
                    this.ctx.lineWidth = 3;
                    this.ctx.strokeStyle = "#facc15"; // Yellow-400
                    this.ctx.stroke();

                    // Vertices
                    drawVertex(c1.x, c1.y);
                    drawVertex(c2.x, c2.y);
                    drawVertex(c3.x, c3.y);
                    drawVertex(c4.x, c4.y);

                    // Labels
                    
                    // Base (P1-P2)
                    const distBase = Math.hypot(vBaseX, vBaseY);
                    drawStyledLabel(`${Math.round(distBase)}m`, (c1.x + c2.x)/2, (c1.y + c2.y)/2);
                    
                    // Side (P2-P3)
                    const distSide = Math.abs(dist);
                    drawStyledLabel(`${Math.round(distSide)}m`, (c2.x + c3.x)/2, (c2.y + c3.y)/2);
                }
            }
        } 
        else if (input.landMode === "circle") {
                // Re-use styled label helper? Or duplicate for scope safely
                const drawStyledLabel = (str, x, y) => {
                this.ctx.font = "bold 13px 'Segoe UI', sans-serif";
                const metrics = this.ctx.measureText(str);
                const padx = 6;
                const pady = 4;
                const w = metrics.width + padx * 2;
                const h = 20;
                const bgX = x - w/2;
                const bgY = y - h/2;
                this.ctx.fillStyle = "rgba(30, 41, 59, 0.9)";
                this.ctx.fillRect(bgX, bgY, w, h);
                this.ctx.fillStyle = "#ffffff";
                this.ctx.textAlign = "left";
                this.ctx.textBaseline = "middle";
                this.ctx.fillText(str, bgX + padx, bgY + h/2);
            };
            const drawVertex = (x, y) => {
                this.ctx.beginPath();
                this.ctx.arc(x, y, 4, 0, Math.PI * 2);
                this.ctx.fillStyle = "#ffffff";
                this.ctx.fill();
                this.ctx.lineWidth = 1.5;
                this.ctx.strokeStyle = "#1e293b";
                this.ctx.stroke();
            };

            // 1 Point: Center set, dragging Radius
            if (points.length === 1) {
                const center = points[0];
                const sCenter = this.toScreen(center.x, center.y);
                const r = Math.hypot(mouseW.x - center.x, mouseW.y - center.y);
                const sR = r * this.scale;
                
                this.ctx.beginPath();
                this.ctx.arc(sCenter.x, sCenter.y, sR, 0, Math.PI * 2);
                this.ctx.fillStyle = "rgba(45, 212, 191, 0.5)"; // Teal
                this.ctx.fill();
                this.ctx.strokeStyle = "#facc15"; // Yellow
                this.ctx.lineWidth = 3;
                this.ctx.stroke();

                // Vertex at Center
                drawVertex(sCenter.x, sCenter.y);
                
                // Radius Line
                const sEdge = this.toScreen(mouseW.x, mouseW.y);
                this.ctx.beginPath();
                this.ctx.moveTo(sCenter.x, sCenter.y);
                this.ctx.lineTo(sEdge.x, sEdge.y);
                this.ctx.setLineDash([5, 5]);
                this.ctx.strokeStyle = "#fff"; // Dashed white for radius
                this.ctx.lineWidth = 2;
                this.ctx.stroke();
                this.ctx.setLineDash([]);
                
                // Label
                drawStyledLabel(`R: ${Math.round(r)}m`, (sCenter.x + sEdge.x)/2, (sCenter.y + sEdge.y)/2);
            }
        } 
        else {
            // Standard Polygon Preview
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
            
            // If closing loop, snap visual to start point
            if (input.isClosingLoop && points.length > 0) {
                const startS = this.toScreen(points[0].x, points[0].y);
                this.ctx.lineTo(startS.x, startS.y);
            } else {
                this.ctx.lineTo(mouseS.x, mouseS.y);
            }
            
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
            for (let i = 0; i < points.length; i++) {
                const pt = points[i];
                const s = this.toScreen(pt.x, pt.y);
                this.ctx.beginPath();
                
                // Highlight start point if closing loop
                if (i === 0 && input.isClosingLoop) {
                    this.ctx.fillStyle = "#fde047"; // Yellow highlight
                    this.ctx.arc(s.x, s.y, 8, 0, Math.PI * 2);
                    this.ctx.fill();
                    this.ctx.fillStyle = "#fff"; // Reset
                } else {
                    this.ctx.arc(s.x, s.y, 4, 0, Math.PI * 2);
                    this.ctx.fill();
                }
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

            // Angle Visualization
            if (points.length >= 2) {
                const last = points[points.length - 1];
                const prev = points[points.length - 2];
                
                // Vector Prev -> Last
                const v1 = { x: last.x - prev.x, y: last.y - prev.y };
                // Vector Last -> Mouse
                const v2 = { x: mouseW.x - last.x, y: mouseW.y - last.y };
                
                const len1 = Math.hypot(v1.x, v1.y);
                const len2 = Math.hypot(v2.x, v2.y);
                
                if (len1 > 0 && len2 > 0) {
                    // Calculate angle
                    const dot = v1.x * v2.x + v1.y * v2.y;
                    const det = v1.x * v2.y - v1.y * v2.x;
                    const rad = Math.atan2(det, dot);
                    // let deg = Math.abs(rad * 180 / Math.PI); // Unused
                    
                    // We want the internal angle, usually 180 - deviation
                    // Or just the deviation? Relative snap is deviation (0, 90).
                    // Let's show deviation from straight line (0 deg) or turn angle.
                    // Actually, let's show the "Corner Angle" (interior).
                    // If parallel (straight), angle is 180.
                    // If 90 turn, angle is 90.
                    
                    // Let's use the absolute angle difference relative to previous segment.
                    // v1 angle:
                    const a1 = Math.atan2(v1.y, v1.x);
                    // v2 angle:
                    const a2 = Math.atan2(v2.y, v2.x);
                    
                    let diff = (a2 - a1) * 180 / Math.PI;
                    // Normalize to -180 to 180
                    while (diff > 180) diff -= 360;
                    while (diff < -180) diff += 360;
                    
                    const absDiff = Math.abs(diff);
                    const displayAngle = Math.round(absDiff);

                    // Draw Angle Arc
                    const sLast = this.toScreen(last.x, last.y);
                    const radius = 20;

                    this.ctx.beginPath();
                    this.ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
                    this.ctx.lineWidth = 1;
                    // Draw arc from a1 to a2
                    this.ctx.arc(sLast.x, sLast.y, radius, a1, a2, diff < 0);
                    this.ctx.stroke();

                    // Draw Text
                    this.ctx.fillStyle = "#fff";
                    this.ctx.font = "11px sans-serif";
                    this.ctx.fillText(`${displayAngle}°`, sLast.x + 10, sLast.y - 10);
                }
            }
        }
      }

      // Road Drag Preview
      if (input.dragStart && this.map.getObjects) {
        // Check active tool via Input? Input knows activeTool via Game
        // We don't have activeTool reference here easily unless passed.
        // But input.dragStart is only set for road currently in my logic?
        // Actually dragStart is used for Pan? No, Pan flag is isPanning.

        // Update: Now dragStart is used for Land (Rect/Circle) too.
        // We need to distinguish based on input.game.activeTool? 
        // We don't have access to game here easily, maybe input.game?
        // Input has reference to Game. Renderer doesn't strictly know Game structure in constructor but Input passed in draw(timestamp, input).
        
        const tool = input.game.activeTool;
        const startW = input.dragStart;
        const curW = input.currentMouseWorld;
        
        const s = this.toScreen(startW.x, startW.y);
        const e = this.toScreen(curW.x, curW.y);
        
        this.ctx.lineWidth = 2 * this.scale;
        this.ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
        this.ctx.fillStyle = "rgba(74, 222, 128, 0.3)"; // Faint Land Green

        if (tool === "road") {
             this.ctx.lineWidth = 20 * this.scale;
             this.ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
             this.ctx.beginPath();
             this.ctx.moveTo(s.x, s.y);
             this.ctx.lineTo(e.x, e.y);
             this.ctx.stroke();
        } 
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
