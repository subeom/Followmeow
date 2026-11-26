import {
  BrowserWindow,
  Menu,
  Tray,
  app,
  ipcMain,
  nativeImage,
  screen,
  shell,
  systemPreferences,
} from "electron";
import type {
  MenuItemConstructorOptions,
  WebContents,
} from "electron";
import { join } from "node:path";
import { CursorSampler } from "./cursor-sampler";
import { FollowController } from "./follow-controller";
import {
  LanguageProvider,
  runProcess,
} from "./language-provider";
import { AppLifecycle } from "./lifecycle";
import { OverlayWindow } from "./overlay-window";
import { SettingsStore } from "./settings-store";
import { buildTrayMenuModel, type TrayMenuEntry } from "./tray";
import type { AppSettings, DisplaySnapshot } from "../domain/types";

const INSTANCE_LOCK = app.requestSingleInstanceLock();
if (!INSTANCE_LOCK) {
  app.quit();
}

let lifecycle: AppLifecycle | null = null;

function snapshots(): readonly DisplaySnapshot[] {
  return screen.getAllDisplays().map((display) => ({
    id: display.id,
    bounds: {
      x: display.bounds.x,
      y: display.bounds.y,
      width: display.bounds.width,
      height: display.bounds.height,
    },
  }));
}

function menuTemplate(entries: readonly TrayMenuEntry[]): MenuItemConstructorOptions[] {
  return entries.map((entry) => {
    if (entry.type === "separator") {
      return { type: "separator" };
    }
    const template: MenuItemConstructorOptions = {
      label: entry.label,
      type:
        entry.type === "submenu"
          ? "submenu"
          : entry.type === "checkbox" || entry.type === "radio"
            ? entry.type
            : "normal",
    };
    if (entry.enabled !== undefined) {
      template.enabled = entry.enabled;
    }
    if (entry.checked !== undefined) {
      template.checked = entry.checked;
    }
    if (entry.items) {
      template.submenu = menuTemplate(entry.items);
    }
    const action = entry.action;
    if (action) {
      template.click = () => {
        if (lifecycle) {
          void lifecycle.handleAction(action);
        }
      };
    }
    return template;
  });
}

async function bootstrap(): Promise<void> {
  if (process.platform === "darwin") {
    app.dock?.hide();
  }
  if (process.platform === "win32") {
    app.setAppUserModelId("com.subeom.Followmeow");
  }

  const platform =
    process.platform === "win32" ? ("win32" as const) : ("darwin" as const);
  const store = new SettingsStore(
    join(app.getPath("userData"), "settings.json"),
    platform,
  );
  const settingsWarnings = await store.load();
  let shouldRenderRichAnimation = false;
  try {
    shouldRenderRichAnimation =
      systemPreferences.getAnimationSettings().shouldRenderRichAnimation;
  } catch {
    shouldRenderRichAnimation = false;
  }
  const systemReducedMotion = !shouldRenderRichAnimation;
  const controller = new FollowController(
    store.value,
    store.value.motionPolicy === "reduced" || systemReducedMotion,
    (frame) => overlay.apply(frame),
  );

  let overlay: OverlayWindow;
  const normalTrayImage = nativeImage
    .createFromPath(join(__dirname, "assets", "tray.png"))
    .resize({ width: 18, height: 18 });
  const disabledTrayImage = nativeImage
    .createFromPath(join(__dirname, "assets", "tray-disabled.png"))
    .resize({ width: 18, height: 18 });
  if (normalTrayImage.isEmpty() || disabledTrayImage.isEmpty()) {
    throw new Error("tray-icon-unavailable");
  }
  const nativeTray = new Tray(normalTrayImage);
  const trayPort = {
    update(settings: AppSettings) {
      nativeTray.setContextMenu(
        Menu.buildFromTemplate(
          menuTemplate(buildTrayMenuModel(app.getVersion(), settings)),
        ),
      );
      nativeTray.setImage(settings.enabled ? normalTrayImage : disabledTrayImage);
      nativeTray.setToolTip("Followmeow");
    },
    showError(reason: string) {
      nativeTray.setToolTip(`Followmeow: ${reason}`);
      console.error(`[followmeow] ${reason}`);
    },
    destroy() {
      nativeTray.destroy();
    },
  };

  const sampler = new CursorSampler(
    {
      cursor: () => screen.getCursorScreenPoint(),
      displays: snapshots,
      now: () => performance.now(),
    },
    (sample) => controller.tick(sample, performance.now()),
    (reason) => controller.invalidate(reason, performance.now()),
  );
  const windowsLanguageScript = app.isPackaged
    ? join(process.resourcesPath, "resources", "win-input-language.ps1")
    : join(app.getAppPath(), "resources", "win-input-language.ps1");
  const languageProvider = new LanguageProvider(
    platform,
    runProcess,
    (observation) => controller.setAutomaticLanguage(observation),
    () => trayPort.showError("language-provider-failed"),
    windowsLanguageScript,
  );

  overlay = new OverlayWindow(
    (options) => {
      return new BrowserWindow(options);
    },
    join(__dirname, "../renderer/index.html"),
    () => {
      if (lifecycle) {
        void lifecycle.rendererReady();
      }
    },
  );
  lifecycle = new AppLifecycle({
    store,
    controller,
    sampler,
    overlay,
    tray: trayPort,
    languageProvider,
    systemReducedMotion,
    setLoginItem(enabled) {
      app.setLoginItemSettings({ openAtLogin: enabled });
    },
    now: () => performance.now(),
    openAbout() {
      void shell.openPath(join(process.resourcesPath, "THIRD_PARTY_NOTICES.md"));
    },
    quitApp() {
      app.quit();
    },
  });
  lifecycle.initialize();

  ipcMain.on("followmeow:renderer-ready", (event) => {
    if (overlay.ownsWebContents(event.sender as WebContents)) {
      overlay.ready();
    }
  });
  screen.on("display-added", () => sampler.noteDisplayChange());
  screen.on("display-removed", () => sampler.noteDisplayChange());
  screen.on("display-metrics-changed", () => sampler.noteDisplayChange());
  for (const warning of settingsWarnings) {
    trayPort.showError(`settings-${warning}`);
  }

  await overlay.whenLoaded();
}

app.on("before-quit", () => {
  lifecycle?.quit();
});

if (INSTANCE_LOCK) {
  void app.whenReady().then(bootstrap).catch(() => {
    console.error("[followmeow] bootstrap-failed");
    app.exit(1);
  });
}
