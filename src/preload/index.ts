// SPDX-FileCopyrightText: 2026 subeomlee
// SPDX-License-Identifier: GPL-2.0-only

import { contextBridge, ipcRenderer } from "electron";
import { isRenderFrame } from "../domain/contracts";
import type { RenderFrame } from "../domain/types";

const FRAME_CHANNEL = "followmeow:frame";
const READY_CHANNEL = "followmeow:renderer-ready";

type FollowmeowBridge = Readonly<{
  ready: () => void;
  onFrame: (listener: (frame: RenderFrame) => void) => () => void;
}>;

const bridge: FollowmeowBridge = {
  ready() {
    ipcRenderer.send(READY_CHANNEL);
  },
  onFrame(listener) {
    const handler = (_event: Electron.IpcRendererEvent, value: unknown) => {
      if (isRenderFrame(value)) {
        listener(value);
      }
    };
    ipcRenderer.on(FRAME_CHANNEL, handler);
    return () => ipcRenderer.removeListener(FRAME_CHANNEL, handler);
  },
};

contextBridge.exposeInMainWorld("followmeow", bridge);
