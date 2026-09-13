"""Generate the Notes app logo assets (independent, no Emergent branding).

Minimal, premium "note page" mark: a white rounded document with a dog-ear
folded corner and text lines, on brand orange (#FF5E00).
"""
from PIL import Image, ImageDraw, ImageFilter

BRAND = (255, 94, 0)          # #FF5E00
BRAND_DK = (223, 78, 0)       # gradient bottom
WHITE = (255, 255, 255)
LINE = (255, 158, 99)         # soft orange text lines
TITLE_LINE = (255, 118, 38)   # accent title line
FOLD = (235, 232, 228)        # dog-ear shade

SS = 4  # supersample


def vertical_gradient(size, top, bottom):
    base = Image.new("RGB", (1, size))
    for y in range(size):
        t = y / max(1, size - 1)
        base.putpixel((0, y), (
            int(top[0] + (bottom[0] - top[0]) * t),
            int(top[1] + (bottom[1] - top[1]) * t),
            int(top[2] + (bottom[2] - top[2]) * t),
        ))
    return base.resize((size, size))


def draw_note_glyph(size, page_ratio=0.54):
    """Return an RGBA image (size x size) with a centered white note page."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    w = int(size * page_ratio)
    h = int(w * 1.24)
    cx = cy = size // 2
    left = cx - w // 2
    top = cy - h // 2
    right = left + w
    bottom = top + h
    rad = int(w * 0.13)
    fold = int(w * 0.28)

    # soft drop shadow
    sh = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    sd = ImageDraw.Draw(sh)
    off = int(size * 0.012)
    sd.rounded_rectangle([left + off, top + off + int(size * 0.008),
                          right + off, bottom + off + int(size * 0.008)],
                         radius=rad, fill=(90, 30, 0, 90))
    sh = sh.filter(ImageFilter.GaussianBlur(int(size * 0.02)))
    img.alpha_composite(sh)

    # page body: main rounded rect, but leave the top-right for the dog-ear.
    # Draw full page, then overlay the dog-ear triangle + its fold shade.
    d.rounded_rectangle([left, top, right, bottom], radius=rad, fill=WHITE)

    # Dog-ear: paint the outer corner triangle with the page-neighbour color by
    # cutting it out (set to transparent) then drawing the folded flap.
    cut = Image.new("L", (size, size), 0)
    cd = ImageDraw.Draw(cut)
    cd.polygon([(right - fold, top), (right + 2, top), (right + 2, top + fold)], fill=255)
    # erase corner -> transparent
    transparent = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    img.paste(transparent, (0, 0), cut)
    # folded flap (triangle) shaded
    d.polygon([(right - fold, top), (right, top + fold), (right - fold, top + fold)],
              fill=FOLD)
    d.line([(right - fold, top), (right, top + fold)], fill=(214, 210, 205), width=max(2, SS // 2))

    # text lines
    pad = int(w * 0.17)
    lx = left + pad
    lx2 = right - pad
    lh = max(3, int(h * 0.05))
    y0 = top + int(h * 0.36)
    d.rounded_rectangle([lx, y0, lx + int((lx2 - lx) * 0.5), y0 + lh * 2],
                        radius=lh, fill=TITLE_LINE)
    gap = int(h * 0.14)
    for i, wf in enumerate([1.0, 1.0, 0.66]):
        yy = y0 + int(h * 0.2) + gap * (i + 1)
        d.rounded_rectangle([lx, yy, lx + int((lx2 - lx) * wf), yy + lh],
                            radius=lh, fill=LINE)
    return img


def make_plate(size):
    """Orange rounded plate + note glyph."""
    S = size * SS
    grad = vertical_gradient(S, BRAND, BRAND_DK).convert("RGBA")
    mask = Image.new("L", (S, S), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, S, S], radius=int(S * 0.235), fill=255)
    canvas = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    canvas.paste(grad, (0, 0), mask)
    canvas.alpha_composite(draw_note_glyph(S))
    return canvas.resize((size, size), Image.LANCZOS)


def main():
    out = "/app/frontend/assets/images"
    make_plate(1024).save(f"{out}/icon.png")
    make_plate(256).save(f"{out}/favicon.png")

    # Adaptive foreground: note glyph on transparent, padded to safe zone.
    S = 1024 * SS
    fg = draw_note_glyph(S, page_ratio=0.40).resize((1024, 1024), Image.LANCZOS)
    fg.save(f"{out}/adaptive-icon.png")

    # Splash: glyph on transparent (backgroundColor set in app.json)
    sp = draw_note_glyph(512 * SS, page_ratio=0.5).resize((512, 512), Image.LANCZOS)
    sp.save(f"{out}/splash-image.png")
    print("Logo assets generated: icon, favicon, adaptive-icon, splash-image")


if __name__ == "__main__":
    main()
