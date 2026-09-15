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

GRIP = """
/* the shell clips its cells but NOT the grip, so the grip can overhang */
.gshell{position:relative;border:2px solid var(--ink);border-radius:14px;background:#fff;padding:4px;
  display:flex}
.gclip{flex:1;display:flex;gap:2px;overflow:hidden;border-radius:10px}
.grip{position:absolute;width:44px;transform:translateX(-22px);display:grid;place-items:center;z-index:8}
.grip i{display:block;background:#fff;border-radius:999px;
  box-shadow:0 0 0 1.5px var(--ink),0 1px 4px rgba(20,20,19,.28)}
.grip.rest i{width:12px}
.grip.hold i{width:14px;box-shadow:0 0 0 1.5px var(--ink),0 3px 10px rgba(20,20,19,.34)}
.stateline{display:flex;gap:10px;align-items:baseline;margin-top:12px}
.statekey{font-size:12px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);width:74px;flex:none}
.statedesc{font-size:13px;line-height:1.5;color:var(--soft)}
.adopt{display:flex;align-items:center;gap:10px;padding:7px 0;font-size:13px}
.adopt .tick{width:16px;height:16px;border-radius:50%;flex:none;display:grid;place-items:center;font-size:10px;color:#fff}
"""

HEAD = f"""<!doctype html>
<html><head><meta charset="utf-8">
<title>Kallo — the grip, and the state component</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600&family=Lora:ital,wght@0,400;1,300&display=swap">
<style>{base}{dirs}{batt}{notch}{CSS}{EXTRA}{OVERRIDE}{GRIP}</style>
</head><body>
<div class="board" style="width:2400px">
<h1>The grip, <em>and whether the state component is really unified</em></h1>
<p class="sub">Two last things before planning: what the drag handle does at rest, on hold and mid-drag, and a
straight answer on the animal-illustration state surface.</p>
"""
out=[HEAD]

def gbar(state='rest', mine=13, of=20, h=56, over=0, w=520):
    cells = "".join(
        f'<div class="bcell" style="flex:1;background:{BRIGHT[0][0] if k<mine else BRIGHT[1][0]};'
        f'border-radius:6px"></div>' for k in range(of))
    pos = mine/of*100
    grip_h = h + over
    return f'''<div style="display:flex;align-items:center;width:{w}px">
      <div class="gshell" style="height:{h}px;flex:1">
        <div class="gclip">{cells}</div>
        <div class="grip {state}" style="left:{pos}%;top:{-over/2}px;height:{grip_h}px"><i style="height:100%"></i></div>
      </div><div class="bnub"></div></div>'''

out.append(f'''
<div class="band">The grip — three states</div>
<p class="bandnote">The problem you named: a 12pt white bar inset inside a shell full of 12pt white gaps
disappears into the pattern. The fix is that the grip is the only thing in the control that <b>spans the full
height</b>, and it grows past the shell the moment you touch it.</p>
<div class="row" style="gap:44px;align-items:flex-start;flex-wrap:wrap">

  <div style="width:640px"><div class="vtag">Rest</div><div class="vname">Flush — touches top and bottom</div>
    <div class="panel" style="margin-top:10px">{gbar('rest', over=0, h=56)}</div>
    <p class="vcap">Height <b>56pt, the full shell</b>, so it reads as a seam cut through the whole battery
    rather than one more white gap between cells. 12pt wide, ink hairline, fully rounded ends.</p></div>

  <div style="width:640px"><div class="vtag">Hold</div><div class="vname">Finger down — grows 12pt</div>
    <div class="panel" style="margin-top:10px">{gbar('hold', over=12, h=56)}</div>
    <p class="vcap"><b>Overhangs 6pt above and below</b> and widens to 14pt, with a deeper shadow. It is now
    taller than anything else in the row, so it cannot be confused with a cell gap — and the growth is the
    confirmation that the touch landed, which is what replaces a hover state on touch.</p></div>

  <div style="width:640px"><div class="vtag">Drag</div><div class="vname">Moving — stays grown, tracks the part</div>
    <div class="panel" style="margin-top:10px">{gbar('hold', mine=16, over=12, h=56)}</div>
    <p class="vcap">Same grown shape, snapping part to part with a <code>selectionClick</code> each time.
    Release animates back to rest over 140 ms. <b>The two pins and their kcal track it live</b> the whole way.</p></div>

  <div style="width:640px"><div class="vtag">Why not just wider</div><div class="vname">12pt versus a fat handle</div>
    <div class="panel" style="margin-top:10px">{gbar('rest', over=0, h=56)}
      <div style="height:14px"></div>{gbar('rest', over=0, h=56, w=520).replace('.grip rest','').replace('width:12px','width:26px')}</div>
    <p class="vcap">A 26pt grip does not disappear either, but at six people a part is only 17.9pt — the handle
    would be wider than the thing it points at. <b>Height is the axis with room to spare; width is not.</b>
    That is why the growth is vertical.</p></div>
</div>

<div class="rulebox" style="max-width:2320px;margin-top:8px">
<p><b>Hit target is unchanged and independent of all three.</b> 44pt wide, 68pt tall, centred on the grip —
the visual can be 12pt because the target never is. Two adjacent grips can never be closer than two parts
(35.8pt), so the targets overlap slightly at the floor; ties go to the grip whose centre is nearer the touch.</p>
</div>''')

