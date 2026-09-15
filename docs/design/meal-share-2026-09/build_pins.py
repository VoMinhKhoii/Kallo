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
.pinwrap{position:relative;flex:none}
.pin{border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:grid;place-items:center;
  box-shadow:0 2px 5px rgba(20,20,19,.24);border:2px solid #fff}
.pin span{transform:rotate(45deg);display:block;line-height:1;letter-spacing:-.2px}
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
<title>Kallo — six seats, pill notches, the ordering rule</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600&family=Lora:ital,wght@0,400;1,300&display=swap">
<style>{base}{dirs}{batt}{notch}{CSS}
.sw{{display:flex;align-items:center;gap:13px;padding:9px 0}}
.swdot{{width:34px;height:34px;border-radius:10px;flex:none;box-shadow:0 1px 3px rgba(20,20,19,.18)}}
.swname{{font-size:16px;flex:1}}
.swhex{{font-size:14px;color:var(--muted);font-family:ui-monospace,SFMono-Regular,monospace}}
.rulebox{{border:1px solid var(--borderSoft);border-radius:12px;padding:14px 16px;margin-top:14px}}
.rulebox p{{margin:0;font-size:13px;line-height:1.55;color:var(--soft)}}
.arrow{{font-size:20px;color:var(--muted);align-self:center;padding:0 4px}}
</style>
</head><body>
<div class="board" style="width:2260px">
<h1>Six seats, <em>pill notches, and the rule that stops the mess</em></h1>
<p class="sub">Black is you and never moves. Green, amber, red, salmon, blue fill in as people join. The notch
is a pill. And yes — notches cannot pass each other; that is the right rule, it is just not the whole answer
to overlap. The section at the bottom shows what else is needed.</p>
"""

out=[HEAD]

# ---------- palette ----------
NAMES = ['Bạn (you)','Ghế 2','Ghế 3','Ghế 4','Ghế 5','Ghế 6']
sw = "".join(
    f'<div class="sw"><div class="swdot" style="background:{BRIGHT[i][0]}"></div>'
    f'<div class="swname">{NAMES[i]}</div><div class="swhex">{BRIGHT[i][0]}</div></div>'
    + ('<div class="gsep full"></div>' if i < 5 else '')
    for i in range(6))

out.append(f'''
<div class="band">The six seats</div>
<p class="bandnote">Seat order is fixed, so a colour means the same thing every time the sheet opens.</p>
<div class="row" style="gap:30px;align-items:flex-start">
  <div style="width:520px"><div class="panel">{sw}</div>
  <p class="vcap"><b>Amber third, salmon fourth, red fifth.</b> The first four seats run black → green →
  amber → salmon, a warm charge-like progression; red only appears at a five-person table, and blue closes it
  out. Pushing red back also keeps the most alarm-coded hue away from the common cases.</p></div>
  <div style="width:1080px">
    <div class="vtag">All six, evenly</div>
    <div class="panel">{control([('Bạn','B',4),('Mai','MN',4),('Thu Hà','TH',3),('Quốc Anh','QA',3),('Lan','LP',3),('Nam','NV',3)])}</div>
    <p class="vcap">Six people at 20 parts: 4/4/3/3/3/3. The palette is full here — a seventh person has no
    seat, so <b>split mode caps at six</b> and a seventh selection falls back to “Bản sao”.</p>
  </div>
</div>''')

# ---------- growing table ----------
out.append('''
<div class="band">As people join</div>
<div class="row" style="flex-wrap:wrap;gap:26px">''')
for tag, ppl in [
  ('Two', [('Bạn','B',10),('Mai','MN',10)]),
  ('Three', [('Bạn','B',7),('Mai','MN',7),('Thu Hà','TH',6)]),
  ('Four', [('Bạn','B',8),('Mai','MN',4),('Thu Hà','TH',5),('Quốc Anh','QA',3)]),
  ('Five', [('Bạn','B',6),('Mai','MN',4),('Thu Hà','TH',4),('Quốc Anh','QA',3),('Lan','LP',3)]),
]:
    out.append(f'''
  <div style="width:1080px"><div class="vtag">{tag}</div>
    <div class="panel" style="margin-top:8px">{control(ppl)}</div></div>''')
out.append('</div>')

# ---------- notch treatments ----------
def notch_demo(cls):
    ppl=[('Bạn','B',12),('Mai','MN',8)]
    html=control(ppl)
    return html.replace('class="nnotch"', f'class="nnotch {cls}"') if cls else html

out.append(f'''
<div class="band">The notch, as a pill</div>
<div class="row" style="gap:30px;flex-wrap:wrap">
  <div style="width:1080px"><div class="vtag">N1</div><div class="vname">Slim pill · 11pt</div>
    <div class="panel" style="margin-top:8px">{notch_demo('')}</div>
    <p class="vcap">Fully rounded, ink hairline, overhanging the shell top and bottom. Reads as a grip without
    eating a whole part’s width. <b>Recommended</b> — at six people a part is only 17.9pt, so the notch has to
    stay narrower than that.</p></div>
  <div style="width:1080px"><div class="vtag">N2</div><div class="vname">Wide pill · 19pt, two grip lines</div>
    <div class="panel" style="margin-top:8px">{notch_demo('wide')}</div>
    <p class="vcap">More obviously draggable, and closer to a real handle. <b>Cost:</b> it is wider than one
    part, so at four or more people the notch covers the cell it is supposed to be pointing at.</p></div>
</div>''')

# ---------- the ordering rule ----------
out.append(f'''
<div class="band">Your ordering rule — yes, and here is the other half</div>
<p class="bandnote">“The notch on the right will never exceed the one on its left.” Correct, and it is already
how a segmented meter has to behave: notches are boundaries, so crossing one would mean a person owns a
negative number of parts. Dragging clamps at the neighbour. But clamping alone does not stop faces colliding.</p>
<div class="row" style="gap:26px;flex-wrap:wrap">
  <div style="width:1080px"><div class="vtag">Clamping only</div>
    <div class="vname">Notch 2 dragged hard left, stopping at notch 1</div>
    <div class="panel" style="margin-top:8px">{control([('Bạn','B',9),('Mai','MN',1),('Thu Hà','TH',7),('Quốc Anh','QA',3)])}</div>
    <p class="vcap"><b>The rule held — and it still looks broken.</b> Mai kept one part. Her run is 17.9pt on a
    phone, her face is 30pt, so she overlaps both neighbours and her kcal number collides with theirs. Ordering
    was never the thing protecting the labels.</p></div>
  <div style="width:1080px"><div class="vtag">Clamping + floor</div>
    <div class="vname">Every notch also stops two parts from its neighbour</div>
    <div class="panel" style="margin-top:8px">{control([('Bạn','B',8),('Mai','MN',2),('Thu Hà','TH',7),('Quốc Anh','QA',3)])}</div>
    <p class="vcap"><b>Two parts — 10% — is the floor</b>, which is also the floor the server needs anyway.
    Combine it with your ordering rule and overlap becomes impossible by construction: no run is ever narrower
    than a face, and no face can ever be to the left of the run it owns.</p></div>
</div>
<div class="rulebox" style="max-width:2180px">
<p><b>So the full rule is two clauses.</b> (1) A notch clamps between its neighbours, so notches never cross —
your rule. (2) A notch stops two parts short of each neighbour, so no run is narrower than the avatar sitting
on it. With 20 parts and a floor of 2, six people fit exactly (12 of 20 parts spoken for, 8 free to move), and
a seventh would not — which is the same place the palette runs out. The two limits agree, which is a good sign.</p>
</div>''')

# ---------- naming the other tab ----------
def seg(left, right, sel='right', w=330):
    L = 'border-radius:17px;background:#fff;box-shadow:0 1px 3px rgba(20,20,19,.10)' if sel=='left' else 'color:var(--muted)'
    R = 'border-radius:17px;background:#fff;box-shadow:0 1px 3px rgba(20,20,19,.10)' if sel=='right' else 'color:var(--muted)'
    return (f'<div style="display:flex;height:40px;border-radius:20px;background:var(--track);padding:3px;width:{w}px">'
            f'<div style="flex:1;{L};display:grid;place-items:center;font-size:15px">{left}</div>'
            f'<div style="flex:1;{R};display:grid;place-items:center;font-size:15px">{right}</div></div>')

out.append(f'''
<div class="band">Renaming “Bản sao”</div>
<p class="bandnote">You are right that it is wrong. “Bản sao” is photocopier language — it describes what the
database does, not what happened at the table. What actually happened is that everybody ate a full serving of
the same dish. The pair has to stay parallel, because the two tabs differ by one idea: whole versus divided.</p>
<div class="row" style="gap:30px;flex-wrap:wrap">
  <div style="width:700px"><div class="vtag">A</div><div class="vname">Nguyên phần / Chia phần</div>
    <div class="panel" style="margin-top:8px">{seg('Nguyên phần','Chia phần', 'left')}
      <p class="vcap" style="margin-top:14px"><b>Recommended.</b> Both tabs turn on the same noun — <i>phần</i>
      — and differ by one word: whole versus divided. “Nguyên” is the everyday word for intact and untouched
      (nguyên con, nguyên đĩa), so “nguyên phần” reads as “a full portion each” with no explanation.</p></div></div>
  <div style="width:700px"><div class="vtag">B</div><div class="vname">Mỗi người một suất / Chia một suất</div>
    <div class="panel" style="margin-top:8px">{seg('Mỗi người 1 suất','Chia 1 suất', 'left')}
      <p class="vcap" style="margin-top:14px"><b>The most explicit, and the most Vietnamese.</b> “Suất” is
      what you actually order — một suất cơm, hai suất phở. It leaves nothing to interpret. <b>Cost:</b> it
      barely fits a 358pt segmented control, and it will not survive a longer language.</p></div></div>
  <div style="width:700px"><div class="vtag">C</div><div class="vname">Cả phần / Chia phần</div>
    <div class="panel" style="margin-top:8px">{seg('Cả phần','Chia phần', 'left')}
      <p class="vcap" style="margin-top:14px">Shortest parallel pair. “Cả” is lighter than “nguyên” and can
      read as “all of it” — which is nearly the opposite of the meaning here when a friend hears “cả phần của
      tôi”. Tightest fit, weakest word.</p></div></div>
</div>''')

# ---------- the battery in whole-portion mode ----------
def full_batteries(people, h=44):
    """W2: one full battery per person, each in their seat colour."""
    out_ = []
    for i,(name,ini,_) in enumerate(people):
        bg = BRIGHT[i][0]
        cells = "".join(f'<div class="bcell" style="background:{bg};border-radius:5px"></div>' for _ in range(4))
        out_.append(f'''<div style="flex:1;min-width:0">
          <div class="nlab" style="flex:1"><div class="nkcal">{KCAL}</div>{av(ini,i,28,x=(i>0))}</div>
          <div class="batt" style="margin-top:4px"><div class="bshell" style="height:{h}px;padding:3px">
            <div class="bcells" style="gap:2px">{cells}</div></div>
            <div class="bnub" style="height:15px;width:4px"></div></div></div>''')
    return f'<div style="display:flex;gap:12px;align-items:flex-end">{"".join(out_)}</div>'

def roster_bar(people):
    """W1: one bar, equal runs, no notches, full kcal above every face."""
    n=len(people); per=UNITS//n; parts=[per]*n
    for k in range(UNITS-per*n): parts[k]+=1
    lab=[]; cells=[]
    for i,((name,ini,_),p) in enumerate(zip(people,parts)):
        lab.append(f'<div class="nlab" style="flex:{p}"><div class="nkcal">{KCAL}</div>{av(ini,i,28,x=(i>0))}</div>')
        bg=BRIGHT[i][0]
        cells += [f'<div class="bcell" style="background:{bg};border-radius:6px"></div>' for _ in range(p)]
    return f'''<div class="ncontrol">
      <div class="nlabels" style="height:66px">{"".join(lab)}</div>
      <div class="batt"><div class="bshell" style="height:52px">
        <div class="bcells" style="gap:2px">{"".join(cells)}</div></div><div class="bnub"></div></div></div>'''

THREE=[('Bạn','B',0),('Mai','MN',0),('Thu Hà','TH',0)]
out.append(f'''
<div class="band">Keeping the battery on the whole-portion tab</div>
<p class="bandnote">The problem to solve: a divided bar means “one dish, split”. On this tab nothing is being
divided, so the same drawing would lie. Two ways to keep the meter and still tell the truth.</p>
<div class="row" style="gap:30px;flex-wrap:wrap">
  <div style="width:1080px"><div class="vtag">W1</div><div class="vname">One bar as a roster</div>
    <div class="panel" style="margin-top:8px">{roster_bar(THREE)}
    <div class="meta" style="margin-top:10px">Mỗi người nhận đủ 1.040 kcal.</div></div>
    <p class="vcap">Same bar, equal runs, <b>no notches and no grips</b> — so it cannot be dragged and reads as
    a roster rather than a division. Every face carries the <b>full</b> 1.040. <b>Cost:</b> it still looks like
    a split at a glance; the equal runs do most of the lying that the caption then has to undo.</p></div>
  <div style="width:1080px"><div class="vtag">W2</div><div class="vname">One full battery each</div>
    <div class="panel" style="margin-top:8px">{full_batteries(THREE)}
    <div class="meta" style="margin-top:12px">Mỗi người nhận đủ một phần — 1.040 kcal.</div></div>
    <p class="vcap"><b>Recommended.</b> Three people, three batteries, every one of them full. The metaphor
    does the explaining: nothing is divided because there is nothing to divide. Switching tabs animates one
    bar splitting into several, or several merging into one — which is exactly the idea the tabs encode.
    <b>Cost:</b> at six people the batteries are 52pt each, so the nub and the face have to shrink.</p></div>
</div>''')

# ---------- in the sheet, both tabs ----------
def sheet2(people, adds, cta, consequence, mode, tag, title, note, height=690):
    add_html = "".join(addrow(n,i)+'<div class="gsep" style="margin-left:46px"></div>' for n,i in adds)
    add_html = add_html.removesuffix('<div class="gsep" style="margin-left:46px"></div>')
    if not adds:
        add_html = '<div class="emptyadd"><span class="meta">Đã thêm tất cả bạn bè.</span></div>'
    if mode == 'split':
        body = f'''<div style="margin-top:22px">{control(people)}</div>
          <div style="display:flex;justify-content:space-between;margin-top:10px">
            <span class="meta">Bạn {round(people[0][2]/UNITS*100)}%</span>
            <span class="meta" style="color:var(--ink)">Chia đều</span></div>'''
    else:
        body = f'''<div style="margin-top:22px">{full_batteries(people, h=40)}</div>
          <div class="meta" style="margin-top:12px">Mỗi người nhận đủ một phần — 1.040 kcal.</div>'''
    return f'''
  <div class="cell">
    <div class="vtag">{tag}</div><div class="vname">{title}</div>
    <div class="phone" style="margin-top:10px"><div class="island"></div><div class="screen">
      <div class="sbar"><span>9:41</span><span>●●●</span></div>
      <div class="dim"></div>
      <div class="sheet" style="height:{height}px;padding-bottom:0">
        <div class="grab"></div>
        <div style="padding:16px 16px 0">
          <div style="font-size:28px;font-weight:600;letter-spacing:-.6px;line-height:1.15">Chia sẻ bữa ăn</div>
          <div class="meta" style="margin-top:5px">Bánh mì thịt nướng + trà đá · 1.040 kcal</div>
          <div style="margin-top:16px">{seg('Nguyên phần','Chia phần','left' if mode=='whole' else 'right', w=358)}</div>
          {body}
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

out.append('''
<div class="band">Both tabs, in the sheet</div>
<p class="bandnote">Pins above, pill notches on the boundaries, an add-only list below. The battery survives
the tab switch — it just stops being one dish.</p>
<div class="row">''')

out.append(sheet2([('Bạn','B',10),('Mai','MN',10)],
    [('Thu Hà','TH'),('Quốc Anh','QA'),('Lan Phương','LP')],
    'Chia với Mai Ngọc','Bữa đã ghi của bạn sẽ giảm còn 520 kcal.','split',
    'Chia phần','Two people, even',
    '<b>Opens here.</b> Black and green, ten parts each, one pill on the boundary.'))

out.append(sheet2([('Bạn','B',8),('Mai','MN',4),('Thu Hà','TH',5),('Quốc Anh','QA',3)],
    [('Lan Phương','LP')],
    'Chia với 3 người','Bữa đã ghi của bạn sẽ giảm còn 416 kcal.','split',
    'Chia phần','Four seats',
    'Black, green, amber, salmon. Each pin points at the run it owns; three pills between them.'))

out.append(sheet2([('Bạn','B',0),('Mai','MN',0),('Thu Hà','TH',0)],
    [('Quốc Anh','QA'),('Lan Phương','LP')],
    'Gửi cho 2 người','Bữa của bạn giữ nguyên.','whole',
    'Nguyên phần','Everyone gets a full one',
    'Three people, three full batteries. <b>Nothing is divided, so nothing is drawn divided</b> — the meter '
    'stays, the pins stay, the pills go. Switching tabs animates one bar splitting into three, or three '
    'merging into one.', height=640))
out.append('</div>')

out.append('''
<div class="band">Open questions</div>
<div style="display:flex;gap:70px;margin-top:20px">
<div class="leg">
  <div class="n">1</div><p><b>Pins cost vertical space.</b> A rotated 30pt drop needs a 66pt lane rather than 54pt, and the point has to clear the bar without touching it. That is 12pt out of the sheet — cheap, but it is the reason the four-seat sheet now runs 690pt.</p>
  <div class="n">2</div><p><b>The × sits on a rotated shape.</b> It is anchored to the unrotated wrapper so it stays square, but it now overlaps the drop’s shoulder rather than a clean circle edge. Worth a look on device — if it reads as debris, move it to the pin’s upper-left where the silhouette is fuller.</p>
</div>
<div class="leg">
  <div class="n">3</div><p><b>Whole-portion mode still needs a verb for the CTA.</b> “Gửi cho 2 người” (send to) is drawn above; “Chia sẻ với” is the other candidate. Split mode says “Chia với”, so the two should not both start with “chia”.</p>
  <div class="n">4</div><p><b>Six seats, floor of two parts, twenty parts.</b> Those three numbers agree exactly: six people spoken for is 12 of 20, and a seventh breaks both the palette and the floor at the same time. A seventh selection should switch the sheet to Nguyên phần rather than erroring.</p>
</div>
</div>

<p style="margin:46px 0 0;font-size:12px;color:var(--muted)">Kallo · meal sharing · seats, pins, pills · 2026-09-15</p>
</div></body></html>''')

open('docs/design/meal-share-2026-09/Pins.dc.html','w').write("".join(out))
print("written")
