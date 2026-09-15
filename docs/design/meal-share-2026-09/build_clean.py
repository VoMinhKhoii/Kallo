import re
KCAL, UNITS = 1040, 20

# Bright, not muted. Index 0 is always you.
BRIGHT = [
    ('#141413', '#fff'),   # 1 black  — you, always
    ('#12B76A', '#fff'),   # 2 green
    ('#FFB020', '#141413'),# 3 amber
    ('#FF8A6B', '#141413'),# 4 salmon
    ('#F04438', '#fff'),   # 5 red
    ('#2E90FA', '#fff'),   # 6 blue
]

def av(ini, idx, size=30, x=True, ring=True, shape='pin'):
    bg, fg = BRIGHT[idx]
    xb = (f'<div class="xb"><svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg></div>'
          if x else '')
    fs = max(10, int(size*0.34))
    if shape == 'pin':
        return (f'<div class="pinwrap" style="width:{size}px;height:{size}px">'
                f'<div class="pin" style="width:{size}px;height:{size}px;background:{bg};color:{fg}">'
                f'<span style="font-size:{fs}px">{ini}</span></div>{xb}</div>')
    border = 'border:2px solid #fff;' if ring else ''
    return (f'<div class="avwrap" style="width:{size}px;height:{size}px">'
            f'<div class="av" style="width:{size}px;height:{size}px;background:{bg};color:{fg};'
            f'font-size:{fs}px;{border}">{ini}</div>{xb}</div>')

def control(people, h=52, gap=2, avatar=30, radius=6, notches=True, labels=True):
    """people: [(name, initials, parts)] in seat order; seat 0 is you."""
    assert sum(p[2] for p in people) == UNITS
    lab = []
    for i, (name, ini, parts) in enumerate(people):
        kc = round(KCAL * parts / UNITS)
        lab.append(f'<div class="nlab" style="flex:{parts}">'
                   f'<div class="nkcal">{kc}</div>{av(ini, i, avatar, x=(i>0))}</div>')
    cells, run, notch = [], 0, []
    for i, (_, _, parts) in enumerate(people):
        bg = BRIGHT[i][0]
        for _ in range(parts):
            cells.append(f'<div class="bcell" style="background:{bg};border-radius:{radius}px"></div>')
        run += parts
        if i < len(people) - 1:
            notch.append(f'<div class="nnotch" style="left:{run/UNITS*100:.4f}%"><i></i></div>')
    return f'''<div class="ncontrol">
  {'<div class="nlabels" style="height:66px">' + ''.join(lab) + '</div>' if labels else ''}
  <div class="batt"><div class="bshell" style="height:{h}px">
    <div class="bcells" style="gap:{gap}px">{''.join(cells)}</div>
    {''.join(notch) if notches else ''}
  </div><div class="bnub"></div></div>
</div>'''

def addrow(name, ini, dim=False):
    return f'''<div class="frow addrow" style="padding:9px 0;{'opacity:.45' if dim else ''}">
      <div class="av" style="background:var(--track);color:var(--soft)">{ini}</div>
      <div class="fname">{name}</div></div>'''

b1=open('docs/design/meal-share-2026-09/Share.dc.html').read()
base=re.search(r'<style>(.*?)</style>', b1, re.S).group(1)
b2=open('docs/design/meal-share-2026-09/Directions.dc.html').read()
dirs=re.search(r'/\* ---- direction board additions ---- \*/(.*?)</style>', b2, re.S).group(1)
b3=open('docs/design/meal-share-2026-09/Battery.dc.html').read()
batt=re.search(r'/\* ---- battery portion control ---- \*/(.*?)</style>', b3, re.S).group(1)
b4=open('docs/design/meal-share-2026-09/Notches.dc.html').read()
notch=re.search(r'/\* ---- notched multi-thumb meter ---- \*/(.*?)</style>', b4, re.S).group(1)

