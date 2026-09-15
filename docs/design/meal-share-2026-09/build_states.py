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

EXTRA = """
.skel{background:var(--track);border-radius:8px}
@keyframes sh{0%{opacity:.55}50%{opacity:1}100%{opacity:.55}}
.skel{animation:sh 1.4s ease-in-out infinite}
.pending{opacity:.55}
.spin{width:16px;height:16px;border-radius:50%;border:2px solid rgba(20,20,19,.25);
  border-top-color:var(--ink);display:inline-block}
.chip{display:inline-flex;align-items:center;height:24px;padding:0 10px;border-radius:12px;
  background:var(--track);font-size:12px;color:var(--muted)}
.tabdis{opacity:.4}
.scrim{background:rgba(20,20,19,.34);border-radius:16px;padding:26px}
.wdialog{width:472px;background:#fff;border-radius:14px;border:1px solid var(--borderSoft);
  box-shadow:0 24px 50px rgba(20,20,19,.24);margin:0 auto}
.wrow{display:flex;align-items:center;gap:12px;padding:9px 0}
.wrow .av{width:30px;height:30px;font-size:12px;background:var(--track);color:var(--soft)}
.toast{background:var(--ink);color:#fff;border-radius:12px;padding:11px 15px;font-size:14px;
  box-shadow:0 6px 18px rgba(20,20,19,.3)}
.toast.err{background:#B3402F}
"""

HEAD = f"""<!doctype html>
<html><head><meta charset="utf-8">
<title>Kallo — share a meal: every state, both platforms</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600&family=Lora:ital,wght@0,400;1,300&display=swap">
<style>{base}{dirs}{batt}{notch}{CSS}{EXTRA}</style>
</head><body>
<div class="board" style="width:3000px">
<h1>Every state, <em>both platforms</em></h1>
<p class="sub">The full matrix for the directed share flow: sender sheet and dialog, recipient card and
activity row, plus the states that only show up when something is missing, loading, refused or locked.
Mobile is 390pt; web dialogs are drawn at their real 472px on the scrim.</p>
<p class="sub" style="margin-top:-18px"><b>Correction from the earlier boards:</b> the shipped Vietnamese label
for the non-split tab is <b>“Cùng một món”</b>, not “Bản sao” — I mistranslated it in the first pass. So the
rename question is really <i>Cùng một món</i> versus <i>Nguyên phần</i>, and the shipped string is better than
I made it look. Both are drawn below.</p>
"""

out=[HEAD]

FRIENDS=[('Thu Hà','TH'),('Quốc Anh','QA'),('Lan Phương','LP')]

def phone(inner, tag, title, note, dim=True):
    return f'''
  <div class="cell">
    <div class="vtag">{tag}</div><div class="vname">{title}</div>
    <div class="phone" style="margin-top:10px"><div class="island"></div><div class="screen">
      <div class="sbar"><span>9:41</span><span>●●●</span></div>
      {'<div class="dim"></div>' if dim else ''}
      {inner}
      <div class="homebar"></div>
    </div></div>
    <p class="cap">{note}</p>
  </div>'''

def sheet_body(body, lane_html, cta, height=636, lane=150, mode='split',
               header_sub='Bánh mì thịt nướng + trà đá', tabs=None, lane_label='Thêm bạn bè'):
    tabs = tabs if tabs is not None else seg('Nguyên phần','Chia phần','left' if mode=='whole' else 'right', w=358)
    return f'''<div class="sheet" style="height:{height}px;padding-bottom:0">
        {sheet_header('Chia sẻ bữa ăn', header_sub)}
        <div style="padding:8px 16px 0">
          <div>{tabs}</div>
          {body}
          <div class="meta" style="margin-top:20px">{lane_label}</div>
          <div class="addlane" style="height:{lane}px">{lane_html}<div class="lanefade"></div></div>
        </div>
        <div style="padding:14px 16px 26px;border-top:1px solid var(--borderFaint)">{cta}</div>
      </div>'''

