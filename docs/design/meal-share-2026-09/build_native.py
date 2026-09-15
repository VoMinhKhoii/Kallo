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

OVERRIDE = """
/* ---- overrides, defined here so nothing inherits a stale rule ---- */
.nnotch{position:absolute;top:4px;bottom:4px;width:44px;transform:translateX(-22px);
  display:grid;place-items:center;z-index:6}
.nnotch i{display:block;width:12px;height:100%;border-radius:999px;background:#fff;
  box-shadow:0 0 0 1.5px var(--ink),0 1px 4px rgba(20,20,19,.28)}
.nnotch.touch::after{content:'';position:absolute;inset:-6px 0;border:1px dashed rgba(211,123,105,.75);
  border-radius:8px}
.nlab{display:flex;flex-direction:column;align-items:center;justify-content:flex-end;
  gap:6px;min-width:0;padding-bottom:12px}
.pin{border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:grid;place-items:center;
  box-shadow:0 3px 7px rgba(20,20,19,.26);border:2px solid #fff;overflow:hidden}
.nkcal{font-size:11px;color:var(--ink);letter-spacing:-.1px;white-space:nowrap}
.wide.off{opacity:.55}
.btnbrown.off{opacity:.55}
/* squircle family */
.sqcard{border-radius:22px}
.sqdialog{border-radius:16px}
/* threads-style notification row */
.nrow{display:flex;align-items:center;gap:12px;padding:13px 16px;border-bottom:1px solid var(--borderFaint)}
.nrow .who{font-size:15px;font-weight:600;letter-spacing:-.2px}
.nrow .when{font-size:15px;color:var(--muted);margin-left:5px}
.nrow .msg{font-size:15px;color:var(--muted);line-height:1.4;margin-top:1px}
.navwrap{position:relative;width:42px;height:42px;flex:none}
.nbadge{position:absolute;right:-2px;bottom:-2px;width:18px;height:18px;border-radius:50%;
  border:2px solid #fff;display:grid;place-items:center}
.nbadge svg{width:9px;height:9px;stroke:#fff;stroke-width:2.6;fill:none;stroke-linecap:round;stroke-linejoin:round}
.blackpill{height:36px;padding:0 16px;border-radius:18px;background:var(--ink);color:#fff;
  display:inline-flex;align-items:center;font-size:14px;white-space:nowrap;flex:none}
.ghostpill{height:36px;padding:0 16px;border-radius:18px;border:1px solid var(--border);
  color:var(--muted);display:inline-flex;align-items:center;font-size:14px;white-space:nowrap;flex:none}
.dots{width:28px;color:var(--muted);text-align:right;font-size:17px;letter-spacing:1px;flex:none}
/* surface state (KalloSurfaceState) */
.surf{text-align:center;padding:22px 16px}
.surfart{width:64px;height:64px;border-radius:20px;background:var(--track);margin:0 auto 14px;
  display:grid;place-items:center;font-size:26px}
.surftitle{font-size:16px;font-weight:600;letter-spacing:-.3px}
.surfsub{font-size:14px;color:var(--muted);line-height:1.45;margin-top:5px}
.ctablack{height:44px;border-radius:22px;background:var(--ink);color:#fff;display:flex;
  align-items:center;justify-content:center;font-size:15px;margin-top:16px}
.swatch{display:flex;align-items:center;gap:13px;padding:9px 0}
.swbox{width:56px;height:38px;background:var(--ink);flex:none}
"""

HEAD = f"""<!doctype html>
<html><head><meta charset="utf-8">
<title>Kallo — native pass: radii, rows, states</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600&family=Lora:ital,wght@0,400;1,300&display=swap">
<style>{base}{dirs}{batt}{notch}{CSS}{EXTRA}{OVERRIDE}</style>
</head><body>
<div class="board" style="width:2700px">
<h1>Native pass — <em>radii, rows, and the states I got wrong</em></h1>
<p class="sub">Four of your notes were my bugs (the notch never became a pill, the pins never lifted), and two
were me contradicting the app (the error state, the disabled dim). This board fixes all of it and puts the
squircle-versus-pill question on the table with what the code actually does.</p>
"""

out=[HEAD]
FRIENDS=[('Thu Hà','TH'),('Quốc Anh','QA'),('Lan Phương','LP')]
TWO=[('Bạn','B',10),('Mai','MN',10)]

