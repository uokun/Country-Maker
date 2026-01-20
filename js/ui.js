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
  }
}
