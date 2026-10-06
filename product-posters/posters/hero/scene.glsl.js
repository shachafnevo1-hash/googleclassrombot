// Path-traced / ray-marched studio scene for the Y2K hero poster.
// One invocation = one sample for one pixel; samples are accumulated with
// additive blending into a float framebuffer.
export const SCENE_FS = /* glsl */ `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;

uniform vec2 uRes;
uniform int uSample;

uniform vec3 uCamPos, uCamTarget;
uniform float uFov, uAperture, uFocus;

uniform sampler2D uProduct;     // sRGB texture, straight alpha
uniform sampler2D uShift;       // per-column base flattening offsets
uniform vec2 uProdSize;         // world width / height
uniform float uProdBase;        // world y of the stand's base

uniform sampler2D uTextSdf;     // signed distance of "TAP!" in text-local world units
uniform vec2 uTextSdfSize;
uniform vec4 uTextRect;         // min corner, size (text-local)
uniform vec3 uTextHalf;         // bounding box half extents
uniform vec3 uTextPos;
uniform mat3 uTextRot;
uniform vec2 uTextShape;        // half depth, bevel radius

uniform vec3 uRingPos;
uniform mat3 uRingRot;
uniform vec2 uRingSize;

uniform vec3 uStarPos[5];
uniform mat3 uStarRot[5];
uniform float uStarSize;

uniform vec4 uBlob[8];          // two liquid-chrome clusters of four balls
uniform vec4 uBlobBound[2];
uniform vec4 uDrop[6];          // chrome droplets (analytic spheres)
uniform vec4 uBubble[6];        // soap bubbles (analytic spheres)
uniform vec4 uTwinkle[2];       // 3D four-point sparkles: xyz, size
uniform mat3 uTwinkleRot[2];

uniform vec3 uSceneMin, uSceneMax;

out vec4 fragColor;

#define PI 3.14159265359
#define M_NONE 0.0
#define M_PED 1.0
#define M_RING 2.0
#define M_CHROME 3.0
#define M_GOLD 4.0
#define M_TEXT 5.0
#define M_FLOOR 6.0
#define M_PRODUCT 7.0
#define M_BUBBLE 8.0

// ------------------------------------------------------------ random
uint pcg(uint v) {
  uint s = v * 747796405u + 2891336453u;
  uint w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u;
  return (w >> 22u) ^ w;
}
float rnd(inout uint s) { s = pcg(s); return float(s) * (1.0 / 4294967296.0); }

vec3 lin(vec3 c) { return pow(c, vec3(2.2)); }

// ------------------------------------------------------------ SDF toolkit
float sdRoundCyl(vec3 p, float r, float h, float rr) {
  vec2 d = vec2(length(p.xz) - r + rr, abs(p.y) - h + rr);
  return min(max(d.x, d.y), 0.0) + length(max(d, 0.0)) - rr;
}
float sdTorus(vec3 p, vec2 t) { return length(vec2(length(p.xz) - t.x, p.y)) - t.y; }
float sdBox(vec3 p, vec3 b) {
  vec3 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}
float smin(float a, float b, float k) {
  float h = max(k - abs(a - b), 0.0) / k;
  return min(a, b) - h * h * k * 0.25;
}
float sdStar5(vec2 p, float r, float rf) {
  const vec2 k1 = vec2(0.809016994375, -0.587785252292);
  const vec2 k2 = vec2(-k1.x, k1.y);
  p.x = abs(p.x);
  p -= 2.0 * max(dot(k1, p), 0.0) * k1;
  p -= 2.0 * max(dot(k2, p), 0.0) * k2;
  p.x = abs(p.x);
  p.y -= r;
  vec2 ba = rf * vec2(-k1.y, k1.x) - vec2(0.0, 1.0);
  float h = clamp(dot(p, ba) / dot(ba, ba), 0.0, r);
  return length(p - ba * h) * sign(p.y * ba.x - p.x * ba.y);
}
float sdStar4(vec2 p, float r, float m) {
  float an = PI / 4.0, en = PI / m;
  vec2 acs = vec2(cos(an), sin(an)), ecs = vec2(cos(en), sin(en));
  float bn = mod(atan(p.x, p.y), 2.0 * an) - an;
  p = length(p) * vec2(cos(bn), abs(sin(bn)));
  p -= r * acs;
  p += ecs * clamp(-dot(p, ecs), 0.0, r * acs.y / ecs.y);
  return length(p) * sign(p.x);
}
float extrudeRound(float d2, float z, float h, float rr) {
  vec2 w = vec2(d2 + rr, abs(z) - h + rr);
  return min(max(w.x, w.y), 0.0) + length(max(w, 0.0)) - rr;
}

// Cubic B-spline filtering from 4 bilinear taps: C2-smooth distance field, so
// the bevel normals of the 3D letters are free of bilinear facets.
vec4 bspline(float v) {
  vec4 n = vec4(1.0, 2.0, 3.0, 4.0) - v;
  vec4 s = n * n * n;
  float x = s.x, y = s.y - 4.0 * s.x, z = s.z - 4.0 * s.y + 6.0 * s.x;
  return vec4(x, y, z, 6.0 - x - y - z) * (1.0 / 6.0);
}
float sdfBicubic(vec2 uv) {
  vec2 tc = uv * uTextSdfSize - 0.5;
  vec2 f = fract(tc);
  tc -= f;
  vec4 xc = bspline(f.x), yc = bspline(f.y);
  vec4 c = tc.xxyy + vec2(-0.5, 1.5).xyxy;
  vec4 s = vec4(xc.xz + xc.yw, yc.xz + yc.yw);
  vec4 o = (c + vec4(xc.yw, yc.yw) / s) / uTextSdfSize.xxyy;
  float s0 = texture(uTextSdf, o.xz).r, s1 = texture(uTextSdf, o.yz).r;
  float s2 = texture(uTextSdf, o.xw).r, s3 = texture(uTextSdf, o.yw).r;
  float sx = s.x / (s.x + s.y), sy = s.z / (s.z + s.w);
  return mix(mix(s3, s2, sx), mix(s1, s0, sx), sy);
}

float sdText(vec3 q) {
  vec2 uv = (q.xy - uTextRect.xy) / uTextRect.zw;
  uv.y = 1.0 - uv.y;
  vec2 cuv = clamp(uv, vec2(0.0), vec2(1.0));
  float d2 = sdfBicubic(cuv) + length((uv - cuv) * uTextRect.zw);
  return extrudeRound(d2, q.z, uTextShape.x, uTextShape.y);
}

vec2 map(vec3 p) {
  // two-tier pedestal
  vec2 res = vec2(sdRoundCyl(p - vec3(0.0, 0.07, 0.0), 1.58, 0.07, 0.03), M_PED);
  float d = sdRoundCyl(p - vec3(0.0, 0.235, 0.0), 1.34, 0.095, 0.035);
  if (d < res.x) res = vec2(d, M_PED);

  d = sdTorus(uRingRot * (p - uRingPos), uRingSize);
  if (d < res.x) res = vec2(d, M_RING);

  for (int g = 0; g < 2; g++) {
    if (length(p - uBlobBound[g].xyz) - uBlobBound[g].w > res.x) continue;
    int o = g * 4;
    float db = length(p - uBlob[o].xyz) - uBlob[o].w;
    db = smin(db, length(p - uBlob[o + 1].xyz) - uBlob[o + 1].w, 0.42);
    db = smin(db, length(p - uBlob[o + 2].xyz) - uBlob[o + 2].w, 0.38);
    db = smin(db, length(p - uBlob[o + 3].xyz) - uBlob[o + 3].w, 0.32);
    if (db < res.x) res = vec2(db, M_CHROME);
  }

  vec3 q = uTextRot * (p - uTextPos);
  float dbx = sdBox(q, uTextHalf);
  if (dbx < res.x) {
    float dt = dbx > 0.04 ? dbx : sdText(q);
    if (dt < res.x) res = vec2(dt, M_TEXT);
  }

  for (int i = 0; i < 5; i++) {
    vec3 sp = p - uStarPos[i];
    float bs = length(sp) - uStarSize * 1.2;
    if (bs > res.x) continue;
    vec3 sq = uStarRot[i] * sp;
    float ds = extrudeRound(sdStar5(sq.xy, uStarSize, 0.5), sq.z, uStarSize * 0.34, uStarSize * 0.3);
    if (ds < res.x) res = vec2(ds, M_GOLD);
  }

  for (int i = 0; i < 2; i++) {
    vec3 sp = p - uTwinkle[i].xyz;
    float bs = length(sp) - uTwinkle[i].w * 1.1;
    if (bs > res.x) continue;
    vec3 sq = uTwinkleRot[i] * sp;
    float ds = extrudeRound(sdStar4(sq.xy, uTwinkle[i].w, 2.35), sq.z, uTwinkle[i].w * 0.16, uTwinkle[i].w * 0.12);
    if (ds < res.x) res = vec2(ds, M_CHROME);
  }
  return res;
}

vec3 calcNormal(vec3 p) {
  const vec2 k = vec2(1.0, -1.0);
  const float e = 0.0007;
  return normalize(k.xyy * map(p + k.xyy * e).x + k.yyx * map(p + k.yyx * e).x +
                   k.yxy * map(p + k.yxy * e).x + k.xxx * map(p + k.xxx * e).x);
}

vec2 boxRange(vec3 ro, vec3 rd, vec3 bmin, vec3 bmax) {
  vec3 inv = 1.0 / rd;
  vec3 t0 = (bmin - ro) * inv, t1 = (bmax - ro) * inv;
  vec3 tn = min(t0, t1), tf = max(t0, t1);
  return vec2(max(max(tn.x, tn.y), tn.z), min(min(tf.x, tf.y), tf.z));
}

float sphereHit(vec3 ro, vec3 rd, vec4 s) {
  vec3 oc = ro - s.xyz;
  float b = dot(oc, rd), c = dot(oc, oc) - s.w * s.w, h = b * b - c;
  if (h < 0.0) return -1.0;
  h = sqrt(h);
  float t = -b - h;
  return t > 1e-4 ? t : -b + h;
}

// ------------------------------------------------------------ product billboard
bool productSample(vec3 p, out vec4 c) {
  float u = p.x / uProdSize.x + 0.5;
  float vg = 1.0 - (p.y - uProdBase) / uProdSize.y;     // 0 = top of the photo
  if (u < 0.0 || u > 1.0 || vg < 0.0 || vg > 1.0) return false;
  float shift = texture(uShift, vec2(u, 0.5)).r;         // flatten the base onto the pedestal
  float vt = vg - shift * smoothstep(0.86, 1.0, vg);
  c = texture(uProduct, vec2(u, vt));
  return c.a > 0.002;
}

// ------------------------------------------------------------ optics
vec3 thinFilm(float cosTheta, float thickness) {
  float n = 1.33;
  float sinT2 = (1.0 - cosTheta * cosTheta) / (n * n);
  float cosT = sqrt(max(0.0, 1.0 - sinT2));
  float opd = 2.0 * n * thickness * cosT;
  vec3 phase = 2.0 * PI * opd / vec3(650.0, 540.0, 455.0) + PI;
  return 0.5 + 0.5 * cos(phase);
}
float schlick(float cosi, float f0) { return f0 + (1.0 - f0) * pow(1.0 - cosi, 5.0); }
vec3 schlick3(float cosi, vec3 f0) { return f0 + (1.0 - f0) * pow(1.0 - cosi, 5.0); }

float softbox(vec3 rd, vec3 axis, vec2 size, float soft) {
  vec3 up0 = abs(axis.y) > 0.9 ? vec3(0.0, 0.0, 1.0) : vec3(0.0, 1.0, 0.0);
  vec3 u = normalize(cross(up0, axis)), v = cross(axis, u);
  float dd = dot(rd, axis);
  if (dd <= 0.0) return 0.0;
  vec2 q = vec2(dot(rd, u), dot(rd, v)) / dd;
  vec2 e = abs(q) - size;
  float r = length(max(e, 0.0)) + min(max(e.x, e.y), 0.0) - 0.06;
  return smoothstep(soft, -soft, r);
}

// Studio environment seen in reflections: the coloured cove behind the set,
// a dark studio behind the camera (gives chrome its contrast), a dark horizon
// line, a big overhead softbox and two coloured strip lights.
vec3 env(vec3 rd) {
  float y = rd.y;
  vec3 cove = mix(lin(vec3(1.0, 0.78, 0.9)), lin(vec3(0.85, 0.48, 0.9)), smoothstep(0.0, 0.18, y));
  cove = mix(cove, lin(vec3(0.42, 0.28, 0.86)), smoothstep(0.15, 0.55, y));
  cove *= 1.0 - 0.6 * exp(-pow((y - 0.012) / 0.035, 2.0));
  // behind the camera: a retro chrome horizon - deep indigo sky over a hot pink glow
  const float hz = 0.25;
  vec3 sky = mix(lin(vec3(0.09, 0.05, 0.27)), lin(vec3(0.36, 0.22, 0.78)), smoothstep(hz, 0.65, y));
  vec3 ground = mix(lin(vec3(1.0, 0.76, 0.84)) * 1.7, lin(vec3(0.42, 0.22, 0.66)), smoothstep(hz, hz - 0.4, y));
  vec3 studio = y > hz ? sky : ground;
  studio += vec3(2.2, 2.0, 2.3) * exp(-pow((y - hz) / 0.005, 2.0));
  vec3 c = mix(cove, studio, smoothstep(-0.2, 0.3, rd.z));
  c = mix(c, lin(vec3(0.93, 0.84, 1.0)), smoothstep(0.0, -0.1, y) * (1.0 - smoothstep(-0.2, 0.3, rd.z)));
  c += vec3(5.0) * softbox(rd, normalize(vec3(0.0, 1.0, 0.15)), vec2(0.55, 0.38), 0.05);
  c += lin(vec3(1.0, 0.6, 0.9)) * 4.0 * softbox(rd, normalize(vec3(-1.0, 0.2, 0.5)), vec2(0.12, 0.9), 0.025);
  c += lin(vec3(0.55, 0.9, 1.0)) * 3.6 * softbox(rd, normalize(vec3(1.0, 0.16, 0.42)), vec2(0.1, 0.85), 0.025);
  c += vec3(2.4) * softbox(rd, normalize(vec3(0.45, 0.55, 1.0)), vec2(0.3, 0.1), 0.03);
  return c;
}

uniform vec3 uGlowDir;
// What the camera sees behind everything: a seamless cove that runs from a
// soft pink horizon glow up into deep violet.
vec3 backdrop(vec3 rd) {
  float y = rd.y;
  vec3 hor = lin(vec3(1.0, 0.86, 0.93));
  vec3 pink = lin(vec3(0.93, 0.6, 0.9));
  vec3 vio = lin(vec3(0.56, 0.42, 0.95));
  vec3 deep = lin(vec3(0.33, 0.22, 0.74));
  vec3 c = mix(hor, pink, smoothstep(-0.01, 0.07, y));
  c = mix(c, vio, smoothstep(0.05, 0.17, y));
  c = mix(c, deep, smoothstep(0.15, 0.3, y));
  c *= mix(vec3(1.05, 0.96, 1.0), vec3(0.94, 1.0, 1.06), smoothstep(-0.25, 0.25, rd.x));
  float a = acos(clamp(dot(rd, uGlowDir), -1.0, 1.0));
  c += lin(vec3(1.0, 0.9, 1.0)) * (0.5 * exp(-a * a / (2.0 * 0.06 * 0.06)) + 0.24 * exp(-a * a / (2.0 * 0.17 * 0.17)));
  return c;
}

// ------------------------------------------------------------ scene query
struct Hit { float t; vec3 n; float m; vec4 c; };

Hit intersect(vec3 ro, vec3 rd, inout uint seed, bool sharpAlpha) {
  Hit h;
  h.t = 1e9; h.m = M_NONE; h.n = vec3(0.0, 1.0, 0.0); h.c = vec4(0.0);
  if (rd.y < 0.0) {
    float t = -ro.y / rd.y;
    if (t > 1e-4) { h.t = t; h.m = M_FLOOR; }
  }
  vec2 tb = boxRange(ro, rd, uSceneMin, uSceneMax);
  if (tb.y > max(tb.x, 0.0) && tb.x < h.t) {
    float t = max(tb.x, 0.0) + 1e-3;
    float tend = min(tb.y, h.t);
    for (int i = 0; i < 240; i++) {
      vec3 p = ro + rd * t;
      vec2 r = map(p);
      if (r.x < 2.5e-4 * max(t, 1.0)) { h.t = t; h.m = r.y; h.n = calcNormal(p); break; }
      t += r.x * 0.9;
      if (t > tend) break;
    }
  }
  if (abs(rd.z) > 1e-6) {
    float t = -ro.z / rd.z;
    if (t > 1e-4 && t < h.t) {
      vec4 c;
      if (productSample(ro + rd * t, c)) {
        float thr = sharpAlpha ? 0.5 : rnd(seed);
        if (c.a > thr) { h.t = t; h.m = M_PRODUCT; h.c = c; h.n = vec3(0.0, 0.0, rd.z < 0.0 ? 1.0 : -1.0); }
      }
    }
  }
  for (int i = 0; i < 6; i++) {
    float t = sphereHit(ro, rd, uDrop[i]);
    if (t > 1e-4 && t < h.t) { h.t = t; h.m = M_CHROME; h.n = normalize(ro + rd * t - uDrop[i].xyz); }
  }
  for (int i = 0; i < 6; i++) {
    float t = sphereHit(ro, rd, uBubble[i]);
    if (t > 1e-4 && t < h.t) {
      h.t = t; h.m = M_BUBBLE; h.n = normalize(ro + rd * t - uBubble[i].xyz); h.c = vec4(float(i));
    }
  }
  return h;
}

float shadow(vec3 ro, vec3 L) {
  float vis = 1.0;
  float tp = -ro.z / L.z;
  if (tp > 1e-3) { vec4 c; if (productSample(ro + L * tp, c)) vis *= 1.0 - c.a; }
  for (int i = 0; i < 6; i++) if (sphereHit(ro, L, uDrop[i]) > 0.0) return 0.0;
  for (int i = 0; i < 6; i++) if (sphereHit(ro, L, uBubble[i]) > 0.0) vis *= 0.88;
  vec2 tb = boxRange(ro, L, uSceneMin, uSceneMax);
  if (tb.y > max(tb.x, 0.0)) {
    float t = max(tb.x, 0.0) + 0.01, res = 1.0;
    for (int i = 0; i < 72; i++) {
      float d = map(ro + L * t).x;
      res = min(res, 9.0 * d / t);
      if (res < 0.003) break;
      t += clamp(d, 0.012, 0.4);
      if (t > tb.y) break;
    }
    vis *= clamp(res, 0.0, 1.0);
  }
  return vis;
}

float ambientOcclusion(vec3 p, vec3 n) {
  float occ = 0.0, sca = 1.0;
  for (int i = 0; i < 5; i++) {
    float h = 0.025 + 0.11 * float(i);
    occ += (h - map(p + n * h).x) * sca;
    sca *= 0.78;
  }
  return clamp(1.0 - 1.5 * occ, 0.0, 1.0);
}

const vec3 KEY_DIR = vec3(-0.42, 1.0, 0.62);
vec3 lighting(vec3 p, vec3 n, inout uint seed) {
  vec3 Lk = normalize(normalize(KEY_DIR) + (vec3(rnd(seed), rnd(seed), rnd(seed)) - 0.5) * 0.22);
  float k = max(dot(n, Lk), 0.0);
  if (k > 0.0) k *= shadow(p + n * 2e-3, Lk);
  float ao = ambientOcclusion(p, n);
  vec3 fillDir = normalize(vec3(0.85, 0.45, 0.35));
  return lin(vec3(1.0, 0.97, 0.96)) * 0.95 * k
       + lin(vec3(0.75, 0.9, 1.0)) * 0.22 * max(dot(n, fillDir), 0.0) * ao
       + lin(vec3(0.86, 0.8, 1.0)) * (0.52 * ao + 0.06);
}

vec3 floorAlbedo(vec3 p, float t) {
  vec3 c = lin(vec3(0.82, 0.7, 0.96));
  // faint Y2K grid, fading out with distance so it never aliases
  vec2 g = abs(fract(p.xz / 0.8 + 0.5) - 0.5) * 0.8;
  float line = 1.0 - smoothstep(0.004, 0.012, min(g.x, g.y));
  float fade = 1.0 - smoothstep(8.0, 22.0, t);
  c = mix(c, vec3(1.25, 1.2, 1.3), line * fade * 0.45);
  return c;
}

vec3 glossy(vec3 r, float rough, inout uint seed) {
  vec3 j = vec3(rnd(seed), rnd(seed), rnd(seed)) - 0.5;
  return normalize(r + j * rough);
}

vec3 trace(vec3 ro, vec3 rd, inout uint seed) {
  vec3 col = vec3(0.0), thr = vec3(1.0);
  bool useBackdrop = true;
  bool alive = true;
  for (int b = 0; b < 7; b++) {
    Hit h = intersect(ro, rd, seed, b > 2);
    if (h.m == M_NONE) { col += thr * (useBackdrop ? backdrop(rd) : env(rd)); alive = false; break; }
    vec3 p = ro + rd * h.t;
    vec3 n = h.n;
    float cosi = clamp(-dot(rd, n), 0.0, 1.0);

    if (h.m == M_PRODUCT) {
      vec3 c = h.c.rgb;
      if (rd.z > 0.0) c = lin(vec3(0.9, 0.9, 0.94));     // back of the acrylic stand
      col += thr * c;
      alive = false; break;
    }
    if (h.m == M_BUBBLE) {
      vec3 nn = dot(n, rd) < 0.0 ? n : -n;
      float ci = clamp(-dot(rd, nn), 0.0, 1.0);
      float idx = h.c.x;
      float swirl = sin(dot(p, vec3(5.1, 3.7, 4.3)) + idx * 1.7) + 0.6 * sin(dot(p, vec3(-7.3, 9.1, 2.2)) + idx);
      vec3 film = thinFilm(ci, 330.0 + 190.0 * swirl);
      float F = schlick(ci, 0.03);
      col += thr * env(reflect(rd, nn)) * film * (F * 1.5 + 0.05);
      thr *= (1.0 - F) * 0.985;
      ro = p + rd * 2e-3;
      continue;
    }
    if (h.m == M_FLOOR) {
      float fog = smoothstep(15.0, 40.0, h.t);
      float F = schlick(cosi, 0.045);
      vec3 lit = floorAlbedo(p, h.t) * lighting(p, n, seed);
      col += thr * mix(lit * (1.0 - F), backdrop(rd), fog);
      thr *= F * (1.0 - fog) * lin(vec3(0.97, 0.95, 1.0));
      rd = glossy(reflect(rd, n), 0.035, seed);
      ro = p + n * 1e-3;
      useBackdrop = true;
      continue;
    }
    if (h.m == M_PED && n.y > 0.92 && p.y > 0.3) {
      // holographic pearl top
      float a = atan(p.z, p.x), r = length(p.xz);
      vec3 film = thinFilm(cosi, 420.0 + 230.0 * sin(a * 3.0 + r * 5.0) + 120.0 * sin(r * 11.0 - a));
      vec3 base = lin(vec3(0.97, 0.93, 1.0)) * mix(vec3(1.0), film, 0.4);
      // soft contact shadow where the stand meets the pedestal
      float contact = 1.0 - 0.5 * exp(-max(p.z, 0.0) * 16.0) * (1.0 - smoothstep(uProdSize.x * 0.45, uProdSize.x * 0.62, abs(p.x)));
      float F = schlick(cosi, 0.06);
      col += thr * base * lighting(p, n, seed) * contact * (1.0 - F);
      thr *= F * mix(vec3(1.0), film * 1.3, 0.35);
      rd = glossy(reflect(rd, n), 0.02, seed);
      ro = p + n * 1e-3;
      useBackdrop = true;
      continue;
    }
    // metals
    vec3 F;
    if (h.m == M_GOLD) {
      F = schlick3(cosi, lin(vec3(1.0, 0.85, 0.34)));
    } else if (h.m == M_TEXT || h.m == M_RING) {
      vec3 film = thinFilm(cosi, 480.0 + 160.0 * sin(p.x * 2.3 + p.y * 3.1));
      F = schlick3(cosi, lin(vec3(0.93, 0.92, 1.0))) * mix(vec3(1.0), film * 1.35, 0.42 * (1.0 - cosi * 0.6));
    } else {
      F = schlick3(cosi, lin(vec3(0.94, 0.94, 0.97)));
    }
    thr *= F;
    rd = reflect(rd, n);
    ro = p + n * 1.5e-3;
    useBackdrop = false;
    if (max(thr.r, max(thr.g, thr.b)) < 0.01) { alive = false; break; }
  }
  if (alive) col += thr * env(rd);
  return col;
}

void main() {
  uint seed = pcg(uint(gl_FragCoord.x) * 1973u + uint(gl_FragCoord.y) * 9277u + uint(uSample) * 26699u + 1u);
  // R2 low-discrepancy pixel jitter with a per-pixel Cranley-Patterson rotation
  float rot0 = rnd(seed), rot1 = rnd(seed);
  seed = pcg(seed + uint(uSample) * 7919u);
  vec2 j = fract(vec2(0.7548776662, 0.5698402910) * float(uSample) + vec2(rot0, rot1));
  vec2 px = floor(gl_FragCoord.xy) + j;

  vec2 ndc = (2.0 * px - uRes) / uRes.y;
  float tf = tan(uFov * 0.5);
  vec3 fw = normalize(uCamTarget - uCamPos);
  vec3 rt = normalize(cross(fw, vec3(0.0, 1.0, 0.0)));
  vec3 up = cross(rt, fw);
  vec3 rd = normalize(fw + ndc.x * tf * rt + ndc.y * tf * up);

  vec3 fp = uCamPos + rd * (uFocus / dot(rd, fw));
  float r = sqrt(rnd(seed)) * uAperture, a = rnd(seed) * 2.0 * PI;
  vec3 ro = uCamPos + rt * (r * cos(a)) + up * (r * sin(a));
  rd = normalize(fp - ro);

  vec3 col = trace(ro, rd, seed);
  fragColor = vec4(min(col, vec3(32.0)), 1.0);
}
`;
