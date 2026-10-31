// nexpot ライドの3D世界。素材は使わず、すべてコードで組み立てる。
// コースは「距離 s」を軸にした一本の道で、地形も建物も s と道からの横ずれ l で配置する。
import * as THREE from '../vendor/three.module.min.js';

export const L = 1800;          // コースの全長（1単位 = 10m として 18km）
const OFF = 140, EXT = 620;     // 出発前と到着後に余分に作る道の長さ
const LAKE_Y = 12;

/* ---------- 数学 ---------- */
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const band = (x, a, b, f) => sstep(a - f, a + f, x) * (1 - sstep(b - f, b + f, x));
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hash(x, y) { const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return h - Math.floor(h); }
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  return lerp(lerp(hash(xi, yi), hash(xi + 1, yi), u), lerp(hash(xi, yi + 1), hash(xi + 1, yi + 1), u), v);
}
function fbm(x, y, o = 4) { let a = .5, f = 1, s = 0; for (let i = 0; i < o; i++) { s += a * vnoise(x * f, y * f); a *= .5; f *= 2; } return s; }
function keyed(keys, t) {           // Catmull-Rom で区間をなめらかにつなぐ
  if (t <= keys[0][0]) return keys[0][1];
  const n = keys.length; if (t >= keys[n - 1][0]) return keys[n - 1][1];
  let i = 0; while (keys[i + 1][0] < t) i++;
  const p0 = keys[Math.max(i - 1, 0)][1], p1 = keys[i][1], p2 = keys[i + 1][1], p3 = keys[Math.min(i + 2, n - 1)][1];
  const u = (t - keys[i][0]) / (keys[i + 1][0] - keys[i][0]);
  return .5 * ((2 * p1) + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (-p0 + 3 * p1 - 3 * p2 + p3) * u * u * u);
}

/* ---------- コース ---------- */
const N = OFF + L + EXT + 1;
const PX = new Float32Array(N), PY = new Float32Array(N), PZ = new Float32Array(N), PH = new Float32Array(N);
(function buildPath() {
  const AMP = [[0, .2], [.05, .75], [.2, .85], [.235, .12], [.27, .12], [.31, .6], [.335, .1], [.49, .12], [.53, .5], [.59, .16], [.68, .16], [.74, .6], [.88, .5], [.95, 0], [1, 0]];
  const ELE = [[0, 80], [.03, 84], [.12, 128], [.22, 168], [.27, 168], [.31, 138], [.345, 102], [.49, 96], [.54, 102], [.6, 110], [.68, 112], [.75, 92], [.83, 52], [.91, 22], [.965, 15], [1, 14.4]];
  let h = -.25, x = 0, z = 0;
  for (let i = OFF; i < N; i++) {
    const s = i - OFF, t = clamp(s / L);
    const k = keyed(AMP, t) * (Math.cos(s / 83) * .0072 + Math.cos(s / 37 + 1.2) * .0034);
    h += k; PH[i] = h; PX[i] = x; PZ[i] = z; x += Math.sin(h); z -= Math.cos(h);
    PY[i] = keyed(ELE, t);
  }
  x = 0; z = 0; h = PH[OFF];
  for (let i = OFF - 1; i >= 0; i--) { x -= Math.sin(h); z += Math.cos(h); PH[i] = h; PX[i] = x; PZ[i] = z; PY[i] = PY[OFF]; }
  for (let pass = 0; pass < 3; pass++) {       // 標高のカクつきをならす
    const c = PY.slice();
    for (let i = 12; i < N - 12; i++) { let a = 0; for (let j = -12; j <= 12; j++) a += c[i + j]; PY[i] = a / 25; }
  }
})();
function pathAt(s, out = {}) {
  const f = clamp(s + OFF, 0, N - 1.001), i = Math.floor(f), u = f - i;
  out.x = lerp(PX[i], PX[i + 1], u); out.y = lerp(PY[i], PY[i + 1], u); out.z = lerp(PZ[i], PZ[i + 1], u); out.h = lerp(PH[i], PH[i + 1], u);
  return out;
}
const _p = {};
function at(s, l, dy = 0) {
  pathAt(s, _p);
  const nx = Math.cos(_p.h), nz = Math.sin(_p.h);
  return new THREE.Vector3(_p.x + nx * l, _p.y + dy, _p.z + nz * l);
}
const faceRoad = (s, l) => { const h = pathAt(s).h; const sg = l > 0 ? -1 : 1; return Math.atan2(sg * Math.cos(h), sg * Math.sin(h)); };
const acrossRoad = (s) => -pathAt(s).h;

/* ---------- 地形の高さ ---------- */
const T_TUN_A = .238, T_TUN_B = .268;
function relH(s, l) {
  const t = s / L, a = Math.abs(l), left = l < 0;
  const n = fbm(s * .011 + 7, l * .013 + 3, 4) - .5;
  const near = sstep(5, 16, a);

  const mt = band(t, .015, .29, .02);
  const slopeUp = Math.min(a, 70) * .86 + Math.max(0, a - 70) * .3;              // 上の方は寝かせて、一枚の壁に見えないようにする
  const crag = (fbm(s * .03 + 2, l * .03 + 8, 3) - .5) * 96 * sstep(24, 150, a);
  const mtH = (left ? slopeUp + n * 70 * near + sstep(20, 120, a) * 30 + crag : -Math.min(a, 150) * .46 - Math.max(0, a - 150) * .1 + n * 40 * near + crag * .7) * near;

  const descent = band(t, .27, .335, .012);
  const dsH = (left ? a * .55 + n * 40 * near : -a * .62 + n * 28 * near) * near;

  const town = band(t, .335, .495, .012);
  const toH = sstep(46, 240, a) * (a * .2 + n * 60);

  const forest = band(t, .495, .745, .016);
  const foH = sstep(7, 60, a) * (a * .36 + n * 46) + sstep(20, 40, a) * n * 8;

  const nat = sstep(.73, .775, t);
  const naH = left ? sstep(6, 40, a) * (a * .16 + n * 22) : -sstep(3, 12, a) * a * .42;
  const pier = sstep(.945, .965, t);

  let h = mt * mtH + descent * dsH + town * toH + forest * foH + nat * naH;
  h = lerp(h, -9 - a * .3, pier);
  if (t < .03) h = lerp(mtH, h, sstep(0, .03, t));

  // トンネルが貫く山。道の部分だけ切り通しにして、両脇を盛り上げる
  const tw = band(t, T_TUN_A - .012, T_TUN_B + .012, .012);
  if (tw > 0) {
    const mound = 44 * Math.exp(-Math.pow(a / 170, 2)) + 12 + n * 18;
    h = lerp(h, Math.max(h, mound), tw * sstep(5.2, 10, a));
  }
  return h;
}

/* ---------- 色 ---------- */
const hex = (s) => new THREE.Color(s);
const PAL = [
  [0, '#6f8c5c', '#967d5f', '#84838a'], [.24, '#4f7650', '#7d6e58', '#6c7079'],
  [.3, '#7f9d58', '#ae9c76', '#8c8c82'], [.5, '#8da75f', '#bba77e', '#93927f'],
  [.54, '#3b6543', '#566049', '#5e6660'], [.72, '#37593f', '#4d5642', '#5a5e5a'],
  [.77, '#a6b95a', '#c2a56a', '#7c7a70'], [1, '#98a84e', '#a88a60', '#6a6870'],
].map(k => [k[0], hex(k[1]), hex(k[2]), hex(k[3])]);
function palette(t, i, out) {
  let k = 0; while (k < PAL.length - 2 && PAL[k + 1][0] < t) k++;
  return out.copy(PAL[k][i]).lerp(PAL[k + 1][i], sstep(PAL[k][0], PAL[k + 1][0], t));
}

