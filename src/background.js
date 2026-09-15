import OBR from "@owlbear-rodeo/sdk";
import { ID } from "./common.js";

const BASE = import.meta.env.BASE_URL;
const url = (p) => new URL(BASE + p, window.location.origin).href;

OBR.onReady(() => {
  OBR.contextMenu.create({
    id: `${ID}/menu`,
    icons: [
      {
        icon: url("icon.svg"),
        label: "Бестіарій",
        filter: {
          every: [
            { key: "type", value: "IMAGE" },
            { key: "layer", value: "CHARACTER" },
          ],
          roles: ["GM"],
        },
      },
    ],
    embed: { url: url("menu.html"), height: 260 },
  });
});