# ---------------- squircle vs pill ----------------
def swatch(name, radius, where, note):
    return f'''<div class="swatch">
      <div class="swbox" style="border-radius:{radius}"></div>
      <div style="flex:1"><div style="font-size:15px">{name}</div>
        <div class="meta" style="font-size:13px">{where}</div></div>
      <div class="swhex" style="font-size:13px;color:var(--muted);font-family:ui-monospace,monospace">{note}</div>
    </div>'''

out.append(f'''
<div class="band">Squircle versus pill — what the code already does</div>
<p class="bandnote">From <code>KalloRadii</code> and <code>kallo_primitives.dart</code>. The split is deliberate
and documented, which is why I want you to see it before overriding it.</p>
<div class="row" style="gap:30px;align-items:flex-start">
  <div style="width:700px"><div class="panel">
    {swatch('card / sheet', '22px', 'KalloRadii.card, .sheet — every card, sheet top corners', '22')}
    <div class="gsep full"></div>
    {swatch('containerLg', '16px', 'grouped containers, invite cards', '16')}
    <div class="gsep full"></div>
    {swatch('xl', '14px', 'the battery shell sits here', '14')}
    <div class="gsep full"></div>
    {swatch('input', '26px', 'full-round 52pt text fields — a pill at that height', '26')}
    <div class="gsep full"></div>
    {swatch('button', '9999px', 'KalloRadii.button = pill. “Fully rounded (stadium) buttons, 50pt primaries / 44pt quiet.”', '∞')}
  </div>
  <p class="vcap"><b>Squircle is already the house shape for surfaces</b> — 22 on cards and sheets, 16 on
  containers. Pill is reserved for <i>buttons</i>, and that is stated outright in the primitive’s own doc
  comment. So the app is not inconsistent; it is using shape to separate <b>things you touch</b> from
  <b>things that hold content</b>.</p></div>

  <div style="width:700px">
    <div class="vtag">If you want squircle buttons anyway</div>
    <div class="panel" style="margin-top:8px">
      <div class="meta" style="margin-bottom:12px">Same button, three radii, at the shipped 50pt height.</div>
      <div class="wide" style="border-radius:9999px">Chia sẻ với 1 người · còn 520 kcal</div>
      <div class="meta" style="margin:9px 0 4px;font-size:12px">pill 9999 — shipped</div>
      <div class="wide" style="border-radius:18px">Chia sẻ với 1 người · còn 520 kcal</div>
      <div class="meta" style="margin:9px 0 4px;font-size:12px">squircle 18 — iOS 26 / Liquid Glass leans here</div>
      <div class="wide" style="border-radius:14px">Chia sẻ với 1 người · còn 520 kcal</div>
      <div class="meta" style="margin:9px 0 4px;font-size:12px">squircle 14 — matches the battery shell exactly</div>
    </div>
    <p class="vcap"><b>My read:</b> 14 is the interesting one, because it makes the button and the meter the
    same object family — the thing you drag and the thing you press share a corner. But this is an
    <b>app-wide</b> change, not a share-sheet change: every primary in Kallo is a stadium today, and one
    squircle button in one sheet would read as a bug. <b>Your call, and it belongs in its own pass.</b></p>
  </div>
</div>''')

# ---------------- threads-style rows ----------------
def nrow(state):
    if state == 'pending':
        action = '<div class="blackpill">Thêm vào nhật ký</div>'
        msg = 'Đã chia phần một bữa ăn với bạn · <b style="color:var(--ink);font-weight:400">35%</b> · 364 kcal'
        bg = ''
    elif state == 'accepted':
        action = ''
        msg = 'Bạn đã thêm phần 35% vào nhật ký'
        bg = 'opacity:.75;'
    else:
        action = ''
        msg = 'Lời mời không còn khả dụng'
        bg = 'opacity:.75;'
    badge = ('<div class="nbadge" style="background:#12B76A">'
             '<svg viewBox="0 0 24 24"><path d="m20 6-11 11-5-5"/></svg></div>')
    return f'''<div class="nrow" style="{bg}">
      <div class="navwrap">
        <div class="av" style="width:42px;height:42px;font-size:14px;background:var(--ink);color:#fff">KV</div>
        {badge}</div>
      <div style="flex:1;min-width:0">
        <div><span class="who">Khôi</span><span class="when">2 giờ</span></div>
        <div class="msg">{msg}</div></div>
      {action}
      <div class="dots">···</div></div>'''

