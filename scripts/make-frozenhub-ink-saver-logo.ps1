# Builds the ink-saving FROZEN HUB logo: same size and layout as the client logo, with the heavy
# "FROZEN HUB" strokes thinned. The FH emblem and the FOODSTUFFS line are left untouched.
# Usage: powershell -NoProfile -File scripts\make-frozenhub-ink-saver-logo.ps1 [-Radius 10]
param(
  [int]$Radius = 10,
  [int]$BandTop = 475,
  [int]$BandBottom = 680,
  [int]$OutWidth = 900
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$seed = Join-Path $PSScriptRoot '..\backend\HexaBill.Api\SeedLogos'
$srcPath = Join-Path $seed 'frozenhub-logo-client-original.png'
$clientPath = Join-Path $seed 'frozenhub-logo-client.png'
if (-not (Test-Path $srcPath)) { Copy-Item $clientPath $srcPath }   # keep the untouched original once

Add-Type -TypeDefinition @"
using System;
public static class Thin {
  public static void Erode(byte[] g, int w, int h, int y0, int y1, int r) {
    var tmp = new byte[g.Length];
    Array.Copy(g, tmp, g.Length);
    // horizontal min (dark = low value; erosion of the dark shape = max of gray)
    for (int y = y0; y < y1; y++)
      for (int x = 0; x < w; x++) {
        byte m = 0;
        for (int k = -r; k <= r; k++) { int xx = x + k; byte v = (xx < 0 || xx >= w) ? (byte)255 : g[y * w + xx]; if (v > m) m = v; }
        tmp[y * w + x] = m;
      }
    for (int y = y0; y < y1; y++)
      for (int x = 0; x < w; x++) {
        byte m = 0;
        for (int k = -r; k <= r; k++) { int yy = y + k; byte v = (yy < y0 || yy >= y1) ? (byte)255 : tmp[yy * w + x]; if (v > m) m = v; }
        g[y * w + x] = m;
      }
  }
}
"@

$src = [System.Drawing.Bitmap]::FromFile($srcPath)
$w = $src.Width; $h = $src.Height
$gray = New-Object 'byte[]' ($w * $h)
for ($y = 0; $y -lt $h; $y++) { for ($x = 0; $x -lt $w; $x++) {
  $c = $src.GetPixel($x, $y); $lum = ($c.R * 30 + $c.G * 59 + $c.B * 11) / 100; $gray[$y * $w + $x] = [byte](($lum * $c.A + 255 * (255 - $c.A)) / 255) } }
$src.Dispose()
$bottom = [Math]::Min($BandBottom, $h)
[Thin]::Erode($gray, $w, $h, $BandTop, $bottom, $Radius)

$bmp = New-Object System.Drawing.Bitmap($w, $h, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
for ($y = 0; $y -lt $h; $y++) { for ($x = 0; $x -lt $w; $x++) {
  $v = $gray[$y * $w + $x]; $bmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($v, $v, $v)) } }

# Smooth edges and keep print resolution: resize with high quality.
$outH = [int][Math]::Round($h * $OutWidth / $w)
$out = New-Object System.Drawing.Bitmap($OutWidth, $outH, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
$g = [System.Drawing.Graphics]::FromImage($out)
$g.Clear([System.Drawing.Color]::White)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.DrawImage($bmp, 0, 0, $OutWidth, $outH)
$g.Dispose(); $bmp.Dispose()

foreach ($name in 'frozenhub-logo-bw.png', 'frozenhub-logo-client.png') {
  $out.Save((Join-Path $seed $name), [System.Drawing.Imaging.ImageFormat]::Png)
}
$out.Dispose()
$bytes = [System.IO.File]::ReadAllBytes((Join-Path $seed 'frozenhub-logo-bw.png'))
$uri = 'data:image/png;base64,' + [Convert]::ToBase64String($bytes)
[System.IO.File]::WriteAllText((Join-Path $seed 'frozenhub-logo.datauri.txt'), $uri)
Write-Output ("Done: {0}x{1}, datauri {2} chars" -f $OutWidth, $outH, $uri.Length)
