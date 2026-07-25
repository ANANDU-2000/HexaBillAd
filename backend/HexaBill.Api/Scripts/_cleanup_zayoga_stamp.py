"""Force pure black/white on Zayoga stamp PNG and re-seed tenant 6."""
from __future__ import annotations

import base64
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import psycopg2
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PNG = ROOT / "wwwroot" / "uploads" / "zayoga" / "zayoga-stamp-signature-white.png"
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


def main() -> None:
    im = Image.open(PNG).convert("RGB")
    arr = np.asarray(im).astype(np.float32)
    bri = arr.mean(axis=2)
    bw = np.where(bri > 175, 255, 0).astype(np.uint8)
    out = np.stack([bw, bw, bw], axis=2)
    ys, xs = np.where(bw < 20)
    pad = 12
    left = max(0, int(xs.min()) - pad)
    right = min(out.shape[1], int(xs.max()) + pad)
    top = max(0, int(ys.min()) - pad)
    bottom = min(out.shape[0], int(ys.max()) + pad)
    clean = Image.fromarray(out[top:bottom, left:right])
    if max(clean.size) > 640:
        clean.thumbnail((640, 640), Image.Resampling.LANCZOS)
    clean.save(PNG, "PNG", optimize=True)
    # transparent sibling for overlays
    rgba = clean.convert("RGBA")
    px = np.array(rgba, copy=True)
    mask = px[:, :, 0] > 200
    px[mask, 3] = 0
    px[~mask, :3] = 0
    px[~mask, 3] = 255
    Image.fromarray(px).save(PNG.with_name("zayoga-stamp-signature.png"), "PNG", optimize=True)
    print("clean", clean.size, PNG.stat().st_size)

    env = load_env(ENV_PATH)
    raw = PNG.read_bytes()
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
    pairs = {
        "Feature_LetterheadOnlyPrint": "true",
        "Feature_DocumentStampSignature": "true",
        "STAMP_BASE64_DATA_URI": data_uri,
        "STAMP_PUBLIC_URL": data_uri,
        "STAMP_STORAGE_KEY": "",
        "STAMP_ORIGINAL_NAME": "zayoga-stamp-signature.png",
        "STAMP_MIME_TYPE": "image/png",
        "STAMP_FILE_SIZE_BYTES": str(len(raw)),
        "STAMP_UPLOADED_AT": datetime.now(timezone.utc).isoformat(),
        "STAMP_WIDTH_MM": "48",
        "SIGNATURE_BASE64_DATA_URI": "",
        "SIGNATURE_STORAGE_KEY": "",
        "SIGNATURE_PUBLIC_URL": "",
        "STAMP_OFFSET_RIGHT_MM": "14",
        "STAMP_OFFSET_BOTTOM_MM": "14",
        "PRINT_MARGIN_BOTTOM_MM": "48",
    }
    for key, value in pairs.items():
        cur.execute(
            """UPDATE "Settings" SET "Value" = %s, "UpdatedAt" = NOW()
               WHERE "Key" = %s AND ("OwnerId" = 6 OR "TenantId" = 6)""",
            (value, key),
        )
        if cur.rowcount == 0:
            cur.execute(
                """INSERT INTO "Settings" ("OwnerId","TenantId","Key","Value","CreatedAt","UpdatedAt")
                   VALUES (6, 6, %s, %s, NOW(), NOW())""",
                (key, value),
            )
    print("seeded", len(data_uri))
    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
