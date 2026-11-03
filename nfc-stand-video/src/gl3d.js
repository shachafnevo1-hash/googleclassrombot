// ─────────────────────────────────────────────────────────────────────────────
// gl3d.js — small deterministic WebGL2 renderer for the hero product (a single
// sheet of white acrylic bent into an L whose foot runs BACKWARD under the
// leaning face) and the smartphone. Real-geometry rounded corners (no stacked
// layers), rendered at 2× and downsampled for clean edges.
// Each render() call draws a complete frame from a plain scene description.
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

  // ── Real-world proportions (0.04 world units ≈ 1 cm) ──────────────────────
  // Stand face ≈ 15.5 × 10.2 cm, 3 mm acrylic. Phone ≈ 2 cm shorter / narrower.
  const panelH = 0.62, panelW = panelH * (920 / 1400);
  const D = {
    panelW, panelH, panelT: 0.012, tilt: (14 * Math.PI) / 180, cornerR: panelW * (46 / 920),
    footDepth: 0.26, bendR: 0.014,
    badgeY: panelH * (1 - 0.528),
    phoneH: panelH * 0.88, phoneW: panelH * 0.88 * (840 / 1600), phoneT: 0.03,
  };
  D.phoneR = D.phoneW * (118 / 840);

  const CAM = { pos: [0, 0.3, 2.4], target: [0, 0.3, 0], fov: (30 * Math.PI) / 180 };
  const FPX = 540 / (CAM.pos[2] * Math.tan(CAM.fov / 2)); // ≈ 840 px per unit at z = 0
  const SS = 2; // supersampling factor

  const VS = `#version 300 es
  in vec3 aPos; in vec2 aUV; in vec3 aN;
  uniform mat4 uVP, uModel;
  out vec2 vUV; out vec3 vN; out vec3 vW;
  void main(){ vec4 w = uModel*vec4(aPos,1.0); vW=w.xyz; vUV=aUV; vN=normalize(mat3(uModel)*aN); gl_Position=uVP*w; }`;
  const FS = `#version 300 es
  precision highp float;
  in vec2 vUV; in vec3 vN; in vec3 vW;
  uniform sampler2D uTex; uniform int uMode; uniform vec4 uColor;
  uniform float uGlossPos, uGlossAmt, uSheen, uSpec; uniform float uReflY, uReflOn; uniform vec3 uEye;
  out vec4 o;
  void main(){
    vec3 L = normalize(vec3(-0.4, 0.7, 0.8));
    vec3 n = normalize(vN);
    if(!gl_FrontFacing) n = -n;
    float ndl = max(dot(n,L),0.0);
    vec3 V = normalize(uEye - vW);
    float spec = pow(max(dot(n, normalize(L+V)),0.0), 60.0);
    vec4 c;
    if(uMode==0){ // printed / screen face (premultiplied texture)
      c = texture(uTex, vUV);
      vec3 rgb = c.rgb*(0.94+0.06*ndl);
      float d = (vUV.x*0.8 + (1.0-vUV.y)*0.6);
      float sheen = uSheen * smoothstep(0.6,0.0,d) * 0.05;
      float band = uGlossAmt * exp(-pow((d - uGlossPos)/0.09, 2.0)) * 0.22;
      rgb += (sheen + band + spec*uSpec) * c.a;
      c = vec4(rgb, c.a);
    } else { // lit solid (acrylic edges, phone frame)
      vec3 rgb = uColor.rgb*(0.8+0.2*ndl) + vec3(spec*uSpec);
      c = vec4(rgb, 1.0);
    }
    float a = 1.0;
    if(uReflOn > 0.5){ float h = uReflY - vW.y; a = 0.09 * smoothstep(0.12, 0.0, h); }
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
    canvas.width = w * SS; canvas.height = h * SS;
    const gl = canvas.getContext('webgl2', { antialias: true, premultipliedAlpha: true, preserveDrawingBuffer: true, alpha: true });
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog);
    const loc = {};
    ['uVP', 'uModel', 'uTex', 'uMode', 'uColor', 'uGlossPos', 'uGlossAmt', 'uSheen', 'uSpec', 'uReflY', 'uReflOn', 'uEye'].forEach((n) => (loc[n] = gl.getUniformLocation(prog, n)));
    const attr = { aPos: gl.getAttribLocation(prog, 'aPos'), aUV: gl.getAttribLocation(prog, 'aUV'), aN: gl.getAttribLocation(prog, 'aN') };
    Object.assign(R3, { canvas, gl, prog, loc, attr, tex: {}, outW: w, outH: h });
    R3.meshes = {
      cube: mkCube(),
      panel: mkSlab(D.panelW, D.panelH, D.panelT, D.cornerR, 0, 0, -D.panelT), // y ∈ [0,H], z ∈ [-T,0]
      phone: mkSlab(D.phoneW, D.phoneH, D.phoneT, D.phoneR, D.phoneR, -D.phoneH / 2, -D.phoneT / 2),
    };
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
  // Rounded-rectangle slab: W × H, thickness T. rTop / rBot are the corner radii
  // at the top / bottom. y runs from y0 to y0+H, z from z0 (back) to z0+T (front).
  // Returns three meshes: textured front, plain back, and lit side walls.
  function mkSlab(W, H, T, rTop, rBot, y0, z0) {
    const SEG = 18, pts = [];
    const arc = (cx, cy, r, a0, a1) => { for (let i = 0; i <= SEG; i++) { const a = a0 + ((a1 - a0) * i) / SEG; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } };
    const x0 = -W / 2, x1 = W / 2, yb = y0, yt = y0 + H;
    // counter-clockwise outline
    if (rBot > 0) arc(x1 - rBot, yb + rBot, rBot, -Math.PI / 2, 0); else pts.push([x1, yb]);
    if (rTop > 0) arc(x1 - rTop, yt - rTop, rTop, 0, Math.PI / 2); else pts.push([x1, yt]);
    if (rTop > 0) arc(x0 + rTop, yt - rTop, rTop, Math.PI / 2, Math.PI); else pts.push([x0, yt]);
    if (rBot > 0) arc(x0 + rBot, yb + rBot, rBot, Math.PI, 1.5 * Math.PI); else pts.push([x0, yb]);
    const uvOf = (p) => [(p[0] - x0) / W, 1 - (p[1] - yb) / H];
    const cx = 0, cy = y0 + H / 2, zf = z0 + T, zb = z0;
    const F = { P: [], U: [], N: [] }, B = { P: [], U: [], N: [] }, S = { P: [], U: [], N: [] };
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      for (const p of [[cx, cy], a, b]) { F.P.push(p[0], p[1], zf); F.U.push(...uvOf(p)); F.N.push(0, 0, 1); }
      for (const p of [[cx, cy], b, a]) { B.P.push(p[0], p[1], zb); B.U.push(...uvOf(p)); B.N.push(0, 0, -1); }
      const ex = b[0] - a[0], ey = b[1] - a[1], l = Math.hypot(ex, ey) || 1, nx = ey / l, ny = -ex / l;
      for (const [p, z] of [[a, zb], [b, zb], [b, zf], [a, zb], [b, zf], [a, zf]]) { S.P.push(p[0], p[1], z); S.U.push(0, 0); S.N.push(nx, ny, 0); }
    }
    return { front: mkMesh(F.P, F.U, F.N), back: mkMesh(B.P, B.U, B.N), side: mkMesh(S.P, S.U, S.N) };
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
    if (ext) gl.texParameterf(gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, 16);
  };

  // ── Placement helpers ─────────────────────────────────────────────────────
  R3.screenToWorld = function (sx, sy, z = 0) {
    const d = CAM.pos[2] - z;
    const k = d / (FPX * CAM.pos[2]);
    return [(sx - 960) * k, CAM.pos[1] - (sy - 540) * k, z];
  };
  // Stand pose {sx, sy, yaw, scale}: (sx, sy) is where the front-bottom of the bend sits.
  R3.standMatrix = function (p) {
    const w = R3.screenToWorld(p.sx, p.sy, p.z || 0);
    return M.chain(M.T(w[0], w[1], w[2]), M.Ry(p.yaw || 0), M.S(p.scale || 1));
  };
  // Bend: the foot's centre-line runs from the back (z = -depth) forward to z = 0,
  // then curls up through (90° + tilt) into the face, which leans backward.
  const BEND = (() => {
    const T = D.panelT, R = D.bendR + T / 2, phi = Math.PI / 2 + D.tilt;
    const c = [T / 2 + R, 0]; // (y, z) centre of curvature
    const at = (th) => [c[0] - R * Math.cos(th), c[1] + R * Math.sin(th)];
    return { R, phi, at, end: at(phi) };
  })();
  R3.BEND = BEND;
  // Panel frame: origin on the printed face at the bottom edge; +y up the face, +z out of the print.
  R3.panelMatrix = (Ms) => M.chain(Ms, M.T(0, BEND.end[0], BEND.end[1]), M.Rx(-D.tilt), M.T(0, 0, D.panelT / 2));
  R3.panelPoint = (p, local) => M.apply(R3.panelMatrix(R3.standMatrix(p)), local).slice(0, 3);
  R3.badgeWorld = (p) => R3.panelPoint(p, [0, D.badgeY, 0]);
  R3.standNormal = function (p) {
    const Mp = R3.panelMatrix(R3.standMatrix(p));
    const a = M.apply(Mp, [0, 0, 0]), b = M.apply(Mp, [0, 0, 1]);
    const v = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], l = Math.hypot(...v);
    return v.map((x) => x / l);
  };
  R3.phoneMatrix = function (p) {
    return M.chain(M.T(p.x, p.y, p.z), M.Ry(p.yaw || 0), M.Rx(p.pitch || 0), M.Rz(p.roll || 0), M.S(p.scale || 1));
  };
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
    gl.uniform1f(L.uGlossPos, opts.glossPos || -5);
    gl.uniform1f(L.uGlossAmt, opts.glossAmt || 0);
    gl.uniform1f(L.uSheen, opts.sheen == null ? 1 : opts.sheen);
    gl.uniform1f(L.uSpec, opts.spec == null ? 0.25 : opts.spec);
    gl.uniform1f(L.uReflOn, opts.refl ? 1 : 0);
    gl.uniform1f(L.uReflY, opts.reflY || 0);
    if (opts.tex) { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, R3.tex[opts.tex]); gl.uniform1i(L.uTex, 0); }
    gl.bindVertexArray(mesh.vao);
    gl.drawArrays(gl.TRIANGLES, 0, mesh.n);
  }

  const ACRYLIC = [0.96, 0.965, 0.975];
  function drawStand(Ms, s, refl) {
    const ms = R3.meshes, T = D.panelT;
    const o = { refl: !!refl, reflY: s.reflY };
    // Foot: runs backward from the bend, same width as the face
    draw(ms.cube, M.chain(Ms, M.T(0, T / 2, -D.footDepth / 2), M.S(D.panelW, T, D.footDepth)), 2, Object.assign({ color: ACRYLIC, spec: 0.2 }, o));
    // Rounded bend at the front-bottom
    const NB = 14, seg = (BEND.R * BEND.phi) / NB;
    for (let i = 0; i < NB; i++) {
      const th = ((i + 0.5) / NB) * BEND.phi, p = BEND.at(th);
      draw(ms.cube, M.chain(Ms, M.T(0, p[0], p[1]), M.Rx(Math.PI / 2 - th), M.S(D.panelW, seg * 1.1, T)), 2, Object.assign({ color: ACRYLIC, spec: 0.2 }, o));
    }
    // Face: white acrylic body + printed front
    const Mp = R3.panelMatrix(Ms);
    draw(ms.panel.side, Mp, 2, Object.assign({ color: ACRYLIC, spec: 0.35 }, o));
    draw(ms.panel.back, Mp, 2, Object.assign({ color: [0.94, 0.945, 0.955], spec: 0.15 }, o));
    draw(ms.panel.front, Mp, 0, Object.assign({ tex: 'stand', glossPos: s.glossPos, glossAmt: s.glossAmt, sheen: 1, spec: 0.12 }, o));
  }

  function drawPhone(p) {
    const ms = R3.meshes, Mph = R3.phoneMatrix(p);
    draw(ms.phone.side, Mph, 2, { color: [0.32, 0.33, 0.36], spec: 0.6 });
    draw(ms.phone.back, Mph, 2, { color: [0.12, 0.125, 0.14], spec: 0.3 });
    draw(ms.phone.front, Mph, 0, { tex: 'phone', sheen: 0.6, spec: 0.35, glossPos: p.glossPos, glossAmt: p.glossAmt || 0 });
  }

  // scene: { cam, stand: {sx,sy,yaw,scale,glossPos,glossAmt} | null, phone: {...} | null }
  R3.render = function (scene) {
    const gl = R3.gl, L = R3.loc;
    gl.viewport(0, 0, R3.canvas.width, R3.canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const { vp, eye } = R3.camera(scene.cam);
    gl.uniformMatrix4fv(L.uVP, false, vp);
    gl.uniform3f(L.uEye, eye[0], eye[1], eye[2]);
    if (scene.stand) {
      const s = scene.stand, Ms = R3.standMatrix(s);
      const baseY = M.apply(Ms, [0, 0, 0])[1];
      const mirror = M.chain(M.T(0, baseY, 0), M.S(1, -1, 1), M.T(0, -baseY, 0));
      // Opaque reflection pass (nearest surface wins), faded in the shader.
      gl.disable(gl.BLEND);
      drawStand(M.mul(mirror, Ms), Object.assign({}, s, { reflY: baseY }), true);
      gl.enable(gl.BLEND);
      gl.clear(gl.DEPTH_BUFFER_BIT);
      drawStand(Ms, s, false);
    }
    if (scene.phone) drawPhone(scene.phone);
    return R3.canvas;
  };
})();
