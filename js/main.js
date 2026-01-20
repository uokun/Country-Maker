import { Game } from "./game.js";

document.addEventListener("DOMContentLoaded", () => {
  console.log("Sandbox Game Initializing...");
  const game = new Game();
  game.start();
});
