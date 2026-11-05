"""Build AuraGen AG logos from a real typeface.
usage: build2.py FONT.ttf OUTDIR [prefix]"""
import sys, os
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.pointInsidePen import PointInsidePen
from fontTools.pens.transformPen import TransformPen

font_path, outdir = sys.argv[1], sys.argv[2]
prefix = sys.argv[3] if len(sys.argv) > 3 else 'auragen-logo'
want = dict(kv.split('=') for kv in sys.argv[4].split(',')) if len(sys.argv) > 4 else {}
f = TTFont(font_path)
if 'fvar' in f:
    loc = {}
    for a in f['fvar'].axes:
        v = want.get(a.axisTag, 'max' if a.axisTag in ('wght', 'opsz') else a.defaultValue)
        v = a.maxValue if v == 'max' else float(v)
        loc[a.axisTag] = max(a.minValue, min(a.maxValue, v))
    f = instantiateVariableFont(f, loc)
gs = f.getGlyphSet(); cmap = f.getBestCmap()
A = gs[cmap[ord('A')]]; G = gs[cmap[ord('G')]]
def bounds(g):
    p = BoundsPen(gs); g.draw(p); return p.bounds
def runs(g, x, y0, y1, n=400):
    out = []; cur = None
    for i in range(n + 1):
        y = y0 + (y1 - y0) * i / n
        p = PointInsidePen(gs, (x, y)); g.draw(p)
        if p.getResult():
            cur = [y, y] if cur is None else [cur[0], y]
        elif cur: out.append(cur); cur = None
    if cur: out.append(cur)
    return out

def inside(g, x, y):
    p = PointInsidePen(gs, (x, y)); g.draw(p); return p.getResult()
ax0, ay0, ax1, ay1 = bounds(A); gx0, gy0, gx1, gy1 = bounds(G)
capH = ay1 - ay0
# A crossbar: lowest filled run on the centre column that isn't the base
a_runs = [r for r in runs(A, (ax0 + ax1) / 2, ay0, ay1) if r[0] > ay0 + capH * 0.05]
a_bar = a_runs[0]
# G bar: run near the middle on a column 65% across
# G bar: the horizontal part (on the right half, away from the top/bottom curves)
# whose centre is closest to the A crossbar, so one halo lines up with both
a_c = (a_bar[0] + a_bar[1]) / 2; gh = gy1 - gy0
g_runs = [r for frac in (0.6, 0.7, 0.8, 0.9) for r in runs(G, gx0 + frac * (gx1 - gx0), gy0, gy1)
          if r[0] > gy0 + 0.15 * gh and r[1] < gy1 - 0.15 * gh and (r[1] - r[0]) < 0.3 * gh]
g_bar = min(g_runs, key=lambda r: abs((r[0] + r[1]) / 2 - a_c))
# G bar horizontal extent: scan row at bar centre from the right
gyc = (g_bar[0] + g_bar[1]) / 2
xs = [gx0 + (gx1 - gx0) * i / 300 for i in range(301)]
gbar_x0 = min(x for x in xs if x > gx0 + 0.4 * (gx1 - gx0) and inside(G, x, gyc))

# Slight join: measure the real gap between A's right edge and G's left edge
# at many heights, then shift G so the closest point overlaps by `overlap`.
overlap = float(os.environ.get('AG_OVERLAP', 0.035)) * capH
def edge(g, y, x0, x1, from_right, n=240):
    rng = range(n, -1, -1) if from_right else range(n + 1)
    for i in rng:
        x = x0 + (x1 - x0) * i / n
        if inside(g, x, y): return x
    return None
gaps = []
for k in range(1, 40):
    y = ay0 + capH * k / 40
    ar = edge(A, y, ax0, ax1, True); gl = edge(G, y, gx0, gx1, False)
    if ar is not None and gl is not None: gaps.append(gl - ar)
gdx = -min(gaps) - overlap
total_w = gx1 + gdx - ax0
s = 178 / capH
if total_w * s > 330: s = 330 / total_w
W = total_w * s
ox = 210 - W / 2 - ax0 * s; base = 240 if s * capH >= 177 else 151 + s * capH / 2
def T(x, y): return (ox + x * s, base - y * s)

def path(g, dx=0):
    pen = SVGPathPen(None)
    g.draw(TransformPen(pen, (s, 0, 0, -s, ox + dx * s, base))); return pen.getCommands()
dA, dG = path(A), path(G, gdx)

# midline geometry in SVG coords
a_bar_y = sorted([T(0, a_bar[0])[1], T(0, a_bar[1])[1]])
g_bar_y = sorted([T(0, g_bar[0])[1], T(0, g_bar[1])[1]])
mid = ((a_bar_y[0] + a_bar_y[1]) / 2 + (g_bar_y[0] + g_bar_y[1]) / 2) / 2
bar_h = ((a_bar_y[1] - a_bar_y[0]) + (g_bar_y[1] - g_bar_y[0])) / 2
x_left, x_right = T(ax0, 0)[0], T(gx1 + gdx, 0)[0]
cx = (x_left + x_right) / 2; rx = (x_right - x_left) / 2 + 28; ry = 12
cy = mid - ry * 0.85
sw = 14
# Where the halo crosses each midline: A crossbar between the inner edges of
# the legs (measured just under the bar), G bar from its start to the G's right edge.
def opening(g, y, x0, x1, n=400):
    xc = (x0 + x1) / 2; step = (x1 - x0) / n; l = r = xc
    while l > x0 and not inside(g, l, y): l -= step
    while r < x1 and not inside(g, r, y): r += step
    return l, r
