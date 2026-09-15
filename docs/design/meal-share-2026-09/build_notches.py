KCAL = 1040
UNITS = 20

PALETTES = {
 'ink':   {'mine':'var(--ink)','t1':'var(--accent)','t2':'var(--accentDark)',
           't3':'var(--accent)','t4':'var(--accentDark)'},
 'charge':{'mine':'#7ca368','t1':'#A8B88A','t2':'#C9A87C','t3':'#E0B98E','t4':'#FFD2B0'},
 'fruit': {'mine':'var(--ink)','t1':'#FFD2B0','t2':'#DCC4FF','t3':'#7ca368','t4':'#d37b69'},
 'warm':  {'mine':'var(--ink)','t1':'#C9A87C','t2':'#FFD2B0','t3':'#B89968','t4':'#E8C9A0'},
}

def control(people, h=54, cell_gap=2, show_notches=True, avatar=28, kcal_size=11,
            label_h=54, tight=False, palette='ink', radius=4):
    """people: list of (name, initials, cells, tone) where tones are mine|t1|t2."""
    total = sum(p[2] for p in people)
    assert total == UNITS, f"cells must sum to {UNITS}, got {total}"

    # labels: one column per person, flex-weighted by their cells
    labels = []
    for name, ini, cells, tone in people:
        kc = round(KCAL * cells / UNITS)
        mine = tone == 'mine'
        col = PALETTES[palette][tone]
        dark = mine or palette == 'charge' or tone == 't4' and palette == 'fruit'
        av_style = f'background:{col};color:{"#fff" if dark else "var(--soft)"};'
        labels.append(
            f'<div class="nlab" style="flex:{cells}">'
            f'<div class="nkcal">{kc}</div>'
            f'<div class="av" style="width:{avatar}px;height:{avatar}px;font-size:{max(9,avatar//3)}px;{av_style}">{ini}</div>'
            f'</div>')

    # the 20 cells, coloured by owner
    cells_html, idx = [], 0
    for _, _, cells, tone in people:
        for _ in range(cells):
            col = PALETTES[palette][tone]
            cells_html.append(
                f'<div class="bcell" style="background:{col};border-radius:{radius}px"></div>')
            idx += 1

    # draggable notches at every internal boundary
    notches, run = [], 0
    for name, ini, cells, tone in people[:-1]:
        run += cells
        notches.append(f'<div class="nnotch" style="left:{run/UNITS*100:.4f}%"><i></i></div>')

    return f'''<div class="ncontrol">
  <div class="nlabels" style="height:{label_h}px">{''.join(labels)}</div>
  <div class="batt">
    <div class="bshell" style="height:{h}px">
      <div class="bcells" style="gap:{cell_gap}px">{''.join(cells_html)}</div>
      {''.join(notches) if show_notches else ''}
    </div>
    <div class="bnub"></div>
  </div>
</div>'''

def legend(people):
    out = []
    for name, ini, cells, tone in people:
        pct = round(cells / UNITS * 100)
        out.append(f'<span>{name} <b>{pct}%</b></span>')
    return '<div class="blabels">' + ''.join(out) + '</div>'

import re
b1=open('docs/design/meal-share-2026-09/Share.dc.html').read()
base=re.search(r'<style>(.*?)</style>', b1, re.S).group(1)
b2=open('docs/design/meal-share-2026-09/Directions.dc.html').read()
dirs=re.search(r'/\* ---- direction board additions ---- \*/(.*?)</style>', b2, re.S).group(1)
b3=open('docs/design/meal-share-2026-09/Battery.dc.html').read()
batt=re.search(r'/\* ---- battery portion control ---- \*/(.*?)</style>', b3, re.S).group(1)