/* ---------- 形を組み立てる道具 ---------- */
function P(geo, color, m) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (m) g.applyMatrix4(m);
  const c = color.isColor ? color : hex(color), n = g.attributes.position.count, col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.deleteAttribute('uv');
  return g;
}
function M(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
}
function merge(list) {
  let n = 0; list.forEach(g => n += g.attributes.position.count);
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3);
  let o = 0;
  list.forEach(g => { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); col.set(g.attributes.color.array, o * 3); o += g.attributes.position.count; });
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return out;
}
const box = (a, b, c) => new THREE.BoxGeometry(a, b, c);
const cyl = (r1, r2, h, n = 7) => new THREE.CylinderGeometry(r1, r2, h, n, 1);
const cone = (r, h, n = 7) => new THREE.ConeGeometry(r, h, n, 1);
function gable(len, width, rise) {       // 切妻屋根。棟が X 方向
  const g = new THREE.CylinderGeometry(1, 1, len, 3, 1);
  g.applyMatrix4(M(0, 0, 0, -Math.PI / 2));
  g.applyMatrix4(M(0, 0, 0, 0, Math.PI / 2));
  g.applyMatrix4(new THREE.Matrix4().makeScale(1, rise / 1.5, width / 1.732));
  g.applyMatrix4(M(0, -rise / 3 + .02));
  return g;
}

const ROOF = '#3a3f46', WOOD = '#3b2a22', PLASTER = '#efe6d6', SHU = '#d33f28';

let leafDetail = 1;                            // スマホでは葉の面数を減らす
function blob(r, sx = 1, sy = 1, sz = 1) {     // でこぼこした葉のかたまり
  const g = new THREE.IcosahedronGeometry(r, leafDetail), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = 1 + (hash(Math.round(x * 40), Math.round((y + z * 3) * 40)) - .5) * .26;
    p.setXYZ(i, x * k * sx, y * k * sy, z * k * sz);
  }
  g.computeVertexNormals();
  return g;
}
function ao(g, lo = .68, hi = 1.12) {          // 下ほど暗くして立体感を出す
  const p = g.attributes.position, c = g.attributes.color;
  let a = 1e9, b = -1e9; for (let i = 0; i < p.count; i++) { a = Math.min(a, p.getY(i)); b = Math.max(b, p.getY(i)); }
  for (let i = 0; i < p.count; i++) { const k = lerp(lo, hi, (p.getY(i) - a) / (b - a)); c.setXYZ(i, c.getX(i) * k, c.getY(i) * k, c.getZ(i) * k); }
  return g;
}
function conifer() {
  return ao(merge([
    P(cyl(.26, .4, 3, 5), '#5a4032', M(0, 1.5)),
    P(cone(2.9, 5.4), '#ffffff', M(0, 4.6)),
    P(cone(2.2, 4.6), '#d9e6da', M(0, 7.1, 0, 0, .5)),
    P(cone(1.45, 3.8), '#c2d6c6', M(0, 9.5, 0, 0, 1)),
  ]));
}
function broadleaf() {
  return ao(merge([
    P(cyl(.2, .36, 3.4, 5), '#55402f', M(0, 1.7)),
    P(blob(2.6, 1.15, .86, 1.15), '#ffffff', M(0, 5.3)),
    P(blob(1.9), '#f2f0f0', M(1.7, 6.2, .8, 0, 1)),
    P(blob(1.7), '#eceaea', M(-1.7, 4.8, -.8, 1, 0, .3)),
    P(blob(1.5), '#ffffff', M(-.5, 7, -1, .5, 2)),
  ]), .62, 1.14);
}
function bamboo() {
  return merge([
    P(cyl(.09, .14, 15, 5), '#ffffff', M(0, 7.5, 0, .02, 0, .03)),
    P(new THREE.IcosahedronGeometry(1.3, 0), '#d7e8c8', M(.3, 14.6, 0, 0, 0, 0, 1, .55, 1)),
    P(new THREE.IcosahedronGeometry(1, 0), '#c8dcb8', M(-.4, 12.8, .3, 0, 1, 0, 1, .5, 1)),
    P(new THREE.IcosahedronGeometry(.9, 0), '#bcd2ac', M(.2, 11, -.4, 0, 2, 0, 1, .5, 1)),
  ]);
}
function rock() {
  const g = new THREE.DodecahedronGeometry(1, 0), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const k = 1 + .22 * Math.sin(p.getX(i) * 5 + p.getZ(i) * 3); p.setXYZ(i, p.getX(i) * k, p.getY(i) * .75 * k, p.getZ(i) * k); }
  g.computeVertexNormals();
  return merge([P(g, '#ffffff')]);
}
function machiya(wall, kind) {
  const W = 9.4, D = 8, H = 3.1, parts = [];
  parts.push(P(box(W, H, D), wall, M(0, H / 2)));
  parts.push(P(box(W, 2.3, D - 1.8), wall, M(0, H + 1.15, -.9)));
  parts.push(P(box(W + .7, .16, 2.4), ROOF, M(0, H + .3, D / 2 + .3, .34)));
  parts.push(P(gable(W + 1.1, D + .2, 1.9), ROOF, M(0, H + 2.3 + .55, -.9)));
  for (let i = 0; i < 13; i++) parts.push(P(box(.08, 2.3, .07), WOOD, M(-W / 2 + .5 + i * .3, 1.28, D / 2 + .05)));
  parts.push(P(box(4.2, .16, .12), WOOD, M(-W / 2 + 2.3, 2.5, D / 2 + .05)));
  parts.push(P(box(3.2, 1.05, .05), kind === 0 ? '#22436b' : kind === 1 ? '#a93a2a' : '#2f5a50', M(2.2, 2.05, D / 2 + .1)));
  parts.push(P(box(3.4, 2.5, .06), '#2b211d', M(2.2, 1.25, D / 2 + .03)));
  for (let i = 0; i < 7; i++) parts.push(P(box(.07, 1.3, .07), WOOD, M(-3.6 + i * 1.2, 4.3, D / 2 - 1.75)));
  parts.push(P(box(W, .1, .1), WOOD, M(0, 4.9, D / 2 - 1.75)));
  return merge(parts);
}
function kura() {
  const W = 7, D = 7, H = 5.4;
  return merge([
    P(box(W, H, D), '#f4eee2', M(0, H / 2)),
    P(box(W + .1, 1.9, D + .1), '#39404a', M(0, .95)),
    P(gable(W + 1.4, D + 1.3, 2.1), ROOF, M(0, H + .68)),
    P(box(1.5, 1.5, .14), '#1f252b', M(0, 3.7, D / 2 + .05)),
  ]);
}
function torii(wide = 9.2, tall = 6.6) {
  const c = SHU, w = wide / 2, d = '#1f1b1b';
  return merge([
    P(cyl(.3, .38, tall, 8), c, M(-w + .9, tall / 2)), P(cyl(.3, .38, tall, 8), c, M(w - .9, tall / 2)),
    P(cyl(.44, .46, .7, 8), d, M(-w + .9, .35)), P(cyl(.44, .46, .7, 8), d, M(w - .9, .35)),
    P(box(wide - .9, .34, .3), c, M(0, tall - 1.15)),
    P(box(wide + .3, .38, .5), c, M(0, tall - .15)),
    P(box(wide + 1.1, .3, .66), d, M(0, tall + .17, 0, 0, 0, 0)),
    P(box(.34, .86, .22), c, M(0, tall - .68)),
  ]);
}
function stoneLantern() {
  const c = '#8f8d86';
  return merge([
    P(cyl(.55, .7, .3, 6), c, M(0, .15)), P(cyl(.2, .26, 1.3, 6), c, M(0, .95)),
    P(cyl(.55, .4, .22, 6), c, M(0, 1.7)), P(cone(.86, .6, 6), '#7c7a74', M(0, 2.6)),
    P(new THREE.SphereGeometry(.14, 6, 4), c, M(0, 3)),
  ]);
}
function nobori(color) {
  const parts = [P(cyl(.05, .06, 5.4, 5), '#6a5a4a', M(0, 2.7)), P(box(.86, 3.7, .03), color, M(.48, 3.2)), P(box(.9, .07, .06), '#6a5a4a', M(.48, 5.08))];
  [[4.45, .34], [4.02, .24], [3.62, .3], [3.2, .2], [2.76, .34], [2.3, .24]].forEach(([y, w], i) => parts.push(P(box(w, .2 + (i % 2) * .08, .05), '#fbf4e4', M(.48 + (i % 3 - 1) * .05, y))));
  return merge(parts);
}
function pagoda() {
  const parts = [], body = '#b5402e', tile = '#2f343a';
  let y = 1.2, w = 9;
  parts.push(P(box(13, 1.2, 13), '#a9a59a', M(0, .6)));
  for (let i = 0; i < 5; i++) {
    const h = 3.3 - i * .18;
    parts.push(P(box(w, h, w), body, M(0, y + h / 2)));
    parts.push(P(box(w - .6, .8, w + .05), '#efe6d6', M(0, y + h * .62)));
    const r = w * 1.06;
    parts.push(P(new THREE.ConeGeometry(r, 1.9, 4, 1), tile, M(0, y + h + .55, 0, 0, Math.PI / 4)));
    parts.push(P(new THREE.ConeGeometry(r * .94, .5, 4, 1, true), '#20252b', M(0, y + h - .15, 0, 0, Math.PI / 4)));
    y += h + .85; w *= .84;
  }
  parts.push(P(cyl(.1, .18, 6.4, 6), '#a3853f', M(0, y + 3)));
  for (let i = 0; i < 6; i++) parts.push(P(cyl(.5 - i * .05, .5 - i * .05, .1, 8), '#a3853f', M(0, y + 2 + i * .55)));
  return merge(parts);
}
function farmhouse() {
  return merge([
    P(box(10, 3.2, 7), '#d9cdb8', M(0, 1.6)),
    P(gable(12, 9.2, 4.6), '#6a5a42', M(0, 3.2 + 1.5)),
    P(box(3, 2.2, .1), '#2d2622', M(0, 1.1, 3.54)),
  ]);
}

