export class Input {
  constructor(canvas, game) {
    this.canvas = canvas;
    this.game = game;
    this.renderer = game.renderer;

    this.isPanning = false;
    this.lastMouseX = 0;
    this.lastMouseY = 0;

    // Tool State
    this.dragStart = null;
    this.currentMouseWorld = { x: 0, y: 0 };
    this.isBrushing = false;

    // Polygon Tool State (for Land)
    this.polyPoints = [];
    this.landMode = "poly"; // poly, rect, circle

    this.keys = {};

    this.setupListeners();
  }

  setupListeners() {
    this.canvas.addEventListener("mousedown", (e) => this.onMouseDown(e));
    this.canvas.addEventListener("mousemove", (e) => this.onMouseMove(e));
    this.canvas.addEventListener("mouseup", (e) => this.onMouseUp(e));
    this.canvas.addEventListener("wheel", (e) => this.onWheel(e), {
      passive: false,
    });
    this.canvas.addEventListener("contextmenu", (e) => {
      e.preventDefault();
    });

    window.addEventListener("keydown", (e) => {
      this.keys[e.code] = true;
    });
    window.addEventListener("keyup", (e) => {
      this.keys[e.code] = false;
      if (e.code === "Escape") this.cancelPoly();
      if (e.code === "Enter") this.finishPoly();
      if (e.code === "Backspace" || e.code === "Delete") this.undoLastPoint();
    });

    // UI Buttons
    const btnCancel = document.getElementById("btn-cancel-poly");
    if (btnCancel) btnCancel.addEventListener("click", () => this.cancelPoly());

    const btnFinish = document.getElementById("btn-finish-poly");
    if (btnFinish) btnFinish.addEventListener("click", () => this.finishPoly());
    
    const btnUndo = document.getElementById("btn-undo-poly");
    if (btnUndo) btnUndo.addEventListener("click", () => this.undoLastPoint());
  }

  getMousePos(e) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  onWheel(e) {
    e.preventDefault();
    const m = this.getMousePos(e);
    this.renderer.zoom(e.deltaY, m.x, m.y);
  }

  onMouseDown(e) {
    const m = this.getMousePos(e);
    const w = this.renderer.toWorld(m.x, m.y);

    // Middle Click Pan
    if (
      e.button === 1 ||
      (e.button === 0 && this.game.activeTool === "cursor")
    ) {
      this.isPanning = true;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
      this.canvas.style.cursor = "grabbing";
      return;
    }

    if (e.button === 0) {
      // Road Tool (Drag)
      if (this.game.activeTool === "road") {
        this.dragStart = w;
      }
      // Land Tool
      else if (this.game.activeTool === "land") {
        // Common: Use snapped position
        const p = this.currentMouseWorld;
        
        if (this.landMode === "rect") {
            // 3-Click Rectangle
            // 1. Start Point
            // 2. Width Vector (Base Line)
            // 3. Height (Perpendicular distance)
            this.polyPoints.push({ x: p.x, y: p.y });
            
            if (this.polyPoints.length === 3) {
                this.finishRect();
            }
        } else if (this.landMode === "circle") {
            // 2-Click Circle
            // 1. Center
            // 2. Radius Point
            this.polyPoints.push({ x: p.x, y: p.y });
            
            if (this.polyPoints.length === 2) {
                this.finishCircle();
            }
        } else {
            // Poly Mode
            this.polyPoints.push({ x: p.x, y: p.y });
            this.updatePolyUI(); // Actually deprecated but keeps state clean? Reference implementation empty.
    
            if (this.polyPoints.length > 2) {
              const first = this.polyPoints[0];
              // Use isClosingLoop flag logic here
              if (this.isClosingLoop) {
                this.finishPoly();
              }
            }
        }
      }
      // Brush Tool (Paint)
      else if (this.game.activeTool === "brush") {
        this.isBrushing = true;
        this.game.startBrush(w.x, w.y);
      }
      // Object Placement
      else if (
        ["residential", "commercial", "industrial", "forest"].includes(
          this.game.activeTool,
        )
      ) {
        this.game.placeObject(this.game.activeTool, w.x, w.y);
      }
    }
  }