EXTRA = """
/* ---- notched multi-thumb meter ---- */
.ncontrol{position:relative}
.nlabels{display:flex;align-items:flex-end}
.nlab{display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:4px;min-width:0}
.nkcal{font-size:11px;color:var(--muted);letter-spacing:-.1px;white-space:nowrap}
.nlab .av{flex:none;border:1.5px solid #fff;box-shadow:0 1px 3px rgba(20,20,19,.18)}
.bcell.t1{background:var(--accent)}
.bcell.t2{background:var(--accentDark)}
.nnotch{position:absolute;top:-5px;bottom:-5px;width:18px;transform:translateX(-9px);
  display:grid;place-items:center;z-index:6}
.nnotch i{display:block;width:9px;height:100%;border-radius:5px;background:#fff;
  box-shadow:0 0 0 1.5px var(--ink),0 1px 3px rgba(20,20,19,.25)}
.tick20{display:flex;margin-top:7px}
.tick20 span{flex:1;text-align:center;font-size:10px;color:var(--muted)}
.warnbox{border:1px solid rgba(211,123,105,.45);background:rgba(211,123,105,.07);
  border-radius:10px;padding:11px 13px;font-size:12px;line-height:1.5;color:var(--soft)}
.warnbox b{color:var(--terra)}
"""

HEAD = f"""<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>Kallo — twenty parts, a notch each</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600&family=Lora:ital,wght@0,400;1,300&display=swap">
<style>{base}{dirs}{batt}{EXTRA}</style>
</head>
<body>
<div class="board" style="width:2560px">
<h1>Twenty parts, <em>a notch each</em></h1>
<p class="sub">The dish divides into 20 parts of 5% each. Every person at the table owns a run of parts, has
their own draggable notch, and wears their avatar above their share with the kcal above that. Drag a notch and
the two people it sits between trade parts; everyone else is untouched, and the total is always 20.</p>
"""

def panel(tag, title, people, note, width=760, h=54, avatar=28, label_h=54,
          show_notches=True, extra='', palette='ink', radius=4):
    return f'''
  <div style="width:{width}px">
    <div class="vtag">{tag}</div><div class="vname">{title}</div>
    <div class="panel" style="margin-top:10px">
      {control(people, h=h, avatar=avatar, label_h=label_h, show_notches=show_notches,
                palette=palette, radius=radius)}
      {legend(people)}
      {extra}
    </div>
    <p class="vcap">{note}</p>
  </div>'''

out = [HEAD]

# ---------- anatomy ----------
out.append('''
<div class="band">Anatomy</div>
<p class="bandnote">One control, drawn at 760pt so the parts are countable. On a 390pt phone the same thing is
358pt wide — each part is 17.9pt, each notch a 44pt touch target centred on an 18pt grip.</p>
<div class="row">''')
out.append(panel('', 'Two people · 13 parts to 7',
    [('Bạn','B',13,'mine'),('Mai Ngọc','MN',7,'t1')],
    '''<b>kcal on top, avatar under it, notch on the boundary, parts underneath.</b> The avatar is centred over
    the run it owns, so identity and quantity are the same object — you never have to match a name in a legend
    to a colour in a bar. The notch overhangs the shell by 5pt top and bottom so it reads as grabbable.'''))
out.append('</div>')

# ---------- the 20 parts ----------
out.append('''
<div class="band">Why twenty</div>
<div class="row">''')
out.append(panel('', 'The step is 5%',
    [('Bạn','B',10,'mine'),('Mai Ngọc','MN',10,'t1')],
    '''<b>Twenty parts of 5% each.</b> Even splits land exactly: halves at 10/10, quarters at 5, fifths at 4,
    tenths at 2. The one common fraction it cannot say is a third — 6.67 parts — so three-way even splits sit
    at 7/7/6 and the labels read 35/35/30. That is the price of a round 5% step.''',
    extra='''<div class="warnbox" style="margin-top:14px"><b>Thirds are not exact.</b> With 20 parts an even
    three-way split is 7/7/6, not 33/33/33. Either we accept a 5% skew on the odd person out, or “Chia đều”
    writes exact thirds and only <i>manual</i> drags snap to parts.</div>'''))
out.append('</div>')