/* ---------- 空と水 ---------- */
const skyFrag = `
uniform vec3 top,hor,fogC,sunCol,sunDir; uniform float stars,time; varying vec3 vP;
float h21(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n21(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float a=.5,s=0.;for(int i=0;i<5;i++){s+=a*n21(p);p*=2.03;a*=.5;}return s;}
void main(){
  vec3 d=normalize(vP); float h=d.y;
  vec3 c=mix(hor,top,pow(clamp(h*1.55+.015,0.,1.),.58));
  vec2 q=d.xz/(max(h,0.)+.16);
  float band=fbm(vec2(q.x*.9+time*.006,q.y*2.6))*fbm(vec2(q.x*2.1-time*.004,q.y*.8+3.));
  float cl=smoothstep(.2,.4,band)*smoothstep(.01,.09,h)*(1.-smoothstep(.36,.66,h));
  float s=max(dot(d,sunDir),0.);
  vec3 lit=mix(mix(hor,vec3(1.),.35),sunCol,pow(s,3.)*.7);
  c=mix(c,lit,cl*.72);
  c+=sunCol*(pow(s,1400.)*2.6+pow(s,70.)*.3+pow(s,7.)*.16);
  if(stars>0.){vec3 g=floor(d*170.);float st=step(.9975,h21(g.xy+g.z*7.3));c+=st*stars*smoothstep(.08,.5,h)*vec3(.9,.95,1.);}
  c=mix(fogC,c,smoothstep(-.03,.035,h));
  gl_FragColor=vec4(c,1.);
  #include <colorspace_fragment>
}`;
const waterFrag = `
uniform vec3 top,hor,fogC,sunCol,sunDir,camPos; uniform float time,fNear,fFar; varying vec3 wP;
void main(){
  vec3 V=normalize(camPos-wP); float d=length(camPos-wP); vec2 p=wP.xz;
  float a=sin(p.x*.21+time*.9)+sin(p.y*.33-time*.7)+.6*sin((p.x+p.y)*.71+time*1.4)+.3*sin(p.x*1.7-p.y*1.3+time*2.);
  float b=sin(p.y*.19-time*.8)+sin(p.x*.37+time*.6)+.6*sin((p.x-p.y)*.83-time*1.2)+.3*sin(p.y*1.9+p.x*.9-time*2.2);
  vec3 N=normalize(vec3(a*.016,1.,b*.016)); vec3 R=reflect(-V,N); R.y=abs(R.y);
  vec3 c=mix(hor,top,pow(clamp(R.y*1.55,0.,1.),.58));
  float s=max(dot(R,sunDir),0.);
  c+=sunCol*(pow(s,260.)*3.2+pow(s,20.)*.34);
  c*=mix(.88,1.,clamp(R.y*3.,0.,1.));
  c=mix(c,fogC,smoothstep(fNear,fFar,d)*.92);
  gl_FragColor=vec4(c,1.);
  #include <colorspace_fragment>
}`;
const passVert = `varying vec3 vP; varying vec3 wP; void main(){vP=position; vec4 w=modelMatrix*vec4(position,1.); wP=w.xyz; gl_Position=projectionMatrix*viewMatrix*w;}`;

/* ---------- 時間と光の流れ ---------- */
const ENV = [
  { t: 0, top: '#2b4674', hor: '#f8b98e', fog: '#efbc9b', sun: '#ffc791', hs: '#a7bddb', hg: '#6d5763', si: 1.75, hi: 1.25, n: 30, f: 600, el: 6, az: 24, ink: '#3b5578', m: 1.2 },
  { t: .14, top: '#39709f', hor: '#ffd8ad', fog: '#f0cfb3', sun: '#ffe1b8', hs: '#bcd5ea', hg: '#66705a', si: 2.1, hi: 1.2, n: 50, f: 680, el: 15, az: 15, ink: '#47698a', m: 1.3 },
  { t: .23, top: '#4f8ec6', hor: '#f4e4cc', fog: '#e4dece', sun: '#fff0d4', hs: '#c6dff0', hg: '#6e7558', si: 2.3, hi: 1.25, n: 60, f: 760, el: 26, az: 0, ink: '#5a7c9b', m: 1.3 },
  { t: .3, top: '#4f9fdb', hor: '#dcf0f4', fog: '#d8edf1', sun: '#fff4dc', hs: '#d8eef8', hg: '#85905f', si: 2.6, hi: 1.4, n: 90, f: 980, el: 46, az: -15, ink: '#7fa3bb', m: .8 },
  { t: .47, top: '#55a4dc', hor: '#f3edd9', fog: '#efe8d4', sun: '#fff1d2', hs: '#dff0f4', hg: '#8c8e62', si: 2.6, hi: 1.4, n: 90, f: 900, el: 48, az: -30, ink: '#8fa7b0', m: .7 },
  { t: .54, top: '#4e78a9', hor: '#f7d29a', fog: '#dcb385', sun: '#ffc97e', hs: '#cdbd99', hg: '#4c4a3a', si: 2, hi: 1.05, n: 16, f: 300, el: 20, az: -45, ink: '#7f7a70', m: .7 },
  { t: .66, top: '#5a4a88', hor: '#f79c5d', fog: '#bd6e48', sun: '#ffa05a', hs: '#ad8d8c', hg: '#422f33', si: 1.7, hi: .95, n: 10, f: 210, el: 11, az: -35, ink: '#6a4a52', m: .7 },
  { t: .745, top: '#5c5095', hor: '#fca468', fog: '#e38f64', sun: '#ffa05a', hs: '#b79fb2', hg: '#4c3e46', si: 1.7, hi: 1.05, n: 40, f: 640, el: 9, az: -8, ink: '#6f5a83', m: .9 },
  { t: .9, top: '#352f75', hor: '#ff9c5e', fog: '#ef9066', sun: '#ff8c4c', hs: '#a59bc8', hg: '#51496a', si: 1.5, hi: 1.08, n: 70, f: 900, el: 4.2, az: 0, ink: '#4e4678', m: 1 },
  { t: 1, top: '#1f2359', hor: '#ff8d57', fog: '#dc7a60', sun: '#ff7c40', hs: '#8a84bc', hg: '#4a4664', si: 1.2, hi: 1.05, n: 90, f: 980, el: 1.9, az: 0, ink: '#39345f', m: 1 },
].map(k => ({ ...k, top: hex(k.top), hor: hex(k.hor), fog: hex(k.fog), sun: hex(k.sun), hs: hex(k.hs), hg: hex(k.hg), ink: hex(k.ink) }));

