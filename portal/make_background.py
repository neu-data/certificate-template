"""Build the certificate background from the approved design.

    python portal/make_background.py

Source: portal/design/certificate-design.webp (the approved mock-up, 1492 x 1054).
1. Every piece of text and the logo are erased from the design (inpainting), keeping the
   wave artwork, frame and accents exactly as designed.
2. The image is upscaled to print resolution (A4 landscape, 300 dpi).
3. The logo and all fixed text are redrawn crisply, each one sized and positioned to match
   the text it replaces in the design.

The participant name, certificate ID and QR code are added later by the portal (Code.gs).
Writes portal/certificate-background.png and portal/layout.json (the boxes for those
three items, in points, used by Code.gs and preview.py).
"""
import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = Path(__file__).parent
DESIGN = HERE / "design" / "certificate-design.webp"
LOGO = HERE.parent / "assets" / "neudata-logo.png"
FONTS = Path("C:/Windows/Fonts")
OUT_W, OUT_H = 3508, 2480                       # A4 landscape at 300 dpi
PAGE_W_PT, PAGE_H_PT = 841.89, 595.28

TEAL, NAVY, BLUE, GREY = (5, 95, 86), (4, 36, 47), (11, 55, 108), (128, 140, 150)

# Fixed text: (rough box in design px, text in the design, text to draw, font, colour, align, tracked)
# The rough box only needs to enclose the original text; its exact extent is measured.
TEXT = [
    ((340, 310, 1195, 380), "CERTIFICATE OF COMPLETION", "CERTIFICATE OF COMPLETION", "GOTHICB.TTF", TEAL, "left", True),
    ((345, 415, 610, 460), "This is to certify that", "This is to certify that", "GOTHIC.TTF", GREY, "left", False),
    ((345, 592, 690, 636), "has successfully completed", "has successfully completed", "GOTHIC.TTF", GREY, "left", False),
    ((345, 643, 1300, 715), "Clinical Data Analysis in R — Phase I", "Clinical Data Analysis in R — Phase I",
     "GOTHICB.TTF", BLUE, "left", False),
    ((345, 720, 1280, 762), "5 online sessions · 7.5 contact hours · 8 September – 6 October 2026 · Online",
     "5 online sessions · 7.5 contact hours · 8 September – 6 October 2026 · Online", "GOTHIC.TTF", NAVY, "left", False),
    ((440, 872, 620, 906), "Signatory Name", "My Luong Vuong", "GOTHICB.TTF", NAVY, "center", False),
    ((385, 905, 690, 934), "Lead Trainer, Senior Biostatistician", "Lead Trainer, Senior Biostatistician",
     "GOTHIC.TTF", GREY, "center", False),
    ((838, 864, 908, 890), "Issued", "Issued", "GOTHIC.TTF", GREY, "center", False),
    ((805, 893, 942, 926), "06-10-2026", "06-10-2026", "GOTHICB.TTF", NAVY, "center", False),
    ((1145, 874, 1325, 908), "Signatory Name", "Bernard Isekah Osang'ir", "GOTHICB.TTF", NAVY, "center", False),
    ((1112, 906, 1375, 936), "Trainer, Senior Biostatistician", "Trainer, Senior Biostatistician",
     "GOTHIC.TTF", GREY, "center", False),
    ((720, 970, 1080, 998), "Neudata Consulting Ltd · www.neu-data.com", "Neudata Consulting Ltd · www.neu-data.com",
     "GOTHIC.TTF", GREY, "center", False),
    ((760, 999, 1042, 1034), "Insight. Impact. Innovation.", "Insight. Impact. Innovation.", "georgiai.ttf", TEAL,
     "center", False),
]
# Erased here, filled per participant by the portal
NAME_BOX = (345, 470, 1135, 590)               # "Participant Name"
IDLINE_BOX = (636, 945, 1160, 974)             # "Certificate ID: ... · Verify at ..."
LOGO_BOX = (295, 88, 575, 272)
# New element (not in the mock-up): QR code beside the name, with a caption
QR_BOX = (1262, 476, 1372, 586)
QR_CAPTION_Y = 592