def lane(items):
    h = "".join(addrow(n,i)+'<div class="gsep" style="margin-left:46px"></div>' for n,i in items)
    return h.removesuffix('<div class="gsep" style="margin-left:46px"></div>')

def split_body(people, extra=''):
    return f'''<div style="margin-top:20px">{control(people)}</div>
          <div style="display:flex;justify-content:flex-end;margin-top:8px">
            <span class="meta" style="color:var(--ink)">Chia đều</span></div>{extra}'''

def cta(label, state='on'):
    if state == 'off':
        return f'<div class="wide off">{label}</div>'
    if state == 'busy':
        return f'<div class="wide"><span class="spin" style="margin-right:9px"></span>{label}</div>'
    return f'<div class="wide">{label}</div>'

TWO=[('Bạn','B',10),('Mai','MN',10)]
SIX=[('Bạn','B',4),('Mai','MN',4),('Thu Hà','TH',3),('Quốc Anh','QA',3),('Lan','LP',3),('Nam','NV',3)]
CLAMP=[('Bạn','B',8),('Mai','MN',2),('Thu Hà','TH',7),('Quốc Anh','QA',3)]
THREE_W=[('Bạn','B',0),('Mai','MN',0),('Thu Hà','TH',0)]

out.append('<div class="band">Mobile · the sheet when things are fine</div><div class="row">')

out.append(phone(sheet_body(split_body(TWO), lane(FRIENDS),
    cta('Chia sẻ với 1 người · còn 520 kcal')),
    'M1','Default','Two seats, even, three friends still addable. The state the sheet opens in.'))

drag = control(TWO).replace('class="nnotch" style="left:50.0000%"',
    'class="nnotch" style="left:63.0000%;z-index:7"')
out.append(phone(sheet_body(f'''<div style="margin-top:20px">{drag}</div>
          <div style="display:flex;justify-content:flex-end;margin-top:8px">
            <span class="meta" style="color:var(--ink)">Chia đều</span></div>''',
    lane(FRIENDS), cta('Chia sẻ với 1 người · còn 655 kcal')),
    'M2','Dragging',
    'Mid-drag at 13/7. <b>The pin and its kcal track the notch live</b>, the grip grows 2pt under the finger, '
    'and a <code>selectionClick</code> fires on every part crossed.'))

out.append(phone(sheet_body(split_body(SIX), '<div class="emptyadd"><span class="meta">Đã thêm tất cả bạn bè.</span></div>',
    cta('Chia sẻ với 5 người · còn 208 kcal'), lane=150),
    'M3','Six — the ceiling',
    'Palette full and floor reached at once. <b>A seventh selection is refused</b>: the row greys and a '
    'footnote offers Nguyên phần instead.'))

out.append(phone(sheet_body(split_body(CLAMP), lane([('Lan Phương','LP')]),
    cta('Chia sẻ với 3 người · còn 416 kcal')),
    'M4','Notch clamped at the floor',
    'Mai is at two parts and the notch will not go further left. <b>No error, no toast</b> — the control '
    'simply stops, which is the only refusal that needs no words.'))

out.append(phone(sheet_body(f'<div style="margin-top:20px">{full_batteries(THREE_W, h=40)}</div>',
    lane([('Quốc Anh','QA'),('Lan Phương','LP')]),
    cta('Chia sẻ với 2 người · còn 1.040 kcal'), lane=207, mode='whole'),
    'M5','Nguyên phần','Three full batteries at the same unit size. Your meal is untouched, so the button '
    'says you keep all 1.040.'))
out.append('</div>')

# ---- mobile, everything else ----
skel_lane = "".join(f'''<div class="frow" style="padding:9px 0">
  <div class="skel" style="width:32px;height:32px;border-radius:50%"></div>
  <div class="skel" style="height:14px;width:{w}px;margin-left:12px"></div></div>''' for w in (120,96,140))

