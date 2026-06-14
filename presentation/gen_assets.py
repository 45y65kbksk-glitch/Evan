"""Generate Sber-style brand assets: gradient logo mark + dark gradient backgrounds."""
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
import os

OUT = os.path.join(os.path.dirname(__file__), "assets")
os.makedirs(OUT, exist_ok=True)

# ---- Sber gradient palette (green -> lime -> yellow -> cyan) ----
GREEN  = (33, 160, 56)    # 21A038  (signature Sber green)
LIME   = (123, 193, 60)
YELLOW = (250, 209, 0)
CYAN   = (0, 191, 240)

def lerp(a, b, t):
    return tuple(a[i] + (b[i] - a[i]) * t for i in range(3))

def sber_color(t):
    stops = [(0.00, GREEN), (0.34, LIME), (0.63, YELLOW), (1.00, CYAN)]
    for i in range(len(stops) - 1):
        t0, c0 = stops[i]
        t1, c1 = stops[i + 1]
        if t <= t1:
            lt = (t - t0) / (t1 - t0) if t1 > t0 else 0.0
            return lerp(c0, c1, lt)
    return stops[-1][1]

def gradient_square(size):
    """Diagonal gradient: bottom-left (green) -> top-right (cyan)."""
    xs = np.linspace(0, 1, size)[None, :]
    ys = np.linspace(0, 1, size)[:, None]
    t = (xs + (1 - ys)) / 2.0  # 0 at bottom-left, 1 at top-right
    lut = np.array([sber_color(v / 255.0) for v in range(256)])  # 256x3
    idx = np.clip((t * 255).astype(int), 0, 255)
    img = lut[idx]  # H x W x 3
    return Image.fromarray(np.clip(img, 0, 255).astype("uint8"), "RGB")

# ---------------------------------------------------------------
# 1) Sber mark: gradient ring with a gap (top-right) + checkmark
# ---------------------------------------------------------------
def make_mark(size=1200):
    ss = size * 3  # supersample for smooth edges
    grad = gradient_square(ss).convert("RGBA")
    mask = Image.new("L", (ss, ss), 0)
    d = ImageDraw.Draw(mask)
    cx = cy = ss / 2
    r_out = ss * 0.45
    r_in = ss * 0.295
    # Ring: long arc, gap centred at top-right (~315deg in PIL clockwise-from-east).
    # Gap spans 278..352 -> draw the complementary long arc 352 .. 278+360.
    d.pieslice([cx - r_out, cy - r_out, cx + r_out, cy + r_out],
               start=352, end=278 + 360, fill=255)
    d.ellipse([cx - r_in, cy - r_in, cx + r_in, cy + r_in], fill=0)
    # Checkmark sitting in the gap, pointing up-right
    lw = int(ss * 0.085)
    p1 = (cx + 0.045 * ss, cy - 0.015 * ss)   # short-arm start
    p2 = (cx + 0.155 * ss, cy + 0.085 * ss)   # bottom vertex
    p3 = (cx + 0.435 * ss, cy - 0.275 * ss)   # long-arm tip (exits through gap)
    d.line([p1, p2, p3], fill=255, width=lw, joint="curve")
    for p in (p1, p2, p3):  # round the caps
        d.ellipse([p[0] - lw / 2, p[1] - lw / 2, p[0] + lw / 2, p[1] + lw / 2], fill=255)
    out = Image.new("RGBA", (ss, ss), (0, 0, 0, 0))
    out.paste(grad, (0, 0), mask)
    out = out.resize((size, size), Image.LANCZOS)
    out.save(os.path.join(OUT, "sber_mark.png"))
    print("wrote sber_mark.png")

# ---------------------------------------------------------------
# 2) Dark gradient background (title / closing slides)
# ---------------------------------------------------------------
def make_bg_dark(W=2667, H=1500):
    xs = np.linspace(0, 1, W)[None, :]
    ys = np.linspace(0, 1, H)[:, None]
    t = (xs * 0.45 + ys * 0.55)
    c0 = np.array([6, 17, 11])     # 06110B  near-black green (top-left)
    c1 = np.array([10, 41, 23])    # 0A2917  deep green (bottom-right)
    base = c0[None, None, :] + (c1 - c0)[None, None, :] * t[..., None]
    X, Y = np.meshgrid(np.arange(W), np.arange(H))
    # warm Sber-green glow, lower-right
    gx, gy, gr = 0.82 * W, 0.70 * H, 0.62 * H
    g = np.clip(1 - np.sqrt((X - gx) ** 2 + (Y - gy) ** 2) / gr, 0, 1) ** 2
    base = base + (np.array([33, 160, 56]) - base) * (g[..., None] * 0.30)
    # faint cyan glow, upper-left for brand richness
    gx2, gy2, gr2 = 0.12 * W, 0.10 * H, 0.42 * H
    g2 = np.clip(1 - np.sqrt((X - gx2) ** 2 + (Y - gy2) ** 2) / gr2, 0, 1) ** 2
    base = base + (np.array([0, 150, 190]) - base) * (g2[..., None] * 0.10)
    Image.fromarray(np.clip(base, 0, 255).astype("uint8"), "RGB").save(
        os.path.join(OUT, "bg_dark.png"))
    print("wrote bg_dark.png")

# ---------------------------------------------------------------
# 3) Faint watermark mark for content slides (very low opacity)
# ---------------------------------------------------------------
def make_watermark(size=1200, opacity=0.05):
    mark = Image.open(os.path.join(OUT, "sber_mark.png")).convert("RGBA")
    r, g, b, a = mark.split()
    a = a.point(lambda v: int(v * opacity))
    mark.putalpha(a)
    mark.save(os.path.join(OUT, "sber_mark_faint.png"))
    print("wrote sber_mark_faint.png")

if __name__ == "__main__":
    make_mark()
    make_bg_dark()
    make_watermark()
    print("done")
