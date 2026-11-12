#!/usr/bin/env python3
"""Build the Yam-el-Yam (Sea to Sea) GPX files for a 24-hour attempt.

Steps:
  1. Download OSM relation 2860967 ("מסע מים אל ים", purple trail marking).
  2. Build a graph from all of the relation's ways and take the shortest path
     from Yad LeYad / Achziv (node 13289769538) to the Kinneret
     (node 10254819616).
  3. Add elevations from the Israel Hiking Map API (200 points per request).
  4. Cut the track at the water points (km 0, 8.0, 19.9, 29.6, 38.9, 43.2,
     49.8, 62.1, end) into 8 colored <trk> elements that Mapeak can show.
  5. Add a <wpt> for each water refill point, and nothing else.

Outputs (in --out):
  yam-el-yam-color-segments.gpx    8 colored tracks + waypoints (load this one into Mapeak)
  yam-el-yam-water-v3.gpx          one track + the same waypoints (for other apps)
  yam-el-yam-segments-preview.png  map + elevation profile (needs matplotlib; before 3.11 also python-bidi)

Usage:
  python3 -I build_gpx.py --cache DIR --out DIR [--no-png]

--cache holds the downloaded relation and the elevation cache; files that are
already there are reused instead of downloaded again.
"""

import argparse
import bisect
import heapq
import json
import math
import os
import sys
import time
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta
from xml.sax.saxutils import escape

RELATION_ID = 2860967
START_NODE = 13289769538  # Yad LeYad, Achziv beach
END_NODE = 10254819616  # Kinneret, Nahal Amud outlet
OSM_URL = f"https://api.openstreetmap.org/api/0.6/relation/{RELATION_ID}/full"
ELEVATION_URL = "https://israelhiking.osm.org.il/api/elevation"
ELEVATION_BATCH = 200
USER_AGENT = "yam-el-yam-gpx-builder/1.0"
R_EARTH = 6371008.8

# Segment boundaries (km along the route). The last boundary is the end of the route.
CUT_KM = [0.0, 8.0, 19.9, 29.6, 38.9, 43.2, 49.8, 62.1]

# color, from, to, planned time, water to carry from the start of the segment, notes
SEGMENTS = [
    ("#E6194B", 'יד לי"ד', "עין חרדלית", "18:00–19:40", "יוצאים עם 3 ל' מהבית", ""),
    ("#4363D8", "עין חרדלית", "אבירים", "19:40–23:45", "להשלים ל-3 ל'",
     "לא שותים ממי נחל כזיב. מתחת למונפור (ק\"מ 13.1) לא עולים למבצר; אם הנחל גבוה הולכים בדרך העפר שבגדה. "
     "בעין טמיר (ק\"מ 16) עולים לאבירים – קל לפספס את הפנייה. שער 1: להגיע לאבירים עד 01:00."),
    ("#F58231", "אבירים", "גשר אלקוש", "23:45–02:30", "2 ל'", ""),
    ("#911EB4", "אלקוש", "חורבת חממה", "02:30–05:15", "2 ל'", ""),
    ("#000000", "חממה", "פסגת מירון", "05:15–07:15", "1.5 ל'", "שער 2: להגיע לפסגת מירון עד 08:30."),
    ("#F032E6", "פסגה", "חניון הפיתול", "07:15–09:00", "1.5 ל'", ""),
    ("#9A6324", "הפיתול", "כביש 85", "09:00–13:15", "3 ל' מלא",
     "שער 3: יוצאים מהפיתול עד 10:00, אחרת מסיימים בכביש 866. "
     "מבריכות שכווי (ק\"מ 53.8) קטעי יתדות וסלע – לאט ובזוג."),
    ("#008080", "כביש 85", "הכנרת", "13:15–16:05", "3 ל' מלא (מים אחרונים)",
     "שער 4: יוצאים מכביש 85 עד 14:00, אחרת לא נכנסים לעמוד התחתון בחושך. "
     "בכנרת: חזירי בר בשביל הבמבוק וכלבים משוטטים."),
]