def measure(img, box, thresh=200):
    """Bounding box of the dark/coloured pixels inside a rough box (design px)."""
    x0, y0, x1, y1 = box
    crop = np.asarray(img.convert("L"))[y0:y1, x0:x1]
    ys, xs = np.where(crop < thresh)
    if len(xs) == 0:
        return box
    return (x0 + xs.min(), y0 + ys.min(), x0 + xs.max() + 1, y0 + ys.max() + 1)


def text_mask(img, boxes, thresh=225, grow=3):
    gray = np.asarray(img.convert("L"))
    mask = np.zeros(gray.shape, np.uint8)
    for (x0, y0, x1, y1) in boxes:
        region = gray[y0:y1, x0:x1] < thresh
        mask[y0:y1, x0:x1][region] = 255
    return cv2.dilate(mask, np.ones((2 * grow + 1, 2 * grow + 1), np.uint8))


def font(name, size_px):
    return ImageFont.truetype(str(FONTS / name), max(4, int(round(size_px))))


def fit_width(fontname, text, width_px):
    lo, hi = 4.0, 600.0
    for _ in range(40):
        mid = (lo + hi) / 2
        b = font(fontname, mid).getbbox(text)
        lo, hi = (mid, hi) if (b[2] - b[0]) < width_px else (lo, mid)
    return lo


def fit_cap_height(fontname, cap_px):
    lo, hi = 4.0, 600.0
    for _ in range(40):
        mid = (lo + hi) / 2
        b = font(fontname, mid).getbbox("H")
        lo, hi = (mid, hi) if (b[3] - b[1]) < cap_px else (lo, mid)
    return lo


def draw_tracked(draw, x, y_top, text, f, fill, total_width):
    """Letter-spaced text filling exactly total_width, ink top at y_top."""
    first = f.getbbox(text[0])[0]
    last_ch = text[-1]
    natural = sum(f.getlength(ch) for ch in text[:-1]) + f.getbbox(last_ch)[2] - first
    gap = (total_width - natural) / (len(text) - 1)
    top = f.getbbox("H")[1]
    cx = x - first
    for ch in text:
        draw.text((cx, y_top - top), ch, font=f, fill=fill)
        cx += f.getlength(ch) + gap


