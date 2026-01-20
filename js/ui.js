export class UI {
    constructor(game) {
        this.game = game;
        this.setupListeners();
    }

    setupListeners() {
        // Tool Buttons
        const toolBtns = document.querySelectorAll('.tool-btn');
        toolBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                // Remove active class from all
                toolBtns.forEach(b => b.classList.remove('active'));
                // Add active to current
                btn.classList.add('active');
                
                const tool = btn.dataset.tool;
                this.game.setTool(tool);
                
                // Update display text
                const display = document.getElementById('tool-display');
                if(display) {
                    const title = btn.getAttribute('title');
                    display.textContent = `ツール: ${title}`;
                }
            });
        });
        
        // Action Buttons
        const btnSave = document.getElementById('btn-save');
        if(btnSave) {
            btnSave.addEventListener('click', () => {
                this.game.saveGame();
            });
        }
        
        const btnClear = document.getElementById('btn-clear');
        if(btnClear) {
            btnClear.addEventListener('click', () => {
                this.game.clearMap();
            });
        }
    }
    updateStatus() {
        const pop = this.game.simulation.getPopulation();
        const el = document.getElementById('pop-main');
        if (el) el.textContent = pop.toLocaleString();
    }
}