out.append(f'''
<div class="band">The notification row, Threads-style</div>
<p class="bandnote">Avatar with a state badge, name and time on one line, the message under it, the action as a
pill on the <b>right</b>, vertically centred, with the overflow dots last. Threads uses white-on-dark for the
live action; our equivalent on a cream canvas is the black pill.</p>
<div class="row" style="gap:30px;align-items:flex-start">
  <div style="width:760px">
    <div class="vtag">Circle · Lời mời</div>
    <div class="panel" style="margin-top:8px;padding:0;overflow:hidden">
      {nrow('pending')}{nrow('accepted')}{nrow('gone')}
    </div>
    <p class="vcap"><b>No status chips.</b> You were right that they read as web. A resolved invite has no
    action left, so the row simply loses its pill and the <i>message line itself</i> carries the outcome —
    which is exactly what Threads does with “You’re now following”. The row dims to 0.75 and stays as history.</p>
  </div>
  <div style="width:800px">
    <div class="vtag">Why the black pill</div>
    <div class="panel" style="margin-top:8px">
      <div class="leg" style="max-width:none">
        <div class="n good">1</div><p><b>One live action per row, highest contrast available.</b> Threads puts a white pill on black; on cream the same role is ink-on-white → <b>black pill, white text</b>. The dismiss is not a second button — it moves into the <code>···</code> overflow, the way Threads hides “Hide this notification”.</p>
        <div class="n">2</div><p><b>This expands a reserved tier.</b> <code>kallo_primitives.dart</code> scopes the black <code>cta</code> to auth and the paywall, plus the one sanctioned use in surface states. A notification-row action would be a fourth. I think it is the right call — it is the only place in Circle with a real commitment — but it should be written into the spec as a deliberate widening, not slipped in.</p>
        <div class="n good">3</div><p><b>The badge does the typing.</b> A green check on the avatar says “a share arrived” before any text is read, and it is the same badge shape Threads uses for follow/reply/like. It also survives the row going quiet — history still shows what kind of thing it was.</p>
      </div>
    </div>
  </div>
</div>''')

# ---------------- fixed sheet: notch, pins, height, cancel ----------------
def sheet_fix(body, lane_html, primary, height=680, lane=150, mode='split', cancel=True):
    footer = f'<div class="wide">{primary}</div>'
    if cancel:
        footer += '<div class="wide ghost" style="height:44px;font-size:15px;margin-top:8px">Huỷ</div>'
    return f'''<div class="sheet" style="height:{height}px;padding-bottom:0">
        {sheet_header('Chia sẻ bữa ăn', 'Bánh mì thịt nướng + trà đá')}
        <div style="padding:8px 16px 0">
          <div>{seg('Nguyên phần','Chia phần','left' if mode=='whole' else 'right', w=358)}</div>
          {body}
          <div class="meta" style="margin-top:18px">Thêm bạn bè</div>
          <div class="addlane" style="height:{lane}px">{lane_html}<div class="lanefade"></div></div>
        </div>
        <div style="padding:14px 16px 22px;border-top:1px solid var(--borderFaint)">{footer}</div>
      </div>'''

def lane(items):
    h="".join(addrow(n,i)+'<div class="gsep" style="margin-left:46px"></div>' for n,i in items)
    return h.removesuffix('<div class="gsep" style="margin-left:46px"></div>')

def phone(inner, tag, title, note, dim=True):
    return f'''
  <div class="cell"><div class="vtag">{tag}</div><div class="vname">{title}</div>
    <div class="phone" style="margin-top:10px"><div class="island"></div><div class="screen">
      <div class="sbar"><span>9:41</span><span>●●●</span></div>
      {'<div class="dim"></div>' if dim else ''}{inner}
      <div class="homebar"></div>
    </div></div><p class="cap">{note}</p></div>'''

# 56pt shell for a thumb-friendly drag
big_meter = control(TWO, h=56, avatar=30)
split_body = f'''<div style="margin-top:18px">{big_meter}</div>
  <div style="display:flex;justify-content:flex-end;margin-top:8px">
    <span class="meta" style="color:var(--ink)">Chia đều</span></div>'''

touch_meter = control(TWO, h=56, avatar=30).replace('class="nnotch"', 'class="nnotch touch"')