def main():
    design = Image.open(DESIGN).convert("RGB")
    s = OUT_W / design.width

    # ---- measure every text element before erasing
    measured = [(measure(design, t[0]),) + t[1:] for t in TEXT]
    name_box = measure(design, NAME_BOX)
    id_box = measure(design, IDLINE_BOX)

    # ---- erase text and logo, keep the artwork
    erase = [t[0] for t in TEXT] + [NAME_BOX, IDLINE_BOX]
    mask = text_mask(design, erase)
    gray = np.asarray(design.convert("L"))
    lx0, ly0, lx1, ly1 = LOGO_BOX
    logo_region = (gray[ly0:ly1, lx0:lx1] < 245).astype(np.uint8) * 255
    mask[ly0:ly1, lx0:lx1] = np.maximum(mask[ly0:ly1, lx0:lx1],
                                        cv2.dilate(logo_region, np.ones((7, 7), np.uint8)))
    clean = cv2.inpaint(cv2.cvtColor(np.asarray(design), cv2.COLOR_RGB2BGR), mask, 5, cv2.INPAINT_TELEA)
    clean = Image.fromarray(cv2.cvtColor(clean, cv2.COLOR_BGR2RGB))
    # the design's paper is a slightly textured off-white (247-255): lift it to clean white,
    # which prints crisply and hides any seams from the erased text
    clean = clean.point(lambda v: min(255, int(v * 255 / 246)))

    # the text sits on near-white paper: whiten those areas fully so no smudges remain
    veil = Image.new("L", clean.size, 0)
    vd = ImageDraw.Draw(veil)
    for (x0, y0, x1, y1) in erase + [LOGO_BOX, QR_BOX]:
        vd.rectangle([x0 - 4, y0 - 4, x1 + 4, y1 + 4], fill=255)
    veil = veil.filter(ImageFilter.GaussianBlur(3))
    clean = Image.composite(Image.new("RGB", clean.size, "white"), clean, veil)

    # ---- upscale to print resolution
    bg = clean.resize((OUT_W, OUT_H), Image.LANCZOS).filter(
        ImageFilter.UnsharpMask(radius=2, percent=60, threshold=2))
    d = ImageDraw.Draw(bg)

    # ---- crisp logo in the same place and size
    logo = Image.open(LOGO).convert("RGBA")
    lb = measure(design, LOGO_BOX, thresh=245)
    scale = min((lb[2] - lb[0]) * s / logo.width, (lb[3] - lb[1]) * s / logo.height)
    logo = logo.resize((int(logo.width * scale), int(logo.height * scale)), Image.LANCZOS)
    bg.paste(logo, (int(lb[0] * s), int(lb[1] * s)), logo)

    # ---- crisp fixed text, matched to the design
    for (box, orig, new, fontname, colour, align, tracked) in measured:
        x0, y0, x1, y1 = [v * s for v in box]
        if tracked:
            f = font(fontname, fit_cap_height(fontname, y1 - y0))
            draw_tracked(d, x0, y0, new, f, colour, x1 - x0)
            continue
        f = font(fontname, fit_width(fontname, orig, x1 - x0))
        b, ref = f.getbbox(new), f.getbbox(orig)
        x = x0 - b[0] if align == "left" else (x0 + x1) / 2 - (b[2] - b[0]) / 2 - b[0]
        d.text((x, y0 - ref[1]), new, font=f, fill=colour)

    # caption under the QR code
    f = font("GOTHIC.TTF", 13 * s)
    cap = "Scan to verify"
    d.text(((QR_BOX[0] + QR_BOX[2]) / 2 * s - f.getlength(cap) / 2, QR_CAPTION_Y * s), cap, font=f, fill=GREY)

    out = HERE / "certificate-background.png"
    bg.save(out, optimize=True)

    # ---- slots for the dynamic content, in points (Code.gs) — the preview uses the same file
    pt = PAGE_W_PT / design.width
    id_font = fit_width("GOTHIC.TTF", "Certificate ID: NDC-TR-2026-001 · Verify at contact@neu-data.com",
                        (id_box[2] - id_box[0]))
    layout = {
        "page": {"w": PAGE_W_PT, "h": PAGE_H_PT},
        "name": {"x": round(name_box[0] * pt, 1), "y": round(name_box[1] * pt, 1),
                 "w": round((QR_BOX[0] - 25 - name_box[0]) * pt, 1),
                 "h": round((name_box[3] - name_box[1]) * pt, 1),
                 "size": round(fit_width("BOD_R.TTF", "Participant Name", name_box[2] - name_box[0]) * pt, 1)},
        "idline": {"x": round((id_box[0] - 70) * pt, 1), "y": round(id_box[1] * pt, 1),
                   "w": round((id_box[2] - id_box[0] + 140) * pt, 1), "h": round((id_box[3] - id_box[1]) * pt, 1),
                   "size": round(id_font * pt, 1)},
        "qr": {"x": round(QR_BOX[0] * pt, 1), "y": round(QR_BOX[1] * pt, 1), "size": round((QR_BOX[2] - QR_BOX[0]) * pt, 1)},
    }
    (HERE / "layout.json").write_text(json.dumps(layout, indent=2), encoding="utf-8")
    print(out, bg.size)
    print(json.dumps(layout))


if __name__ == "__main__":
    main()