ay_probe = a_bar[0] - 0.02 * capH
al, ar_ = opening(A, ay_probe, ax0, ax1)
a_l, a_r = T(al, 0)[0], T(ar_, 0)[0]
gb0 = T(gbar_x0 + gdx, 0)[0]
band_top = min(a_bar_y[0], g_bar_y[0], mid - sw / 2) - 3
band_bot = max(a_bar_y[1], g_bar_y[1], mid + sw / 2) + 3
mA = (a_l, band_top, a_r - a_l, band_bot - band_top)
mG = (gb0, band_top, x_right - gb0, band_bot - band_top)
MIDLINE_SEE_THROUGH = float(os.environ.get('AG_SEE_THROUGH', 0.45))
# Redraw the G's bar over the halo so the G never reads as a C
G_BAR_ON_TOP = os.environ.get('AG_G_BAR_ON_TOP', '0') == '1'
A_BAR_ON_TOP = os.environ.get('AG_A_BAR_ON_TOP', '0') == '1'
# trapezoid between the slanted inner leg edges, measured just above and below the bar
_e = 0.01 * capH
_tl, _tr = opening(A, a_bar[1] + _e, ax0, ax1)      # in the counter, above the bar
_bl, _br = opening(A, a_bar[0] - _e, ax0, ax1)      # in the opening, below the bar
abar_pts = [T(_tl, a_bar[1] + _e), T(_tr, a_bar[1] + _e), T(_br, a_bar[0] - _e), T(_bl, a_bar[0] - _e)]
abar_poly = ' '.join('%.1f,%.1f' % xy for xy in abar_pts)

# Optional: thicken the A crossbar by AG_A_BAR_THICKEN px on each side,
# filling between the slanted inner leg edges so it merges with the legs.
thick_px = float(os.environ.get('AG_A_BAR_THICKEN', 0))
a_thick = ''
a_top_svg, a_bot_svg = a_bar_y
if thick_px > 0:
    t = thick_px / s; pad = 1.0 / s
    tl, tr = opening(A, a_bar[1] + t, ax0, ax1)
    bl, br = opening(A, a_bar[0] - t, ax0, ax1)
    pts = [T(tl - pad, a_bar[1] + t), T(tr + pad, a_bar[1] + t), T(br + pad, a_bar[0] - t), T(bl - pad, a_bar[0] - t)]
    a_thick = '<polygon class="aura" points="%s"/>' % ' '.join('%.1f,%.1f' % xy for xy in pts)
    a_top_svg, a_bot_svg = T(0, a_bar[1] + t)[1], T(0, a_bar[0] - t)[1]

# Optional: tilt the halo (back higher, front lower, as if seen slightly from
# above) just enough that both bars sit inside the ring's opening.
if os.environ.get('AG_TILT', '0') == '1':
    top = min(a_top_svg, g_bar_y[0]); bot = max(a_bot_svg, g_bar_y[1])
    cy = (top + bot) / 2
    need = (bot - top) / 2 + sw / 2 + float(os.environ.get('AG_TILT_GAP', 3))
    xs_check = [a_l, a_r, gb0, (gb0 + x_right) / 2]
    fs = [max(0.2, (1 - ((x - cx) / rx) ** 2) ** 0.5) for x in xs_check]
    ry = min(40, max(need / f for f in fs))
gbar_clip = (gb0 - 1, g_bar_y[0] - 1, x_right - gb0 + 2, g_bar_y[1] - g_bar_y[0] + 2)