# ---------- states ----------
out.append('''
<div class="band">Every party size</div>
<p class="bandnote">All at 20 parts. You are always ink and always leftmost; friends alternate the two tans so
neighbouring runs stay legible without needing five distinct colours.</p>
<div class="row" style="flex-wrap:wrap;gap:30px">''')

out.append(panel('P = 2', 'Even — the default',
    [('Bạn','B',10,'mine'),('Mai Ngọc','MN',10,'t1')],
    'Opens here. Identical to today’s split, so the feature stays invisible until someone wants it.',
    width=590, h=50, avatar=26, label_h=50))

out.append(panel('P = 3', 'Even — the thirds problem',
    [('Bạn','B',7,'mine'),('Mai Ngọc','MN',7,'t1'),('Thu Hà','TH',6,'t2')],
    'Seven, seven, six. Visibly not equal, and the labels say so: 35 / 35 / 30.',
    width=590, h=50, avatar=26, label_h=50))

out.append(panel('P = 5', 'Even — four friends',
    [('Bạn','B',4,'mine'),('Mai','MN',4,'t1'),('Thu Hà','TH',4,'t2'),
     ('Quốc Anh','QA',4,'t1'),('Lan Phương','LP',4,'t2')],
    'Four parts each, 20% apiece. Avatars have 71pt of run to sit in — comfortable.',
    width=590, h=50, avatar=26, label_h=50))

out.append(panel('P = 5', 'Uneven — the real case',
    [('Bạn','B',8,'mine'),('Mai','MN',4,'t1'),('Thu Hà','TH',3,'t2'),
     ('Quốc Anh','QA',3,'t1'),('Lan Phương','LP',2,'t2')],
    'You had 40%, Lan Phương had a taste. Four notches, each trading only with its neighbour.',
    width=590, h=50, avatar=26, label_h=50))
out.append('</div>')

# ---------- the tight case ----------
out.append('''
<div class="band">Where it breaks, and the floor that fixes it</div>
<p class="bandnote">Phone width, not board width: 358pt of shell, so one part is 17.9pt and an avatar is 26pt.
Any run under two parts is narrower than the face sitting on it.</p>
<div class="row" style="gap:30px;flex-wrap:wrap">''')

out.append(panel('Broken', 'One part each for the last two',
    [('Bạn','B',12,'mine'),('Mai','MN',4,'t1'),('Thu Hà','TH',2,'t2'),
     ('Quốc Anh','QA',1,'t1'),('Lan Phương','LP',1,'t2')],
    '''<b>Two 5% runs at the end.</b> Their avatars are 26pt sitting on 18pt of bar, so they collide with each
    other and with Thu Hà. The kcal above them collides worse — “52” and “52” overlap outright.''',
    width=590, h=50, avatar=26, label_h=50))

out.append(panel('Fixed', 'Floor of two parts · 10% minimum',
    [('Bạn','B',10,'mine'),('Mai','MN',4,'t1'),('Thu Hà','TH',2,'t2'),
     ('Quốc Anh','QA',2,'t1'),('Lan Phương','LP',2,'t2')],
    '''<b>A person cannot hold less than two parts.</b> 10% is the floor, which is also the floor the server
    already needs (<code>0.1–0.9</code>), so the control and the validator agree by construction. The notch
    simply stops. If you truly ate none of it, do not tick that person.''',
    width=590, h=50, avatar=26, label_h=50))
out.append('</div>')
out.append('''
<p class="bandnote" style="margin-top:6px">The floor also caps the table: at 10% each, <b>ten people</b> is the
hard maximum, and past six the avatars are shoulder to shoulder. The friend picker should stop offering
“Chia phần” beyond six selected and fall back to “Bản sao”.</p>''')

# ---------- colour ----------
FIVE = [('Bạn','B',8,'mine'),('Mai','MN',4,'t1'),('Thu Hà','TH',3,'t2'),
        ('Quốc Anh','QA',3,'t3'),('Lan Phương','LP',2,'t4')]