skel_meter = '''<div style="margin-top:20px">
  <div class="skel" style="height:24px;width:110px;margin:0 auto 10px"></div>
  <div class="skel" style="height:52px;border-radius:14px"></div></div>'''

out.append('<div class="band">Mobile · loading, empty, refused, locked</div><div class="row">')

out.append(phone(sheet_body(skel_meter, skel_lane, cta('Chia sẻ với 1 người', 'off')),
    'M6','Loading the circle',
    'Skeletons for both the meter and the lane — the meter cannot be drawn until we know who is in it. '
    'The shipped web build writes “Đang tải danh sách bạn bè…” as text here; mobile already had a skeleton, '
    'and both should be this.'))

empty = '''<div style="margin-top:20px">
  <div class="emptyadd" style="padding:22px 16px">
    <div class="meta" style="line-height:1.5">Chưa có ai trong danh sách của bạn.</div>
    <div style="margin-top:14px"><div class="wide" style="height:44px;font-size:15px">Thêm bạn bè</div></div>
  </div></div>'''
out.append(phone(sheet_body(empty, '', cta('Chia sẻ với 0 người', 'off'), lane=0, lane_label=''),
    'M7','No circle yet',
    '<b>The one state that must not be a dead end.</b> No meter, no lane, no disabled primary sitting there '
    'accusingly — just the reason and the way out. Shipped copy: “Chưa có ai trong danh sách. Hãy thêm bạn trước.”'))

err = '''<div style="margin-top:20px">
  <div class="emptyadd" style="padding:22px 16px;border-style:solid;border-color:rgba(211,123,105,.45)">
    <div class="meta" style="line-height:1.5">Không tải được danh sách bạn bè.</div>
    <div style="margin-top:12px"><span class="meta" style="color:var(--ink)">Chạm để thử lại</span></div>
  </div></div>'''
out.append(phone(sheet_body(err, '', cta('Chia sẻ với 0 người', 'off'), lane=0, lane_label=''),
    'M8','Load failed',
    'A failed fetch must never read as “you have no friends” — the two states look identical if you are '
    'careless. Tappable retry, terracotta hairline, no red alert banner.'))

dis_tabs = ('<div style="display:flex;height:40px;border-radius:20px;background:var(--track);padding:3px;width:358px">'
    '<div style="flex:1;border-radius:17px;background:#fff;display:grid;place-items:center;font-size:15px;'
    'box-shadow:0 1px 3px rgba(20,20,19,.10)">Nguyên phần</div>'
    '<div class="tabdis" style="flex:1;display:grid;place-items:center;font-size:15px;color:var(--muted)">Chia phần</div></div>')
already = f'''<div style="margin-top:20px">{full_batteries([('Bạn','B',0),('Mai','MN',0)], h=40)}</div>
        <div class="meta" style="margin-top:12px;line-height:1.45">Bữa này đã được chia phần rồi, nên chỉ có thể
        gửi nguyên phần.</div>'''
out.append(phone(sheet_body(already, lane(FRIENDS), cta('Chia sẻ với 1 người · còn 520 kcal'),
    lane=118, mode='whole', tabs=dis_tabs),
    'M9','Meal already split',
    '<code>portionFactor &lt; 1</code>, so the server would refuse a second split. <b>Disable the tab and say '
    'why</b> rather than letting them build a share that 402s. Today this only surfaces as a toast after the fact.'))

out.append(phone(sheet_body(split_body(TWO), lane(FRIENDS),
    cta('Đang chia sẻ…','busy')),
    'M10','Submitting',
    'Button holds its label width so nothing reflows, spinner replaces the count. The sheet stays up and the '
    'notch locks — a drag mid-flight would desync from what was posted.'))
out.append('</div>')