ADOPTERS = [
 ('thread_feed.dart', 1), ('create_group_empty.dart', 1), ('circle_error.dart', 1),
 ('thread_body.dart', 1), ('thread_states.dart', 1), ('section_state.dart', 1),
 ('today_meal_list.dart', 1), ('logging_day_error_state.dart', 1),
 ('nutrition/empty_state.dart', 1), ('nutrition/inline_error.dart', 1),
 ('micronutrients_locked_card.dart', 1), ('profile_status_views.dart', 1),
 ('route_error_screen.dart', 1),
 ('share_meal_sheet.dart', 0), ('meal_invites.dart', 0),
 ('friend_list_skeleton.dart', 0), ('web · share-meal-dialog.tsx', 0),
]
rows = "".join(
    f'''<div class="adopt">
      <div class="tick" style="background:{'#12B76A' if ok else '#F04438'}">{'✓' if ok else '✕'}</div>
      <div style="flex:1;font-family:ui-monospace,SFMono-Regular,monospace;font-size:12.5px;
           color:{'var(--soft)' if ok else 'var(--ink)'}">{n}</div>
      <div class="meta" style="font-size:12px">{'KalloSurfaceState' if ok else 'bare Text'}</div></div>'''
    for n, ok in ADOPTERS)

surf = '''<div class="surf">
  <div class="surfart">🦫</div>
  <div class="surftitle">Chưa có ai trong danh sách</div>
  <div class="surfsub">Thêm một người bạn để có thể chia sẻ bữa ăn với họ.</div>
  <div class="ctablack">Thêm bạn bè</div></div>'''

out.append(f'''
<div class="band">Is the animal state surface actually unified? Yes — and the share flow is the hole in it</div>
<div class="row" style="gap:40px;align-items:flex-start">
  <div style="width:760px"><div class="panel">{rows}</div>
    <p class="vcap"><b>13 mobile call sites and a web twin</b> at <code>components/shared/surface-state/</code>,
    all going through one widget that picks a capybara pose from
    <code>(area, kind)</code> — and after 22:00 a sleeping pose. It is unified.
    <b>The four red rows are the entire share flow.</b> It renders
    <code>Text(tr('groups.shareMeal.noFriends'))</code> and <code>Text(tr('groups.shareMeal.error'))</code> as
    bare lines, which is exactly the drift you felt.</p></div>
  <div style="width:520px"><div class="vtag">What the share sheet should render</div>
    <div class="panel" style="margin-top:8px;padding:0">
      <div style="background:var(--elev);border-radius:22px;overflow:hidden">{surf}</div></div>
    <p class="vcap"><code>KalloSurfaceState(area: SurfaceArea.circle, kind: SurfaceKind.empty, compact: true)</code>
    → <b>capybara-telescope</b> for “no circle yet”, <b>capybara-stuck-jar</b> for a failed fetch. One line each.
    Nothing to design: the pose, the spacing, the black action tier and the <code>liveRegion</code> semantics
    all come with it.</p></div>
</div>

<div class="rulebox" style="max-width:2320px">
<p><b>One bonus find.</b> <code>SurfaceKind</code> already has an <code>offline</code> member. That answers the
offline question I left open two rounds ago — the app has a designed offline surface and the share sheet
should use it rather than failing at submit with a generic toast.</p>
</div>

<p style="margin:46px 0 0;font-size:12px;color:var(--muted)">Kallo · meal sharing · grip &amp; state audit · 2026-09-16</p>
</div></body></html>''')

open('docs/design/meal-share-2026-09/Grip.dc.html','w').write("".join(out))
print("written")
