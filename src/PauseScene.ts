import Phaser from "phaser";
import { W, H } from "./GameScene";

/** Overlay launched while the game scene is paused; Escape or a tap resumes. */
export class PauseScene extends Phaser.Scene {
  constructor() {
    super("pause");
  }

  create() {
    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.65);
    this.add
      .text(W / 2, H / 2 - 40, "PAUSED", {
        fontFamily: "monospace",
        fontSize: "56px",
        fontStyle: "bold",
        color: "#ffffff",
        stroke: "#000000",
        strokeThickness: 8,
      })
      .setOrigin(0.5);
    this.add
      .text(W / 2, H / 2 + 30, "ESC or tap to resume", {
        fontFamily: "monospace",
        fontSize: "20px",
        color: "#aaaaaa",
      })
      .setOrigin(0.5);
    const resume = () => {
      this.scene.stop();
      this.scene.resume("game");
    };
    this.input.keyboard?.on("keydown-ESC", resume);
    this.input.on("pointerdown", resume);
  }
}