# ---- entry + feedback + type scale ----
def meal_card(locked=False, split_done=False):
    chip = ('<span class="chip" style="background:var(--accent10);color:var(--ink);margin-left:2px">Pro</span>'
            if locked else '')
    pill = ('<span class="chip" style="margin-left:8px">đã chia 1/2</span>' if split_done else '')
    return f'''<div style="padding:6px 16px 0">
      <div style="font-size:28px;font-weight:600;letter-spacing:-.6px;margin-bottom:14px">Log</div>
      <div class="card">
        <div style="display:flex;justify-content:space-between;gap:12px">
          <div class="mealname" style="flex:1">Bánh mì thịt nướng + trà đá{pill}</div>
          <div class="val">{'520' if split_done else '1.040'} kcal</div></div>
        <div class="cpt" style="margin-top:7px">P: 38g&nbsp;&nbsp;C: 96g&nbsp;&nbsp;F: 34g</div>
        <div class="acts">
          <div class="ic"><svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg></div>
          <div class="ic"><svg viewBox="0 0 24 24"><path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h8M16 18h4"/><circle cx="16" cy="6" r="2"/><circle cx="8" cy="12" r="2"/><circle cx="14" cy="18" r="2"/></svg></div>
          <div class="ic on"><svg viewBox="0 0 24 24"><path d="M15 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/></svg></div>{chip}
          <div class="spacer"></div>
          <div class="ic"><svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9"/></svg></div>
          <div class="ic"><svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg></div>
        </div></div></div>'''

out.append('<div class="band">Mobile · entry, feedback, and Dynamic Type</div><div class="row">')

out.append(phone(meal_card(), 'M11','Entry — unlocked',
    'The share action is the third icon. It opens the sheet.', dim=False))

out.append(phone(meal_card(locked=True), 'M12','Entry — Pro locked',
    '<code>locked(\'copy_split\')</code>. The chip rides beside the icon and the tap opens the paywall, not '
    'the sheet — <b>no picker whose only outcome is a 402</b>. This is already how the shipped build behaves.', dim=False))

out.append(phone(meal_card(split_done=True) + f'''
      <div style="position:absolute;left:16px;right:16px;top:62px">
        <div class="toast">Đã chia phần với Mai Ngọc</div></div>''',
    'M13','Success','Top toast, the app\'s own <code>showTopToast</code>. The card underneath has already '
    'rescaled to 520 kcal and carries a quiet “đã chia 1/2” pill so the meal explains itself later.', dim=False))

out.append(phone(meal_card() + f'''
      <div style="position:absolute;left:16px;right:16px;top:62px">
        <div class="toast err">Không thể chia sẻ bữa ăn. Vui lòng thử lại.</div></div>''',
    'M14','Failed','<code>TopToastVariant.error</code>. <b>The sheet stays open with the draft intact</b> so a '
    'retry is one tap, not a rebuild. Today it closes on success only — that part is already right.', dim=False))

big = sheet_body(split_body(TWO), lane(FRIENDS[:2]),
    cta('Chia sẻ với 1 người · còn 520 kcal'), height=700, lane=120)
big = big.replace('font-size:16px;font-weight:600;letter-spacing:-.3px', 'font-size:21px;font-weight:600;letter-spacing:-.3px')
big = big.replace('class="meta"', 'class="meta" data-big="1"')
out.append(phone(big.replace('font-size:15px">Nguyên phần','font-size:19px">Nguyên phần')
                    .replace('font-size:15px">Chia phần','font-size:19px">Chia phần'),
    'M15','Dynamic Type 1.3×',
    'The app clamps at 1.3× (<code>withClampedTextScaling</code>). <b>The lane is what gives</b>: it shrinks '
    'and scrolls, the meter and the button keep their size. Two friend rows visible instead of three.'))
out.append('</div>')

