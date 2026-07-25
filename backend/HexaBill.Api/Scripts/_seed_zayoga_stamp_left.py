"""Process Zayoga stamp+sign photo → blue ink on white/transparent PNG, seed left-side placement for tenant 6."""
from __future__ import annotations

import base64
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import psycopg2
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
SRC = Path(
    r"C:\Users\anand\.cursor\projects\c-Users-anand-OneDrive-Desktop-My-StartUps-Projects-HexaBilngApp"
    r"\assets\c__Users_anand_AppData_Roaming_Cursor_User_workspaceStorage_"
    r"2b5b3130cccd29cc2d86dd1d9f39f33d_images_image-bacbe865-7577-40b5-84cb-6469db2cc9f5.png"
)
OUT_DIR = ROOT / "wwwroot" / "uploads" / "zayoga"
WHITE = OUT_DIR / "zayoga-stamp-signature-white.png"
TRANS = OUT_DIR / "zayoga-stamp-signature.png"
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
    from collections import deque

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


def process() -> Path:
    if not SRC.exists():
        raise SystemExit(f"missing {SRC}")
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    im = Image.open(SRC).convert("RGBA")
    w, h = im.size
    # Drop Galaxy watermark band
    im = im.crop((int(w * 0.02), int(h * 0.02), int(w * 0.98), int(h * 0.90)))
    arr = np.asarray(im).astype(np.float32)
    r, g, b, a = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2], arr[:, :, 3]
    brightness = (r + g + b) / 3.0
    chroma = np.maximum(np.maximum(r, g), b) - np.minimum(np.minimum(r, g), b)
    blue_ink = (b > r + 10) & (b > g + 6) & (b > 60) & (brightness < 230) & (chroma > 14)
    dark_ink = (brightness < 100) & (chroma > 6)
    ink = blue_ink | dark_ink
    ink = Image.fromarray((ink.astype(np.uint8) * 255), "L").filter(ImageFilter.MedianFilter(3))
    ink = np.asarray(ink) > 128
    ink = keep_large_components(ink, min_size=50)

    out = np.zeros_like(arr, dtype=np.uint8)
    # Keep original blue ink colors where ink; transparent elsewhere
    out[ink, 0] = np.clip(r[ink] * 0.35, 0, 80).astype(np.uint8)  # deepen toward stamp blue
    out[ink, 1] = np.clip(g[ink] * 0.45, 0, 100).astype(np.uint8)
    out[ink, 2] = np.clip(np.maximum(b[ink], 140), 120, 220).astype(np.uint8)
    out[ink, 3] = 255

    # Prefer stronger blue from source where clearly blue
    strong = ink & (b > r + 20) & (b > g + 15)
    out[strong, 0] = np.clip(r[strong] * 0.5, 20, 90).astype(np.uint8)
    out[strong, 1] = np.clip(g[strong] * 0.55, 40, 120).astype(np.uint8)
    out[strong, 2] = np.clip(b[strong], 130, 230).astype(np.uint8)

    rgba = Image.fromarray(out, "RGBA")
    ys, xs = np.where(ink)
    pad = 14
    left, right = max(0, int(xs.min()) - pad), min(rgba.width, int(xs.max()) + pad)
    top, bottom = max(0, int(ys.min()) - pad), min(rgba.height, int(ys.max()) + pad)
    rgba = rgba.crop((left, top, right, bottom))
    if max(rgba.size) > 700:
        rgba.thumbnail((700, 700), Image.Resampling.LANCZOS)

    white_bg = Image.new("RGBA", rgba.size, (255, 255, 255, 255))
    composed = Image.alpha_composite(white_bg, rgba)
    composed.save(WHITE, "PNG", optimize=True)
    rgba.save(TRANS, "PNG", optimize=True)
    print("saved", WHITE, composed.size, WHITE.stat().st_size)
    return WHITE


def upsert(cur, key: str, value: str) -> None:
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


def seed(png: Path) -> None:
    env = load_env(ENV_PATH)
    raw = png.read_bytes()
    data_uri = "data:image/png;base64," + base64.b64encode(raw).decode("ascii")
    print("data_uri len", len(data_uri))
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
    # Left side like First Party on agreement photo; ~50mm stamp diameter
    for key, value in {
        "Feature_LetterheadOnlyPrint": "true",
        "Feature_DocumentStampSignature": "true",
        "STAMP_ALIGN": "left",
        "STAMP_BASE64_DATA_URI": data_uri,
        "STAMP_PUBLIC_URL": data_uri,
        "STAMP_STORAGE_KEY": "",
        "STAMP_ORIGINAL_NAME": "zayoga-stamp-signature.png",
        "STAMP_MIME_TYPE": "image/png",
        "STAMP_FILE_SIZE_BYTES": str(len(raw)),
        "STAMP_UPLOADED_AT": datetime.now(timezone.utc).isoformat(),
        "STAMP_WIDTH_MM": "50",
        "SIGNATURE_WIDTH_MM": "42",
        "SIGNATURE_BASE64_DATA_URI": "",
        "SIGNATURE_STORAGE_KEY": "",
        "SIGNATURE_PUBLIC_URL": "",
        "STAMP_OFFSET_RIGHT_MM": "22",  # inset from LEFT when STAMP_ALIGN=left
        "STAMP_OFFSET_BOTTOM_MM": "28",
        "SIGNATURE_OFFSET_RIGHT_MM": "22",
        "SIGNATURE_OFFSET_BOTTOM_MM": "22",
        "PRINT_MARGIN_BOTTOM_MM": "55",
        "PRINT_MARGIN_TOP_MM": "52",
    }.items():
        upsert(cur, key, value)
    print("seeded left-align stamp for tenant 6")
    cur.close()
    conn.close()


if __name__ == "__main__":
    seed(process())
