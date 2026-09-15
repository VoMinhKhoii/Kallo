import re
KCAL, UNITS = 1040, 20

# Bright, not muted. Index 0 is always you.
BRIGHT = [
    ('#141413', '#fff'),   # black  — you
    ('#12B76A', '#fff'),   # green  — first friend
    ('#F04438', '#fff'),   # red
    ('#FF8A6B', '#141413'),# salmon
    ('#FFB020', '#141413'),# amber  — only if we go past four
    ('#2E90FA', '#fff'),   # blue   — only if we go past five
]

def av(ini, idx, size=30, x=True, ring=True):
    bg, fg = BRIGHT[idx]
    border = 'border:2px solid #fff;' if ring else ''
    xb = (f'<div class="xb"><svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg></div>'
          if x else '')
    return (f'<div class="avwrap" style="width:{size}px;height:{size}px">'
            f'<div class="av" style="width:{size}px;height:{size}px;background:{bg};color:{fg};'
            f'font-size:{max(10,int(size*0.36))}px;{border}">{ini}</div>{xb}</div>')

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
  {'<div class="nlabels" style="height:56px">' + ''.join(lab) + '</div>' if labels else ''}
  <div class="batt"><div class="bshell" style="height:{h}px">
    <div class="bcells" style="gap:{gap}px">{''.join(cells)}</div>
    {''.join(notch) if notches else ''}
  </div><div class="bnub"></div></div>
