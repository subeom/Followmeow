// SPDX-FileCopyrightText: 2026 subeomlee
// SPDX-License-Identifier: GPL-2.0-only

import {
  DISPLAY_MARGIN_DIP,
  OVERLAY_SIZE,
  type DisplaySnapshot,
  type Point,
} from "./types";

export const FOLLOWER_GAP_DIP = 34;

function isFinitePoint(point: Point): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y);
}

export function findContainingDisplay(
  displays: readonly DisplaySnapshot[],
  point: Point,
): DisplaySnapshot | null {
  if (!isFinitePoint(point)) {
    return null;
  }

  return (
    displays.find(({ bounds }) => {
      return (
        point.x >= bounds.x &&
        point.y >= bounds.y &&
        point.x <= bounds.x + bounds.width &&
        point.y <= bounds.y + bounds.height
      );
    }) ?? null
  );
}

export function desiredOverlayOrigin(cursor: Point, heading: Point): Point {
  if (!isFinitePoint(cursor) || !isFinitePoint(heading)) {
    throw new RangeError("cursor and heading must be finite");
  }
  const length = Math.hypot(heading.x, heading.y);
  const unit =
    Number.isFinite(length) && length > 0.0001
      ? { x: heading.x / length, y: heading.y / length }
      : { x: 1, y: 0 };
  const centerDistance = FOLLOWER_GAP_DIP + OVERLAY_SIZE.width / 2;

  return {
    x: cursor.x - unit.x * centerDistance - OVERLAY_SIZE.width / 2,
    y: cursor.y - unit.y * centerDistance - OVERLAY_SIZE.height / 2,
  };
}

export function clampOverlayOrigin(
  origin: Point,
  display: DisplaySnapshot,
): Point | null {
  if (!isFinitePoint(origin)) {
    return null;
  }

  const { bounds } = display;
  const minimumX = bounds.x + DISPLAY_MARGIN_DIP;
  const maximumX =
    bounds.x + bounds.width - DISPLAY_MARGIN_DIP - OVERLAY_SIZE.width;
  const minimumY = bounds.y + DISPLAY_MARGIN_DIP;
  const maximumY =
    bounds.y + bounds.height - DISPLAY_MARGIN_DIP - OVERLAY_SIZE.height;

  if (
    ![minimumX, maximumX, minimumY, maximumY].every(Number.isFinite) ||
    minimumX > maximumX ||
    minimumY > maximumY
  ) {
    return null;
  }

  return {
    x: Math.min(Math.max(origin.x, minimumX), maximumX),
    y: Math.min(Math.max(origin.y, minimumY), maximumY),
  };
}

function clearOfCursor(
  origin: Point,
  cursor: Point,
  gap: number,
): boolean {
  return (
    origin.x >= cursor.x + gap ||
    origin.x + OVERLAY_SIZE.width <= cursor.x - gap
  );
}

export function clampOverlayOriginClearOfCursor(
  origin: Point,
  cursor: Point,
  display: DisplaySnapshot,
): Point | null {
  if (!isFinitePoint(origin) || !isFinitePoint(cursor)) {
    return null;
  }

  const request = clampOverlayOrigin(origin, display);
  if (request === null) {
    return null;
  }
  if (clearOfCursor(request, cursor, FOLLOWER_GAP_DIP)) {
    return request;
  }

  for (const gap of [FOLLOWER_GAP_DIP, 0]) {
    const candidates = [
      clampOverlayOrigin(
        {
          x: cursor.x - gap - OVERLAY_SIZE.width,
          y: request.y,
        },
        display,
      ),
      clampOverlayOrigin(
        {
          x: cursor.x + gap,
          y: request.y,
        },
        display,
      ),
    ]
      .filter((candidate): candidate is Point => candidate !== null)
      .filter((candidate) => clearOfCursor(candidate, cursor, gap))
      .sort(
        (left, right) =>
          Math.abs(left.x - origin.x) - Math.abs(right.x - origin.x),
      );
    if (candidates[0] !== undefined) {
      return candidates[0];
    }
  }
  return null;
}