out.append("""
<div class="band">Colour — make it read as a battery, and make it fun</div>
<p class="bandnote">Same five people, same eight/four/three/three/two. Only the fill changes. Every colour below
is already a Kallo token — apricot and lilac ship in <code>kallo_colors.dart</code> as brand accents, sage and
terracotta are the sanctioned status pair. No pure red, no pure green.</p>
<div class="row" style="flex-wrap:wrap;gap:30px">""")

out.append(panel('C1', 'Ink + tans — where we are',
    FIVE,
    """Legible, calm, and completely mute. Two tans repeating means neighbours are told apart by position
    rather than identity, and it looks like a progress bar with faces glued on.""",
    width=760, h=52, avatar=26, label_h=50, palette='ink'))

out.append(panel('C2', 'Charge ramp — most battery',
    FIVE,
    """<b>One hue travelling from sage through tan to apricot.</b> This is what a battery actually looks like:
    a level, not a set of categories. Reads instantly as “full on the left, empty on the right”, and the
    gradient does the teaching. <br><b>Cost:</b> the ramp implies rank — Lan Phương looks like the low-battery
    warning rather than someone who had a taste.""",
    width=760, h=52, avatar=26, label_h=50, palette='charge', radius=5))

out.append(panel('C3', 'Fruit — most playful',
    FIVE,
    """<b>Ink for you, then apricot, lilac, sage, terracotta.</b> Each person owns a colour, the avatar carries
    the same fill, and the bar becomes a little group portrait. Warm, a bit toy-like, and the one treatment
    where you can find your own run without counting. <br><b>Recommended</b> — it is the only option that
    scales past two friends without ambiguity.""",
    width=760, h=52, avatar=26, label_h=50, palette='fruit', radius=6))

out.append(panel('C4', 'Warm only — playful, one family',
    FIVE,
    """Tan and apricot alternating, ink for you. Keeps the board strictly inside the warm palette and still
    separates neighbours. The safe middle if lilac and sage feel like they belong to another product.""",
    width=760, h=52, avatar=26, label_h=50, palette='warm', radius=6))
out.append("</div>")

out.append("""
<div class="row" style="margin-top:8px">
<div class="leg" style="max-width:1100px">
  <div class="n good">1</div><p><b>Playful lives in the radius and the nub, not only the hue.</b> The cells above
  go from 4pt to 6pt corners across the variants; at 6pt on a 52pt bar they read as little tiles you could pick
  up. Pair that with the terminal nub and the thing announces itself as a toy gauge rather than a chart.</p>
  <div class="n">2</div><p><b>Colour cannot be the only channel.</b> Whatever we pick, the avatar above the run
  stays the primary identifier — 8% of men cannot separate sage from terracotta, and C2’s ramp is
  monochrome-hostile by design. The kcal figure above each avatar is the text fallback.</p>
</div>
</div>""")


# ---------- in context ----------
sheet_people = [('Bạn','B',8,'mine'),('Mai','MN',4,'t1'),('Thu Hà','TH',3,'t2'),
                ('Quốc Anh','QA',3,'t1'),('Lan Phương','LP',2,'t2')]
rows = []
for name, ini, cells, tone in sheet_people[1:]:
    kc = round(KCAL*cells/UNITS)
    pct = round(cells/UNITS*100)
    rows.append(f'''            <div class="frow" style="padding:9px 0"><div class="av">{ini}</div>
              <div class="fname">{name}</div><div class="fnum">{pct}% · {kc} kcal</div></div>
            <div class="gsep" style="margin-left:46px"></div>''')
rows_html = "\n".join(rows).rstrip().rstrip('<div class="gsep" style="margin-left:46px"></div>')