# Water refill points, the only waypoints in the GPX (one at the start of each segment
# after the first): plan km, name, lat, lon, what to know there.
REFILL = [
    (8.0, "עין חרדלית", 33.04234, 35.1783894, "ברז על השביל. ממלאים ל-3 ל'."),
    (19.9, "חניון אבירים", 33.0428189, 35.2868911,
     "ברז בחניון הלילה, 300 מ' מהחיבור לכביש 8925 לכיוון אבירים, משמאל. 2 ל'."),
    (29.6, "גשר אלקוש", 33.0222440, 35.3288989,
     "תחנת הדלק (חורפיש) ומכולת מנטה, פתוחות 24/7, כ-300 מ' מהשביל. 2 ל'."),
    (38.9, "חורבת חממה", 33.0090773, 35.3936043, "ברז על השביל. 1.5 ל'. גיבוי: בי\"ס שדה מירון, 300 מ'."),
    (43.2, "חניון פסגת מירון", 32.9935301, 35.41435, "ברז על השביל. 1.5 ל'."),
    (49.8, "חניון הפיתול", 32.979093, 35.442061, "ברז על השביל. 3 ל' מלא. גיבוי: תחנת דלק במירון, כ-900 מ'."),
    (62.1, "כביש 85 – ברז מקורות", 32.912308, 35.4853811,
     "בצד המערבי של המתחם, מצפון לכביש, כ-220 מ' מהשביל. 3 ל' מלא – מים אחרונים."),
]

# Plan: km, arrival (clock), stop minutes, name. Used for the preview and for the
# km at sunrise. Arrival times after midnight belong to the next day.
SCHEDULE = [
    (0.0, "18:00", 0, 'יד לי"ד'),
    (8.0, "19:40", 10, "עין חרדלית"),
    (16.0, "22:00", 15, "עין טמיר"),
    (19.9, "23:45", 25, "חניון אבירים"),
    (29.6, "02:30", 10, "גשר אלקוש"),
    (38.9, "05:15", 25, "חורבת חממה"),
    (43.2, "07:15", 10, "פסגת מירון"),
    (49.8, "09:00", 25, "חניון הפיתול"),
    (53.8, "10:35", 10, "בריכות שכווי"),
    (62.1, "13:15", 15, "כביש 85"),
    (67.5, "14:55", 10, "עין עמוד"),
    (None, "16:05", 0, "הכנרת"),  # None = end of route
]
SUNRISE = "06:03"
DAY0 = datetime(2000, 1, 1)  # any date: only the clock times are used

# Full names of the segment start points, for the preview labels.
SCHEDULE_NAME = {0.0: 'יד לי"ד', 8.0: "עין חרדלית", 19.9: "חניון אבירים", 29.6: "גשר אלקוש",
                 38.9: "חורבת חממה", 43.2: "פסגת מירון", 49.8: "חניון הפיתול", 62.1: "כביש 85"}


# ---------------------------------------------------------------- helpers

def haversine(lat1, lon1, lat2, lon2):
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R_EARTH * math.asin(math.sqrt(a))


def http(url, body=None, timeout=90):
    headers = {"User-Agent": USER_AGENT}
    if body is not None:
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=body, headers=headers)
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return resp.read()
        except Exception as exc:  # network hiccup: back off and retry
            if attempt == 3:
                raise
            wait = 2 ** (attempt + 1)
            print(f"  retry in {wait}s after: {exc}", file=sys.stderr)
            time.sleep(wait)


def load_relation(cache_dir):
    path = os.path.join(cache_dir, f"relation_{RELATION_ID}_full.xml")
    if not os.path.exists(path):
        print(f"downloading {OSM_URL}")
        data = http(OSM_URL)
        with open(path, "wb") as f:
            f.write(data)
    root = ET.parse(path).getroot()
    nodes = {int(n.get("id")): (float(n.get("lat")), float(n.get("lon"))) for n in root.iter("node")}
    ways = {int(w.get("id")): [int(nd.get("ref")) for nd in w.iter("nd")] for w in root.iter("way")}
    rel = next(r for r in root.iter("relation") if int(r.get("id")) == RELATION_ID)
    members = [int(m.get("ref")) for m in rel.iter("member") if m.get("type") == "way"]
    return nodes, ways, members, rel.get("version"), rel.get("timestamp")


