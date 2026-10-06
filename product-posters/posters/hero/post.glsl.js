// Post-processing: physically-inspired bloom (CoD:AW 13-tap down / tent up),
// Kawase star streaks for the Y2K sparkle glare, Khronos PBR Neutral tone
// mapping (keeps the product photo's colours intact), grade, CA, grain.
export const VS = /* glsl */ `#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2(gl_VertexID == 1 ? 3.0 : -1.0, gl_VertexID == 2 ? 3.0 : -1.0);
  vUv = p * 0.5 + 0.5;
  gl_Position = vec4(p, 0.0, 1.0);
}`;

const HEAD = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 o;
`;

export const RESOLVE_FS = HEAD + /* glsl */ `
uniform sampler2D uAccum;
void main() {
  vec4 a = texture(uAccum, vUv);
  o = vec4(a.rgb / max(a.a, 1.0), 1.0);
}`;

export const PREFILTER_FS = HEAD + /* glsl */ `
uniform sampler2D uSrc;
uniform vec2 uTexel;
uniform float uThreshold, uKnee;
void main() {
  vec3 c = 0.25 * (texture(uSrc, vUv + uTexel * vec2(-0.5, -0.5)).rgb + texture(uSrc, vUv + uTexel * vec2(0.5, -0.5)).rgb +
                   texture(uSrc, vUv + uTexel * vec2(-0.5, 0.5)).rgb + texture(uSrc, vUv + uTexel * vec2(0.5, 0.5)).rgb);
  float br = max(c.r, max(c.g, c.b));
  float rq = clamp(br - uThreshold + uKnee, 0.0, 2.0 * uKnee);
  rq = rq * rq / (4.0 * uKnee + 1e-5);
  c *= max(rq, br - uThreshold) / max(br, 1e-5);
  o = vec4(c, 1.0);
}`;

export const DOWN_FS = HEAD + /* glsl */ `
uniform sampler2D uSrc;
uniform vec2 uTexel;
vec3 t(float x, float y) { return texture(uSrc, vUv + uTexel * vec2(x, y)).rgb; }
void main() {
  vec3 a = t(-2.0, 2.0), b = t(0.0, 2.0), c = t(2.0, 2.0);
  vec3 d = t(-2.0, 0.0), e = t(0.0, 0.0), f = t(2.0, 0.0);
  vec3 g = t(-2.0, -2.0), h = t(0.0, -2.0), i = t(2.0, -2.0);
  vec3 j = t(-1.0, 1.0), k = t(1.0, 1.0), l = t(-1.0, -1.0), m = t(1.0, -1.0);
  o = vec4(e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125, 1.0);
}`;

export const UP_FS = HEAD + /* glsl */ `
uniform sampler2D uLow, uCur;
uniform vec2 uTexel;
uniform float uRadius;
vec3 t(float x, float y) { return texture(uLow, vUv + uTexel * uRadius * vec2(x, y)).rgb; }
void main() {
  vec3 s = t(-1.0, -1.0) + 2.0 * t(0.0, -1.0) + t(1.0, -1.0) + 2.0 * t(-1.0, 0.0) + 4.0 * t(0.0, 0.0) +
           2.0 * t(1.0, 0.0) + t(-1.0, 1.0) + 2.0 * t(0.0, 1.0) + t(1.0, 1.0);
  o = vec4(texture(uCur, vUv).rgb + s / 16.0, 1.0);
}`;

export const STREAK_FS = HEAD + /* glsl */ `
uniform sampler2D uSrc;
uniform vec2 uDir;      // texel step
uniform float uB;       // 4^pass
uniform float uAtten;
void main() {
  vec3 s = vec3(0.0);
  for (int i = 0; i < 4; i++) {
    float w = pow(uAtten, uB * float(i));
    s += w * texture(uSrc, vUv + uDir * uB * float(i)).rgb;
  }
  o = vec4(s, 1.0);
}`;

export const COMPOSITE_FS = HEAD + /* glsl */ `
uniform sampler2D uHdr, uBloom, uS0, uS1, uS2, uS3;
uniform float uBloomK, uStreakK, uExposure, uGrain;
uniform vec2 uRes;

// Hue-preserving shoulder (the PBR Neutral curve without its toe offset and
// with a later knee): everything below 0.86 passes through untouched, so the
// product photo keeps its exact colours; only true highlights roll off.
vec3 tonemap(vec3 c) {
  const float k = 0.86;
  float peak = max(c.r, max(c.g, c.b));
  if (peak <= k) return c;
  const float d = 1.0 - k;
  float newPeak = 1.0 - d * d / (peak + d - k);
  c *= newPeak / peak;
  float g = 1.0 - 1.0 / (0.15 * (peak - newPeak) + 1.0);
  return mix(c, vec3(newPeak), g);
}
vec3 toSrgb(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
float hash(vec2 p) { p = fract(p * vec2(443.897, 441.423)); p += dot(p, p.yx + 19.19); return fract((p.x + p.y) * p.x); }

void main() {
  vec2 d = vUv - 0.5;
  float ca = dot(d, d) * 0.006;
  vec3 c = vec3(texture(uHdr, vUv - d * ca).r, texture(uHdr, vUv).g, texture(uHdr, vUv + d * ca).b);
  c += texture(uBloom, vUv).rgb * uBloomK;
  c += (texture(uS0, vUv).rgb + texture(uS1, vUv).rgb + texture(uS2, vUv).rgb + texture(uS3, vUv).rgb) * uStreakK;
  c = tonemap(c * uExposure);
  // gentle vignette towards a deep lilac
  float v = smoothstep(0.95, 0.25, length(d * vec2(1.0, 0.86)));
  c = mix(c * vec3(0.82, 0.78, 0.95), c, 0.72 + 0.28 * v);
  c = toSrgb(c);
  c += (hash(gl_FragCoord.xy) - 0.5) * uGrain;
  o = vec4(c, 1.0);
}`;
