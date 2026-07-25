"""Remove stamp noise speckles, tight-crop, re-seed tenant 6. No scipy."""
from __future__ import annotations

import base64
from collections import deque
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import psycopg2
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
WHITE = ROOT / "wwwroot" / "uploads" / "zayoga" / "zayoga-stamp-signature-white.png"
TRANS = ROOT / "wwwroot" / "uploads" / "zayoga" / "zayoga-stamp-signature.png"
ENV_PATH = ROOT / ".env"


def load_env(path: Path) -> dict[str, str]:
    env: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def keep_large_components(ink: np.ndarray, min_size: int = 80) -> np.ndarray:
    h, w = ink.shape
    visited = np.zeros_like(ink, dtype=bool)
    keep = np.zeros_like(ink, dtype=bool)
    for y in range(h):
        for x in range(w):
            if not ink[y, x] or visited[y, x]:
                continue
            q = deque([(y, x)])
            visited[y, x] = True
            cells: list[tuple[int, int]] = []
            while q:
                cy, cx = q.popleft()
                cells.append((cy, cx))
                for ny, nx in ((cy - 1, cx), (cy + 1, cx), (cy, cx - 1), (cy, cx + 1)):
                    if 0 <= ny < h and 0 <= nx < w and ink[ny, nx] and not visited[ny, nx]:
                        visited[ny, nx] = True
                        q.append((ny, nx))
            if len(cells) >= min_size:
                for cy, cx in cells:
                    keep[cy, cx] = True
    return keep


def main() -> None:
    im = Image.open(WHITE).convert("L").filter(ImageFilter.MedianFilter(size=3))
    arr = np.array(im)
    ink = arr < 128
    ink = keep_large_components(ink, min_size=60)
    out = np.where(ink, 0, 255).astype(np.uint8)
    ys, xs = np.where(out < 40)
    if len(xs) == 0:
        raise SystemExit("no ink after denoise")
    pad = 8
    left, right = max(0, int(xs.min()) - pad), min(out.shape[1], int(xs.max()) + pad)
    top, bottom = max(0, int(ys.min()) - pad), min(out.shape[0], int(ys.max()) + pad)
    cropped = Image.fromarray(out[top:bottom, left:right]).convert("RGB")
    if max(cropped.size) > 560:
        cropped.thumbnail((560, 560), Image.Resampling.LANCZOS)
    cropped.save(WHITE, "PNG", optimize=True)

    rgba = np.array(cropped.convert("RGBA"), copy=True)
    white = rgba[:, :, 0] > 200
    rgba[white, 3] = 0
    rgba[~white, :3] = 0
    rgba[~white, 3] = 255
    Image.fromarray(rgba).save(TRANS, "PNG", optimize=True)
    print("final", cropped.size, "bytes", WHITE.stat().st_size)

    env = load_env(ENV_PATH)
    raw = WHITE.read_bytes()
    data_uri = "data:image/png;base64," + base64.b64encode(raw).decode("ascii")
    conn = psycopg2.connect(
        host=env.get("DB_HOST_EXTERNAL") or env.get("DB_HOST"),
        port=int(env.get("DB_PORT_EXTERNAL") or env.get("DB_PORT") or "5432"),
        dbname=env.get("DB_NAME") or "hexabill",
        user=env["DB_USER"],
        password=env["DB_PASSWORD"],
        sslmode="require",
    )
    conn.autocommit = True
    cur = conn.cursor()
    for key, value in {
        "STAMP_BASE64_DATA_URI": data_uri,
        "STAMP_PUBLIC_URL": data_uri,
        "STAMP_STORAGE_KEY": "",
        "STAMP_FILE_SIZE_BYTES": str(len(raw)),
        "STAMP_UPLOADED_AT": datetime.now(timezone.utc).isoformat(),
        "Feature_DocumentStampSignature": "true",
        "Feature_LetterheadOnlyPrint": "true",
    }.items():
        cur.execute(
            """UPDATE "Settings" SET "Value"=%s, "UpdatedAt"=NOW()
               WHERE "Key"=%s AND ("OwnerId"=6 OR "TenantId"=6)""",
            (value, key),
        )
        if cur.rowcount == 0:
            cur.execute(
                """INSERT INTO "Settings" ("OwnerId","TenantId","Key","Value","CreatedAt","UpdatedAt")
                   VALUES (6,6,%s,%s,NOW(),NOW())""",
                (key, value),
            )
    print("reseeded", len(data_uri))
    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
