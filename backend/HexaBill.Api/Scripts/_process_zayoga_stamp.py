"""Crop Zayoga stamp+sign photo → clear B&W transparent PNG, seed tenant 6 Settings."""
from __future__ import annotations

import base64
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image, ImageFilter
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
SRC = Path(
    r"C:\Users\anand\.cursor\projects\c-Users-anand-OneDrive-Desktop-My-StartUps-Projects-HexaBilngApp"
    r"\assets\c__Users_anand_AppData_Roaming_Cursor_User_workspaceStorage_"
    r"2b5b3130cccd29cc2d86dd1d9f39f33d_images_image-b6f8132c-101c-4137-bd65-cb565e57789c.png"
)
OUT_DIR = ROOT / "wwwroot" / "uploads" / "zayoga"
OUT_PNG = OUT_DIR / "zayoga-stamp-signature.png"
ENV_PATH = ROOT / ".env"


def load_env(path: Path) -> dict[str, str]:
    env: dict[str, str] = {}
    if not path.exists():
        return env
    for line in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def process_image() -> Path:
    if not SRC.exists():
        raise SystemExit(f"Source image missing: {SRC}")
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    im = Image.open(SRC).convert("RGBA")
    w, h = im.size
    # Drop Galaxy watermark band and slight edges
    im = im.crop((int(w * 0.03), int(h * 0.03), int(w * 0.97), int(h * 0.88)))
    arr = np.asarray(im).astype(np.float32)
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    brightness = (r + g + b) / 3.0
    chroma = np.maximum(np.maximum(r, g), b) - np.minimum(np.minimum(r, g), b)

    # Soft ink strength: preserve thin ring lettering (not a solid black bar)
    blue_excess = np.clip((b - np.maximum(r, g)) / 55.0, 0.0, 1.5)
    darkness = np.clip((215.0 - brightness) / 215.0, 0.0, 1.0)
    strength = np.clip(darkness * 0.55 + blue_excess * 0.85, 0.0, 1.0)
    # Paper / low-chroma highlights → no ink
    paper = (brightness > 205) | ((chroma < 12) & (brightness > 175))
    strength = np.where(paper, 0.0, strength)
    strength = np.where(strength < 0.12, 0.0, strength)

    # Mild blur then re-threshold to smooth jagged edges without filling gaps
    strength_img = Image.fromarray((strength * 255).astype(np.uint8), mode="L")
    strength_img = strength_img.filter(ImageFilter.MedianFilter(size=3))
    strength = np.asarray(strength_img).astype(np.float32) / 255.0
    strength = np.where(strength < 0.14, 0.0, np.clip(strength * 1.15, 0.0, 1.0))

    alpha = (np.clip(strength, 0.0, 1.0) * 255.0).astype(np.uint8)
    # Pure black ink with variable alpha (anti-aliased look)
    out = np.zeros((arr.shape[0], arr.shape[1], 4), dtype=np.uint8)
    out[:, :, 0] = 0
    out[:, :, 1] = 0
    out[:, :, 2] = 0
    out[:, :, 3] = alpha
    out_im = Image.fromarray(out, "RGBA")

    ys, xs = np.where(alpha > 20)
    if len(xs) == 0:
        raise SystemExit("No ink detected — adjust thresholds")
    pad = 16
    left = max(0, int(xs.min()) - pad)
    right = min(out_im.width, int(xs.max()) + pad)
    top = max(0, int(ys.min()) - pad)
    bottom = min(out_im.height, int(ys.max()) + pad)
    out_im = out_im.crop((left, top, right, bottom))

    white_bg = Image.new("RGBA", out_im.size, (255, 255, 255, 255))
    composed = Image.alpha_composite(white_bg, out_im)

    max_side = 720
    if max(composed.size) > max_side:
        composed.thumbnail((max_side, max_side), Image.Resampling.LANCZOS)
        out_im.thumbnail((max_side, max_side), Image.Resampling.LANCZOS)

    out_im.save(OUT_PNG, "PNG", optimize=True)
    white_path = OUT_DIR / "zayoga-stamp-signature-white.png"
    composed.save(white_path, "PNG", optimize=True)
    print(f"Saved {OUT_PNG} size={out_im.size} bytes={OUT_PNG.stat().st_size}")
    print(f"Saved {white_path} size={composed.size} bytes={white_path.stat().st_size}")
    return white_path


