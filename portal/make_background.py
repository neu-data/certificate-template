"""Draw the certificate background (wave artwork, frame, logo, title bar).

    python portal/make_background.py

Writes portal/certificate-background.png (A4 landscape, 300 dpi). All text, the
participant name, the ID and the QR code are added on top of this image by the
portal (Apps Script), so the background never contains personal data.
"""
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from matplotlib.colors import LinearSegmentedColormap
from PIL import Image

HERE = Path(__file__).parent
LOGO = HERE.parent / "assets" / "neudata-logo.png"
OUT = HERE / "certificate-background.png"

# Design grid: 1492 x 1054 units (matches the approved mock-up), rendered at 3508 x 2480 px
W, H = 1492, 1054
TEAL, NAVY, BLUE = "#055F56", "#04242F", "#0B376C"
waves = LinearSegmentedColormap.from_list("neudata", ["#2BB3A3", "#0E8C80", TEAL, BLUE, NAVY])

fig = plt.figure(figsize=(11.693, 8.268), dpi=300)
ax = fig.add_axes([0, 0, 1, 1])
ax.set_xlim(0, W)
ax.set_ylim(H, 0)          # y grows downwards, like the mock-up
ax.axis("off")
fig.patch.set_facecolor("white")

# ---- Wave artwork: two families of fine curves that cross into a mesh ---------------------
def bezier(p0, p1, p2, p3, n=500):
    t = np.linspace(0, 1, n)[:, None]
    pts = (1 - t) ** 3 * p0 + 3 * (1 - t) ** 2 * t * p1 + 3 * (1 - t) * t ** 2 * p2 + t ** 3 * p3
    return pts[:, 0], pts[:, 1]

n = 46
# Left edge: strands run top to bottom, bulging right and crossing twice
for fam, (ox, sign) in enumerate([(0, 1), (35, -1)]):
    for i in range(n):
        t = i / (n - 1)
        p0 = np.array([-60 + 140 * t, -40])
        p1 = np.array([60 + 230 * t + ox, 260 + sign * 120 * t])
        p2 = np.array([-120 + 260 * (1 - t) + ox, 640 - sign * 90 * t])
        p3 = np.array([180 + 260 * t, H + 40])
        xs, ys = bezier(p0, p1, p2, p3)
        c = waves(t if fam == 0 else 1 - t)
        ax.plot(xs, ys, color=c, lw=0.42, alpha=0.75)

# Top-right: strands sweep from the top edge across to the right edge
for fam, sign in enumerate([1, -1]):
    for i in range(n):
        t = i / (n - 1)
        p0 = np.array([760 + 260 * t, -30])
        p1 = np.array([1060 + 120 * sign * t, 140 + 60 * t])
        p2 = np.array([1240 - 60 * sign * t, 60 + 260 * t])
        p3 = np.array([W + 40, 120 + 420 * t])
        xs, ys = bezier(p0, p1, p2, p3)
        c = waves(1 - t if fam == 0 else t)
        ax.plot(xs, ys, color=c, lw=0.42, alpha=0.7)


# ---- Frame: corner brackets and edge lines ----------------------------------------------------
frame = dict(color=TEAL, lw=1.3, zorder=3, solid_capstyle="round")
ax.plot([40, 1065], [36, 36], **frame)            # top
ax.plot([40, 40], [36, 110], **frame)
ax.plot([1340, 1460], [36, 36], **frame)          # top-right corner
ax.plot([1460, 1460], [36, 110], **frame)
ax.plot([1460, 1460], [500, 1016], **frame)       # right
ax.plot([1090, 1460], [1016, 1016], **frame)      # bottom right
ax.plot([385, 710], [1016, 1016], **frame)        # bottom middle
ax.plot([36, 36], [925, 1016], **frame)           # bottom-left corner
ax.plot([36, 235], [1016, 1016], **frame)

# Circuit-style accents with nodes, echoing the data theme
for (xx, y0, y1, nodes) in [(111, 88, 330, [(111, 325, "fill")]),
                            (140, 180, 330, [(140, 181, "ring")]),
                            (115, 436, 1000, [(115, 436, "fill"), (115, 533, "fill"), (117, 850, "fill")]),
                            (60, 508, 910, [(60, 508, "ring"), (60, 910, "fill")]),
                            (1398, 64, 330, [(1398, 64, "fill"), (1398, 330, "ring")]),
                            (1424, 0, 190, [])]:
    ax.plot([xx, xx], [y0, y1], color=TEAL, lw=0.9, zorder=3)
    for (nx, ny, kind) in nodes:
        if kind == "fill":
            ax.add_patch(plt.Circle((nx, ny), 7, color=TEAL, zorder=4))
        else:
            ax.add_patch(plt.Circle((nx, ny), 6, fill=False, ec=TEAL, lw=1.2, zorder=4))

# ---- Signature lines -----------------------------------------------------------------------
ax.plot([365, 712], [857, 857], color=NAVY, lw=1.0, zorder=3)
ax.plot([1053, 1423], [857, 857], color=NAVY, lw=1.0, zorder=3)

# ---- Title accent bar ----------------------------------------------------------------------
ax.add_patch(plt.Rectangle((303, 302), 5, 93, color=TEAL, zorder=4, lw=0))

fig.savefig(OUT, dpi=300, facecolor="white")
plt.close(fig)

# ---- Logo (pasted at full resolution) -----------------------------------------------------------
bg = Image.open(OUT).convert("RGB")
px = bg.width / W

# Feathered white veil behind the text block, so stray strands never cross the text
from PIL import ImageDraw, ImageFilter
mask = Image.new("L", bg.size, 0)
ImageDraw.Draw(mask).rectangle([int(345 * px), int(290 * px), int(1300 * px), int(990 * px)], fill=235)
mask = mask.filter(ImageFilter.GaussianBlur(int(45 * px)))
bg = Image.composite(Image.new("RGB", bg.size, "white"), bg, mask)
# keep the frame, accents and title bar crisp: redraw them over the veil
crisp = Image.open(OUT).convert("RGB")
mask2 = Image.new("L", bg.size, 0)
d2 = ImageDraw.Draw(mask2)
d2.rectangle([int(300 * px), int(300 * px), int(310 * px), int(397 * px)], fill=255)   # title bar
d2.rectangle([int(360 * px), int(852 * px), int(717 * px), int(862 * px)], fill=255)    # signature lines
d2.rectangle([int(1048 * px), int(852 * px), int(1428 * px), int(862 * px)], fill=255)
bg = Image.composite(crisp, bg, mask2)
logo = Image.open(LOGO).convert("RGBA")
h = int(170 * px)
logo = logo.resize((int(logo.width * h / logo.height), h), Image.LANCZOS)
bg.paste(logo, (int(300 * px), int(96 * px)), logo)
bg.save(OUT, optimize=True)
print(OUT, bg.size)