def shortest_path(nodes, ways, members, start, end):
    adj = {}
    for wid in members:
        refs = ways[wid]
        for a, b in zip(refs, refs[1:]):
            d = haversine(*nodes[a], *nodes[b])
            adj.setdefault(a, []).append((b, d))
            adj.setdefault(b, []).append((a, d))
    dist, prev, heap = {start: 0.0}, {}, [(0.0, start)]
    while heap:
        d, u = heapq.heappop(heap)
        if u == end:
            break
        if d > dist[u]:
            continue
        for v, w in adj.get(u, ()):
            nd = d + w
            if nd < dist.get(v, math.inf):
                dist[v], prev[v] = nd, u
                heapq.heappush(heap, (nd, v))
    if end not in dist:
        sys.exit("no path between start and end inside the relation (gap in the ways?)")
    path = [end]
    while path[-1] != start:
        path.append(prev[path[-1]])
    return path[::-1]


def elevations(points, cache_dir):
    """Elevation for each (lat, lon), cached by rounded coordinates."""
    path = os.path.join(cache_dir, "elevation_cache.json")
    cache = {}
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            cache = json.load(f)
    keys = [f"{lat:.7f},{lon:.7f}" for lat, lon in points]
    missing = [k for k in dict.fromkeys(keys) if k not in cache]
    for i in range(0, len(missing), ELEVATION_BATCH):
        chunk = missing[i:i + ELEVATION_BATCH]
        body = json.dumps([[float(k.split(",")[1]), float(k.split(",")[0])] for k in chunk]).encode()
        result = json.loads(http(ELEVATION_URL, body))
        if len(result) != len(chunk):
            sys.exit(f"elevation API returned {len(result)} values for {len(chunk)} points")
        for k, e in zip(chunk, result):
            cache[k] = float(e)
        print(f"  elevations {min(i + ELEVATION_BATCH, len(missing))}/{len(missing)}")
        time.sleep(0.3)
    if missing:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(cache, f)
    return [cache[k] for k in keys]


def km_label(km):
    return f"{km:.1f}" if km else "0"


def cumulative(pts):
    cum = [0.0]
    for a, b in zip(pts, pts[1:]):
        cum.append(cum[-1] + haversine(a[0], a[1], b[0], b[1]))
    return cum


def point_at(pts, cum, s):
    """Interpolated (lat, lon, ele) at distance s (m) along the track."""
    i = min(max(bisect.bisect_right(cum, s) - 1, 0), len(pts) - 2)
    span = cum[i + 1] - cum[i]
    t = (s - cum[i]) / span if span > 0 else 0.0
    t = min(max(t, 0.0), 1.0)
    a, b = pts[i], pts[i + 1]
    return tuple(a[k] + t * (b[k] - a[k]) for k in range(3))


def cut(pts, cum, s0, s1):
    inner = [pts[k] for k in range(len(pts)) if s0 < cum[k] < s1]
    return [point_at(pts, cum, s0)] + inner + [point_at(pts, cum, s1)]


def climb(eles, threshold=0.0):
    """Total ascent and descent. threshold > 0 ignores wiggles smaller than it."""
    up = down = 0.0
    ref = eles[0]
    for e in eles[1:]:
        diff = e - ref
        if diff > threshold:
            up += diff
            ref = e
        elif diff < -threshold:
            down -= diff
            ref = e
        elif threshold == 0.0:
            ref = e
    return up, down


