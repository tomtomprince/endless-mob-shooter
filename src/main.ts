import "./style.css";
import Phaser from "phaser";
import { BootScene } from "./BootScene";
import { GameScene, W, H } from "./GameScene";

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "app",
  width: W,
  height: H,
  backgroundColor: "#0a0a0a",
  pixelArt: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, GameScene],
});
