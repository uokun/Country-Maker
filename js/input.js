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
    });

    // UI Buttons
    const btnCancel = document.getElementById("btn-cancel-poly");
    if (btnCancel) btnCancel.addEventListener("click", () => this.cancelPoly());

    const btnFinish = document.getElementById("btn-finish-poly");
    if (btnFinish) btnFinish.addEventListener("click", () => this.finishPoly());
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
      // Land Tool (Polygon Click)
      else if (this.game.activeTool === "land") {
        this.polyPoints.push(w);
        this.updatePolyUI();

        if (this.polyPoints.length > 2) {
          const first = this.polyPoints[0];
          const dx = w.x - first.x;
          const dy = w.y - first.y;
          if (Math.hypot(dx, dy) < 20 / this.renderer.scale) {
            this.finishPoly();
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

  onMouseMove(e) {
    const m = this.getMousePos(e);
    let w = this.renderer.toWorld(m.x, m.y);

    // Snapping Logic (Polygon Tool)
    this.isSnapped = false;
    this.snapType = null;

    if (this.game.activeTool === "land" && this.polyPoints.length > 0) {
      const last = this.polyPoints[this.polyPoints.length - 1];
      const snapThresh = 20 / this.renderer.scale;

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
    const el = document.getElementById("poly-controls");
    if (el) {
      if (this.polyPoints.length > 0) el.classList.remove("hidden");
      else el.classList.add("hidden");
    }
  }

  cancelPoly() {
    this.polyPoints = [];
    this.updatePolyUI();
  }

  finishPoly() {
    if (this.polyPoints.length > 2) {
      this.game.createLand(this.polyPoints);
      this.polyPoints = [];
      this.updatePolyUI();
    }
  }
}