def project(pts, cum, lat, lon):
    """(km along the track, distance from the track in m) of the closest track point."""
    kx = math.cos(math.radians(lat)) * math.pi / 180 * R_EARTH
    ky = math.pi / 180 * R_EARTH
    best = (math.inf, 0, 0.0)
    for i in range(len(pts) - 1):
        ax, ay = (pts[i][1] - lon) * kx, (pts[i][0] - lat) * ky
        bx, by = (pts[i + 1][1] - lon) * kx, (pts[i + 1][0] - lat) * ky
        dx, dy = bx - ax, by - ay
        l2 = dx * dx + dy * dy
        t = 0.0 if l2 == 0 else max(0.0, min(1.0, -(ax * dx + ay * dy) / l2))
        d = math.hypot(ax + t * dx, ay + t * dy)
        if d < best[0]:
            best = (d, i, t)
    d, i, t = best
    return (cum[i] + t * (cum[i + 1] - cum[i])) / 1000, d


def schedule_times(total_km):
    """[(km, arrive datetime, depart datetime, name)] with the day rollover applied."""
    day0 = DAY0
    out, last = [], None
    for km, hhmm, stop, name in SCHEDULE:
        h, m = map(int, hhmm.split(":"))
        t = day0.replace(hour=h, minute=m)
        while last is not None and t < last:
            t += timedelta(days=1)
        out.append((total_km if km is None else km, t, t + timedelta(minutes=stop), name))
        last = t
    return out


def km_at_time(sched, when):
    for (k0, _, dep0, _), (k1, arr1, _, _) in zip(sched, sched[1:]):
        if dep0 <= when <= arr1:
            return k0 + (k1 - k0) * (when - dep0) / (arr1 - dep0)
        if when < dep0:
            return k0
    return sched[-1][0]


# ---------------------------------------------------------------- GPX output

def q(text):
    return escape(text)


def gpx_header(name, desc, bounds):
    minlat, minlon, maxlat, maxlon = bounds
    return [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<gpx version="1.1" creator="yam-el-yam build_gpx.py" '
        'xmlns="http://www.topografix.com/GPX/1/1" '
        'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" '
        'xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">',
        "  <metadata>",
        f"    <name>{q(name)}</name>",
        f"    <desc>{q(desc)}</desc>",
        '    <copyright author="OpenStreetMap contributors">',
        "      <license>https://opendatacommons.org/licenses/odbl/</license>",
        "    </copyright>",
        f'    <link href="https://www.openstreetmap.org/relation/{RELATION_ID}">',
        f"      <text>OSM relation {RELATION_ID}</text>",
        "    </link>",
        f'    <bounds minlat="{minlat:.7f}" minlon="{minlon:.7f}" maxlat="{maxlat:.7f}" maxlon="{maxlon:.7f}"/>',
        "  </metadata>",
    ]


def gpx_wpt(w):
    return [
        f'  <wpt lat="{w["lat"]:.7f}" lon="{w["lon"]:.7f}">',
        f'    <ele>{w["ele"]:.1f}</ele>',
        f'    <name>{q(w["name"])}</name>',
        f'    <desc>{q(w["desc"])}</desc>',
        f'    <sym>{w["sym"]}</sym>',
        f'    <type>{q(w["type"])}</type>',
        "  </wpt>",
    ]


def gpx_trk(name, desc, number, color, opacity, weight, pts):
    lines = [
        "  <trk>",
        f"    <name>{q(name)}</name>",
        f"    <desc>{q(desc)}</desc>",
        f"    <number>{number}</number>",
        "    <extensions>",
        f"      <Color>{color}</Color>",
        f"      <Opacity>{opacity}</Opacity>",
        f"      <Weight>{weight}</Weight>",
        "    </extensions>",
        "    <trkseg>",
    ]
    lines += [f'      <trkpt lat="{p[0]:.7f}" lon="{p[1]:.7f}"><ele>{p[2]:.1f}</ele></trkpt>' for p in pts]
    lines += ["    </trkseg>", "  </trk>"]
    return lines