# ---- recipient, mobile ----
def invite_card(state='pending', parts=7, of=20):
    pct = round(parts/of*100)
    kc  = round(KCAL*parts/of)
    meter = f'''<div style="margin-top:11px">
      <div class="batt"><div class="bshell" style="height:30px;border-radius:10px;border-width:1.5px;padding:3px">
        <div class="bcells" style="gap:2px">
          {''.join('<div class="bcell" style="background:var(--track);border-radius:4px"></div>' for _ in range(of-parts))}
          {''.join(f'<div class="bcell" style="background:{BRIGHT[1][0]};border-radius:4px"></div>' for _ in range(parts))}
        </div></div><div class="bnub" style="height:13px;width:4px"></div></div>
      <div class="blabels" style="margin-top:7px;font-size:12px">
        <span>Khôi {100-pct}%</span><span>Bạn <b>{pct}%</b></span></div></div>'''
    if state == 'pending':
        actions = f'''<div style="margin-top:14px"><div class="wide" style="height:46px">Thêm vào nhật ký</div></div>
          <div style="margin-top:6px"><div class="wide ghost" style="height:40px;font-size:14px">Bỏ qua</div></div>'''
    elif state == 'accepted':
        actions = '<div style="margin-top:14px"><span class="chip">Đã thêm vào nhật ký</span></div>'
    else:
        actions = '<div style="margin-top:14px"><span class="chip">Không còn khả dụng</span></div>'
    dim = 'opacity:.6;' if state != 'pending' else ''
    return f'''<div class="card" style="border-radius:16px;box-shadow:0 1px 2px rgba(20,20,19,.05);{dim}">
      <div style="display:flex;align-items:center;gap:8px">
        <div class="av" style="width:24px;height:24px;font-size:10px;background:var(--ink);color:#fff">KV</div>
        <div class="meta ink" style="flex:1">Khôi đã chia phần một bữa ăn với bạn</div></div>
      <div class="mealname" style="margin-top:9px">Bánh mì thịt nướng + trà đá</div>
      {meter}
      <div style="display:flex;justify-content:space-between;margin-top:11px">
        <div class="cpt">P: 13g&nbsp;&nbsp;C: 34g&nbsp;&nbsp;F: 12g</div><div class="val">{kc} kcal</div></div>
      {actions}</div>'''

out.append('''
<div class="band">Mobile · the receiving end</div>
<p class="bandnote">Shown at phone content width. The read-only meter uses the same widget with
<code>interactive: false</code> — sender on the neutral track, only your own run tinted.</p>
<div class="row" style="gap:26px">''')
for tag,title,state,note in [
  ('R1','Pending','pending','Full-width primary, quiet full-width dismiss. <b>35% is expressible</b> — the '
   'shipped <code>_portionLabel</code> would have printed “1/3” here, which is wrong.'),
  ('R2','Accepted','accepted','Collapses to one chip. Shipped copy: “Đã thêm vào nhật ký”.'),
  ('R3','Gone','unavailable','Dismissed here, dismissed elsewhere, or auto-dismissed because the sender '
   're-split the meal. <b>One neutral chip for all three</b> — the client cannot tell them apart and must not '
   'imply the reader acted.'),
]:
    out.append(f'''<div style="width:390px"><div class="vtag">{tag}</div><div class="vname">{title}</div>
      <div style="background:var(--canvas);padding:16px;border-radius:14px;margin-top:8px">{invite_card(state)}</div>
      <p class="cap">{note}</p></div>''')
out.append('</div>')

# ---- web ----
def wdialog(body, footer, title='Chia sẻ bữa ăn', sub='Bánh mì thịt nướng + trà đá · 1.040 kcal'):
    return f'''<div class="wdialog">
      <div style="padding:20px 22px 0;display:flex;align-items:flex-start">
        <div style="flex:1">
          <div style="font-family:Lora,serif;font-size:22px;letter-spacing:-.2px">{title}</div>
          <div class="meta" style="margin-top:3px;font-size:13px">{sub}</div></div>
        <div style="width:30px;height:30px;border-radius:8px;display:grid;place-items:center">
          <svg style="width:17px;height:17px;stroke:var(--muted);stroke-width:1.7;fill:none;stroke-linecap:round"
               viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg></div>
      </div>
      <div style="padding:0 22px">{body}</div>
      <div style="border-top:1px solid var(--borderFaint);margin-top:16px;padding:14px 22px;
           display:flex;align-items:center;justify-content:flex-end;gap:12px">{footer}</div>
    </div>'''

