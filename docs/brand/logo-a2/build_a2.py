# HydroStab mark "Righting Hull" A2: exact geometry, filled shapes only (no strokes, no clipping).
# Hull frame: midship section 2:1 (beam 156, depth 78), flat bottom, bilge radius 20, square deck edge;
# heeled 10 deg about the pivot; the waterline stays level; the underwater body is solid;
# the metacentre M sits on the ship's own centreline.
import math, sys
HEEL = 10.0
CX, CY = 128.0, 140.0          # pivot = centre of the hull section on the waterline
X0, X1, YD, YB, RB = 50.0, 206.0, 100.0, 178.0, 20.0   # hull mid-line rectangle: sides, deck, bottom, bilge radius

def rot(px, py, deg):
    a = math.radians(deg); dx, dy = px - CX, py - CY
    return CX + dx * math.cos(a) - dy * math.sin(a), CY + dx * math.sin(a) + dy * math.cos(a)

def section(off):
    """closed path of the section offset by 'off' (positive = outward), bilge radius grows/shrinks with it"""
    x0, x1, yd, yb, r = X0 - off, X1 + off, YD - off, YB + off, max(1.0, RB + off)
    return x0, x1, yd, yb, r, (f'M{x0:.2f} {yd:.2f} V{yb - r:.2f} A{r:.2f} {r:.2f} 0 0 0 {x0 + r:.2f} {yb:.2f} '
                              f'H{x1 - r:.2f} A{r:.2f} {r:.2f} 0 0 0 {x1:.2f} {yb - r:.2f} V{yd:.2f} Z')

def side_hit(x, wl):
    """y (hull frame) where the vertical side x of the hull meets the world waterline y = wl"""
    # world y of hull point (x, y): CY + dx sin(-h) + dy cos(-h)  ->  solve for y
    a = math.radians(-HEEL); dx = x - CX
    return CY + (wl - CY - dx * math.sin(a)) / math.cos(a)

def mark(sw, wl_h, dot_r, wl_half, colors, ty):
    ink, sea, m = colors
    h = sw / 2
    _, _, _, _, _, outer = section(h)
    _, _, _, _, _, inner = section(-h)
    # underwater body inside the hull: inner shape below the (world-level) waterline,
    # grown 1.5 units so it overlaps the outline instead of meeting it edge to edge (no hairline seam)
    x0, x1, yd, yb, r, _ = section(-h + 1.5)
    yl, yr = side_hit(x0, CY), side_hit(x1, CY)
    body = (f'M{x0:.2f} {yl:.2f} V{yb - r:.2f} A{r:.2f} {r:.2f} 0 0 0 {x0 + r:.2f} {yb:.2f} '
            f'H{x1 - r:.2f} A{r:.2f} {r:.2f} 0 0 0 {x1:.2f} {yb - r:.2f} V{yr:.2f} Z')
    mx, my = rot(CX, YD - h - 40, -HEEL)
    tf = f'rotate({-HEEL} {CX} {CY})'
    return (f'<g transform="translate(0 {ty})">'
            f'<path fill="{ink}" fill-rule="evenodd" transform="{tf}" d="{outer} {inner}"/>'
            f'<path fill="{ink}" transform="{tf}" d="{body}"/>'
            f'<rect fill="{sea}" x="{CX - wl_half:.2f}" y="{CY - wl_h / 2:.2f}" width="{2 * wl_half:.2f}" height="{wl_h:.2f}"/>'
            f'<circle fill="{m}" cx="{mx:.2f}" cy="{my:.2f}" r="{dot_r}"/></g>')

def svg(body, bg=None, title='HydroStab'):
    tile = f'<rect width="256" height="256" rx="56" fill="{bg}"/>' if bg else ''
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><title>{title}</title>{tile}{body}</svg>\n'

K = ('#000', '#000', '#000')
REG = dict(sw=16, wl_h=16, dot_r=12, wl_half=98, ty=8)
SMALL = dict(sw=24, wl_h=22, dot_r=20, wl_half=100, ty=13)
INK, BLUE, MAG, PAPER = '#22302B', '#245F80', '#A3195B', '#E7EBE5'
out = {
  'a2-symbol-black.svg': svg(mark(colors=K, **REG)),
  'a2-symbol-small-black.svg': svg(mark(colors=K, **SMALL)),
  'a2-symbol-colour.svg': svg(mark(colors=(INK, BLUE, MAG), **REG)),
  'a2-symbol-small-colour.svg': svg(mark(colors=(INK, BLUE, MAG), **SMALL)),
  'a2-symbol-reversed.svg': svg(mark(colors=('#F1F3EE', '#8EBCD6', '#E36A9F'), **REG)),
  'a2-appicon.svg': svg('<g transform="translate(128 128) scale(0.82) translate(-128 -128)">' + mark(colors=(INK, BLUE, MAG), **REG) + '</g>', bg=PAPER),
  'a2-appicon-dark.svg': svg('<g transform="translate(128 128) scale(0.82) translate(-128 -128)">' + mark(colors=('#F1F3EE', '#8EBCD6', '#E36A9F'), **REG) + '</g>', bg='#151B18'),
}
for k, v in out.items(): open(k, 'w').write(v)
print('written', len(out))