def write(path, lines):
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(lines + ["</gpx>", ""]))
    print(f"wrote {path} ({os.path.getsize(path) // 1024} KB)")


# ---------------------------------------------------------------- preview PNG

def render_png(path, segs, wpts, pts, cum, sched, sunrise_km, ascent):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.ft2font
    import matplotlib.pyplot as plt
    from matplotlib.lines import Line2D

    if getattr(matplotlib.ft2font, "__libraqm_version__", None):
        def H(s):  # matplotlib 3.11+ (libraqm) lays out right-to-left text itself
            return s
    else:  # older matplotlib draws glyphs left to right: reorder Hebrew first
        from bidi.algorithm import get_display

        def H(s):
            return "\n".join(get_display(line) for line in s.split("\n"))

    plt.rcParams["font.family"] = "DejaVu Sans"
    fig = plt.figure(figsize=(12, 13.2), dpi=150)
    gs = fig.add_gridspec(2, 1, height_ratios=[1.25, 1], hspace=0.13, left=0.06, right=0.98, top=0.93, bottom=0.05)
    ax, ax2 = fig.add_subplot(gs[0]), fig.add_subplot(gs[1])
    total_km = cum[-1] / 1000
    fig.text(0.5, 0.975, H("מסע מים אל ים ב-24 שעות · 8 מקטעים לפי נקודות מים"),
             ha="center", va="center", fontsize=17, weight="bold")
    fig.text(0.5, 0.952, H(f"{total_km:.1f} ק\"מ · עלייה ~{round(ascent, -2):,.0f} מ' · "
                           f"יציאה 18:00 מיד לי\"ד · סיום משוער ~16:05 בכנרת"),
             ha="center", va="center", fontsize=11.5, color="#444")

    # ---- map
    lat0 = sum(p[0] for p in pts) / len(pts)
    for s in segs:
        ax.plot([p[1] for p in s["pts"]], [p[0] for p in s["pts"]], color=s["color"], lw=3.4,
                solid_capstyle="round", zorder=3)
    for s in segs:  # number badge at the middle of each segment
        mid = point_at(pts, cum, (s["s0"] + s["s1"]) / 2)
        ax.scatter([mid[1]], [mid[0]], s=330, color=s["color"], edgecolor="white", linewidth=1.5, zorder=6)
        ax.text(mid[1], mid[0], str(s["n"]), color="white", ha="center", va="center", fontsize=10,
                weight="bold", zorder=7)
    # start, the refill points (at the tap itself) and the end, each with its planned arrival
    label_pos = {0: (0, 14), 1: (0, -18), 2: (0, 14), 3: (0, -18), 4: (-45, 16), 5: (58, 12), 6: (0, 16),
                 7: (0, 14), 8: (0, -18)}
    bounds = [s["s0"] for s in segs] + [segs[-1]["s1"]]
    names = [s["from_full"] for s in segs] + ["הכנרת"]
    times = [s["time"].split("–")[0] for s in segs] + [segs[-1]["time"].split("–")[1]]
    for j, (b, nm, tm) in enumerate(zip(bounds, names, times)):
        if 0 < j < len(bounds) - 1:
            lat, lon = wpts[j - 1]["lat"], wpts[j - 1]["lon"]
            ax.scatter([lon], [lat], s=80, color="#1f78d1", edgecolor="white", linewidth=1.4, zorder=9)
        else:
            lat, lon, _ = point_at(pts, cum, b)
            ax.scatter([lon], [lat], s=70, color="white", edgecolor="#222", linewidth=1.6, zorder=9)
        dx, dy = label_pos[j]
        ax.annotate(H(f"{nm} {tm}"), (lon, lat), xytext=(dx, dy), textcoords="offset points",
                    ha="center", va="center", fontsize=9, zorder=10,
                    bbox=dict(boxstyle="round,pad=0.25", fc="white", ec="#bbb", lw=0.6, alpha=0.9))
    ax.set_aspect(1 / math.cos(math.radians(lat0)))
    ax.set_xticks([])
    ax.set_yticks([])
    for sp in ax.spines.values():
        sp.set_color("#ccc")
    ax.margins(0.04, 0.12)
    # scale bar (10 km) at top right
    x1, x2 = ax.get_xlim()
    y1, y2 = ax.get_ylim()
    dlon = 10000 / (math.cos(math.radians(lat0)) * math.pi / 180 * R_EARTH)
    sx = x2 - (x2 - x1) * 0.04 - dlon
    sy = y2 - (y2 - y1) * 0.07
    ax.plot([sx, sx + dlon], [sy, sy], color="#333", lw=3)
    ax.text(sx + dlon / 2, sy + (y2 - y1) * 0.025, H("10 ק\"מ"), ha="center", fontsize=9)
    # legends
    seg_handles = [Line2D([], [], color=s["color"], lw=4) for s in segs]
    seg_labels = [H(f"{s['n']} · {s['frm']} ← {s['to']} · {s['km']:.1f} ק\"מ · "
                    + (f"ירידה {s['desc_m']:.0f} מ'" if s['n'] == 6 else f"עלייה {s['asc_m']:.0f} מ'")
                    + f" · {s['time']}") for s in segs]
    leg1 = ax.legend(seg_handles, seg_labels, loc="lower left", fontsize=8.6, frameon=True, framealpha=0.95,
                     markerfirst=False, title=H("מקטעים (צבעים כמו ב-Mapeak)"), title_fontsize=9.5)
    ax.add_artist(leg1)
    mk = [Line2D([], [], marker="o", ls="", markerfacecolor="#1f78d1", markeredgecolor="white", markersize=8),
          Line2D([], [], marker="o", ls="", markerfacecolor="white", markeredgecolor="#222", markersize=8,
                 markeredgewidth=1.6)]
    ax.legend(mk, [H("מילוי מים + שעת הגעה"), H("התחלה / סיום")],
              loc="upper right", bbox_to_anchor=(1.0, 0.86), fontsize=8.6, framealpha=0.95, markerfirst=False)

    # ---- elevation profile
    ymin, ymax = -400, 1500
    ax2.axvspan(0, sunrise_km, color="#2b3a67", alpha=0.08, lw=0)
    ax2.text(sunrise_km / 2, ymax - 35, H(f"חושך (18:00–{SUNRISE})"), ha="center", fontsize=9, color="#2b3a67")
    ax2.axvline(sunrise_km, color="#e0a100", lw=1.2, ls=":")
    ax2.text(sunrise_km - 0.3, 250, H(f"זריחה {SUNRISE}"), ha="right", fontsize=8.5, color="#8a6000")
    for s in segs:
        km = [s["s0"] / 1000] + [c / 1000 for c, p in zip(cum, pts) if s["s0"] < c < s["s1"]] + [s["s1"] / 1000]
        el = [p[2] for p in s["pts"]]
        ax2.fill_between(km, el, ymin, color=s["color"], alpha=0.16, lw=0)
        ax2.plot(km, el, color=s["color"], lw=2)
        mid = (s["s0"] + s["s1"]) / 2000
        ax2.text(mid, ymin + 140, str(s["n"]), ha="center", va="center", fontsize=11, weight="bold",
                 color="white", bbox=dict(boxstyle="circle,pad=0.3", fc=s["color"], ec="white"))
        ax2.text(mid, ymin + 50, H(f"{s['km']:.1f} ק\"מ"), ha="center", va="center", fontsize=7.8, color="#333")
    for j, (b, nm, tm) in enumerate(zip(bounds, names, times)):
        x = b / 1000
        ax2.axvline(x, color="#888", lw=0.8, ls="--", zorder=1)
        y = ymax - 140 - (j % 2) * 130
        ha = "left" if j == 0 else "right" if j == len(bounds) - 1 else "center"
        ax2.text(x + {"left": 0.3, "right": -0.3, "center": 0}[ha], y, H(f"{nm}\n{tm}"), ha=ha, va="center",
                 fontsize=8, zorder=5, bbox=dict(boxstyle="round,pad=0.2", fc="white", ec="#ccc", lw=0.5, alpha=0.95))
    top = max(range(len(pts)), key=lambda k: pts[k][2])
    ax2.annotate(H(f"נקודה גבוהה {pts[top][2]:,.0f} מ'"), (cum[top] / 1000, pts[top][2]), xytext=(-14, 0),
                 textcoords="offset points", ha="right", va="center", fontsize=8.5, color="#000")
    ax2.set_xlim(0, total_km)
    ax2.set_ylim(ymin, ymax)
    ax2.set_xticks(range(0, int(total_km) + 1, 5))
    ax2.set_xlabel(H("ק\"מ"), fontsize=10)
    ax2.set_ylabel(H("גובה (מ')"), fontsize=10)
    ax2.grid(True, color="#eee", lw=0.6)
    ax2.axhline(0, color="#7fb3d5", lw=0.8)
    for sp in ("top", "right"):
        ax2.spines[sp].set_visible(False)
    fig.text(0.98, 0.012, "© OpenStreetMap contributors (ODbL) · elevation: Israel Hiking Map", ha="right",
             fontsize=7, color="#888")
    fig.savefig(path, dpi=150)
    plt.close(fig)
    print(f"wrote {path} ({os.path.getsize(path) // 1024} KB)")