def wseg(sel='right'):
    return seg('Nguyên phần','Chia phần', sel, w=428).replace('height:40px','height:36px').replace('font-size:15px','font-size:13px')

def wrows(items):
    h="".join(f'''<div class="wrow"><div class="av">{i}</div><div style="flex:1;font-size:14px">{n}</div></div>
      <div class="gsep" style="margin-left:42px"></div>''' for n,i in items)
    return h.removesuffix('<div class="gsep" style="margin-left:42px"></div>')

WB = '<div class="btnbrown" style="width:210px">{}</div>'
WG = '<div class="btnghost" style="width:92px">Huỷ</div>'

out.append('''
<div class="band">Web · the dialog</div>
<p class="bandnote">472px on the scrim, at real size. Same information architecture as mobile — subject, tabs,
meter, add-only list, footer — with a desktop footer that finally has a cancel.</p>
<div class="row" style="gap:30px;flex-wrap:wrap">''')

wsplit = f'''<div style="margin-top:14px">{wseg()}</div>
  <div style="margin-top:16px">{control(TWO, h=46, avatar=27)}</div>
  <div style="display:flex;justify-content:flex-end;margin-top:8px">
    <span class="meta" style="font-size:12px;color:var(--ink)">Chia đều</span></div>
  <div class="meta" style="margin-top:16px;font-size:12px">Thêm bạn bè</div>
  <div style="margin-top:2px;max-height:142px;overflow:hidden">{wrows(FRIENDS)}</div>'''
out.append(f'''<div style="width:560px"><div class="vtag">W1</div><div class="vname">Default split</div>
  <div class="scrim" style="margin-top:8px">{wdialog(wsplit, WG + WB.format('Chia sẻ · còn 520 kcal'))}</div>
  <p class="cap"><b>Keyboard is the difference that matters here.</b> Each notch is a real
  <code>role="slider"</code>: ← → move one part, ⇧← ⇧→ jump five, Home/End clamp to the floor, and
  <code>aria-valuetext</code> reads “Mai Ngọc, 10 phần, 50 phần trăm”.</p></div>''')

wwhole = f'''<div style="margin-top:14px">{wseg('left')}</div>
  <div style="margin-top:16px">{full_batteries(THREE_W, h=38)}</div>
  <div class="meta" style="margin-top:20px;font-size:12px">Thêm bạn bè</div>
  <div style="margin-top:2px;max-height:100px;overflow:hidden">{wrows(FRIENDS[1:])}</div>'''
out.append(f'''<div style="width:560px"><div class="vtag">W2</div><div class="vname">Nguyên phần</div>
  <div class="scrim" style="margin-top:8px">{wdialog(wwhole, WG + WB.format('Chia sẻ · còn 1.040 kcal'))}</div>
  <p class="cap">The morph runs here too — same 320 ms, same keyed cells. On web it is a
  <code>layout</code> transition rather than an <code>AnimatedList</code>, but the rule is identical: one
  object rearranging, never a cross-fade.</p></div>''')

wskel = f'''<div style="margin-top:14px">{wseg()}</div>
  <div style="margin-top:16px"><div class="skel" style="height:22px;width:100px;margin:0 auto 9px"></div>
  <div class="skel" style="height:46px;border-radius:12px"></div></div>
  <div class="meta" style="margin-top:20px;font-size:12px">Thêm bạn bè</div>
  <div style="margin-top:6px">{''.join(f'<div class="wrow"><div class="skel" style="width:30px;height:30px;border-radius:50%"></div><div class="skel" style="height:13px;width:{w}px"></div></div>' for w in (130,100))}</div>'''