surf_empty = '''<div class="surf">
  <div class="surfart">🐾</div>
  <div class="surftitle">Chưa có ai trong danh sách</div>
  <div class="surfsub">Thêm một người bạn để có thể chia sẻ bữa ăn với họ.</div>
  <div class="ctablack">Thêm bạn bè</div></div>'''
surf_error = '''<div class="surf">
  <div class="surfart">🫙</div>
  <div class="surftitle">Không tải được danh sách</div>
  <div class="surfsub">Kiểm tra kết nối rồi thử lại nhé.</div>
  <div class="ctablack">Thử lại</div></div>'''

out.append('<div class="band">The sheet, with the four bugs fixed</div><div class="row">')

out.append(phone(sheet_fix(split_body, lane(FRIENDS),
    'Chia sẻ với 1 người · còn 520 kcal'),
    'F1','Notch, pins, height, Cancel',
    '<b>The notch is a pill now</b> — it was inheriting a <code>border-radius:5px</code> rule from an earlier '
    'board that my patch never actually replaced. <b>Pins clear the shell by 12pt.</b> Shell is 56pt so the '
    'drag lives in a comfortable band, and <b>Huỷ sits under the primary</b>.'))

out.append(phone(sheet_fix(f'''<div style="margin-top:18px">{touch_meter}</div>
  <div style="display:flex;justify-content:flex-end;margin-top:8px">
    <span class="meta" style="color:var(--ink)">Chia đều</span></div>''', lane(FRIENDS),
    'Chia sẻ với 1 người · còn 520 kcal'),
    'F2','The touch target, drawn',
    'Dashed terracotta is the <b>44×68pt hit box</b>, not a visual. The grip is 12pt wide; the target extends '
    '16pt either side and 6pt above and below the 56pt shell, so a thumb never has to find a 12pt line.'))

out.append(phone(sheet_fix(surf_empty, '', 'Chia sẻ', height=640, lane=0, cancel=True).replace(
    '<div class="meta" style="margin-top:18px">Thêm bạn bè</div>','').replace(
    '<div class="wide">Chia sẻ</div>','<div class="wide off">Chia sẻ</div>'),
    'F3','No circle — the house anatomy',
    '<code>KalloSurfaceState</code>: illustration, title, one supporting line, one action. The action is the '
    '<b>black cta</b>, which is the tier surface states are already allowed to use. <b>Not a dashed box, not '
    'terracotta</b> — that was my invention.'))

out.append(phone(sheet_fix(surf_error, '', 'Chia sẻ', height=640, lane=0, cancel=True).replace(
    '<div class="meta" style="margin-top:18px">Thêm bạn bè</div>','').replace(
    '<div class="wide">Chia sẻ</div>','<div class="wide off">Chia sẻ</div>'),
    'F4','Load failed — same anatomy',
    '<b>“There is no red here — a retry is not a destruction.”</b> That is <code>circle_error.dart</code>’s own '
    'comment, and my terracotta error box broke it. Danger in this app is for delete, sign-out and error '
    '<i>copy</i> — never for a retryable fetch. Disabled dims to <b>0.55</b>, not 0.45.'))
out.append('</div>')

# ---------------- web dialog on the squircle ----------------
def wrows(items):
    h="".join(f'''<div class="wrow"><div class="av">{i}</div><div style="flex:1;font-size:14px">{n}</div></div>
      <div class="gsep" style="margin-left:42px"></div>''' for n,i in items)
    return h.removesuffix('<div class="gsep" style="margin-left:42px"></div>')

def wdialog(body, footer, radius=16):
    return f'''<div class="wdialog" style="border-radius:{radius}px">
      <div style="padding:20px 22px 0;display:flex;align-items:flex-start">
        <div style="flex:1">
          <div style="font-family:Lora,serif;font-size:22px;letter-spacing:-.2px">Chia sẻ bữa ăn</div>
          <div class="meta" style="margin-top:3px;font-size:13px">Bánh mì thịt nướng + trà đá · 1.040 kcal</div></div>
        <div style="width:32px;height:32px;border-radius:10px;display:grid;place-items:center;
             background:var(--track)">
          <svg style="width:16px;height:16px;stroke:var(--soft);stroke-width:1.8;fill:none;stroke-linecap:round"
               viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg></div>
      </div>
      <div style="padding:0 22px">{body}</div>
      <div style="border-top:1px solid var(--borderFaint);margin-top:16px;padding:14px 22px;
           display:flex;align-items:center;justify-content:flex-end;gap:12px">{footer}</div></div>'''