</div>'''

def addrow(name, ini, dim=False):
    return f'''<div class="frow addrow" style="padding:9px 0;{'opacity:.45' if dim else ''}">
      <div class="av" style="background:var(--track);color:var(--soft)">{ini}</div>
      <div class="fname">{name}</div>
      <div class="plus"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></div></div>'''

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
"""

HEAD = f"""<!doctype html>
<html><head><meta charset="utf-8">
<title>Kallo — bright seats, removable, add-only list</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600&family=Lora:ital,wght@0,400;1,300&display=swap">
<style>{base}{dirs}{batt}{notch}{CSS}</style>
</head><body>
<div class="board" style="width:2320px">
<h1>Bright seats, <em>removable, and an add-only list</em></h1>
<p class="sub">Black is always you. Green is always the first person you add, then red, then salmon. Everyone
at the table already sits above the battery wearing their share, so the list underneath stops being a picker
and becomes a place to add the people who are not there yet. Tap the × on a face to take them back out.</p>
"""

def sheet(people, adds, cta, consequence, mode='split', height=690, note='', tag='', title=''):
    add_html = "".join(
        (f'{addrow(n, i)}<div class="gsep" style="margin-left:46px"></div>') for n, i in adds)
    add_html = add_html.rstrip().removesuffix('<div class="gsep" style="margin-left:46px"></div>')
    if not adds:
        add_html = ('<div class="emptyadd"><span class="meta">Đã thêm tất cả bạn bè.</span></div>')
    portion = (f'''<div style="margin-top:22px">{control(people)}</div>
          <div style="display:flex;justify-content:space-between;margin-top:10px">
            <span class="meta">Bạn {round(people[0][2]/UNITS*100)}%</span>
            <span class="meta" style="color:var(--ink)">Chia đều</span>
          </div>''' if mode == 'split' else f'''<div style="margin-top:22px">
            <div class="nlabels" style="height:56px;justify-content:flex-start;gap:14px">
              {''.join(f'<div class="nlab" style="flex:0 0 auto">{av(i, k, 30, x=(k>0))}</div>'
                       for k, (n, i, p) in enumerate(people))}
            </div>
            <div class="meta" style="margin-top:4px">Mỗi người nhận đủ một phần bữa này.</div>
          </div>''')
    return f'''
  <div class="cell">
    {f'<div class="vtag">{tag}</div><div class="vname">{title}</div>' if tag else ''}
    <div class="phone" style="margin-top:10px"><div class="island"></div><div class="screen">
      <div class="sbar"><span>9:41</span><span>●●●</span></div>
      <div class="dim"></div>
      <div class="sheet" style="height:{height}px;padding-bottom:0">
        <div class="grab"></div>
        <div style="padding:16px 16px 0">
          <div style="font-size:28px;font-weight:600;letter-spacing:-.6px;line-height:1.15">Chia sẻ bữa ăn</div>
          <div class="meta" style="margin-top:5px">Bánh mì thịt nướng + trà đá · 1.040 kcal</div>
          <div style="display:flex;height:40px;border-radius:20px;background:var(--track);padding:3px;margin-top:16px">
            <div style="flex:1;{'border-radius:17px;background:#fff;box-shadow:0 1px 3px rgba(20,20,19,.10)' if mode=='copy' else 'color:var(--muted)'};display:grid;place-items:center;font-size:16px">Bản sao</div>
            <div style="flex:1;{'border-radius:17px;background:#fff;box-shadow:0 1px 3px rgba(20,20,19,.10)' if mode=='split' else 'color:var(--muted)'};display:grid;place-items:center;font-size:16px">Chia phần</div>
          </div>
          {portion}
          <div class="meta" style="margin-top:20px">Thêm người</div>
          <div style="margin-top:2px">{add_html}</div>
        </div>
        <div style="padding:14px 16px 26px">
          <div class="meta" style="margin-bottom:11px">{consequence}</div>
          <div class="wide">{cta}</div>
        </div>
      </div>
      <div class="homebar"></div>
    </div></div>
    <p class="cap">{note}</p>
  </div>'''

out = [HEAD]

# ---------- seats ----------
out.append('''
<div class="band">The seats</div>
<p class="bandnote">Fixed order, so the colour means the same thing every time you open the sheet. Black is you
and never moves; the next person to be added takes green, then red, then salmon.</p>
<div class="row" style="flex-wrap:wrap;gap:28px">''')

for tag, ppl, note in [
  ('Two', [('Bạn','B',10),('Mai Ngọc','MN',10)],
   'The default. <b>Black and green</b>, ten parts each — today’s even split, unchanged.'),
  ('Three', [('Bạn','B',7),('Mai Ngọc','MN',7),('Thu Hà','TH',6)],
   'Red joins. Even thirds are 7/7/6 at this step — <b>35 / 35 / 30</b>, visibly not equal.'),
  ('Four', [('Bạn','B',8),('Mai','MN',4),('Thu Hà','TH',5),('Quốc Anh','QA',3)],
   'Salmon fills the last named seat. <b>Four colours, four people — the palette is exactly full here.</b>'),
  ('Five', [('Bạn','B',6),('Mai','MN',4),('Thu Hà','TH',4),('Quốc Anh','QA',3),('Lan Phương','LP',3)],
   'A fifth person needs a fifth colour. Amber is drawn in as a placeholder — <b>your call whether to extend '
   'the palette or cap split mode at four.</b>'),
]:
    out.append(f'''
  <div style="width:1080px">
    <div class="vtag">{tag}</div>
    <div class="panel" style="margin-top:10px">{control(ppl)}</div>
    <p class="vcap">{note}</p>
  </div>''')
out.append('</div>')

# ---------- remove ----------
out.append('''
<div class="band">Removing someone</div>
<p class="bandnote">The × rides the top-right of every face except yours. Tap it and that person’s parts flow
back to the neighbours, the seat colours close up, and their name reappears in the add list below.</p>
<div class="row" style="gap:28px;flex-wrap:wrap">''')
out.append(f'''
  <div style="width:1080px">
    <div class="vtag">Before</div><div class="vname">Thu Hà holds five parts</div>
    <div class="panel" style="margin-top:10px">{control([('Bạn','B',8),('Mai','MN',4),('Thu Hà','TH',5),('Quốc Anh','QA',3)])}</div>
    <p class="vcap">Tap the × on Thu Hà.</p>
  </div>
  <div style="width:1080px">
    <div class="vtag">After</div><div class="vname">Her parts rejoin the pool, colours close up</div>
    <div class="panel" style="margin-top:10px">{control([('Bạn','B',10),('Mai','MN',6),('Quốc Anh','QA',4)])}</div>
    <p class="vcap"><b>Quốc Anh moves from salmon to red</b> — seats are positional, not personal. The
    alternative (colour follows the person) means a gap in the palette after any removal, which looks broken.
    The cost is that everyone shifts hue when someone leaves, so the transition wants a 200 ms colour tween
    rather than a hard cut.</p>
  </div>''')
out.append('</div>')

# ---------- in the sheet ----------
out.append('''
<div class="band">In the sheet</div>
<p class="bandnote">The list below the meter now holds only people who are <i>not</i> at the table. Adding is a
tap on the +; removing is the × on the face. Nothing appears in two places at once.</p>
<div class="row">''')

out.append(sheet(
    [('Bạn','B',10),('Mai Ngọc','MN',10)],
    [('Thu Hà','TH'),('Quốc Anh','QA'),('Lan Phương','LP')],
    'Chia với Mai Ngọc', 'Bữa đã ghi của bạn sẽ giảm còn 520 kcal.',
    tag='Default', title='One friend, even',
    note='<b>Opens here.</b> Black and green at ten parts each. Three friends left in the add list.'))

out.append(sheet(
    [('Bạn','B',8),('Mai','MN',4),('Thu Hà','TH',5),('Quốc Anh','QA',3)],
    [('Lan Phương','LP')],
    'Chia với 3 người', 'Bữa đã ghi của bạn sẽ giảm còn 416 kcal.',
    tag='Full table', title='Four seats, one left to add',
    note='Four faces, four notches, one row left below. <b>The meter is the roster</b> — the list is just the '
         'door. Note how short the sheet gets as people move up out of the list.'))

out.append(sheet(
    [('Bạn','B',5),('Mai','MN',5),('Thu Hà','TH',5),('Quốc Anh','QA',5)],
    [],
    'Chia với 3 người', 'Bữa đã ghi của bạn sẽ giảm còn 260 kcal.',
    tag='Empty list', title='Everyone added',
    note='<b>The add list empties out</b> rather than vanishing, so the section does not pop in and out as you '
         'add the last person. A dashed rule and one muted line is enough.'))

out.append(sheet(
    [('Bạn','B',5),('Mai','MN',5),('Thu Hà','TH',5),('Quốc Anh','QA',5)],
    [('Lan Phương','LP')],
    'Gửi cho 3 người', 'Bữa của bạn giữ nguyên.', mode='copy', height=600,
    tag='Copy mode', title='Same roster, no meter',
    note='<b>Copy keeps the face row and drops the battery.</b> The people you picked stay visible in exactly '
         'the same place, so switching modes moves one block instead of rebuilding the sheet. No kcal above the '
         'faces here — everyone gets the whole dish.'))
out.append('</div>')

# ---------- notes ----------
out.append('''
<div class="band">What this settles, and what it opens</div>
<div style="display:flex;gap:70px;margin-top:20px">
<div class="leg">
  <div class="n good">1</div><p><b>Nothing is listed twice.</b> A person is either a face above the meter or a row below it, never both. That kills the checkmark column, the selected-row wash, and the “which of these is on?” scan entirely.</p>
  <div class="n good">2</div><p><b>Add and remove are different gestures in different places</b> — a + on a row, an × on a face. Reversible, obvious, and neither one is a long-press or a swipe.</p>
  <div class="n">3</div><p><b>Bright is a deliberate break from the design system.</b> <code>mobile.md</code> says no pure red and no pure green; these are #F04438 and #12B76A. I am following your call, but it should be a named exception in the spec, scoped to this control, so the next person does not “fix” it back to sage and terracotta.</p>
</div>
<div class="leg">
  <div class="n">4</div><p><b>Four colours means four people.</b> Past that we either extend the palette (amber, then blue — drawn above) or cap split mode at four and fall back to copy. The 10% floor separately caps it at ten, so the palette is now the binding constraint. <b>Needs your call.</b></p>
  <div class="n">5</div><p><b>Red on a face is not an error.</b> Red normally means destructive in this app, and here it just means “the second friend”. Worth checking on device — if it reads as a warning next to the × badge, swap red and salmon so the brightest hue is not also the most alarming.</p>
  <div class="n good">6</div><p><b>The × makes the friend list optional.</b> Once people can be removed from the meter, the add list can collapse behind a single “Thêm người” row when there are more than six friends — a push to a full-screen picker, which is the native answer to a long list.</p>
</div>
</div>

<p style="margin:46px 0 0;font-size:12px;color:var(--muted)">Kallo · meal sharing · bright seats · 2026-09-15</p>
</div></body></html>''')

open('docs/design/meal-share-2026-09/Seats.dc.html','w').write("".join(out))
print("written")
