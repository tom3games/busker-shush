# 喋るなら出ていけ！ 生成したシート（緑背景・3体横並び）を切り抜いて img/*.webp にする。~/tools/pyimg/bin/python art/key.py [シート名...]
# grandma-refill/art/key.py を写した。切り方は okan-door/art/key.py が元。緑の抜き方だけ変えた: スイカの皮や葉の濃い緑を残すため、
# 「外の縁とつながった緑」と「ほぼ真緑」だけを抜く（濃い緑は抜かない）
import numpy as np, os, sys
from PIL import Image, ImageFilter
from PIL import ImageDraw
D = os.path.dirname(os.path.abspath(__file__)); OUT = D + '/../img/'
RAW = os.path.expanduser('~/Desktop/claudecode/_art_raw/busker-shush/')
RIM = 7
MAXH = 520
SHEETS = {
  'mus_a': ['m_play', 'm_look', 'm_shout'],
  'mus_b': ['m_wind', 'm_mic', 'm_bow'],
  'mus_c': ['m_out', 'm_cd', 'm_clap'],
  'you_a': ['y_phone', 'y_pshout', 'y_fly'],
  'you_b': ['y_wait', 'y_whis', 'y_shout'],
  'folks_a': ['mom', 'police', 'tako'],
  'folks_b': ['boss', 'friend', 'date'],
  'date_b': ['d_yes', 'd_bye', 'd_shock'],
  'npc': ['n_aunt', 'n_stream', 'n_suit'],
  'npc_b': ['n_aunt_f', 'n_stream_f', 'n_suit_f'],
}
MANUAL = {'mus_a': [[0, 508], [508, 1012], [1012, 1536]]}
SMALL = {}
BIG = {'m_out': 900}
def alpha(a):
  r, g, b = a[..., 0], a[..., 1], a[..., 2]
  k = g - np.maximum(r, b)
  loose = (k > 50) & (g > 140)
  m = Image.fromarray((loose * 255).astype(np.uint8), 'L'); H, W = loose.shape
  for x in list(range(0, W, 3)) + [W - 1]:
    for y in (0, H - 1):
      if m.getpixel((x, y)) == 255: ImageDraw.floodfill(m, (x, y), 128)
  for y in range(0, H, 3):
    for x in (0, W - 1):
      if m.getpixel((x, y)) == 255: ImageDraw.floodfill(m, (x, y), 128)
  bg = (np.asarray(m) == 128) | ((k > 170) & (g > 215))
  soft = 1 - np.clip((k - 22) / (90 - 22), 0, 1)
  al = np.where(bg, 0, 1.0)
  # 縁だけ柔らかく（背景のすぐ隣の画素）
  bgi = Image.fromarray((bg * 255).astype(np.uint8), 'L').filter(ImageFilter.MaxFilter(3)); near = (np.asarray(bgi) > 0) & ~bg
  al = np.where(near, np.minimum(1, soft + 0.15), al)
  lim = np.maximum(r, b); g2 = np.where(near & (g > lim), lim, g)
  return np.dstack([r, g2, b, al * 255]).clip(0, 255).astype(np.uint8)
def rimmed(im):
  a = im.split()[3].filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.7)); im.putalpha(a)
  rim = a.point(lambda v: 255 if v > 60 else 0).filter(ImageFilter.MaxFilter(RIM * 2 + 1)).filter(ImageFilter.GaussianBlur(0.8))
  paper = Image.new('RGBA', im.size, (255, 253, 246, 0)); paper.putalpha(rim)
  return Image.alpha_composite(paper, im)
def segments(mask):
  col = mask.sum(0) > 2
  segs, s = [], None
  for x, v in enumerate(col):
    if v and s is None: s = x
    if not v and s is not None: segs.append([s, x]); s = None
  if s is not None: segs.append([s, len(col)])
  mass = lambda sg: mask[:, sg[0]:sg[1]].sum()
  while len(segs) > 3:
    i = min(range(len(segs)), key=lambda k: mass(segs[k]))
    if i == 0: j = 1
    elif i == len(segs) - 1: j = i - 1
    else: j = i - 1 if segs[i][0] - segs[i - 1][1] < segs[i + 1][0] - segs[i][1] else i + 1
    a, b = sorted([i, j]); segs[a] = [segs[a][0], segs[b][1]]; del segs[b]
  return segs
def cut(sheet, names):
  src = RAW + sheet + '.png'
  if not os.path.exists(src): print('なし', sheet); return
  rgba = alpha(np.asarray(Image.open(src).convert('RGB')).astype(np.float32))
  if sheet in MANUAL:
    for i, (x0, x1) in enumerate(MANUAL[sheet]):
      pass
  mask = rgba[..., 3] > 128
  segs = MANUAL.get(sheet) or segments(mask)
  if len(segs) != 3: print('列が3つに割れない', sheet, segs); return
  for (x0, x1), name in zip(segs, names):
    src_rgba = rgba
    if sheet in MANUAL:
      src_rgba = rgba.copy(); src_rgba[:, :x0, 3] = 0; src_rgba[:, x1:, 3] = 0
    rows = np.where(mask[:, x0:x1].sum(1) > 0)[0]; y0, y1 = rows[0], rows[-1] + 1
    pad = RIM + 4
    box = (max(0, x0 - pad), max(0, y0 - pad), min(rgba.shape[1], x1 + pad), min(rgba.shape[0], y1 + pad))
    im = rimmed(Image.fromarray(src_rgba[box[1]:box[3], box[0]:box[2]].copy(), 'RGBA'))
    mh = BIG.get(name) or SMALL.get(name, MAXH)
    s = min(1, mh / im.height, (700 if name in BIG else 600) / im.width)
    if s < 1: im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    if name.startswith('_'): continue
    im.save(OUT + name + '.webp', quality=86, method=6)
    print(name, im.size, os.path.getsize(OUT + name + '.webp'))
for k in (sys.argv[1:] or SHEETS):
  cut(k, SHEETS[k])