CSS = """
/* ---- final: bright seats, removable avatars, add-list ---- */
.avwrap{position:relative;flex:none}
.pinwrap{position:relative;flex:none}
.pin{border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:grid;place-items:center;
  box-shadow:0 3px 7px rgba(20,20,19,.26);border:2px solid #fff;overflow:hidden}
.pin span{transform:rotate(45deg);display:block;line-height:1;letter-spacing:-.2px;font-weight:600}
.pin img{width:100%;height:100%;object-fit:cover;transform:rotate(45deg) scale(1.42)}
.avwrap .av{box-shadow:0 1px 3px rgba(20,20,19,.20)}
.xb{position:absolute;top:-5px;right:-5px;width:17px;height:17px;border-radius:50%;
  background:#fff;box-shadow:0 0 0 1px var(--border),0 1px 2px rgba(20,20,19,.20);
  display:grid;place-items:center}
.xb svg{width:9px;height:9px;stroke:var(--soft);stroke-width:3;fill:none;stroke-linecap:round}
.plus{width:26px;height:26px;border-radius:50%;border:1.5px solid var(--border);
  display:grid;place-items:center;flex:none}
.plus svg{width:14px;height:14px;stroke:var(--ink);stroke-width:2;fill:none;stroke-linecap:round}
.addrow .av{width:32px;height:32px;font-size:12px}
.emptyadd{border:1px dashed var(--border);border-radius:12px;padding:13px;text-align:center}
.addlane{position:relative;overflow:hidden;margin-top:2px}
.lanefade{position:absolute;left:0;right:0;bottom:0;height:34px;pointer-events:none;
  background:linear-gradient(to bottom,rgba(255,255,255,0),#fff)}
"""



def seg(left, right, sel='right', w=358):
    L = 'border-radius:17px;background:#fff;box-shadow:0 1px 3px rgba(20,20,19,.10)' if sel=='left' else 'color:var(--muted)'
    R = 'border-radius:17px;background:#fff;box-shadow:0 1px 3px rgba(20,20,19,.10)' if sel=='right' else 'color:var(--muted)'
    return (f'<div style="display:flex;height:40px;border-radius:20px;background:var(--track);padding:3px;width:{w}px">'
            f'<div style="flex:1;{L};display:grid;place-items:center;font-size:15px">{left}</div>'
            f'<div style="flex:1;{R};display:grid;place-items:center;font-size:15px">{right}</div></div>')

def full_batteries(people, h=44):
    """Nguyen phan: one full battery each, at the SAME unit size as the split
    meter — floor(20 / n) units apiece, so a cell never changes width."""
    n = len(people)
    per = UNITS // n
    out_ = []
    for i,(name,ini,_) in enumerate(people):
        bg = BRIGHT[i][0]
        cells = "".join(f'<div class="bcell" style="background:{bg};border-radius:5px"></div>'
                        for _ in range(per))
        out_.append(f'''<div style="flex:{per};min-width:0">
          <div class="nlab" style="flex:1"><div class="nkcal">{KCAL:,}</div>{av(ini,i,30,x=(i>0))}</div>
          <div class="batt"><div class="bshell" style="height:{h}px;padding:3px">
            <div class="bcells" style="gap:2px">{cells}</div></div>
            <div class="bnub" style="height:15px;width:4px"></div></div></div>'''.replace(
            f'{KCAL:,}', f'{KCAL:,}'.replace(',', '.')))
    return f'''<div style="display:flex;gap:12px;align-items:flex-end">{"".join(out_)}</div>'''

def sheet_header(title, subtitle):
    """The app's own header (kallo_sheet_header.dart): 36x5 grabber, X on the
    LEFT at a 44pt target on the content-inset line, centred 16/600 title,
    centred 14 muted subtitle, 44pt mirror on the right."""
    return f'''<div style="padding-top:8px">
      <div style="width:36px;height:5px;border-radius:2.5px;background:var(--border);margin:0 auto"></div>
      <div style="display:flex;align-items:center;padding:8px 16px 4px">
        <div style="width:44px;height:44px;display:flex;align-items:center">
          <svg style="width:20px;height:20px;stroke:var(--muted);stroke-width:1.7;fill:none;
               stroke-linecap:round" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg></div>
        <div style="flex:1;text-align:center">
          <div style="font-size:16px;font-weight:600;letter-spacing:-.3px">{title}</div>
          <div class="meta" style="margin-top:2px;white-space:nowrap;overflow:hidden;
               text-overflow:ellipsis">{subtitle}</div></div>
        <div style="width:44px;height:44px"></div>
      </div></div>'''