  setLandMode(mode) {
      this.landMode = mode;
      // Reset state if switching
      this.polyPoints = [];
      this.dragStart = null;
      this.isClosingLoop = false;
      this.updatePolyUI();
  }

  onMouseMove(e) {
    const m = this.getMousePos(e);
    let w = this.renderer.toWorld(m.x, m.y);

    // Snapping Logic (Polygon Tool)
    this.isSnapped = false;
    this.snapType = null;

    if (this.game.activeTool === "land" && this.polyPoints.length > 0) {
      const last = this.polyPoints[this.polyPoints.length - 1];
      const snapThresh = 20 / this.renderer.scale;
      
      // Check for closing loop
      if (this.polyPoints.length > 2) {
        const first = this.polyPoints[0];
        const distToStart = Math.hypot(w.x - first.x, w.y - first.y);
        this.isClosingLoop = distToStart < snapThresh;
      } else {
        this.isClosingLoop = false;
      }

      let bestDist = snapThresh;
      let snapCandidate = null; // {x, y, type}

      const useGlobal =
        document.getElementById("chk-snap-global")?.checked ?? true;
      const useRelative =
        document.getElementById("chk-snap-relative")?.checked ?? true;

      // 1. Global Snap (Vertical/Horizontal)
      if (useGlobal) {
        const dx = Math.abs(w.x - last.x);
        const dy = Math.abs(w.y - last.y);

        // Note: Prioritize closer one
        if (dx < bestDist) {
          bestDist = dx;
          snapCandidate = { x: last.x, y: w.y, type: "global" };
        }
        if (dy < bestDist) {
          bestDist = dy;
          snapCandidate = { x: w.x, y: last.y, type: "global" };
        }
      }

      // 2. Relative Snap (90/180 deg from last segment)
      if (useRelative && this.polyPoints.length > 1) {
        const prev = this.polyPoints[this.polyPoints.length - 2];
        const baseAngle = Math.atan2(last.y - prev.y, last.x - prev.x);

        // Current angle to mouse
        const curDist = Math.hypot(w.x - last.x, w.y - last.y);
        const curAngle = Math.atan2(w.y - last.y, w.x - last.x);

        // Test 4 cardinal directions relative to baseAngle: 0, 90, 180, -90
        const angles = [0, Math.PI / 2, Math.PI, -Math.PI / 2];

        for (const da of angles) {
          const targetAngle = baseAngle + da;

          // Project mouse onto line defined by (last, targetAngle)
          // Distance from point to line... or simpler:
          // Check angular difference? Angular diff is easier if dist is large.
          // But pixel distance is better for UX.
          // Let's use vector projection.
          // Vector Mouse->Last (M-L)
          // Unit Vector Target (U)
          // Proj = (M-L) dot U
          // Closest point on line = L + Proj * U
          // Dist = distance(Mouse, Closest)

          const ux = Math.cos(targetAngle);
          const uy = Math.sin(targetAngle);

          const vx = w.x - last.x;
          const vy = w.y - last.y;

          const dot = vx * ux + vy * uy;
          // We only want 'forward' projection if da=0? No, lines are infinite for snapping technically,
          // but visually we usually mean 0-360 range.
          // Let's assume we want to guide the cursor.

          // Closest point on the infinite line
          const cx = last.x + dot * ux;
          const cy = last.y + dot * uy;

          const d = Math.hypot(w.x - cx, w.y - cy);

          if (d < bestDist) {
            bestDist = d;
            snapCandidate = { x: cx, y: cy, type: "relative" };
          }
        }
      }

      // Apply best snap
      if (snapCandidate) {
        w.x = snapCandidate.x;
        w.y = snapCandidate.y;
        this.isSnapped = true;
        this.snapType = snapCandidate.type;
      }
    }

    this.currentMouseWorld = w;

    if (this.isBrushing && this.game.activeTool === "brush") {
      this.game.addBrushPoint(w.x, w.y);
      return;
    }

    if (this.isPanning) {
      const dx = e.clientX - this.lastMouseX;
      const dy = e.clientY - this.lastMouseY;
      this.renderer.pan(dx, dy);
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
      return;
    }

    const display = document.getElementById("coords-display");
    if (display)
      display.textContent = `X: ${Math.round(w.x)}, Y: ${Math.round(w.y)}`;
  }