def upsert_setting(cur, key: str, value: str) -> None:
    cur.execute(
        """
        UPDATE "Settings"
        SET "Value" = %s, "UpdatedAt" = NOW()
        WHERE "Key" = %s AND ("OwnerId" = 6 OR "TenantId" = 6)
        """,
        (value, key),
    )
    if cur.rowcount == 0:
        cur.execute(
            """
            INSERT INTO "Settings" ("OwnerId", "TenantId", "Key", "Value", "CreatedAt", "UpdatedAt")
            VALUES (6, 6, %s, %s, NOW(), NOW())
            """,
            (key, value),
        )


def seed_tenant6(png_path: Path) -> None:
    try:
        import psycopg2
    except ImportError:
        os.system(f'"{sys.executable}" -m pip install psycopg2-binary -q')
        import psycopg2

    env = load_env(ENV_PATH)
    host = env.get("DB_HOST_EXTERNAL") or env.get("DB_HOST")
    db = env.get("DB_NAME") or "hexabill"
    user = env.get("DB_USER")
    password = env.get("DB_PASSWORD")
    port = int(env.get("DB_PORT_EXTERNAL") or env.get("DB_PORT") or "5432")
    if not (host and user and password):
        raise SystemExit("Missing DB_* in backend/HexaBill.Api/.env")

    raw = png_path.read_bytes()
    data_uri = "data:image/png;base64," + base64.b64encode(raw).decode("ascii")
    print(f"data_uri length={len(data_uri)}")
    if len(data_uri) > 900_000:
        raise SystemExit(f"Base64 too large ({len(data_uri)} chars)")

    storage_key = ""  # force base64 path on Render (no local stamp file on disk)
    # data URI so Settings preview works without disk file on Render
    public_url = data_uri

    conn = psycopg2.connect(
        host=host,
        port=port,
        dbname=db,
        user=user,
        password=password,
        sslmode="require",
    )
    conn.autocommit = True
    cur = conn.cursor()

    pairs = {
        "Feature_LetterheadOnlyPrint": "true",
        "Feature_DocumentStampSignature": "true",
        "STAMP_BASE64_DATA_URI": data_uri,
        "STAMP_STORAGE_KEY": storage_key,
        "STAMP_PUBLIC_URL": public_url,
        "STAMP_ORIGINAL_NAME": "zayoga-stamp-signature.png",
        "STAMP_MIME_TYPE": "image/png",
        "STAMP_FILE_SIZE_BYTES": str(len(raw)),
        "STAMP_UPLOADED_AT": datetime.now(timezone.utc).isoformat(),
        "STAMP_WIDTH_MM": "48",
        "SIGNATURE_WIDTH_MM": "42",
        # Composite image includes signature — clear separate signature so it is not drawn twice
        "SIGNATURE_BASE64_DATA_URI": "",
        "SIGNATURE_STORAGE_KEY": "",
        "SIGNATURE_PUBLIC_URL": "",
        "STAMP_OFFSET_RIGHT_MM": "14",
        "STAMP_OFFSET_BOTTOM_MM": "14",
        "SIGNATURE_OFFSET_RIGHT_MM": "12",
        "SIGNATURE_OFFSET_BOTTOM_MM": "14",
        "PRINT_MARGIN_TOP_MM": "52",
        "PRINT_MARGIN_BOTTOM_MM": "48",
    }

    for key, value in pairs.items():
        upsert_setting(cur, key, value)

    cur.execute(
        """
        SELECT "Key",
               CASE WHEN "Key" LIKE '%%BASE64%%' OR ("Key" LIKE '%%PUBLIC_URL%%' AND LENGTH(COALESCE("Value",'')) > 80)
                    THEN LEFT(COALESCE("Value",''), 28) || '... len=' || LENGTH(COALESCE("Value",''))::text
                    ELSE LEFT(COALESCE("Value",''), 80)
               END
        FROM "Settings"
        WHERE ("OwnerId" = 6 OR "TenantId" = 6)
          AND ("Key" LIKE 'STAMP_%%' OR "Key" LIKE 'SIGNATURE_%%'
               OR "Key" IN ('Feature_LetterheadOnlyPrint','Feature_DocumentStampSignature'))
        ORDER BY "Key"
        """
    )
    print("Tenant 6 settings:")
    for k, v in cur.fetchall():
        print(f"  {k} = {v}")
    cur.close()
    conn.close()
    print("Seeded Zayoga stamp for tenant 6.")


if __name__ == "__main__":
    path = process_image()
    seed_tenant6(path)