def svg(aura_css, tile=False):
    W, H = (420, 420) if tile else (520, 340)
    vb = "0 0 420 420" if tile else "-50 -20 520 340"
    bg = '<rect width="420" height="420" rx="72" fill="#0E1A22"/>\n  ' if tile else ''
    shift = ' transform="translate(0 60)"' if tile else ''
    r = lambda t: 'x="%.1f" y="%.1f" width="%.1f" height="%.1f"' % t
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" width="{W}" height="{H}" role="img" aria-labelledby="t">
  <title id="t">AuraGen</title>
  <defs>
    <!-- AuraGen brand colors: A = "Aura" navy / white, G = "Gen" emerald -->
    <linearGradient id="gen-green" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#1FC995"/>
      <stop offset="1" stop-color="#0FA877"/>
    </linearGradient>

    <!-- Golden halo -->
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#B8860B"/>
      <stop offset="0.3" stop-color="#F5C542"/>
      <stop offset="0.5" stop-color="#FFD23F"/>
      <stop offset="0.7" stop-color="#F5C542"/>
      <stop offset="1" stop-color="#B8860B"/>
    </linearGradient>

    <filter id="glow" filterUnits="userSpaceOnUse" x="-60" y="-60" width="540" height="420">
      <!-- tight hot core -->
      <feGaussianBlur in="SourceAlpha" stdDeviation="4" result="a1"/>
      <feFlood flood-color="#FFE27A"/>
      <feComposite in2="a1" operator="in" result="core"/>
      <!-- bright bloom -->
      <feGaussianBlur in="SourceAlpha" stdDeviation="12" result="a2"/>
      <feComponentTransfer in="a2" result="a2b"><feFuncA type="linear" slope="1.8"/></feComponentTransfer>
      <feFlood flood-color="#FFC21A"/>
      <feComposite in2="a2b" operator="in" result="bloom"/>
      <!-- wide light spill -->
      <feGaussianBlur in="SourceAlpha" stdDeviation="30" result="a3"/>
      <feComponentTransfer in="a3" result="a3b"><feFuncA type="linear" slope="2.2"/></feComponentTransfer>
      <feFlood flood-color="#F5B000"/>
      <feComposite in2="a3b" operator="in" result="spill"/>
      <feMerge>
        <feMergeNode in="spill"/>
        <feMergeNode in="bloom"/>
        <feMergeNode in="core"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>

    <filter id="soft" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="1.2"/>
    </filter>

    <!-- Back half of the halo (behind the letters) / front half (over them) -->
    <clipPath id="back-half"><rect x="-60" y="-60" width="540" height="{cy + 60:.1f}"/></clipPath>
    <clipPath id="front-half"><rect x="-60" y="{cy:.1f}" width="540" height="{360 - cy:.1f}"/></clipPath>

    <!-- Halo turns slightly see-through only where it crosses the midlines, solid gold everywhere else -->
    <mask id="midline-lighten" maskUnits="userSpaceOnUse" x="-60" y="-60" width="540" height="420">
      <rect x="-60" y="-60" width="540" height="420" fill="#fff"/>
      <g fill="#000" fill-opacity="{MIDLINE_SEE_THROUGH}" filter="url(#soft)">
        <rect {r(mA)} rx="2"/>
        <rect {r(mG)} rx="2"/>
      </g>
    </mask>

    <clipPath id="g-bar"><rect {r(gbar_clip)}/></clipPath>
    <clipPath id="a-bar"><polygon points="{abar_poly}"/></clipPath>

    <!-- One shared ellipse so back + front highlights stay in sync -->
    <ellipse id="ring" cx="{cx:.1f}" cy="{cy:.1f}" rx="{rx:.1f}" ry="{ry}" pathLength="100"/>
  </defs>

  <style>
{aura_css}
    .base  {{ fill: none; stroke: url(#gold); stroke-width: {sw:.0f}; }}
    .glint {{ fill: none; stroke: #FFD84A; stroke-width: {sw:.0f}; stroke-linecap: round;
             stroke-dasharray: 16 34; animation: spin 3s linear infinite; }}
    @keyframes spin {{ to {{ stroke-dashoffset: -100; }} }}
    @media (prefers-reduced-motion: reduce) {{ .glint {{ animation: none; }} }}
  </style>

  {bg}<g{shift}>
  <!-- Halo: back half -->
  <g filter="url(#glow)"><g clip-path="url(#back-half)">
    <use href="#ring" class="base"/>
    <use href="#ring" class="glint"/>
  </g></g>

  <!-- G first so the A sits on top where they join -->
  <path fill="url(#gen-green)" d="{dG}"/>
  <path class="aura" d="{dA}"/>
  {a_thick}

  <!-- Halo: front half (slightly lightened over the midlines) -->
  <g mask="url(#midline-lighten)">
    <g filter="url(#glow)"><g clip-path="url(#front-half)">
      <use href="#ring" class="base"/>
      <use href="#ring" class="glint"/>
    </g></g>
  </g>
  {'<!-- A crossbar sits on top of the halo -->' + chr(10) + '  <path class="aura" clip-path="url(#a-bar)" d="' + dA + '"/>' if A_BAR_ON_TOP else ''}
  {'<!-- G bar sits on top of the halo so the G stays legible -->' + chr(10) + '  <path fill="url(#gen-green)" clip-path="url(#g-bar)" d="' + dG + '"/>' if G_BAR_ON_TOP else ''}
  </g>
</svg>
'''

auto = '    .aura { fill: #0E1A36; }\n    @media (prefers-color-scheme: dark) { .aura { fill: #F4F6FA; } }'
light = '    .aura { fill: #0E1A36; }'
dark = '    .aura { fill: #F4F6FA; }'
for suffix, css, tile in [('', auto, False), ('-light', light, False), ('-dark', dark, False), ('-tile', dark, True)]:
    open(os.path.join(outdir, f'{prefix}{suffix}.svg'), 'w').write(svg(css, tile))
print(f'ry={ry:.1f} a_bar={a_bar_y} g_bar={g_bar_y} mid={mid:.1f} cy={cy:.1f} sw={sw:.1f} scale={s:.4f}')
