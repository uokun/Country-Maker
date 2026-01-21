export class UI {
  constructor(game) {
    this.game = game;
    this.setupListeners();
  }

  setupListeners() {
    // Tool Buttons
    const toolBtns = document.querySelectorAll(".tool-btn");
    toolBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        // Remove active class from all
        toolBtns.forEach((b) => b.classList.remove("active"));
        // Add active to current
        btn.classList.add("active");

        const tool = btn.dataset.tool;
        this.game.setTool(tool);

        // Update display text
        const display = document.getElementById("tool-display");
        if (display) {
          const title = btn.getAttribute("title");
          display.textContent = `ツール: ${title}`;
          
          this.updateSettingsPanel(tool);
        }
      });
    });

    // Action Buttons
    const btnSave = document.getElementById("btn-save");
    if (btnSave) {
      btnSave.addEventListener("click", () => {
        this.game.saveGame();
      });
    }

    const btnClear = document.getElementById("btn-clear");
    if (btnClear) {
      btnClear.addEventListener("click", () => {
        this.game.clearMap();
      });
    }
    // Panel Close Button
    const btnClosePanel = document.getElementById("btn-close-panel");
    if (btnClosePanel) {
        btnClosePanel.addEventListener("click", () => {
            const panel = document.getElementById("side-panel");
            if (panel) panel.classList.add("hidden");
        });
    }

    // Default Panel State
    this.updateSettingsPanel("cursor");
  }

  updateSettingsPanel(tool) {
    const panel = document.getElementById("side-panel");
    const content = document.getElementById("panel-content");
    
    if (!panel || !content) return;

    let html = "";
    let showPanel = true;

    if (tool === "land") {
        html = `
            <div class="panel-section">
                <div class="section-label">モード</div>
                <div class="panel-buttons" style="grid-template-columns: 1fr 1fr 1fr;">
                    <button class="panel-btn active" id="mode-poly" title="多角形">⬢ 多角形</button>
                    <button class="panel-btn" id="mode-rect" title="四角形">⬛ 四角形</button>
                    <button class="panel-btn" id="mode-circle" title="円">⚫ 円</button>
                </div>
            </div>

            <div class="panel-section" id="section-land-snap">
                <div class="section-label">スナップ設定</div>
                <div class="panel-row">
                    <label title="マップの縦横軸に合わせる">
                        <span>🌐 グローバル (縦横)</span>
                        <input type="checkbox" id="chk-snap-global" checked>
                        <div class="checkbox-visual"></div>
                    </label>
                </div>
                <div class="panel-row">
                    <label title="直前の線に対して直角・並行に合わせる">
                        <span>📐 相対 (直角・並行)</span>
                        <input type="checkbox" id="chk-snap-relative" checked>
                        <div class="checkbox-visual"></div>
                    </label>
                </div>
            </div>
            
            <div class="panel-section" id="section-land-actions" style="margin-top: 10px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 10px;">
                <div class="section-label">アクション</div>
                <div class="panel-buttons">
                    <button id="p-btn-undo" class="panel-btn" title="Backspace">
                        ↩ 戻る
                    </button>
                    <button id="p-btn-cancel" class="panel-btn danger" title="Esc">
                        ✖ 中止
                    </button>
                    <button id="p-btn-finish" class="panel-btn primary" title="Enter">
                        ✔ 完了 (接続)
                    </button>
                </div>
            </div>
        `;
    } else if (tool === "brush") {
        html = `
            <div class="panel-section">
                <div class="section-label">ブラシ設定 (WIP)</div>
                <div style="font-size: 12px; opacity: 0.7;">サイズ調整機能を追加予定</div>
            </div>
        `;
    } else if (tool === "road" || tool === "rail") {
        html = `
             <div class="panel-section">
                <div class="section-label">建設設定 (WIP)</div>
                <div style="font-size: 12px; opacity: 0.7;">幅・種類変更機能を追加予定</div>
            </div>
        `;
    } else {
        // Cursor or others
        showPanel = false;
    }

    if (showPanel) {
        content.innerHTML = html;
        panel.classList.remove("hidden");
        
        if (tool === "land") {
            // Bind Mode Buttons
            const updateModeUI = (mode) => {
                this.game.input.setLandMode(mode);
                document.querySelectorAll("#side-panel .panel-btn").forEach(b => {
                    if (b.id.startsWith("mode-")) b.classList.remove("active");
                });
                document.getElementById(`mode-${mode}`).classList.add("active");

                // Show/Hide relevant sections
                const snap = document.getElementById("section-land-snap");
                const actions = document.getElementById("section-land-actions");
                
                if (mode === "poly") {
                    if (snap) snap.style.display = "flex";
                    if (actions) actions.style.display = "flex";
                    // Restore checkboxes state if needed, or rely on them persisting in DOM?
                    // Re-creating DOM wipes state.
                    // Ideal: read from Game/Input state.
                    // For now, default checked as per HTML.
                } else {
                    if (snap) snap.style.display = "none";
                    if (actions) actions.style.display = "none"; // Rect/Circle are drag-to-create
                }
            };

            // Set initial UI state based on current logical state
            const currentMode = this.game.input.landMode || "poly";
            
            // Direct call, no timeout to ensure sync
            updateModeUI(currentMode);

            const bindModeBtn = (id, mode) => {
                const b = document.getElementById(id);
                if (b) {
                    // Clone to remove old listeners (simple way to prevent duplicate/stale listeners)
                    const newB = b.cloneNode(true);
                    b.parentNode.replaceChild(newB, b);
                    newB.addEventListener("click", (e) => {
                        e.stopPropagation(); // Prevent bubble
                        updateModeUI(mode);
                    });
                }
            };

            bindModeBtn("mode-poly", "poly");
            bindModeBtn("mode-rect", "rect");
            bindModeBtn("mode-circle", "circle");

            // Bind Actions (Only relevant for Poly)
            const btnUndo = document.getElementById("p-btn-undo");
            if (btnUndo) btnUndo.addEventListener("click", () => this.game.input.undoLastPoint());

            const btnCancel = document.getElementById("p-btn-cancel");
            if (btnCancel) btnCancel.addEventListener("click", () => this.game.input.cancelPoly());

            const btnFinish = document.getElementById("p-btn-finish");
            if (btnFinish) btnFinish.addEventListener("click", () => this.game.input.finishPoly());
        }

    } else {
        panel.classList.add("hidden");
    }
  }

  updateStatus() {
    const pop = this.game.simulation.getPopulation();
    const el = document.getElementById("pop-main");
    if (el) el.textContent = pop.toLocaleString();

    // Update Scale Bar
    const scale = this.game.renderer.scale;
    if (!scale) return;

    // 100px on screen = (100 / scale) meters in world
    // We want to find a nice 'round' world distance (e.g. 100m, 1km)
    // that creates a bar of reasonable pixel width (e.g. 50-150px).

    // let's try to find a Distance D such that D * scale is roughly 100px.
    const refPixels = 100;
    const rawMeters = refPixels / scale;

    // Snap rawMeters to 1, 2, 5 * 10^n
    const magnitude = Math.pow(10, Math.floor(Math.log10(rawMeters)));
    const residual = rawMeters / magnitude;

    let dispMeters;
    if (residual > 5) dispMeters = 5 * magnitude;
    else if (residual > 2) dispMeters = 2 * magnitude;
    else dispMeters = 1 * magnitude;

    const barWidth = dispMeters * scale;

    const barLine = document.getElementById("scale-bar-line");
    const barText = document.getElementById("scale-bar-text");

    if (barLine && barText) {
      barLine.style.width = `${barWidth}px`;

      let label = `${dispMeters}m`;
      if (dispMeters >= 1000) label = `${dispMeters / 1000}km`;

      barText.textContent = label;
    }

    // Update Scale Numeric Display
    const scaleEl = document.getElementById("scale-display");
    if (scaleEl) {
      // Show as 1:X or percentage? Let's do percentage for simplicity or 1:X relative to 1px=1m
      // If scale=1, 1px=1m. 
      const zoomPercent = Math.round(scale * 100);
      scaleEl.textContent = `縮尺: ${zoomPercent}%`;
    }
  }
}