# ---------------------------------------------------------------- main

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--cache", required=True, help="folder for the downloaded relation and elevation cache")
    ap.add_argument("--out", required=True, help="folder for the GPX/PNG output")
    ap.add_argument("--no-png", action="store_true", help="skip the preview image")
    args = ap.parse_args()
    os.makedirs(args.cache, exist_ok=True)
    os.makedirs(args.out, exist_ok=True)

    nodes, ways, members, version, stamp = load_relation(args.cache)
    print(f"relation {RELATION_ID} v{version} ({stamp}): {len(members)} ways, {len(nodes)} nodes")
    path = shortest_path(nodes, ways, members, START_NODE, END_NODE)
    latlon = [nodes[n] for n in path]

    wpt_coords = [(w[2], w[3]) for w in REFILL]
    eles = elevations(latlon + wpt_coords, args.cache)
    pts = [(lat, lon, e) for (lat, lon), e in zip(latlon, eles)]
    wpt_eles = eles[len(latlon):]
    cum = cumulative(pts)
    total = cum[-1]
    up_raw, down_raw = climb([p[2] for p in pts])
    up1, down1 = climb([p[2] for p in pts], 1.0)
    print(f"route: {len(pts)} points, {total / 1000:.2f} km, ascent {up_raw:.0f} m raw / {up1:.0f} m (1 m filter), "
          f"descent {down_raw:.0f} / {down1:.0f} m, min {min(eles[:len(pts)]):.0f} m, "
          f"max {max(eles[:len(pts)]):.0f} m")

    # ---- segments
    bounds_m = [k * 1000 for k in CUT_KM] + [total]
    segs = []
    for i, (color, frm, to, tm, water, notes) in enumerate(SEGMENTS):
        s0, s1 = bounds_m[i], bounds_m[i + 1]
        spts = cut(pts, cum, s0, s1)
        el = [p[2] for p in spts]
        asc, dsc = climb(el)
        segs.append(dict(n=i + 1, color=color, frm=frm, from_full=SCHEDULE_NAME[CUT_KM[i]], to=to,
                         time=tm, water=water, notes=notes, s0=s0, s1=s1, pts=spts, km=(s1 - s0) / 1000,
                         asc_m=asc, desc_m=dsc, emin=min(el), emax=max(el)))

    # ---- waypoints
    wpts = []
    print("\nrefill points: plan km | route km | off-route m")
    for (km, name, lat, lon, desc), ele in zip(REFILL, wpt_eles):
        rkm, off = project(pts, cum, lat, lon)
        flag = "  <-- check" if abs(rkm - km) > 0.3 else ""
        print(f"  {name:<24} {km:5.1f} | {rkm:6.2f} | {off:5.0f}{flag}")
        wpts.append(dict(lat=lat, lon=lon, ele=ele, type="מים", sym="Drinking Water",
                         name=f'מים · {name} (ק"מ {km_label(km)})', desc=desc))

    # ---- GPX files
    lats = [p[0] for p in pts] + [w["lat"] for w in wpts]
    lons = [p[1] for p in pts] + [w["lon"] for w in wpts]
    bbox = (min(lats), min(lons), max(lats), max(lons))
    head_desc = (f"מסע מים אל ים – ניסיון ב-24 שעות. יציאה 18:00 מיד לי\"ד, סיום משוער ~16:05 בכנרת. "
                 f"{total / 1000:.1f} ק\"מ, עלייה ~{round(up1, -2):,.0f} מ' (DEM גולמי {round(up_raw, -2):,.0f}), "
                 f"נקודה גבוהה {max(p[2] for p in pts):,.0f} מ'. "
                 f"מסלול: OSM relation {RELATION_ID} (גרסה {version}), גבהים: Israel Hiking Map.")

    lines = gpx_header("מסע מים אל ים – 24 שעות – 8 מקטעים", head_desc, bbox)
    for w in wpts:
        lines += gpx_wpt(w)
    for s in segs:
        climb_txt = f"ירידה {s['desc_m']:.0f} מ'" if s["n"] == 6 else f"עלייה {s['asc_m']:.0f} מ'"
        name = f"{s['n']} · {s['frm']} ← {s['to']} · {s['km']:.1f} ק\"מ · {climb_txt} · {s['time']}"
        desc = (f"מקטע {s['n']} מתוך 8: {s['frm']} ← {s['to']}. ק\"מ {s['s0'] / 1000:.1f}–{s['s1'] / 1000:.1f} "
                f"({s['km']:.1f} ק\"מ), עלייה {s['asc_m']:.0f} מ', ירידה {s['desc_m']:.0f} מ'. "
                f"שעות מתוכננות {s['time']}. מים בתחילת המקטע: {s['water']}." + (f" {s['notes']}" if s["notes"] else ""))
        lines += gpx_trk(name, desc, s["n"], s["color"], 0.85, 8, s["pts"])
    write(os.path.join(args.out, "yam-el-yam-color-segments.gpx"), lines)

    lines = gpx_header("מסע מים אל ים – 24 שעות – מסלול אחד", head_desc, bbox)
    for w in wpts:
        lines += gpx_wpt(w)
    lines += gpx_trk(f"מסע מים אל ים · {total / 1000:.1f} ק\"מ", head_desc, 1, "#8E24AA", 0.85, 6, pts)
    write(os.path.join(args.out, "yam-el-yam-water-v3.gpx"), lines)

    # ---- report
    sched = schedule_times(total / 1000)
    rise_h, rise_m = map(int, SUNRISE.split(":"))
    sunrise_km = km_at_time(sched, DAY0 + timedelta(days=1, hours=rise_h, minutes=rise_m))
    print("\n| # | מקטע | ק\"מ | עלייה | ירידה | שעות |")
    print("|---|---|---|---|---|---|")
    for s in segs:
        print(f"| {s['n']} | {s['frm']} ← {s['to']} | {s['km']:.1f} | {s['asc_m']:.0f} | {s['desc_m']:.0f} | "
              f"{s['time']} |")
    print(f"\nkm at sunrise {SUNRISE}: {sunrise_km:.1f}")
    for km, arr, dep, nm in sched:
        p = point_at(pts, cum, km * 1000)
        print(f"  {km:5.1f} km  {arr:%a %H:%M}  ele {p[2]:6.0f}  {nm}")

    if not args.no_png:
        render_png(os.path.join(args.out, "yam-el-yam-segments-preview.png"), segs, wpts, pts, cum, sched,
                   sunrise_km, up1)


if __name__ == "__main__":
    main()
