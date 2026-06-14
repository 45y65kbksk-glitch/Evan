"""Approximate PPTX -> PNG renderer for visual QA (LibreOffice is unusable here).
Reads true shape geometry/text from the generated file via python-pptx and draws
with PIL using Liberation Sans (Arial-metric; ~ wider than Calibri => conservative
fit check). Good enough to catch overflow, overlap and alignment problems."""
import os, sys
from PIL import Image, ImageDraw, ImageFont
from pptx import Presentation
from pptx.util import Emu
from pptx.enum.shapes import MSO_SHAPE_TYPE
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.oxml.ns import qn

REG = "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"
BLD = "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"
ITAL = "/usr/share/fonts/truetype/liberation/LiberationSans-Italic.ttf"
DPI = 150
EMU_IN = 914400
PX = DPI / EMU_IN
ASSET = os.path.join(os.path.dirname(__file__), "assets")

_fc = {}
def fnt(px, bold, ital=False):
    px = max(6, int(round(px)))
    key = (px, bold, ital)
    if key not in _fc:
        p = BLD if bold else (ITAL if ital else REG)
        _fc[key] = ImageFont.truetype(p, px)
    return _fc[key]

def emu(v): return int(round((v or 0) * PX))

def hexof(color, default="000000"):
    try:
        if color and color.type is not None and color.rgb is not None:
            return str(color.rgb)
    except Exception:
        pass
    return default

def rrect(d, box, r, fill=None, outline=None, width=1):
    d.rounded_rectangle(box, radius=r, fill=fill, outline=outline, width=width)

def para_tokens(para):
    """Return list of lines; each line is list of tokens (text,size,bold,ital,color).
    Splits on explicit newlines inside runs."""
    toks = []
    runs = para.runs
    if not runs:
        return [[]]
    for r in runs:
        sz = r.font.size.pt if r.font.size is not None else 14
        bold = bool(r.font.bold)
        ital = bool(r.font.italic)
        col = hexof(r.font.color)
        parts = r.text.split("\n")
        for i, part in enumerate(parts):
            if i > 0:
                toks.append(("\n", sz, bold, ital, col))
            for w in part.split(" "):
                toks.append((w, sz, bold, ital, col))
            # re-add spaces as separators handled in wrap
    return toks

def is_bullet(para):
    pPr = para._p.find(qn('a:pPr'))
    if pPr is None:
        return False
    return pPr.find(qn('a:buChar')) is not None or pPr.find(qn('a:buAutoNum')) is not None