out.append(f'''<div style="width:560px"><div class="vtag">W3</div><div class="vname">Loading</div>
  <div class="scrim" style="margin-top:8px">{wdialog(wskel, WG + '<div class="btnbrown off" style="width:210px">Chia sẻ</div>')}</div>
  <p class="cap"><b>Replaces the literal string “Đang tải danh sách bạn bè…”</b> that ships today. The dialog
  keeps its height so it does not resize under the cursor when the fetch lands.</p></div>''')

wempty = f'''<div style="margin-top:14px">{wseg()}</div>
  <div style="margin-top:18px;border:1px dashed var(--border);border-radius:12px;padding:24px;text-align:center">
    <div class="meta" style="font-size:13px;line-height:1.5">Chưa có ai trong danh sách của bạn.</div>
    <div style="margin-top:14px;display:flex;justify-content:center">
      <div class="btnbrown" style="width:170px;height:38px">Thêm bạn bè</div></div></div>'''
out.append(f'''<div style="width:560px"><div class="vtag">W4</div><div class="vname">No circle yet</div>
  <div class="scrim" style="margin-top:8px">{wdialog(wempty, WG + '<div class="btnbrown off" style="width:210px">Chia sẻ</div>')}</div>
  <p class="cap">Same rule as mobile: the empty state owns the dialog and offers the way out. The disabled
  primary stays visible so the footer does not reflow, but it is not the thing being offered.</p></div>''')
out.append('</div>')

# ---- web: narrow + activity rows ----
narrow_inner = f'''<div style="margin-top:14px">{seg('Nguyên phần','Chia phần','right', w=330).replace('height:40px','height:36px')}</div>
  <div style="margin-top:16px">{control(TWO, h=44, avatar=26)}</div>
  <div class="meta" style="margin-top:16px;font-size:12px">Thêm bạn bè</div>
  <div style="margin-top:2px;max-height:104px;overflow:hidden">{wrows(FRIENDS[:2])}</div>'''

def act_row(state, label):
    """One activity-feed row. Kept out of the f-string: nested triple quotes
    inside an f-string expression is a syntax error before 3.12."""
    if state == 'pending':
        actions = ('<div style="margin-top:10px;display:flex;gap:8px;align-items:center">'
                   '<div class="btnbrown" style="width:150px;height:34px;border-radius:17px;font-size:13px">'
                   'Thêm vào nhật ký</div>'
                   '<div style="height:34px;padding:0 14px;display:flex;align-items:center;'
                   'font-size:13px;color:var(--muted)">Bỏ qua</div></div>')
    else:
        actions = f'<div style="margin-top:8px"><span class="chip">{label}</span></div>'
    bg = 'background:rgba(240,234,224,.3);' if state == 'pending' else ''
    dim = 'opacity:.7;' if state != 'pending' else ''
    return (f'<div style="display:flex;align-items:flex-start;gap:12px;padding:14px 16px;'
            f'border-bottom:1px solid var(--border);{bg}{dim}">'
            f'<div class="av" style="width:34px;height:34px;font-size:12px;background:var(--ink);color:#fff">KV</div>'
            f'<div style="flex:1;min-width:0">'
            f'<div style="font-size:15px;line-height:1.45">Khôi đã chia phần một bữa ăn với bạn</div>'
            f'<div class="meta" style="font-size:13px">2 giờ trước · chia phần · '
            f'<b style="color:var(--ink);font-weight:400">35%</b> · 364 kcal</div>{actions}</div></div>')

ACT = "".join(act_row(s, l) for s, l in
              [('pending',''),('accepted','Đã thêm vào nhật ký'),('gone','Không còn khả dụng')])

