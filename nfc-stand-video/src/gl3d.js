// ─────────────────────────────────────────────────────────────────────────────
// gl3d.js — tiny deterministic WebGL2 renderer for the hero product (acrylic
// L-stand with raised G badge) and the smartphone. Each call to render() draws
// a complete frame from a plain scene description: no retained animation state.
// ─────────────────────────────────────────────────────────────────────────────
(function () {
  const M = {};
  M.ident = () => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  M.mul = (a, b) => {
    const o = new Float32Array(16);
    for (let c = 0; c < 4; c++)
      for (let r = 0; r < 4; r++) {
        let s = 0;
        for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
        o[c * 4 + r] = s;
      }
    return o;
  };
  M.chain = (...ms) => ms.reduce((a, b) => M.mul(a, b));
  M.T = (x, y, z) => { const m = M.ident(); m[12] = x; m[13] = y; m[14] = z; return m; };
  M.S = (x, y, z) => { const m = M.ident(); m[0] = x; m[5] = y === undefined ? x : y; m[10] = z === undefined ? x : z; return m; };
  M.Rx = (a) => { const c = Math.cos(a), s = Math.sin(a); const m = M.ident(); m[5] = c; m[6] = s; m[9] = -s; m[10] = c; return m; };
  M.Ry = (a) => { const c = Math.cos(a), s = Math.sin(a); const m = M.ident(); m[0] = c; m[2] = -s; m[8] = s; m[10] = c; return m; };
  M.Rz = (a) => { const c = Math.cos(a), s = Math.sin(a); const m = M.ident(); m[0] = c; m[1] = s; m[4] = -s; m[5] = c; return m; };
  M.persp = (fovy, asp, n, f) => {
    const t = 1 / Math.tan(fovy / 2), m = new Float32Array(16);
    m[0] = t / asp; m[5] = t; m[10] = (f + n) / (n - f); m[11] = -1; m[14] = (2 * f * n) / (n - f);
    return m;
  };
  M.lookAt = (e, c, up) => {
    let zx = e[0] - c[0], zy = e[1] - c[1], zz = e[2] - c[2];
    let l = Math.hypot(zx, zy, zz); zx /= l; zy /= l; zz /= l;
    let xx = up[1] * zz - up[2] * zy, xy = up[2] * zx - up[0] * zz, xz = up[0] * zy - up[1] * zx;
    l = Math.hypot(xx, xy, xz); xx /= l; xy /= l; xz /= l;
    const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
    return new Float32Array([xx, yx, zx, 0, xy, yy, zy, 0, xz, yz, zz, 0,
      -(xx * e[0] + xy * e[1] + xz * e[2]), -(yx * e[0] + yy * e[1] + yz * e[2]), -(zx * e[0] + zy * e[1] + zz * e[2]), 1]);
  };
  M.apply = (m, p) => {
    const x = p[0], y = p[1], z = p[2], w = p[3] === undefined ? 1 : p[3];
    return [m[0] * x + m[4] * y + m[8] * z + m[12] * w, m[1] * x + m[5] * y + m[9] * z + m[13] * w,
      m[2] * x + m[6] * y + m[10] * z + m[14] * w, m[3] * x + m[7] * y + m[11] * z + m[15] * w];
  };

  // ── Product dimensions (world units ≈ metres × 2) ─────────────────────────
  const D = {
    // One sheet of 3 mm white acrylic bent into an L (real product proportions)
    panelW: 0.62 * (920 / 1400), panelH: 0.62, panelT: 0.0095, tilt: (14 * Math.PI) / 180,
    baseDepth: 0.23, bendR: 0.016,
    badgeY: 0.62 * (1 - 0.528), badgeR: 0.62 * (920 / 1400) * 0.122, badgeT: 0.0035,
    phoneW: 0.1425, phoneH: 0.3, phoneT: 0.0085,
  };

  // Camera defaults: 30° vertical FOV, 1 world unit ≈ 840 px at z = 0.
  const CAM = { pos: [0, 0.3, 2.4], target: [0, 0.3, 0], fov: (30 * Math.PI) / 180 };
  const FPX = 540 / (CAM.pos[2] * Math.tan(CAM.fov / 2)); // ≈ 840

  const VS = `#version 300 es
  in vec3 aPos; in vec2 aUV; in vec3 aN;
  uniform mat4 uVP, uModel;
  out vec2 vUV; out vec3 vN; out vec3 vW;
  void main(){ vec4 w = uModel*vec4(aPos,1.0); vW=w.xyz; vUV=aUV; vN=normalize(mat3(uModel)*aN); gl_Position=uVP*w; }`;
  const FS = `#version 300 es
  precision highp float;
  in vec2 vUV; in vec3 vN; in vec3 vW;
  uniform sampler2D uTex; uniform int uMode; uniform vec4 uColor; uniform float uAlpha;
  uniform float uGlossPos, uGlossAmt, uSheen; uniform float uReflY, uReflOn; uniform vec3 uEye;
  out vec4 o;
  void main(){
    vec3 L = normalize(vec3(-0.45, 0.65, 0.75));
    vec3 n = normalize(vN);
    if(!gl_FrontFacing) n = -n;
    float ndl = max(dot(n,L),0.0);
    vec3 V = normalize(uEye - vW);
    float spec = pow(max(dot(n, normalize(L+V)),0.0), 48.0);
    vec4 c;
    if(uMode==0){ // textured face (premultiplied)
      c = texture(uTex, vUV);
      if(c.a < 0.004) discard;
      vec3 rgb = c.rgb*(0.9+0.1*ndl);
      // static acrylic sheen + travelling gloss band
      float d = (vUV.x*0.8 + (1.0-vUV.y)*0.6);
      float sheen = uSheen * smoothstep(0.55,0.0,d) * 0.06;
      float band = uGlossAmt * exp(-pow((d - uGlossPos)/0.08, 2.0)) * 0.3;
      rgb += (sheen + band) * c.a;
      c = vec4(rgb, c.a);
    } else if(uMode==1){ // extrusion layer: solid colour masked by tex alpha
      float a = texture(uTex, vUV).a;
      if(a < 0.5) discard;
      c = vec4(uColor.rgb*(0.82+0.18*ndl), 1.0);
    } else { // lit solid
      vec3 rgb = uColor.rgb*(0.8+0.2*ndl) + vec3(spec*0.3);
      c = vec4(rgb, 1.0);
    }
    float a = uAlpha;
    if(uReflOn > 0.5){ float h = uReflY - vW.y; a *= 0.14 * smoothstep(0.2, 0.0, h); }
    o = vec4(c.rgb * a, c.a * a);
  }`;

  function compile(gl, type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }

  const R3 = (window.R3 = { M, D, CAM, FPX });

  R3.init = function (w, h) {
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const gl = canvas.getContext('webgl2', { antialias: true, premultipliedAlpha: true, preserveDrawingBuffer: true, alpha: true });
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog);
    const loc = {};
    ['uVP', 'uModel', 'uTex', 'uMode', 'uColor', 'uAlpha', 'uGlossPos', 'uGlossAmt', 'uSheen', 'uReflY', 'uReflOn', 'uEye'].forEach((n) => (loc[n] = gl.getUniformLocation(prog, n)));
    const attr = { aPos: gl.getAttribLocation(prog, 'aPos'), aUV: gl.getAttribLocation(prog, 'aUV'), aN: gl.getAttribLocation(prog, 'aN') };
    Object.assign(R3, { canvas, gl, prog, loc, attr, tex: {} });
    R3.meshes = { quad: mkQuad(), cube: mkCube(), cap: mkCap(64), side: mkSide(64) };
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  };

  function mkMesh(pos, uv, nrm) {
    const gl = R3.gl;
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const bind = (data, a, n) => {
      const b = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(a);
      gl.vertexAttribPointer(a, n, gl.FLOAT, false, 0, 0);
    };
    bind(pos, R3.attr.aPos, 3); bind(uv, R3.attr.aUV, 2); bind(nrm, R3.attr.aN, 3);
    gl.bindVertexArray(null);
    return { vao, n: pos.length / 3 };
  }
  function mkQuad() {
    const p = [-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0];
    const uv = [0, 1, 1, 1, 1, 0, 0, 1, 1, 0, 0, 0];
    const n = [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1];
    return mkMesh(p, uv, n);
  }
  function mkCube() {
    const P = [], UV = [], N = [];
    const faces = [[[1, 0, 0], [0, 1, 0], [0, 0, 1]], [[-1, 0, 0], [0, 1, 0], [0, 0, -1]], [[0, 1, 0], [0, 0, 1], [1, 0, 0]],
      [[0, -1, 0], [0, 0, -1], [1, 0, 0]], [[0, 0, 1], [1, 0, 0], [0, 1, 0]], [[0, 0, -1], [-1, 0, 0], [0, 1, 0]]];
    for (const [n, u, v] of faces) {
      const c = (a, b) => [n[0] * 0.5 + u[0] * a + v[0] * b, n[1] * 0.5 + u[1] * a + v[1] * b, n[2] * 0.5 + u[2] * a + v[2] * b];
      const q = [c(-0.5, -0.5), c(0.5, -0.5), c(0.5, 0.5), c(-0.5, -0.5), c(0.5, 0.5), c(-0.5, 0.5)];
      for (const p of q) { P.push(...p); UV.push(0, 0); N.push(...n); }
    }
    return mkMesh(P, UV, N);
  }
  function mkCap(seg) { // unit disc in XY plane, facing +z
    const P = [], UV = [], N = [];
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
      const v = [[0, 0], [Math.cos(a0), Math.sin(a0)], [Math.cos(a1), Math.sin(a1)]];
      for (const [x, y] of v) { P.push(x, y, 0); UV.push(0.5 + x * 0.5, 0.5 - y * 0.5); N.push(0, 0, 1); }
    }
    return mkMesh(P, UV, N);
  }
  function mkSide(seg) { // unit cylinder side, z ∈ [-1, 0]
    const P = [], UV = [], N = [];
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
      const c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
      const q = [[c0, s0, 0], [c1, s1, 0], [c1, s1, -1], [c0, s0, 0], [c1, s1, -1], [c0, s0, -1]];
      for (const p of q) { P.push(...p); UV.push(0, 0); N.push(p[0], p[1], 0); }
    }
    return mkMesh(P, UV, N);
  }

  R3.setTexture = function (name, source) {
    const gl = R3.gl;
    let t = R3.tex[name];
    if (!t) { t = gl.createTexture(); R3.tex[name] = t; }
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const ext = gl.getExtension('EXT_texture_filter_anisotropic');
    if (ext) gl.texParameterf(gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, 8);
  };

  // ── Placement helpers ─────────────────────────────────────────────────────
  // World point at depth z that projects to screen (sx, sy) with default camera.
  R3.screenToWorld = function (sx, sy, z = 0) {
    const d = CAM.pos[2] - z;
    const k = d / (FPX * CAM.pos[2]);
    return [(sx - 960) * k, CAM.pos[1] - (sy - 540) * k, z];
  };

  // Stand pose: {sx, sy (screen pos of base-front-centre at z=0), z, yaw, scale}
  R3.standMatrix = function (p) {
    const w = R3.screenToWorld(p.sx, p.sy, p.z || 0);
    return M.chain(M.T(w[0], w[1], w[2]), M.Ry(p.yaw || 0), M.S(p.scale || 1));
  };
  // Bend geometry: the base centre-line runs front→back at y = T/2, then turns
  // through (90° − tilt) around a centre of curvature into the leaning panel.
  const BEND = (() => {
    const T = D.panelT, R = D.bendR + T / 2, phi = Math.PI / 2 - D.tilt;
    const c = [T / 2 + R, 0]; // (y, z)
    const at = (th) => [c[0] - R * Math.cos(th), c[1] - R * Math.sin(th)];
    return { R, phi, at, end: at(phi) };
  })();
  R3.BEND = BEND;
  // Panel frame: origin on the printed (front) face at the panel's bottom edge.
  R3.panelMatrix = (Ms) => M.chain(Ms, M.T(0, BEND.end[0], BEND.end[1]), M.Rx(-D.tilt), M.T(0, 0, D.panelT / 2));
  R3.badgeWorld = function (p, extraZ = 0) {
    const Mp = R3.panelMatrix(R3.standMatrix(p));
    return M.apply(Mp, [0, D.badgeY, D.badgeT + extraZ]).slice(0, 3);
  };
  R3.standNormal = function (p) {
    const Mp = R3.panelMatrix(R3.standMatrix(p));
    const a = M.apply(Mp, [0, 0, 0]), b = M.apply(Mp, [0, 0, 1]);
    const v = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], l = Math.hypot(...v);
    return v.map((x) => x / l);
  };
  R3.phoneMatrix = function (p) {
    return M.chain(M.T(p.x, p.y, p.z), M.Ry(p.yaw || 0), M.Rx(p.pitch || 0), M.Rz(p.roll || 0), M.S(p.scale || 1));
  };
  // Phone face texture (u,v in 0..1) → world position
  R3.phoneUVWorld = function (p, u, v) {
    return M.apply(R3.phoneMatrix(p), [(u - 0.5) * D.phoneW, (0.5 - v) * D.phoneH, D.phoneT / 2]).slice(0, 3);
  };

  R3.camera = function (cam) {
    cam = cam || CAM;
    const view = M.lookAt(cam.pos, cam.target, [0, 1, 0]);
    const proj = M.persp(cam.fov || CAM.fov, 16 / 9, 0.02, 40);
    return { vp: M.mul(proj, view), eye: cam.pos };
  };
  R3.project = function (world, cam) {
    const { vp } = R3.camera(cam);
    const c = M.apply(vp, [world[0], world[1], world[2], 1]);
    return [(c[0] / c[3] * 0.5 + 0.5) * 1920, (1 - (c[1] / c[3] * 0.5 + 0.5)) * 1080, c[3]];
  };

  // ── Drawing ───────────────────────────────────────────────────────────────
  function draw(mesh, model, mode, opts) {
    const gl = R3.gl, L = R3.loc;
    gl.uniformMatrix4fv(L.uModel, false, model);
    gl.uniform1i(L.uMode, mode);
    const c = opts.color || [1, 1, 1];
    gl.uniform4f(L.uColor, c[0], c[1], c[2], 1);
    gl.uniform1f(L.uAlpha, opts.alpha == null ? 1 : opts.alpha);
    gl.uniform1f(L.uGlossPos, opts.glossPos || -5);
    gl.uniform1f(L.uGlossAmt, opts.glossAmt || 0);
    gl.uniform1f(L.uSheen, opts.sheen == null ? 1 : opts.sheen);
    gl.uniform1f(L.uReflOn, opts.refl ? 1 : 0);
    gl.uniform1f(L.uReflY, opts.reflY || 0);
    if (opts.tex) { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, R3.tex[opts.tex]); gl.uniform1i(L.uTex, 0); }
    gl.bindVertexArray(mesh.vao);
    gl.drawArrays(gl.TRIANGLES, 0, mesh.n);
  }

  function drawStand(Ms, s, refl) {
    const ms = R3.meshes;
    const o = { alpha: s.alpha == null ? 1 : s.alpha, refl: !!refl, reflY: s.reflY };
    const acrylic = [0.95, 0.955, 0.965];
    const T = D.panelT;
    // Base plate (same sheet, same width as the panel)
    draw(ms.cube, M.chain(Ms, M.T(0, T / 2, D.baseDepth / 2), M.S(D.panelW, T, D.baseDepth)), 2, Object.assign({ color: acrylic }, o));
    // Rounded bend, built from short segments along the arc
    const NB = 12, seg = (BEND.R * BEND.phi) / NB;
    for (let i = 0; i < NB; i++) {
      const th = ((i + 0.5) / NB) * BEND.phi, p = BEND.at(th);
      draw(ms.cube, M.chain(Ms, M.T(0, p[0], p[1]), M.Rx(th - Math.PI / 2), M.S(D.panelW, seg * 1.08, T)), 2, Object.assign({ color: acrylic }, o));
    }
    const Mp = R3.panelMatrix(Ms);
    const faceM = M.chain(Mp, M.T(0, D.panelH / 2, 0), M.S(D.panelW, D.panelH, 1));
    // Extruded acrylic thickness (layers masked by the face silhouette)
    const LAYERS = 10;
    for (let i = LAYERS; i >= 1; i--) {
      const z = -(D.panelT * i) / LAYERS;
      const shade = i === LAYERS ? 0.93 : 0.97;
      draw(ms.quad, M.chain(M.T(0, 0, 0), Mp, M.T(0, D.panelH / 2, z), M.S(D.panelW, D.panelH, 1)), 1,
        Object.assign({ tex: 'stand', color: [acrylic[0] * shade, acrylic[1] * shade, acrylic[2] * shade] }, o));
    }
    // Printed face
    draw(ms.quad, faceM, 0, Object.assign({ tex: 'stand', glossPos: s.glossPos, glossAmt: s.glossAmt, sheen: 1 }, o));
    // Raised G badge
    const Mb = M.chain(Mp, M.T(0, D.badgeY, D.badgeT));
    draw(ms.side, M.chain(Mb, M.S(D.badgeR, D.badgeR, D.badgeT)), 2, Object.assign({ color: [0.9, 0.91, 0.93] }, o));
    draw(ms.cap, M.chain(Mb, M.T(0, 0, 0.0002), M.S(D.badgeR, D.badgeR, 1)), 0, Object.assign({ tex: 'badge', glossPos: s.glossPos, glossAmt: s.glossAmt * 0.6, sheen: 0.4 }, o));
  }

  function drawPhone(p) {
    const ms = R3.meshes;
    const Mph = R3.phoneMatrix(p);
    const o = { alpha: p.alpha == null ? 1 : p.alpha };
    const LAYERS = 10;
    for (let i = LAYERS; i >= 1; i--) {
      const z = D.phoneT / 2 - (D.phoneT * i) / LAYERS;
      const k = 0.75 + 0.25 * Math.sin((i / LAYERS) * Math.PI); // brushed rail highlight
      draw(ms.quad, M.chain(Mph, M.T(0, 0, z), M.S(D.phoneW, D.phoneH, 1)), 1, Object.assign({ tex: 'phone', color: [0.36 * k, 0.38 * k, 0.42 * k] }, o));
    }
    draw(ms.quad, M.chain(Mph, M.T(0, 0, D.phoneT / 2), M.S(D.phoneW, D.phoneH, 1)), 0, Object.assign({ tex: 'phone', sheen: 0.5, glossPos: p.glossPos, glossAmt: p.glossAmt || 0 }, o));
  }

  // scene: { cam, stand: {sx,sy,yaw,scale,alpha,glossPos,glossAmt} | null, phone: {...} | null }
  R3.render = function (scene) {
    const gl = R3.gl, L = R3.loc;
    gl.viewport(0, 0, R3.canvas.width, R3.canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const { vp, eye } = R3.camera(scene.cam);
    gl.uniformMatrix4fv(L.uVP, false, vp);
    gl.uniform3f(L.uEye, eye[0], eye[1], eye[2]);
    if (scene.stand && (scene.stand.alpha == null || scene.stand.alpha > 0.001)) {
      const s = scene.stand;
      const Ms = R3.standMatrix(s);
      const baseY = M.apply(Ms, [0, 0, 0])[1];
      // Floor reflection: mirror about the floor plane through the base.
      const mirror = M.chain(M.T(0, baseY, 0), M.S(1, -1, 1), M.T(0, -baseY, 0));
      // Opaque, depth-tested pass (nearest surface wins) with the fade baked
      // into colour+alpha, so stacked acrylic layers never accumulate.
      gl.disable(gl.BLEND);
      drawStand(M.mul(mirror, Ms), Object.assign({}, s, { reflY: baseY }), true);
      gl.enable(gl.BLEND);
      gl.clear(gl.DEPTH_BUFFER_BIT);
      drawStand(Ms, s, false);
    }
    if (scene.phone && (scene.phone.alpha == null || scene.phone.alpha > 0.001)) drawPhone(scene.phone);
    return R3.canvas;
  };
})();