HEAD = f"""<!doctype html>
<html><head><meta charset="utf-8">
<title>Kallo — the share sheet, cleaned up</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600&family=Lora:ital,wght@0,400;1,300&display=swap">
<style>{base}{dirs}{batt}{notch}{CSS}
.frame{{background:#fff;border:1px solid var(--borderSoft);border-radius:14px;padding:18px 16px}}
.fstep{{font-size:11px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:var(--muted);margin-bottom:12px}}
.ftime{{font-size:12px;color:var(--muted);margin-top:10px}}
.seq{{display:flex;gap:14px;align-items:stretch}}
.seq > div{{flex:1;min-width:0}}
.morphnote{{border-left:2px solid var(--accent);padding-left:14px;margin-top:16px}}
.morphnote p{{margin:0 0 7px;font-size:13px;line-height:1.55;color:var(--soft)}}
.morphnote p:last-child{{margin-bottom:0}}
</style>
</head><body>
<div class="board" style="width:2260px">
<h1>The sheet, <em>cleaned up</em></h1>
<p class="sub">Captions gone, the consequence folded into the button, the notch fixed so its ends are actually
round, the pins lifted clear of the shell and their points sharpened. Plus the tab morph, drawn frame by frame.</p>
"""

out=[HEAD]

def wide_cta(n, kcal):
    return f'Chia sẻ với {n} người · còn {kcal:,}'.replace(',', '.') + ' kcal'

def sheet3(people, adds, mode, tag, title, note, height=636, kcal_left=None, lane=None):
    lane = lane if lane is not None else (150 if mode == 'split' else 207)
    add_html = "".join(addrow(n,i)+'<div class="gsep" style="margin-left:46px"></div>' for n,i in adds)
    add_html = add_html.removesuffix('<div class="gsep" style="margin-left:46px"></div>')
    if not adds:
        add_html = '<div class="emptyadd"><span class="meta">Đã thêm tất cả bạn bè.</span></div>'
    if mode == 'split':
        body = f'''<div style="margin-top:20px">{control(people)}</div>
          <div style="display:flex;justify-content:flex-end;margin-top:8px">
            <span class="meta" style="color:var(--ink)">Chia đều</span></div>'''
        keep = kcal_left if kcal_left is not None else round(KCAL*people[0][2]/UNITS)
    else:
        body = f'''<div style="margin-top:20px">{full_batteries(people, h=40)}</div>'''
        keep = KCAL
    return f'''
  <div class="cell">
    <div class="vtag">{tag}</div><div class="vname">{title}</div>
    <div class="phone" style="margin-top:10px"><div class="island"></div><div class="screen">
      <div class="sbar"><span>9:41</span><span>●●●</span></div>
      <div class="dim"></div>
      <div class="sheet" style="height:{height}px;padding-bottom:0">
        {sheet_header('Chia sẻ bữa ăn', 'Bánh mì thịt nướng + trà đá')}
        <div style="padding:8px 16px 0">
          <div>{seg('Nguyên phần','Chia phần','left' if mode=='whole' else 'right', w=358)}</div>
          {body}
          <div class="meta" style="margin-top:20px">Thêm bạn bè</div>
          <div class="addlane" style="height:{lane}px">{add_html}
            <div class="lanefade"></div></div>
        </div>
        <div style="padding:14px 16px 26px;border-top:1px solid var(--borderFaint)">
          <div class="wide">{wide_cta(len(people)-1, keep)}</div>
        </div>
      </div>
      <div class="homebar"></div>
    </div></div>
    <p class="cap">{note}</p>
  </div>'''

# ---------- the sheets ----------
out.append('''
<div class="band">The sheet, with everything stripped out</div>
<p class="bandnote">No portion caption, no “Bạn 40%”, no consequence sentence. The button carries the one number
that mattered. The add lane is a fixed height, so the button sits in the same place whether one friend is left
in the list or nine.</p>
<div class="row">''')

out.append(sheet3([('Bạn','B',10),('Mai','MN',10)],
    [('Thu Hà','TH'),('Quốc Anh','QA'),('Lan Phương','LP')], 'split',
    'Chia phần','Two people, even',
    '<b>Opens here.</b> One pill on the boundary, two pins, and a button that says what you keep.'))

out.append(sheet3([('Bạn','B',8),('Mai','MN',4),('Thu Hà','TH',5),('Quốc Anh','QA',3)],
    [('Lan Phương','LP')], 'split',
    'Chia phần','Four seats, one friend left',
    'Two rows fewer in the lane than the sheet to its left — <b>and the button has not moved a pixel.</b>'))

out.append(sheet3([('Bạn','B',0),('Mai','MN',0),('Thu Hà','TH',0)],
    [('Quốc Anh','QA'),('Lan Phương','LP')], 'whole',
    'Nguyên phần','Everyone gets a full one',
    'Three full batteries, no caption needed — the drawing already says nobody is sharing anything. '
    '“còn 1.040 kcal” because your own meal is untouched.'))
