"""Preview the finished certificate with sample data (same layout the portal uses).

    python portal/preview.py "Nguyễn Thị Minh Phương"

Writes portal/preview.png. Positions mirror LAYOUT in Code.gs (points on an
842 x 595 pt A4-landscape page).
"""
import sys
from pathlib import Path

import qrcode
from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).parent
bg = Image.open(HERE / "certificate-background.png").convert("RGB")
S = bg.width / 842.0                     # px per pt
d = ImageDraw.Draw(bg)

FONTS = Path("C:/Windows/Fonts")
def font(names, size):
    for n in names:
        p = FONTS / n
        if p.exists():
            return ImageFont.truetype(str(p), int(size * S))
    return ImageFont.load_default()

SANS_B = ["GOTHICB.TTF", "segoeuib.ttf", "arialbd.ttf"]
SANS = ["GOTHIC.TTF", "segoeui.ttf", "arial.ttf"]
SERIF = ["georgia.ttf", "times.ttf"]
SERIF_I = ["georgiai.ttf", "timesi.ttf"]
TEAL, NAVY, BLUE, GREY = "#055F56", "#04242F", "#0B376C", "#8A99A3"

name = sys.argv[1] if len(sys.argv) > 1 else "Participant Name"
cert_id = "NDC-TR-2026-1-1047-001"
verify_url = f"https://script.google.com/macros/s/EXAMPLE/exec?verify={cert_id}"


def text(x, y, s, f, fill, anchor="la", w=None):
    if w is not None:                  # centre inside a box of width w
        x, anchor = x + w / 2, anchor.replace("l", "m")
    d.text((x * S, y * S), s, font=f, fill=fill, anchor=anchor)


def name_size(n):
    L = len(n)
    return 44 if L <= 22 else 36 if L <= 30 else 30 if L <= 38 else 24


text(198, 197, "CERTIFICATE OF COMPLETION", font(SANS_B, 25), TEAL, "lm")
text(200, 245, "This is to certify that", font(SANS, 13), GREY, "lm")
text(197, 293, name, font(SERIF, name_size(name)), NAVY, "lm")
text(200, 344, "has successfully completed", font(SANS, 13), GREY, "lm")
text(198, 381, "Clinical Data Analysis in R — Phase I", font(SANS_B, 23), BLUE, "lm")
text(200, 417, "5 online sessions · 7.5 contact hours · 8 September – 6 October 2026 · Online",
     font(SANS, 12), NAVY, "lm")
text(206, 498, "My Luong Vuong", font(SANS_B, 11), NAVY, "mm", w=196)
text(206, 514, "Lead Trainer, Senior Biostatistician", font(SANS, 9), GREY, "mm", w=196)
text(594, 498, "Bernard Isekah Osang'ir", font(SANS_B, 11), NAVY, "mm", w=209)
text(594, 514, "Trainer, Senior Biostatistician", font(SANS, 9), GREY, "mm", w=209)
text(436, 491, "Issued", font(SANS, 9), GREY, "mm", w=113)
text(436, 508, "06-10-2026", font(SANS_B, 12), NAVY, "mm", w=113)
text(226, 542, f"Certificate ID: {cert_id}  ·  Scan the QR code to verify", font(SANS, 8.5), GREY, "mm", w=530)
text(226, 556, "Neudata Consulting Ltd  ·  www.neu-data.com  ·  contact@neu-data.com", font(SANS, 8.5), GREY, "mm", w=530)
text(226, 572, "Insight. Impact. Innovation.", font(SERIF_I, 11), TEAL, "mm", w=530)

qr = qrcode.make(verify_url, box_size=10, border=1).convert("RGB")
size = int(66 * S)
qr = qr.resize((size, size), Image.NEAREST)
d.rectangle([int(726 * S), int(207 * S), int(796 * S), int(277 * S)], fill="white")
bg.paste(qr, (int(728 * S), int(209 * S)))
text(728, 284, "Scan to verify", font(SANS, 7.5), GREY, "mm", w=66)

out = HERE / "preview.png"
bg.save(out)
print(out)