out.append(f'''
<div class="band">In the sheet — you and four friends</div>
<p class="bandnote">Direction B’s shell, the notched meter in the portion slot, every row carrying the share it
was given.</p>
<div class="row">

  <div class="cell">
    <div class="phone"><div class="island"></div><div class="screen">
      <div class="sbar"><span>9:41</span><span>●●●</span></div>
      <div class="dim"></div>
      <div class="sheet" style="height:706px;padding-bottom:0">
        <div class="grab"></div>
        <div style="padding:16px 16px 0">
          <div style="font-size:28px;font-weight:600;letter-spacing:-.6px;line-height:1.15">Chia sẻ bữa ăn</div>
          <div class="meta" style="margin-top:5px">Bánh mì thịt nướng + trà đá · 1.040 kcal</div>
          <div style="display:flex;height:40px;border-radius:20px;background:var(--track);padding:3px;margin-top:16px">
            <div style="flex:1;display:grid;place-items:center;font-size:16px;color:var(--muted)">Bản sao</div>
            <div style="flex:1;border-radius:17px;background:#fff;display:grid;place-items:center;font-size:16px;
                 box-shadow:0 1px 3px rgba(20,20,19,.10)">Chia phần</div>
          </div>
          <div style="margin-top:22px">
            {control(sheet_people, h=52, avatar=26, label_h=50)}
          </div>
          <div style="display:flex;justify-content:space-between;margin-top:10px">
            <span class="meta">Bạn 40%</span>
            <span class="meta" style="color:var(--ink)">Chia đều</span>
          </div>
          <div class="meta" style="margin-top:16px">Chia với</div>
          <div style="margin-top:2px">
{rows_html}
          </div>
        </div>
        <div style="padding:14px 16px 26px">
          <div class="meta" style="margin-bottom:11px">Bữa đã ghi của bạn sẽ giảm còn 416 kcal.</div>
          <div class="wide">Chia với 4 người</div>
        </div>
      </div>
      <div class="homebar"></div>
    </div></div>
    <p class="cap"><b>The meter is now the whole story</b> and the rows are the receipt. “Chia đều” on the
    right of the meter resets every notch to even in one tap — the escape hatch from a fiddly drag, and the
    thing that keeps the common case one gesture.</p>
  </div>

  <div style="width:1180px">
    <div class="vtag">What this costs on the server</div>
    <div class="panel" style="margin-top:10px">
      <div class="leg" style="max-width:none">
        <div class="n">1</div><p><b>Per-recipient portions are now mandatory.</b> Four friends can hold four
        different shares, so one <code>copy_factor</code> no longer covers the call. The wire becomes
        <code>splits: [{{userId, parts}}]</code> and <code>meal_share_invites</code> stores a factor per row.
        This is the N-C cost I flagged — the notched meter buys the capability back with a far better control,
        but it does not make the server change go away.</p>
        <div class="n good">2</div><p><b>Parts are integers, which is the good news.</b> Sending
        <code>parts</code> (8/4/3/3/2) instead of floats means the server sums them, asserts 20, and derives
        every factor itself. No floating-point drift, no “shares sum to 0.9999”, and the validator is one
        equality check.</p>
        <div class="n good">3</div><p><b>The sender’s own scale is still one number.</b>
        <code>scaleOwnMealInPlace(tx, source, items, myParts/20)</code> is unchanged. Only the invite side
        grows a column.</p>
        <div class="n">4</div><p><b>Accessibility needs real work.</b> Four notches on one bar is not a
        slider, it is four sliders sharing a track. Each notch gets its own
        <code>Semantics(slider:)</code> with value “Mai Ngọc, 4 phần, 20 phần trăm” and
        increase/decrease stepping one part. VoiceOver users will navigate notch by notch; the avatars need
        <code>excludeSemantics</code> so the run is not announced twice.</p>
        <div class="n good">5</div><p><b>The receiving end gets simpler, not harder.</b> The invite card already
        shows a read-only meter — it just renders the same parts array with the recipient’s own run tinted
        and everyone else on the neutral track.</p>
      </div>
    </div>
  </div>

</div>

<p style="margin:46px 0 0;font-size:12px;color:var(--muted)">Kallo · meal sharing · notched meter · 2026-09-15</p>
</div>
</body>
</html>''')

open('docs/design/meal-share-2026-09/Notches.dc.html','w').write("".join(out))
print("written")