out.append('</div>')

# ---------- morph storyboard ----------
def morph(groups, gap, outer, inner, notches, ms, caption, h=50):
    """groups: [(cells, seatIndex, weight)] — weight drives the run width."""
    inner_html = []
    for gi,(cells, si, w) in enumerate(groups):
        bg = BRIGHT[si][0]
        cs = "".join(f'<div class="bcell" style="background:{bg};border-radius:5px"></div>' for _ in range(cells))
        nub = (f'<div class="bnub" style="opacity:{inner};height:14px;width:4px;margin-left:2px"></div>'
               if inner > 0 else '')
        inner_html.append(
            f'<div style="flex:{w};display:flex;align-items:center;min-width:0">'
            f'<div style="flex:1;align-self:stretch;display:flex;gap:2px;padding:3px;'
            f'border-radius:11px;border:2px solid rgba(20,20,19,{inner});min-width:0">{cs}</div>{nub}</div>')
    notch_html = ''
    if notches:
        run = 0; total = sum(g[2] for g in groups); pos = []
        for g in groups[:-1]:
            run += g[2]; pos.append(run/total*100)
        notch_html = "".join(
            f'<div class="nnotch" style="left:{p:.2f}%;opacity:{notches}"><i></i></div>' for p in pos)
    return f'''<div>
      <div class="fstep">{ms}</div>
      <div class="batt"><div class="bshell" style="height:{h}px;padding:4px;overflow:visible;
        border-color:rgba(20,20,19,{outer});position:relative">
        <div style="flex:1;display:flex;gap:{gap}px;min-width:0">{''.join(inner_html)}</div>
        {notch_html}
      </div><div class="bnub" style="opacity:{outer}"></div></div>
      <div class="ftime">{caption}</div>
    </div>'''

S = [(7,0,7),(7,1,7),(6,2,6)]          # split: 7 / 7 / 6 parts
M = [(6,0,6.5),(6,1,6.5),(5,2,6)]      # mid: runs converging, cells shedding
W = [(4,0,1),(4,1,1),(4,2,1)]          # whole: four cells each, equal

out.append(f'''
<div class="band">Morphing between the two tabs</div>
<p class="bandnote">The two states share their atoms — coloured cells belonging to named people — so the switch
should be one continuous object changing shape, never a cross-fade between two different drawings.</p>
<div class="frame">
  <div class="seq">
    {morph(S, 0, 1, 0, 1, '0 ms', 'Chia phần. One shell, twenty parts, pills on the boundaries.')}
    {morph(S, 4, 0.55, 0.22, 0, '110 ms', 'Pills fade first. Gaps begin opening at the boundaries they were sitting on.')}
    {morph(M, 9, 0.18, 0.62, 0, '220 ms', 'Runs converge toward equal width; each group grows its own shell as the outer one lets go. Spare cells fade out at the trailing edge.')}
    {morph(W, 14, 0, 1, 0, '320 ms', 'Nguyên phần. Three shells, three nubs, every battery full.')}
  </div>
  <div class="morphnote">
    <p><b>What is actually animated.</b> Four things, all on the same 320 ms curve: run width (parts fraction → equal), gap (0 → 14pt), outer shell border alpha (1 → 0) against inner shell border alpha (0 → 1), and cell count at the trailing edge of each run.</p>
    <p><b>Cells are keyed by person, not by index.</b> The seventh black cell in the split state is the same widget as the fourth black cell in the whole state — that is what makes it read as one object rearranging rather than two pictures swapping. In Flutter this is an <code>AnimatedList</code> keyed on <code>(userId, cellIndex)</code> inside a <code>LayoutBuilder</code>, not an <code>AnimatedCrossFade</code>.</p>
    <p><b>The pins never move.</b> They stay centred over their run the whole way through, so the faces are the fixed points the eye tracks while everything under them rearranges. Only their kcal number tweens — from the split share up to the full 1.040, counting as it goes.</p>
    <p><b>Reverse is the same timeline played backwards</b>, which is why the gap has to close onto exactly the boundary a pill will reappear at. Assembling and disassembling are one animation, not two.</p>
  </div>
</div>''')

out.append('''
<p style="margin:46px 0 0;font-size:12px;color:var(--muted)">Kallo · meal sharing · cleaned sheet + morph · 2026-09-15</p>
</div></body></html>''')

open('docs/design/meal-share-2026-09/Clean.dc.html','w').write("".join(out))
print("written")