  onMouseUp(e) {
    if (this.isBrushing) {
      this.isBrushing = false;
      this.game.endBrush();
    }

    if (this.isPanning) {
      this.isPanning = false;
      this.canvas.style.cursor = "default";
      return;
    }

    const m = this.getMousePos(e);
    const w = this.renderer.toWorld(m.x, m.y);

    // Land Shape Creation (Drag) - Deprecated / Removed
    // Logic is now in onMouseDown via finishRect/finishCircle
    
    // Cleanup any lingering dragStart just in case
    this.dragStart = null;

    if (this.game.activeTool === "road" && this.dragStart) {
      const dx = w.x - this.dragStart.x;
      const dy = w.y - this.dragStart.y;
      if (Math.hypot(dx, dy) > 5) {
        this.game.createRoad(this.dragStart, w);
      }
      this.dragStart = null;
    }
  }

  updatePolyUI() {
    // Deprecated: UI is now handled by side panel buttons
  }

  cancelPoly() {
    this.polyPoints = [];
    this.updatePolyUI();
  }

  finishPoly() {
    if (this.polyPoints.length > 2) {
      this.game.createLand(this.polyPoints);
      this.polyPoints = [];
      this.isClosingLoop = false;
      this.updatePolyUI();
    }
  }

  undoLastPoint() {
    if (this.polyPoints.length > 0) {
      this.polyPoints.pop();
      this.isClosingLoop = false;
      this.updatePolyUI();
    }
  }

  finishRect() {
      if (this.polyPoints.length !== 3) return;
      const p1 = this.polyPoints[0];
      const p2 = this.polyPoints[1];
      const p3 = this.polyPoints[2];
      
      // Vector p1->p2
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      
      // We need to project p3 onto the line perpendicular to p1-p2 to find the "height" vector
      // Or simply: The rectangle is defined by Base(p1, p2) and the component of Vector(p2, p3) perpendicular to Base.
      // Actually simpler:
      // We want a rectangle where one side is P1->P2.
      // The other side length is determined by P3's distance from the line P1-P2.
      // AND P3 projects the "far side".
      
      // Let vBase = P2 - P1.
      // Let vHeight = P3 - P2 (but projected to be perpendicular to vBase? No, just P3 determines the offset)
      // Standard rotated rect logic:
      // P1, P2 are corners. P3 determines the thickness/height.
      // We project (P3 - P2) onto perpendicular of (P1 - P2).
      
      const vBaseX = p2.x - p1.x;
      const vBaseY = p2.y - p1.y;
      
      // Perpendicular vector (rotated 90 deg)
      const perpX = -vBaseY;
      const perpY = vBaseX;
      
      // Normalize perp
      const len = Math.hypot(perpX, perpY);
      if (len === 0) return; // p1 == p2
      const uPerpX = perpX / len;
      const uPerpY = perpY / len;
      
      // Vector P2 -> P3
      const v3X = p3.x - p2.x;
      const v3Y = p3.y - p2.y;
      
      // Project P2->P3 onto UnitPerp
      const dist = v3X * uPerpX + v3Y * uPerpY;
      
      // The Offset Vector
      const offX = uPerpX * dist;
      const offY = uPerpY * dist;
      
      // 4 Points:
      // 1. P1
      // 2. P2
      // 3. P2 + Offset
      // 4. P1 + Offset
      
      const corners = [
          { x: p1.x, y: p1.y },
          { x: p2.x, y: p2.y },
          { x: p2.x + offX, y: p2.y + offY },
          { x: p1.x + offX, y: p1.y + offY }
      ];
      
      this.game.createLand(corners);
      this.polyPoints = [];
  }

  finishCircle() {
      if (this.polyPoints.length !== 2) return;
      const center = this.polyPoints[0];
      const edge = this.polyPoints[1];
      
      const r = Math.hypot(edge.x - center.x, edge.y - center.y);
      if (r > 1) {
        const segments = 64; // Higher quality
        const points = [];
        for (let i = 0; i < segments; i++) {
            const angle = (i / segments) * Math.PI * 2;
            points.push({
                x: center.x + Math.cos(angle) * r,
                y: center.y + Math.sin(angle) * r
            });
        }
        this.game.createLand(points);
      }
      this.polyPoints = [];
  }
}