wbody = f'''<div style="margin-top:14px">{seg('Nguyên phần','Chia phần','right', w=428).replace('height:40px','height:36px').replace('font-size:15px','font-size:13px').replace('border-radius:20px','border-radius:12px').replace('border-radius:17px','border-radius:9px')}</div>
  <div style="margin-top:16px">{control(TWO, h=50, avatar=28)}</div>
  <div style="display:flex;justify-content:flex-end;margin-top:8px">
    <span class="meta" style="font-size:12px;color:var(--ink)">Chia đều</span></div>
  <div class="meta" style="margin-top:16px;font-size:12px">Thêm bạn bè</div>
  <div style="margin-top:2px;max-height:142px;overflow:hidden">{wrows(FRIENDS)}</div>'''

WG = '<div class="btnghost" style="width:92px;border-radius:12px">Huỷ</div>'
WB = '<div class="btnbrown" style="width:210px;border-radius:12px">Chia sẻ · còn 520 kcal</div>'

out.append(f'''
<div class="band">Web · the dialog on the squircle family</div>
<p class="bandnote">Web radii run 4 / 6 / 8 / 12 / 16. The dialog takes <b>16</b>, its controls take
<b>12</b>, and the close button becomes a 10pt squircle tile instead of a bare glyph — so the whole dialog is
one corner family instead of three.</p>
<div class="row" style="gap:36px;align-items:flex-start">
  <div style="width:580px"><div class="vtag">Before</div><div class="vname">Mixed corners</div>
    <div class="scrim" style="margin-top:8px;border-radius:22px">{wdialog(wbody, WG.replace('border-radius:12px','border-radius:11px') + '<div class="btnbrown" style="width:210px;border-radius:11px">Chia sẻ · còn 520 kcal</div>', 14)}</div>
    <p class="cap">14pt dialog, 11pt buttons, 20pt segmented track, bare X. Four radii, no family.</p></div>
  <div style="width:580px"><div class="vtag">After</div><div class="vname">One family, 16 / 12 / 10</div>
    <div class="scrim" style="margin-top:8px;border-radius:22px">{wdialog(wbody, WG + WB, 16)}</div>
    <p class="cap"><b>Dialog 16, buttons and segmented 12, close tile 10.</b> Each step is the next token down,
    so the nesting reads as deliberate. The meter keeps 14 because it is the one element shared verbatim with
    mobile — a squircle on both platforms at the same number.</p></div>
</div>

<div class="band">What this changes in the spec</div>
<div style="display:flex;gap:70px;margin-top:20px">
<div class="leg">
  <div class="n good">1</div><p><b>Error and empty states are not new UI.</b> They are <code>KalloSurfaceState</code> with <code>compact: true</code>, area <code>circle</code>, kind <code>empty</code> / <code>error</code> — the cast pose comes for free, and the web twin lives at <code>components/shared/surface-state/</code>. One line each, not a design.</p>
  <div class="n good">2</div><p><b>Disabled is 0.55 and press is a 150 ms colour shift.</b> Straight from <code>kallo_primitives.dart</code>. Every mockup I drew used an opacity dim for press, which is the Material default the app deliberately left behind.</p>
  <div class="n">3</div><p><b>The black pill in a notification row widens a reserved tier.</b> Worth one line in the spec so it is a decision rather than drift.</p>
</div>
<div class="leg">
  <div class="n good">4</div><p><b>Shell height 56, grip 12, target 44×68.</b> The meter is the only draggable surface in the app, so it does not inherit a hit-target convention — it needs its own, and 44 is the app’s stated minimum (<code>KalloIcons.hit</code>).</p>
  <div class="n">5</div><p><b>Squircle buttons are an app-wide question.</b> Not something to settle inside the share sheet. If you want it, it is a separate pass over <code>KalloRadii.button</code> and every primary in the app at once.</p>
  <div class="n">6</div><p><b>Still unanswered from last round:</b> the undo on an irreversible split, and what happens offline.</p>
</div>
</div>

<p style="margin:46px 0 0;font-size:12px;color:var(--muted)">Kallo · meal sharing · native pass · 2026-09-16</p>
</div></body></html>''')

open('docs/design/meal-share-2026-09/Native.dc.html','w').write("".join(out))
print("written")