def draw_text(d, shape):
    tf = shape.text_frame
    x0, y0 = emu(shape.left), emu(shape.top)
    w, h = emu(shape.width), emu(shape.height)
    ml = emu(tf.margin_left); mr = emu(tf.margin_right)
    mt = emu(tf.margin_top); mb = emu(tf.margin_bottom)
    inner_x = x0 + ml; inner_w = w - ml - mr
    inner_y = y0 + mt; inner_h = h - mt - mb
    anchor = tf.vertical_anchor

    # build wrapped lines across all paragraphs
    lines = []  # (tokens_with_width, line_height, align, bullet)
    for para in tf.paragraphs:
        align = para.alignment
        bullet = is_bullet(para)
        toks = para_tokens(para)
        # group tokens into words list preserving hard breaks
        cur = []
        cur_w = 0
        bullet_prefix = "•  " if bullet else ""
        prefix_done = not bullet
        def flush():
            nonlocal cur, cur_w
            if cur:
                lines.append((cur, max(t[5] for t in cur) if cur else fnt(14,0).size, align, False))
            cur = []; cur_w = 0
        # We'll compute per-token width with font
        space_w = lambda size: fnt(size*DPI/72, False).getlength(" ")
        first_token = True
        maxsize = 14
        line_items = []
        line_w = 0
        def push_line():
            nonlocal line_items, line_w
            lines.append((line_items, align, bullet))
            line_items = []; line_w = 0
        avail = inner_w
        # prepend bullet as a token
        seq = []
        if bullet:
            seq.append(("•", None, True, False, "21A038", True))
        for (w_, sz, b, it, col) in toks:
            if w_ == "\n":
                seq.append(("\n", sz, b, it, col, False)); continue
            seq.append((w_, sz, b, it, col, False))
        for item in seq:
            tok = item[0]
            if tok == "\n":
                push_line(); continue
            sz = item[1] if item[1] else 14
            f = fnt(sz*DPI/72, item[2], item[3])
            tw = f.getlength(tok if tok else " ")
            sw = f.getlength(" ")
            add = tw + (sw if line_items else 0)
            if line_items and line_w + add > avail and tok != "•":
                push_line()
                add = tw
            line_items.append((tok, sz, item[2], item[3], item[4], item[0] == "•"))
            line_w += add
        push_line()

    # compute total height
    def line_h(items):
        if not items: return int(14*DPI/72*1.25)
        return int(max(it[1] for it in items)*DPI/72*1.28)
    total = sum(line_h(it[0]) for it in lines)
    if anchor == MSO_ANCHOR.MIDDLE:
        cy = inner_y + max(0, (inner_h - total)//2)
    elif anchor == MSO_ANCHOR.BOTTOM:
        cy = inner_y + max(0, inner_h - total)
    else:
        cy = inner_y
    for items, align, bullet in lines:
        lh = line_h(items)
        # measure width
        ww = 0
        for j,(tok,sz,b,it,col,isb) in enumerate(items):
            f = fnt(sz*DPI/72,b,it)
            ww += f.getlength(tok) + (f.getlength(" ") if j>0 else 0)
        if align == PP_ALIGN.CENTER:
            cx = inner_x + max(0,(inner_w-ww)//2)
        elif align == PP_ALIGN.RIGHT:
            cx = inner_x + max(0,(inner_w-ww))
        else:
            cx = inner_x
        x = cx
        for j,(tok,sz,b,it,col,isb) in enumerate(items):
            f = fnt(sz*DPI/72,b,it)
            if j>0:
                x += f.getlength(" ")
            d.text((x, cy), tok, font=f, fill="#"+(col or "000000"))
            x += f.getlength(tok)
        cy += lh

def render(path, outdir):
    prs = Presentation(path)
    W = emu(prs.slide_width); Hh = emu(prs.slide_height)
    os.makedirs(outdir, exist_ok=True)
    dark = Image.open(os.path.join(ASSET,"bg_dark.png")).convert("RGB").resize((W,Hh))
    for idx, slide in enumerate(prs.slides):
        # background
        has_bg_img = slide._element.find(qn('p:cSld')+'/'+qn('p:bg')) is not None and \
                     b'blipFill' in slide._element.xml.encode() if False else None
        # detect background blip
        bgimg = False; bgcol = None
        bg_el = slide._element.find('.//'+qn('p:bg'))
        if bg_el is not None:
            if bg_el.find('.//'+qn('a:blip')) is not None:
                bgimg = True
            srgb = bg_el.find('.//'+qn('a:srgbClr'))
            if srgb is not None:
                bgcol = srgb.get('val')
        if bgimg:
            img = dark.copy()
        else:
            img = Image.new("RGB",(W,Hh), "#"+(bgcol or "FFFFFF"))
        d = ImageDraw.Draw(img, "RGBA")
        for shape in slide.shapes:
            try:
                if shape.shape_type == MSO_SHAPE_TYPE.PICTURE:
                    blob = shape.image.blob
                    from io import BytesIO
                    im = Image.open(BytesIO(blob)).convert("RGBA")
                    im = im.resize((max(1,emu(shape.width)), max(1,emu(shape.height))))
                    img.paste(im,(emu(shape.left),emu(shape.top)), im)
                    continue
            except Exception as e:
                pass
            # shape fill / geometry
            try:
                box = [emu(shape.left),emu(shape.top),
                       emu(shape.left)+emu(shape.width),emu(shape.top)+emu(shape.height)]
                fill_hex = None
                try:
                    if shape.fill.type == 1:
                        fill_hex = "#"+hexof(shape.fill.fore_color,"FFFFFF")
                except Exception:
                    fill_hex = None
                line_hex = None; lw=1
                try:
                    if shape.line.color and shape.line.color.type is not None:
                        line_hex = "#"+str(shape.line.color.rgb)
                        lw = max(1,emu(shape.line.width or 9525))
                except Exception:
                    line_hex=None
                ast = None
                try: ast = shape.auto_shape_type
                except Exception: ast = None
                if fill_hex or line_hex:
                    name = str(ast) if ast else ""
                    if "OVAL" in name:
                        d.ellipse(box, fill=fill_hex, outline=line_hex, width=lw)
                    elif "ROUNDED" in name:
                        rrect(d, box, max(6,int(0.08*DPI)), fill=fill_hex, outline=line_hex, width=lw)
                    else:
                        d.rectangle(box, fill=fill_hex, outline=line_hex, width=lw)
            except Exception as e:
                pass
            # text
            try:
                if shape.has_text_frame and shape.text_frame.text.strip():
                    draw_text(d, shape)
            except Exception as e:
                pass
        img.save(os.path.join(outdir, f"slide-{idx+1:02d}.png"))
    return prs.slides

if __name__ == "__main__":
    src = sys.argv[1] if len(sys.argv)>1 else "deck.pptx"
    out = sys.argv[2] if len(sys.argv)>2 else "qa"
    for f in os.listdir(out) if os.path.isdir(out) else []:
        if f.endswith(".png"): os.remove(os.path.join(out,f))
    render(src, out)
    print("rendered to", out)