out.append(f'''
<div class="band">Web · narrow viewport, and the activity feed</div>
<div class="row" style="gap:30px;flex-wrap:wrap">
  <div style="width:430px"><div class="vtag">W5</div><div class="vname">Under 640px — sheet, not dialog</div>
    <div class="scrim" style="margin-top:8px;padding:0;overflow:hidden;position:relative;height:560px">
      <div style="position:absolute;left:0;right:0;bottom:0;background:#fff;border-radius:16px 16px 0 0;padding:0 0 18px">
        <div style="width:36px;height:5px;border-radius:2.5px;background:var(--border);margin:9px auto 0"></div>
        <div style="padding:10px 18px 0">
          <div style="font-family:Lora,serif;font-size:20px">Chia sẻ bữa ăn</div>
          <div class="meta" style="font-size:12px;margin-top:2px">Bánh mì thịt nướng + trà đá</div>
          {narrow_inner}
        </div>
        <div style="border-top:1px solid var(--borderFaint);margin-top:14px;padding:12px 18px 0">
          <div class="btnbrown" style="width:100%">Chia sẻ với 1 người · còn 520 kcal</div></div>
      </div></div>
    <p class="cap"><b>The centred dialog becomes a bottom sheet under 640px</b>, with the full-width button
    mobile already uses. Same components, one breakpoint — otherwise a 472px dialog on a 380px phone browser
    gets clipped on both sides.</p></div>
  <div style="width:820px">
    <div class="vtag">W6–W8</div><div class="vname">Activity rows</div>
    <div class="panel" style="margin-top:8px;padding:0">
      {ACT}
    </div>
    <p class="cap"><b>The portion and the kcal join the meta line</b> — today this row says only “chia phần”
    with no number at all, so the reader has to accept blind to find out what they are getting.
    Actions are a filled pill plus a text dismiss, not two outlined chips.</p>
  </div>
</div>''')

out.append('''
<div class="band">What is still unresolved</div>
<div style="display:flex;gap:70px;margin-top:20px">
<div class="leg">
  <div class="n">1</div><p><b>The non-split tab’s name.</b> Shipped is “Cùng một món”; I have been drawing “Nguyên phần”. Cùng một món says <i>what dish</i>, Nguyên phần says <i>how much</i> — and since the other tab is about how much, the pair reads better as Nguyên phần / Chia phần. Your call, and it is a one-string change either way.</p>
  <div class="n">2</div><p><b>The whole-portion CTA verb.</b> Both tabs currently say “Chia sẻ với N người”. If they should differ, this one becomes “Gửi cho N người”.</p>
  <div class="n">3</div><p><b>Six is the cap, but nothing designed the refusal.</b> M3 greys the seventh row; the alternative is letting the seventh selection switch the sheet to Nguyên phần automatically and say so. The second is friendlier and the first is more predictable.</p>
</div>
<div class="leg">
  <div class="n">4</div><p><b>Web has no haptics and no drag inertia</b>, so the notch needs a hover state mobile does not: cursor <code>col-resize</code>, the grip widening 2px, and the two adjacent runs lifting their saturation slightly. Not drawn yet.</p>
  <div class="n">5</div><p><b>Nobody has designed the undo.</b> A split permanently rescales your logged meal; the only current escape is editing amounts by hand afterwards. A five-second “Hoàn tác” on the success toast would cover the fat-finger case — but it means holding the transaction open or writing a compensating one.</p>
  <div class="n">6</div><p><b>Offline.</b> The sheet is reachable with no connection, the friend list comes from cache, and the share will fail at submit. Either gate the entry point on connectivity or queue it — right now it is state M14 with a confusing cause.</p>
</div>
</div>

<p style="margin:46px 0 0;font-size:12px;color:var(--muted)">Kallo · meal sharing · full state matrix · 2026-09-15</p>
</div></body></html>''')

open('docs/design/meal-share-2026-09/States.dc.html','w').write("".join(out))
print("written")