/* ---------- 世界をつくる ---------- */
export function createWorld(canvas, opts = {}) {
  const q = opts.quality ?? 1;
  leafDetail = q >= 1 ? 1 : 0;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: q >= 1, powerPreference: 'high-performance' });
  let pixelRatio = Math.min(devicePixelRatio || 1, q >= 1 ? 1.75 : 1.5);
  renderer.setPixelRatio(pixelRatio);
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xffffff, 40, 600);
  const camera = new THREE.PerspectiveCamera(62, 1, .3, 3400);
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const matSmooth = new THREE.MeshLambertMaterial({ vertexColors: true });
  const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 2); scene.add(sun); scene.add(sun.target);
  const R = rng(20261031);

  const add = (geo, m = mat) => { const o = new THREE.Mesh(geo, m); o.frustumCulled = false; scene.add(o); return o; };
  const zones = [];        // 離れたら描かない
  function instanced(geo, list, material = mat, colorOf) {
    const im = new THREE.InstancedMesh(geo, material, list.length);
    const d = new THREE.Object3D(), c = new THREE.Color();
    let lo = 1e9, hi = -1e9;
    list.forEach((it, i) => {
      d.position.copy(it.p); d.rotation.set(it.rx || 0, it.ry || 0, it.rz || 0); d.scale.set(it.sx ?? it.k ?? 1, it.sy ?? it.k ?? 1, it.sz ?? it.k ?? 1);
      d.updateMatrix(); im.setMatrixAt(i, d.matrix);
      if (colorOf) { colorOf(it, c, i); im.setColorAt(i, c); }
      lo = Math.min(lo, it.s); hi = Math.max(hi, it.s);
    });
    im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.frustumCulled = false; scene.add(im);
    zones.push({ o: im, lo: lo - 720, hi: hi + 160 });
    return im;
  }

  /* 地形 */
  (function terrain() {
    const LAT = [-420, -300, -220, -160, -118, -86, -62, -44, -31, -22, -15, -10, -6.6, -4.3, 4.3, 6.6, 10, 15, 22, 31, 44, 62, 86, 118, 160, 220, 300, 420];
    const step = q >= 1 ? 4 : 6, S0 = -130, S1 = L + 610, rows = Math.floor((S1 - S0) / step) + 1, cols = LAT.length;
    const pos = new Float32Array(rows * cols * 3), col = new Float32Array(rows * cols * 3), idx = [];
    const a = new THREE.Color(), b = new THREE.Color(), c = new THREE.Color(), PAVE = hex('#bdb29c');
    for (let r = 0; r < rows; r++) {
      const s = S0 + r * step, t = clamp(s / L);
      for (let i = 0; i < cols; i++) {
        const l = LAT[i], v = at(s, l), o = (r * cols + i) * 3;
        const near = Math.abs(l) < 5;
        const h = near ? -.06 : relH(s, l);
        pos[o] = v.x; pos[o + 1] = v.y + h; pos[o + 2] = v.z;
        const h2 = near ? -.06 : relH(s + step, l), lat2 = i < cols - 1 ? LAT[i + 1] : l + 1;
        const h3 = near ? -.06 : relH(s, lat2);
        const slope = Math.hypot((h2 - h) / step, (h3 - h) / Math.max(1, lat2 - l));
        const n = fbm(s * .03, l * .05 + 9, 3);
        palette(t, 1, a); palette(t, 2, b); palette(t, 3, c);
        a.lerp(b, sstep(.42, .66, n));
        a.lerp(c, sstep(.62, 1.05, slope));
        const stone = band(t, .338, .49, .004) * (1 - sstep(16, 20, Math.abs(l)));
        if (stone > 0) a.lerp(PAVE, stone);
        const j = .92 + hash(r, i) * .16;
        col[o] = a.r * j; col[o + 1] = a.g * j; col[o + 2] = a.b * j;
        if (r < rows - 1 && i < cols - 1) { const A = r * cols + i, B = A + 1, C = A + cols, D = C + 1; idx.push(A, B, C, B, D, C); }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setIndex(idx); g.computeVertexNormals();
    add(g);
  })();

  /* 道 */
  (function road() {
    const WID = 3.9, S0 = -130, S1 = L + 8, step = 3, rows = Math.floor((S1 - S0) / step) + 1;
    const pos = new Float32Array(rows * 2 * 3), col = new Float32Array(rows * 2 * 3), idx = [];
    const KEY = [[0, '#6d717c'], [.27, '#6f7380'], [.335, '#a59a86'], [.49, '#a79c88'], [.53, '#b4ab98'], [.74, '#a89f8c'], [.78, '#a29c95'], [.945, '#a39d96'], [.965, '#c49a72'], [1, '#c49a72']].map(k => [k[0], hex(k[1])]);
    const c = new THREE.Color();
    for (let r = 0; r < rows; r++) {
      const s = S0 + r * step, t = clamp(s / L);
      let k = 0; while (k < KEY.length - 2 && KEY[k + 1][0] < t) k++;
      c.copy(KEY[k][1]).lerp(KEY[k + 1][1], sstep(KEY[k][0], KEY[k + 1][0], t));
      const pier = t > .955; const j = pier ? (r % 2 ? .82 : 1.06) : .97 + hash(r, 3) * .06;
      for (let i = 0; i < 2; i++) {
        const v = at(s, (i ? 1 : -1) * WID, .06), o = (r * 2 + i) * 3;
        pos[o] = v.x; pos[o + 1] = v.y; pos[o + 2] = v.z;
        col[o] = c.r * j; col[o + 1] = c.g * j; col[o + 2] = c.b * j;
      }
      if (r < rows - 1) { const A = r * 2; idx.push(A, A + 1, A + 2, A + 1, A + 3, A + 2); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setIndex(idx); g.computeVertexNormals();
    add(g, new THREE.MeshLambertMaterial({ vertexColors: true }));

    // 白線
    const edge = [];
    for (let s = -120; s < L * .24; s += 7) edge.push({ s, p: at(s, 0, .09), ry: -pathAt(s).h });
    for (let s = L * .76; s < L * .95; s += 7) edge.push({ s, p: at(s, 0, .09), ry: -pathAt(s).h });
    instanced(box(.16, .02, 3.2), edge, new THREE.MeshLambertMaterial({ color: 0xf1ede4 }));

    // nexpot のルート線。アプリの地図と同じ点線を路面に重ねる
    const dash = [];
    for (let s = -30; s < L + 4; s += 3.6) dash.push({ s, p: at(s, -1.5, .11), ry: -pathAt(s).h });
    instanced(box(.3, .02, 1.9), dash, new THREE.MeshBasicMaterial({ color: 0x20d0c0, fog: false, transparent: true, opacity: .9 }));
  })();

  /* トンネル */
  (function tunnel() {
    const A = T_TUN_A * L, B = T_TUN_B * L, r = 5.5, segs = 10, step = 3;
    const rows = Math.floor((B - A) / step) + 1, cols = segs + 1;
    const pos = new Float32Array(rows * cols * 3), col = new Float32Array(rows * cols * 3), idx = [];
    for (let i = 0; i < rows; i++) {
      const s = A + i * step;
      for (let j = 0; j < cols; j++) {
        const an = Math.PI * j / segs, v = at(s, Math.cos(an) * r, Math.sin(an) * r * 1.08 - .1), o = (i * cols + j) * 3;
        pos[o] = v.x; pos[o + 1] = v.y; pos[o + 2] = v.z;
        const n = .95 + hash(i, j) * .1; col[o] = .34 * n; col[o + 1] = .33 * n; col[o + 2] = .31 * n;
        if (i < rows - 1 && j < cols - 1) { const a = i * cols + j, b = a + 1, c = a + cols, d = c + 1; idx.push(a, b, c, b, d, c); }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setIndex(idx); g.computeVertexNormals();
    add(g, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, flatShading: true }));

    // 山の天井
    const rx = [-18, -11, -6, 0, 6, 11, 18], rr = Math.floor((B - A + 16) / 6) + 1, p2 = new Float32Array(rr * rx.length * 3), c2 = new Float32Array(rr * rx.length * 3), id2 = [];
    const rock = hex('#6a6e74');
    for (let i = 0; i < rr; i++) {
      const s = A - 8 + i * 6;
      for (let j = 0; j < rx.length; j++) {
        const v = at(s, rx[j], 13 + Math.abs(rx[j]) * .25 + fbm(s * .04, j, 3) * 7), o = (i * rx.length + j) * 3;
        p2[o] = v.x; p2[o + 1] = v.y; p2[o + 2] = v.z; const n = .85 + hash(i, j) * .25;
        c2[o] = rock.r * n; c2[o + 1] = rock.g * n; c2[o + 2] = rock.b * n;
        if (i < rr - 1 && j < rx.length - 1) { const a = i * rx.length + j, b = a + 1, c = a + rx.length, d = c + 1; id2.push(a, c, b, b, c, d); }
      }
    }
    const g2 = new THREE.BufferGeometry();
    g2.setAttribute('position', new THREE.BufferAttribute(p2, 3)); g2.setAttribute('color', new THREE.BufferAttribute(c2, 3));
    g2.setIndex(id2); g2.computeVertexNormals();
    add(g2, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, flatShading: true }));

    // 坑口
    const shape = new THREE.Shape();
    shape.moveTo(-34, -6); shape.lineTo(34, -6); shape.lineTo(34, 30); shape.lineTo(-34, 30); shape.closePath();
    const hole = new THREE.Path();
    hole.moveTo(-r, -.1); hole.absarc(0, 0, r, 0, 0, false);
    const arch = new THREE.Path(); arch.moveTo(r + .1, -.1);
    for (let j = 0; j <= 24; j++) { const an = Math.PI * j / 24; arch.lineTo(Math.cos(an) * (r + .05), Math.sin(an) * (r * 1.08 + .05) - .1); }
    arch.lineTo(-r - .1, -6); arch.lineTo(r + .1, -6); arch.closePath();
    shape.holes.push(arch);
    const face = new THREE.ExtrudeGeometry(shape, { depth: 1.6, bevelEnabled: false, curveSegments: 4 });
    [A, B].forEach((s, i) => {
      const f = new THREE.Mesh(face, new THREE.MeshLambertMaterial({ color: 0x9a988f }));
      f.position.copy(at(s, 0)); f.rotation.y = -pathAt(s).h + (i ? Math.PI : 0); f.frustumCulled = false; scene.add(f);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r + .5, .62, 6, 28, Math.PI).scale(1, 1.08, .9), new THREE.MeshLambertMaterial({ color: 0xc4bfb2, flatShading: true }));
      ring.position.copy(at(s, 0, .1)); ring.rotation.y = f.rotation.y; ring.translateZ(1.7); ring.frustumCulled = false; scene.add(ring);
      for (let k = 0; k < 2; k++) {
        const band = new THREE.Mesh(box(68, .26, .5), new THREE.MeshLambertMaterial({ color: 0x77766f }));
        band.position.copy(at(s, 0, 8.6 + k * 5.2)); band.rotation.y = f.rotation.y; band.translateZ(1.8); band.frustumCulled = false; scene.add(band);
      }
    });

    // 照明
    const lamps = [];
    for (let s = A + 6; s < B; s += 8) { [-1, 1].forEach(sd => lamps.push({ s, p: at(s, sd * 3.9, 4.7), ry: -pathAt(s).h })); }
    instanced(box(.3, .12, 1.9), lamps, new THREE.MeshBasicMaterial({ color: 0xffb25e, fog: false }));
  })();

  /* 木々と岩 */
  const pick = (lo, hi) => lerp(lo, hi, R());
  function sideOffset(minA, maxA, bias = 1.6) { const a = minA + Math.pow(R(), bias) * (maxA - minA); return (R() < .5 ? -1 : 1) * a; }
  (function flora() {
    const cf = [], bl = [], sk = [], mp = [], bb = [], rk = [];
    const count = (n) => Math.floor(n * q);
    for (let i = 0; i < count(1100); i++) {         // 山の針葉樹
      const s = pick(-120, L * .235), l = sideOffset(s < 90 ? 30 : 11, 300), h = relH(s, l);
      cf.push({ s, p: at(s, l, h - .4), ry: R() * 6, k: pick(.9, 1.8), kind: 0 });
    }
    for (let i = 0; i < count(320); i++) {          // 下りの森
      const s = pick(L * .27, L * .335), l = sideOffset(10, 260), h = relH(s, l);
      cf.push({ s, p: at(s, l, h - .4), ry: R() * 6, k: pick(1, 2), kind: 0 });
    }
    for (let i = 0; i < count(620); i++) {          // 社の森
      const s = pick(L * .5, L * .745), l = sideOffset(16, 260), h = relH(s, l);
      if (s > L * .59 && s < L * .69 && Math.abs(l) < 26) continue;
      if (s > L * .69 && s < L * .735 && l > 8 && l < 60) continue;           // 塔の手前は空ける
      cf.push({ s, p: at(s, l, h - .4), ry: R() * 6, k: pick(1.5, 2.8), kind: 1 });
    }
    for (let i = 0; i < count(260); i++) {          // 町の周りの緑と里山
      const s = pick(L * .33, L * .5), l = sideOffset(62, 300), h = relH(s, l);
      bl.push({ s, p: at(s, l, h - .3), ry: R() * 6, k: pick(1.1, 2.3) });
    }
    for (let i = 0; i < count(240); i++) {          // 湖までの里
      const s = pick(L * .75, L * .955), l = -pick(50, 300), h = relH(s, l);
      bl.push({ s, p: at(s, l, h - .3), ry: R() * 6, k: pick(1.1, 2.4) });
    }
    for (let i = 0; i < count(170); i++) {          // 湖へ下る道の茂み
      const s = pick(L * .75, L * .95), l = -pick(7, 46), h = relH(s, l);
      bl.push({ s, p: at(s, l, h - .2), ry: R() * 6, k: pick(.3, .62) });
    }
    for (let s = L * .3; s < L * .335; s += 6.5) {   // 桜並木（町の入り口）
      [-1, 1].forEach(sd => sk.push({ s, p: at(s, sd * pick(7.5, 9), relH(s, sd * 8) - .2), ry: R() * 6, k: pick(1, 1.25) }));
    }
    for (let s = L * .485; s < L * .515; s += 6) { [-1, 1].forEach(sd => sk.push({ s, p: at(s, sd * pick(7.5, 9.5), relH(s, sd * 8) - .2), ry: R() * 6, k: pick(1, 1.25) })); }
    for (let i = 0; i < count(170); i++) {          // もみじ
      const s = pick(L * .51, L * .59), l = sideOffset(8, 50, 1.2), h = relH(s, l);
      mp.push({ s, p: at(s, l, h - .2), ry: R() * 6, k: pick(.9, 1.5) });
    }
    for (let i = 0; i < count(90); i++) {
      const s = pick(L * .69, L * .75), l = sideOffset(10, 60, 1.2), h = relH(s, l);
      mp.push({ s, p: at(s, l, h - .2), ry: R() * 6, k: pick(.9, 1.6) });
    }
    for (let i = 0; i < count(1100); i++) {         // 竹林
      const s = pick(L * .585, L * .695), l = (R() < .5 ? -1 : 1) * (6.5 + Math.pow(R(), 1.4) * 34), h = relH(s, l);
      bb.push({ s, p: at(s, l, h - .2), ry: R() * 6, rz: (R() - .5) * .07, k: pick(.85, 1.25) });
    }
    for (let i = 0; i < count(240); i++) {          // 岩
      const s = pick(-100, L * .3), l = sideOffset(7, 110), h = relH(s, l);
      rk.push({ s, p: at(s, l, h - .2), ry: R() * 6, sx: pick(.8, 3.6), sy: pick(.8, 2.8), sz: pick(.8, 3.6) });
    }
    const green = [hex('#5c8f63'), hex('#6fa06a'), hex('#4c8060')], forest = [hex('#3f7058'), hex('#386453'), hex('#4b7a58')];
    instanced(conifer(), cf, mat, (it, c, i) => c.copy((it.kind ? forest : green)[i % 3]));
    const sato = [hex('#7c9a4c'), hex('#94a851'), hex('#6c8f4f'), hex('#a7ad57')];
    instanced(broadleaf(), bl, mat, (it, c, i) => c.copy(sato[i % 4]));
    const pink = [hex('#ffc4d2'), hex('#ffb3c6'), hex('#ffdbe3')];
    instanced(broadleaf(), sk, mat, (it, c, i) => c.copy(pink[i % 3]));
    const fall = [hex('#d94b2b'), hex('#e8742a'), hex('#c23a2c'), hex('#e6a12e')];
    instanced(broadleaf(), mp, mat, (it, c, i) => c.copy(fall[i % 4]));
    const bam = [hex('#79a267'), hex('#8fb573'), hex('#6c9660')];
    instanced(bamboo(), bb, mat, (it, c, i) => c.copy(bam[i % 3]));
    instanced(rock(), rk, mat, (it, c) => c.setRGB(.45, .46, .48));
  })();

  /* ガードレール（谷側） */
  (function rail() {
    const posts = [], bars = [];
    for (let s = 40; s < L * .232; s += 4.4) {
      posts.push({ s, p: at(s, 4.9, .5), ry: -pathAt(s).h });
      bars.push({ s, p: at(s + 2.2, 4.86, .82), ry: -pathAt(s + 2.2).h });
    }
    instanced(box(.1, 1, .1), posts, new THREE.MeshLambertMaterial({ color: 0xd9d7cf }));
    instanced(box(.05, .3, 4.5), bars, new THREE.MeshLambertMaterial({ color: 0xeeeae0 }));
  })();

  /* 町 */
  const glows = [];
  (function town() {
    const A = L * .338, B = L * .488;
    const lists = [[], [], []], kuras = [], blds2 = [];
    for (let side = -1; side <= 1; side += 2) {
      for (let s = A; s < B;) {
        const w = 9.8, k = R();
        if (k < .11) { s += 6; continue; }
        if (k < .26) { kuras.push({ s, p: at(s, side * 10.6, -.05), ry: faceRoad(s, side) }); s += 8; continue; }
        lists[Math.floor(R() * 3)].push({ s, p: at(s, side * 10.1, -.05), ry: faceRoad(s, side) });
        s += w;
      }
      for (let s = A + 5; s < B; s += 11.5) {
        if (R() < .2) continue;
        blds2.push({ s, p: at(s, side * pick(21, 25), -.05), ry: faceRoad(s, side) + (R() - .5) * .14 });
      }
    }
    instanced(machiya(PLASTER, 0), lists[0]);
    instanced(machiya('#55392b', 1), lists[1]);
    instanced(machiya('#c8a877', 2), lists[2]);
    instanced(kura(), kuras);
    instanced(machiya('#d7c9b2', 2), blds2);

    // 提灯の列
    const lant = [], wires = [];
    for (let s = A + 16; s < B - 8; s += 26) {
      const a = at(s, -5.4, 6.2), b = at(s, 5.4, 6.2), n = 11;
      for (let i = 0; i <= n; i++) {
        const u = i / n, p = a.clone().lerp(b, u); p.y -= Math.sin(u * Math.PI) * .7;
        lant.push({ s, p, sy: 1.2, sx: 1, sz: 1, kind: i % 2 });
        if (i % 3 === 0) glows.push(p.clone());
      }
    }
    instanced(new THREE.SphereGeometry(.2, 8, 6), lant, new THREE.MeshBasicMaterial({ color: 0xffffff }), (it, c) => c.set(it.kind ? 0xe2452f : 0xfff1cf));

    // のぼり
    const flags = [[], []];
    for (let s = A + 4; s < B; s += 15) { [-1, 1].forEach((sd, i) => flags[(i + Math.floor(s)) % 2].push({ s, p: at(s + (sd > 0 ? 4 : 0), sd * 5.3, 0), ry: -pathAt(s).h + Math.PI / 2 })); }
    instanced(nobori('#c93a2b'), flags[0]); instanced(nobori('#2a4f7b'), flags[1]);
  })();

  /* 鳥居の森 */
  (function shrine() {
    const list = [];
    const A = L * .597, B = L * .682;
    for (let s = A; s < B; s += 3.25) list.push({ s, p: at(s, 0, -.02), ry: acrossRoad(s), k: 1 });
    instanced(torii(), list);
    instanced(torii(), [{ s: L * .53, p: at(L * .53, 0, -.02), ry: acrossRoad(L * .53), k: 1.75 }]);
    instanced(torii(), [{ s: L + 165, p: at(L + 165, 0, LAKE_Y - at(L + 165, 0).y - .4), ry: acrossRoad(L + 165), k: 2.6 }]);

    const lanterns = [], lights = [];
    const place = (s, l) => { const p = at(s, l, relH(s, l) - .1); lanterns.push({ s, p, ry: R() * 3, k: 1.05 }); lights.push({ s, p: p.clone().add(new THREE.Vector3(0, 2.02, 0)), k: .46 }); glows.push(p.clone().add(new THREE.Vector3(0, 2.1, 0))); };
    for (let s = L * .532; s < L * .596; s += 7.4) { place(s, -5.3); place(s, 5.3); }
    for (let s = L * .685; s < L * .742; s += 7.4) { place(s, -5.3); place(s, 5.3); }
    instanced(stoneLantern(), lanterns);
    instanced(box(.9, .95, .9), lights, new THREE.MeshBasicMaterial({ color: 0xffd089 }));

    const gs = L * .712;
    instanced(pagoda(), [{ s: gs, p: at(gs, 25, relH(gs, 25) - .4), ry: .4, k: 1.5 }]);
  })();

  /* 農家・桟橋 */
  (function satoyama() {
    const fh = [];
    [.79, .83, .86, .9].forEach((t, i) => { const s = L * t, l = -(150 + i * 26); fh.push({ s, p: at(s, l, relH(s, l)), ry: faceRoad(s, l) + .3, k: 1.1 }); });
    instanced(farmhouse(), fh);

    const piles = [];
    for (let s = L * .955; s < L + 8; s += 6) [-1, 1].forEach(sd => piles.push({ s, p: at(s, sd * 3.95, -2.4), ry: 0 }));
    instanced(cyl(.16, .2, 5.4, 6), piles, new THREE.MeshLambertMaterial({ color: 0x8a6a4c }));
  })();

  /* スポットのピン */
  const SPOTS = [
    { n: 1, t: .187, name: '見晴らし峠' }, { n: 2, t: .41, name: '古い町並み' },
    { n: 3, t: .705, name: '森のお社' }, { n: 4, t: .925, name: '湖のほとり' },
  ];
  (function pins() {
    SPOTS.forEach(sp => {
      const c = document.createElement('canvas'); c.width = 128; c.height = 168;
      const x = c.getContext('2d');
      x.fillStyle = '#0D9488'; x.beginPath(); x.arc(64, 62, 50, Math.PI * .86, Math.PI * 2.14); x.quadraticCurveTo(88, 120, 64, 160); x.quadraticCurveTo(40, 120, 19, 92); x.fill();
      x.fillStyle = '#fff'; x.beginPath(); x.arc(64, 62, 34, 0, 7); x.fill();
      x.fillStyle = '#0D9488'; x.font = '700 46px Quicksand, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(sp.n, 64, 64);
      const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, fog: false, depthWrite: false }));
      s.scale.set(3.4, 4.46, 1); s.position.copy(at(sp.t * L, sp.n === 1 ? 5.2 : sp.n === 2 ? 6.5 : sp.n === 3 ? 7.5 : -5.5, 7.4));
      if (sp.n === 4) s.position.copy(at(sp.t * L, -6, relH(sp.t * L, -6) + 6.6));
      sp.sprite = s; sp.baseY = s.position.y; scene.add(s);
    });
  })();

  /* 光の粒（提灯のにじみ） */
  function dotTexture(hard = .25) {
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(hard, 'rgba(255,255,255,.65)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
  }
  const glowGeo = new THREE.BufferGeometry().setFromPoints(glows);
  const glowMat = new THREE.PointsMaterial({ size: 5.4, map: dotTexture(), color: 0xffb35e, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: .0, fog: false });
  const glowPts = new THREE.Points(glowGeo, glowMat); glowPts.frustumCulled = false; scene.add(glowPts);

  /* 舞うもの（土ぼこり／花びら／もみじ／蛍） */
  const PN = Math.floor(260 * q), pPos = new Float32Array(PN * 3), pVel = new Float32Array(PN * 3);
  for (let i = 0; i < PN; i++) { pPos[i * 3] = R() * 70; pPos[i * 3 + 1] = R() * 22; pPos[i * 3 + 2] = R() * 70; pVel[i * 3] = R() - .5; pVel[i * 3 + 1] = R() - .5; pVel[i * 3 + 2] = R() - .5; }
  const pGeo = new THREE.BufferGeometry(); pGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(PN * 3), 3));
  const pMat = new THREE.PointsMaterial({ size: .22, map: dotTexture(.55), color: 0xffffff, transparent: true, depthWrite: false, fog: false, opacity: .8 });
  const pts = new THREE.Points(pGeo, pMat); pts.frustumCulled = false; scene.add(pts);

  /* 空・山並み・湖 */
  const U = {
    top: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, fogC: { value: new THREE.Color() }, sunCol: { value: new THREE.Color() },
    sunDir: { value: new THREE.Vector3(0, 1, 0) }, stars: { value: 0 }, time: { value: 0 }, camPos: { value: new THREE.Vector3() }, fNear: { value: 50 }, fFar: { value: 900 },
  };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(3000, 32, 24), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: U, vertexShader: passVert, fragmentShader: skyFrag }));
  sky.frustumCulled = false; sky.renderOrder = -10; scene.add(sky);

  const rings = [0, 1, 2].map(i => {
    const rad = 1250 + i * 520, seg = 180, pos = [], idx = [];
    for (let j = 0; j <= seg; j++) {
      const a = j / seg * Math.PI * 2, x = Math.cos(a), z = Math.sin(a);
      const wrap = (u) => Math.sin(u) * .5 + .5;
      const nn = fbm(x * (3.4 + i) + 9 + i * 7, z * (3.4 + i) + 4, 5), ridge = 1 - Math.abs(fbm(x * 2.2 + i, z * 2.2 + 2, 3) * 2 - 1);
      const h = (70 + 300 * Math.pow(nn, 1.5) + 200 * Math.pow(ridge, 3)) * (1 + i * .45) * (.3 + wrap(a * 2 + i) * .1 + .6);
      pos.push(x * rad, -160, z * rad, x * rad, h, z * rad);
      if (j < seg) { const k = j * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0x888888, fog: false, side: THREE.DoubleSide }));
    m.frustumCulled = false; m.renderOrder = -9 + i; scene.add(m); return m;
  });

  const water = new THREE.Mesh(new THREE.CircleGeometry(3200, 48).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({ fog: false, uniforms: U, vertexShader: passVert, fragmentShader: waterFrag }));
  water.position.set(at(L, 0).x, LAKE_Y, at(L, 0).z); water.frustumCulled = false; scene.add(water);

  /* 棚田：道から湖へ段々に下り、水を張った田に空が映る */
  (function terraces() {
    const A = L * .765, B = L * .925, step = 6, bands = 15, w = 10.5, rise = 2.3;
    const wet = { pos: [], idx: [] }, dry = { pos: [], col: [], idx: [] }, rim = { pos: [], col: [], idx: [] };
    const lat = (b, s) => 7 + b * w + (b ? Math.sin(s * .017 + b * .9) * 2.6 + Math.sin(s * .05 + b) * 1.1 : 0);
    const level = (b, s) => Math.floor((pathAt(s).y - 1 - b * rise) / rise) * rise + rise * .12;
    const quad = (set, a, b, c, d, color) => {
      const n = set.pos.length / 3;
      [a, b, c, d].forEach(v => { set.pos.push(v.x, v.y, v.z); if (set.col) set.col.push(color.r, color.g, color.b); });
      set.idx.push(n, n + 1, n + 2, n + 1, n + 3, n + 2);
    };
    const rice = [hex('#c9c66a'), hex('#e0b95a'), hex('#b4bf5e')], bank = hex('#8a9a52'), soil = hex('#8f7358');
    for (let b = 0; b < bands; b++) {
      for (let s = A; s < B; s += step) {
        const s2 = s + step, y = level(b, s + 3), yNext = level(b + 1, s + 3), yFwd = level(b, s2 + 3);
        if (y < LAKE_Y + .4) continue;
        const pt = (ss, ll, yy) => { const v = at(ss, ll); v.y = yy; return v; };
        const a0 = pt(s, lat(b, s) + .25, y), a1 = pt(s, lat(b + 1, s) - .25, y), b0 = pt(s2, lat(b, s2) + .25, y), b1 = pt(s2, lat(b + 1, s2) - .25, y);
        if (hash(Math.floor(s / 40 + b * 1.7), b * 3.1) < .7) quad(wet, a0, b0, a1, b1);
        else quad(dry, a0, b0, a1, b1, rice[(b + Math.floor(s / 40)) % 3].clone().multiplyScalar(.9 + hash(s, b) * .2));
        // 畦と石垣
        const drop = Math.max(y - yNext, rise) + .6;
        const g0 = pt(s, lat(b + 1, s) - .25, y + .12), g1 = pt(s2, lat(b + 1, s2) - .25, y + .12);
        const g2 = pt(s, lat(b + 1, s) + .25, y + .12), g3 = pt(s2, lat(b + 1, s2) + .25, y + .12);
        quad(rim, g0, g1, g2, g3, bank);
        quad(rim, g2, g3, pt(s, lat(b + 1, s) + .25, y - drop), pt(s2, lat(b + 1, s2) + .25, y - drop), soil);
        if (Math.abs(yFwd - y) > .1) {
          const hi = Math.max(y, yFwd) + .12, lo = Math.min(y, yFwd) - .6;
          quad(rim, pt(s2, lat(b, s2), hi), pt(s2, lat(b, s2), lo), pt(s2, lat(b + 1, s2), hi), pt(s2, lat(b + 1, s2), lo), soil);
          quad(rim, pt(s2 - .3, lat(b, s2), hi), pt(s2 + .3, lat(b, s2), hi), pt(s2 - .3, lat(b + 1, s2), hi), pt(s2 + .3, lat(b + 1, s2), hi), bank);
        }
      }
    }
    const build = (set, material) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(set.pos, 3));
      if (set.col) g.setAttribute('color', new THREE.Float32BufferAttribute(set.col, 3));
      g.setIndex(set.idx); g.computeVertexNormals();
      const o = add(g, material); zones.push({ o, lo: A - 720, hi: B + 160 });
    };
    build(wet, new THREE.ShaderMaterial({ side: THREE.DoubleSide, uniforms: U, vertexShader: passVert, fragmentShader: waterFrag }));
    build(dry, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
    build(rim, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, flatShading: true }));
  })();

  /* 環境の補間 */
  const env = { top: new THREE.Color(), hor: new THREE.Color(), fog: new THREE.Color(), sun: new THREE.Color(), hs: new THREE.Color(), hg: new THREE.Color(), ink: new THREE.Color() };
  const endH = pathAt(L).h, DARK = hex('#100e0c');
  function applyEnv(t) {
    let i = 0; while (i < ENV.length - 2 && ENV[i + 1].t < t) i++;
    const a = ENV[i], b = ENV[i + 1], u = sstep(a.t, b.t, t);
    ['top', 'hor', 'fog', 'sun', 'hs', 'hg', 'ink'].forEach(k => env[k].copy(a[k]).lerp(b[k], u));
    let si = lerp(a.si, b.si, u), hi = lerp(a.hi, b.hi, u), near = lerp(a.n, b.n, u), far = lerp(a.f, b.f, u);
    const el = THREE.MathUtils.degToRad(lerp(a.el, b.el, u)), az = endH + THREE.MathUtils.degToRad(lerp(a.az, b.az, u));
    const tw = band(t, T_TUN_A + .003, T_TUN_B - .001, .0025);
    env.fogT = tw;
    const fogC = env.fog.clone().lerp(DARK, tw);
    if (tw > 0) { si = lerp(si, .05, tw); hi = lerp(hi, .32, tw); near = lerp(near, 8, tw); far = lerp(far, 120, tw); }
    scene.fog.color.copy(fogC); scene.fog.near = near; scene.fog.far = far;
    hemi.color.copy(env.hs); hemi.groundColor.copy(env.hg); hemi.intensity = hi;
    sun.color.copy(env.sun); sun.intensity = si;
    const d = U.sunDir.value.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)).normalize();
    U.top.value.copy(env.top); U.hor.value.copy(env.hor); U.fogC.value.copy(env.fog); U.sunCol.value.copy(env.sun);
    U.stars.value = sstep(.9, 1, t) * .9; U.fNear.value = near; U.fFar.value = far * 1.6;
    rings.forEach((m, k) => { m.material.color.copy(env.fog).lerp(env.ink, .42 + (2 - k) * .18); });
    const mScale = lerp(a.m, b.m, u); rings.forEach(m => m.scale.y = mScale);
    glowMat.opacity = sstep(.42, .6, t) * .85;
    // 舞うものの色
    const w = [band(t, -.1, .27, .02), band(t, .28, .5, .02), band(t, .5, .745, .02), sstep(.86, .97, t)];
    const col = pMat.color.set(0xffffff);
    if (w[0] > .5) { col.set(0xffe9c4); pMat.size = .16; pMat.opacity = .7; pMat.blending = THREE.NormalBlending; }
    else if (w[1] > .5) { col.set(0xffc2d0); pMat.size = .26; pMat.opacity = .95; pMat.blending = THREE.NormalBlending; }
    else if (w[2] > .5) { col.set(0xff7a3a); pMat.size = .34; pMat.opacity = .95; pMat.blending = THREE.NormalBlending; }
    else if (w[3] > .5) { col.set(0xe6ff9e); pMat.size = .13; pMat.opacity = 1; pMat.blending = THREE.AdditiveBlending; }
    else { col.set(0xffd9b0); pMat.size = .14; pMat.opacity = .6; pMat.blending = THREE.NormalBlending; }
    return tw;
  }

  /* 描画 */
  let W = 1, H = 1, time = 0;
  const v = new THREE.Vector3(), cp = {}, look = new THREE.Vector3(), sunNdc = new THREE.Vector3();
  const state = { sunX: .5, sunY: .3, sunFront: true };
  function resize(w, h) {
    W = w; H = h; renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w < h ? 70 : 60;
    camera.updateProjectionMatrix();
  }
  function setPixelRatio(r) { pixelRatio = r; renderer.setPixelRatio(r); renderer.setSize(W, H, false); }

  function render(s, dt, o = {}) {
    time += dt; U.time.value = time;
    const t = clamp(s / L), tw = applyEnv(t);
    const pedal = s * .55;
    pathAt(s, cp);
    const ahead = pathAt(s + 26);
    const curve = (pathAt(s + 34).h - cp.h);                  // 曲がる方向へ少し傾く
    const bob = (o.still ? 0 : Math.sin(pedal) * .03 * clamp(o.speed ?? 0, 0, 1));
    const lane = -1.1;
    const nx = Math.cos(cp.h), nz = Math.sin(cp.h);
    camera.position.set(cp.x + nx * lane, cp.y + 1.86 + bob, cp.z + nz * lane);
    const aNx = Math.cos(ahead.h), aNz = Math.sin(ahead.h);
    look.set(ahead.x + aNx * lane, ahead.y + 1.15, ahead.z + aNz * lane);
    if (o.lookPitch) look.y += o.lookPitch * 26;
    if (o.lookYaw) { look.x += nx * o.lookYaw * 26; look.z += nz * o.lookYaw * 26; }
    camera.up.set(0, 1, 0);
    camera.lookAt(look);
    camera.rotateZ(-curve * .46);
    if (o.fovKick !== undefined) { const f = (W < H ? 70 : 60) + o.fovKick; if (Math.abs(f - camera.fov) > .05) { camera.fov = f; camera.updateProjectionMatrix(); } }

    sun.position.copy(camera.position).addScaledVector(U.sunDir.value, 400); sun.target.position.copy(camera.position);
    sky.position.copy(camera.position);
    U.camPos.value.copy(camera.position);
    rings.forEach(m => m.position.set(camera.position.x, Math.min(camera.position.y, 150) - 40, camera.position.z));
    water.visible = t > .62;

    // 遠くのものは描かない
    for (const z of zones) z.o.visible = s > z.lo && s < z.hi;

    SPOTS.forEach(sp => {
      const d = Math.abs(sp.t * L - s);
      sp.sprite.visible = d < 240;
      sp.sprite.position.y = sp.baseY + Math.sin(time * 2.1 + sp.n) * .22;
      const k = 1 + Math.sin(time * 3) * .03;
      sp.sprite.scale.set(3.4 * k, 4.46 * k, 1);
    });

    // 舞うもの
    if (pts.visible) {
      const arr = pGeo.attributes.position.array, cx = camera.position.x, cy = camera.position.y, cz = camera.position.z;
      const sw = t > .28 && t < .75 ? 1 : .4;
      for (let i = 0; i < PN; i++) {
        const k = i * 3;
        pPos[k] += (pVel[k] + Math.sin(time + i) * .5) * dt * 1.6 * sw;
        pPos[k + 1] += (pVel[k + 1] * .4 - (t > .28 && t < .75 ? .55 : 0)) * dt * 1.6;
        pPos[k + 2] += (pVel[k + 2] + Math.cos(time * .8 + i) * .5) * dt * 1.6 * sw;
        arr[k] = cx - 35 + ((pPos[k] - cx) % 70 + 70) % 70;
        arr[k + 1] = cy - 3 + ((pPos[k + 1] - cy) % 22 + 22) % 22;
        arr[k + 2] = cz - 35 + ((pPos[k + 2] - cz) % 70 + 70) % 70;
      }
      pGeo.attributes.position.needsUpdate = true;
    }

    renderer.render(scene, camera);

    sunNdc.copy(camera.position).addScaledVector(U.sunDir.value, 1200).project(camera);
    state.sunX = (sunNdc.x + 1) / 2; state.sunY = (1 - sunNdc.y) / 2; state.sunFront = sunNdc.z < 1;
    state.tw = tw; state.fog = '#' + scene.fog.color.getHexString(); state.sunCss = '#' + env.sun.getHexString();
    state.elev = cp.y; state.curve = curve;
    return state;
  }

  const route = []; for (let s = 0; s <= L; s += 18) { const p = pathAt(s); route.push([p.x, p.z]); }
  const posAt = (s) => { const p = pathAt(s); return [p.x, p.z]; };
  return { render, resize, setPixelRatio, get pixelRatio() { return pixelRatio; }, L, SPOTS, route, posAt };
}
