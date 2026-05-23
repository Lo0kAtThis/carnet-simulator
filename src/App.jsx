import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import * as THREE from "three";

/* ══════════════════════════════════════════════════════════════ DATA */

const SIZES = [
  { id:"petit", label:"Petit",  dim:"A6 · 10,5 × 14,8 cm", price:6,  sc:0.70 },
  { id:"moyen", label:"Moyen",  dim:"A5 · 14,8 × 21 cm",   price:9,  sc:1.00 },
  { id:"grand", label:"Grand",  dim:"A4 · 21 × 29,7 cm",   price:12, sc:1.30 },
];
const BINDINGS = [
  { id:"japonaise", label:"Japonaise",       desc:"Piqûres côté, fil apparent", price:5 },
  { id:"copte",     label:"Copte",           desc:"Dos nu, chevrons de fil",    price:7 },
  { id:"spirale",   label:"Spirale",         desc:"Métal brossé, 360°",         price:3 },
  { id:"longue",    label:"Long stitch",     desc:"Coutures longues sur lin",   price:6 },
  { id:"parfaite",  label:"Dos carré collé", desc:"Propre, type livre de poche",price:1 },
  { id:"agrafes",   label:"Agrafes",         desc:"Métal, sobre et robuste",    price:0 },
  { id:"belge",     label:"Belge (Bradel)",  desc:"Toile dos, haut de gamme",   price:9 },
];
const PAPERS = [
  { id:"standard",  label:"Standard 80g",    desc:"Écriture & notes",          price:0,  pg:"#f6f4ef" },
  { id:"esquisse",  label:"Esquisse 100g",   desc:"Croquis & feutres",         price:2,  pg:"#f0ede4" },
  { id:"dessin",    label:"Dessin 180g",     desc:"Crayon, encre, pastels",    price:5,  pg:"#ede9de" },
  { id:"aquarelle", label:"Aquarelle 300g",  desc:"Cold press, watercolor",    price:10, pg:"#e8ece8" },
  { id:"kraft",     label:"Kraft 120g",      desc:"Naturel & chaleureux",      price:3,  pg:"#b8845a" },
  { id:"noir",      label:"Vélin noir 120g", desc:"Pastels & encres claires",  price:4,  pg:"#1a1a1a" },
];
const FORMATS = [
  { id:"portrait",  label:"Portrait",  icon:"▯", ar:1/Math.SQRT2, xtra:0 },
  { id:"paysage",   label:"Paysage",   icon:"▭", ar:Math.SQRT2,   xtra:0 },
  { id:"leporello", label:"Leporello", icon:"⊞", ar:Math.SQRT2,   xtra:5 },
];
const COVER_COLORS = [
  { hex:"#1c1410", name:"Noir d'encre" },
  { hex:"#3b2a1e", name:"Brun bistre"  },
  { hex:"#5c2d1e", name:"Rouge brique" },
  { hex:"#7a1c2e", name:"Bordeaux"     },
  { hex:"#1e3a4c", name:"Bleu nuit"    },
  { hex:"#2a3d2f", name:"Vert forêt"   },
  { hex:"#4a3860", name:"Prune"        },
  { hex:"#7c6040", name:"Tabac"        },
  { hex:"#8a7a60", name:"Sable"        },
  { hex:"#c8b49a", name:"Parchemin"    },
  { hex:"#d8cfc4", name:"Lin"          },
  { hex:"#f2ede6", name:"Ivoire"       },
];

/* ══════════════════════════════════════════════════════════════ THREE UTILS */

/** Safe mesh helper – always uses .position.set(), never Object.assign */
function mk(geo, mat, px = 0, py = 0, pz = 0, rx = 0, ry = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(px, py, pz);
  if (rx) m.rotation.x = rx;
  if (ry) m.rotation.y = ry;
  return m;
}

const phong = (color, sh = 28, spec = 0x332211) =>
  new THREE.MeshPhongMaterial({ color, shininess: sh, specular: spec });

/* ══════════════════════════════════════════════════════════════ 3-D HOOK */

function useNotebook(canvasRef, config, imgUrl) {
  const R = useRef({
    scene: null, renderer: null, cam: null, group: null,
    frame: null, ry: 0.55, rx: -0.18,
    drag: false, lx: 0, ly: 0, autoRot: true, autoTimer: null,
  });

  /* ── scene setup (runs once) ── */
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const w = el.clientWidth || 700, h = el.clientHeight || 700;

    const scene    = new THREE.Scene();
    const renderer = new THREE.WebGLRenderer({ canvas: el, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(w, h);
    renderer.shadowMap.enabled   = true;
    renderer.shadowMap.type      = THREE.PCFSoftShadowMap;
    renderer.toneMapping         = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;

    const cam = new THREE.PerspectiveCamera(30, w / h, 0.1, 100);
    cam.position.set(0, 0.05, 5.8);

    // warm key light
    const key = new THREE.DirectionalLight(0xfff0d8, 1.55);
    key.position.set(5, 7, 5);
    key.castShadow = true;
    key.shadow.mapSize.width = key.shadow.mapSize.height = 2048;
    key.shadow.camera.near = 1; key.shadow.camera.far = 20;
    key.shadow.radius = 3;
    scene.add(key);
    // cool fill
    const fill = new THREE.DirectionalLight(0xc8d8f0, 0.50);
    fill.position.set(-4, -1, 5);
    scene.add(fill);
    // rim
    const rim = new THREE.DirectionalLight(0xffe0a0, 0.28);
    rim.position.set(0, -6, -3);
    scene.add(rim);
    // ambient
    scene.add(new THREE.AmbientLight(0xfff4e8, 0.48));

    // shadow catcher
    const shadowMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(10, 10),
      new THREE.ShadowMaterial({ opacity: 0.22 })
    );
    shadowMesh.rotation.x  = -Math.PI / 2;
    shadowMesh.position.y  = -1.55;
    shadowMesh.receiveShadow = true;
    scene.add(shadowMesh);

    R.current.scene = scene;
    R.current.renderer = renderer;
    R.current.cam = cam;

    const tick = () => {
      R.current.frame = requestAnimationFrame(tick);
      const ref = R.current;
      if (ref.autoRot && ref.group) ref.ry += 0.0025;
      if (ref.group) {
        ref.group.rotation.x = ref.rx;
        ref.group.rotation.y = ref.ry;
        ref.group.position.y = Math.sin(Date.now() * 0.0008) * 0.033;
      }
      renderer.render(scene, cam);
    };
    tick();

    const obs = new ResizeObserver(() => {
      const nw = el.clientWidth, nh = el.clientHeight;
      if (nw && nh) {
        renderer.setSize(nw, nh);
        cam.aspect = nw / nh;
        cam.updateProjectionMatrix();
      }
    });
    obs.observe(el);
    return () => { cancelAnimationFrame(R.current.frame); obs.disconnect(); renderer.dispose(); };
  }, []);

  /* ── rebuild on config change ── */
  useEffect(() => { rebuild(config, imgUrl); }, [config, imgUrl]);

  function disposeGroup() {
    const ref = R.current;
    if (!ref.group || !ref.scene) return;
    ref.scene.remove(ref.group);
    ref.group.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) [].concat(o.material).forEach(m => { if (m.map) m.map.dispose(); m.dispose(); });
    });
    ref.group = null;
  }

  function rebuild(cfg, imgUrl) {
    disposeGroup();
    const ref = R.current;
    if (!ref.scene) return;

    const sd  = SIZES.find(s => s.id === cfg.size)    || SIZES[1];
    const fd  = FORMATS.find(f => f.id === cfg.format) || FORMATS[0];
    const pd  = PAPERS.find(p => p.id === cfg.paper)  || PAPERS[0];
    const sc  = sd.sc;
    const ar  = fd.ar;

    let bW, bH;
    if (ar < 1) { bH = 1.65 * sc; bW = bH * ar; }
    else        { bW = 1.65 * sc; bH = bW / ar; }
    const bD  = ({ petit: 0.10, moyen: 0.15, grand: 0.21 }[cfg.size] || 0.15) * sc;
    const cvT = 0.026 * sc; // cover thickness

    const CC  = new THREE.Color(cfg.color || "#1e3a4c");
    const PC  = new THREE.Color(pd.pg);

    /* ── cover texture ── */
    const cW = 512, cH = Math.round(512 * bH / bW);
    const cvs = document.createElement("canvas");
    cvs.width = cW; cvs.height = cH;
    const ctx = cvs.getContext("2d");
    ctx.fillStyle = cfg.color || "#1e3a4c";
    ctx.fillRect(0, 0, cW, cH);
    // cloth grain — drawn on separate canvas then composited so cover color stays intact
    const grainCvs = document.createElement("canvas");
    grainCvs.width = cW; grainCvs.height = cH;
    const gCtx = grainCvs.getContext("2d");
    const grainData = gCtx.createImageData(cW, cH);
    for (let k = 0; k < grainData.data.length; k += 4) {
      const v = Math.round((Math.random() - 0.5) * 40 + 128);
      grainData.data[k] = grainData.data[k+1] = grainData.data[k+2] = v;
      grainData.data[k+3] = 255; // fully opaque on its own canvas
    }
    gCtx.putImageData(grainData, 0, 0);
    ctx.globalAlpha = 0.07; // subtle overlay over the cover color
    ctx.drawImage(grainCvs, 0, 0);
    ctx.globalAlpha = 1.0;
    // vignette
    const vg = ctx.createRadialGradient(cW/2, cH/2, cH*0.12, cW/2, cH/2, cH*0.80);
    vg.addColorStop(0, "rgba(255,255,255,0.04)");
    vg.addColorStop(1, "rgba(0,0,0,0.30)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, cW, cH);
    const tex = new THREE.CanvasTexture(cvs);
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;

    if (imgUrl) {
      const im = new Image();
      im.onload = () => {
        // composite drawing ON TOP of the cover color — transparent pixels show cover
        const s = Math.min(cW / im.width, cH / im.height);
        ctx.drawImage(im, (cW - im.width*s)/2, (cH - im.height*s)/2, im.width*s, im.height*s);
        tex.needsUpdate = true;
      };
      im.src = imgUrl;
    }

    const g = new THREE.Group();

    /* ── pages block ── */
    const PC2  = PC.clone();
    const pagesM = [
      phong(PC2.clone().multiplyScalar(0.76), 4),  // -x (spine side)
      phong(PC2.clone().multiplyScalar(0.91), 4),  // +x (fore-edge)
      phong(PC2.clone().multiplyScalar(0.86), 4),  // +y (top)
      phong(PC2.clone().multiplyScalar(0.86), 4),  // -y (bottom)
      phong(PC2, 4),                                // +z (front face)
      phong(PC2, 4),                                // -z (back face)
    ];
    // pages slightly inset from covers (avoids z-fighting)
    const pg = mk(new THREE.BoxGeometry(bW*0.964, bH*0.978, bD*0.988), pagesM);
    pg.castShadow = true;
    g.add(pg);

    // fore-edge page lines
    const lineC = new THREE.MeshLambertMaterial({ color: PC2.clone().lerp(new THREE.Color("#666"), 0.20) });
    for (let i = 0; i < 20; i++) {
      const z = ((i / 19) - 0.5) * bD * 0.82;
      const l = mk(new THREE.BoxGeometry(0.0024*sc, bH*0.962, 0.0008), lineC, bW*0.476, 0, z);
      g.add(l);
    }

    /* ── front cover ── */
    const frontM = [
      phong(CC), phong(CC), phong(CC), phong(CC),
      new THREE.MeshPhongMaterial({ map: tex, shininess: 55, specular: new THREE.Color(0x3a2a18) }),
      phong(CC.clone().lerp(new THREE.Color("#000"), 0.06)),
    ];
    const front = mk(new THREE.BoxGeometry(bW, bH, cvT), frontM, 0, 0, bD/2 + cvT/2 + 0.004);
    front.castShadow = true;
    g.add(front);

    /* ── back cover (same color as front, just slightly darker) ── */
    const bCC   = CC.clone().lerp(new THREE.Color("#000"), 0.09);
    const backM = [phong(bCC), phong(bCC), phong(bCC), phong(bCC), phong(bCC), phong(bCC)];
    const back  = mk(new THREE.BoxGeometry(bW, bH, cvT), backM, 0, 0, -(bD/2 + cvT/2 + 0.004));
    back.castShadow = true;
    g.add(back);

    /* ── spine cover strip ── */
    const spW    = 0.052 * sc;
    const spineM = phong(CC.clone().lerp(new THREE.Color("#000"), 0.15), 10);
    const spineX = -bW/2 - spW/2;
    const spineMesh = mk(
      new THREE.BoxGeometry(spW, bH + 0.004, bD + cvT*2 + 0.010),
      spineM, spineX, 0, 0
    );
    spineMesh.castShadow = true;
    g.add(spineMesh);

    /* ── binding geometry ── */
    try { addBinding(g, cfg.binding, bW, bH, bD, sc, cvT); }
    catch (e) { console.warn("binding error:", e); }

    /* ── leporello folds ── */
    if (fd.id === "leporello") {
      for (let i = 0; i < 8; i++) {
        const fc = i % 2 === 0
          ? PC2.clone().lerp(new THREE.Color("#fff"), 0.22)
          : PC2.clone().lerp(new THREE.Color("#555"), 0.14);
        const fold = mk(
          new THREE.BoxGeometry(0.088*sc, bH*0.952, bD*0.84),
          phong(fc, 3),
          bW*0.5 + (i + 0.5) * 0.088*sc, 0, 0
        );
        g.add(fold);
      }
    }

    g.rotation.x = ref.rx;
    g.rotation.y = ref.ry;
    ref.scene.add(g);
    ref.group = g;
  }

  /* ══════════════════════════════════ BINDING GEOMETRIES */
  function addBinding(g, bid, bW, bH, bD, sc, cvT) {
    const GOLD   = new THREE.Color("#d4aa6a");
    const WAX    = new THREE.Color("#c49048");
    const SILVER = new THREE.Color("#b2bac4");
    const LINEN  = new THREE.Color("#c8b898");

    const sx    = -bW / 2;               // left edge x
    const halfD = (bD + cvT*2 + 0.012) / 2; // half of total book thickness
    const fullD = halfD * 2;

    /* ── JAPONAISE ── */
    if (bid === "japonaise") {
      const n  = 7;
      const hx = sx + 0.078 * sc;

      for (let i = 0; i < n; i++) {
        const y = ((i / (n-1)) - 0.5) * bH * 0.68;

        // gold peg through book
        const peg = mk(
          new THREE.CylinderGeometry(0.019*sc, 0.019*sc, fullD + 0.004, 12),
          phong(GOLD, 80, 0x886644),
          hx, y, 0, Math.PI / 2
        );
        g.add(peg);

        // vertical thread on front & back faces
        if (i < n - 1) {
          const ny = (((i+1) / (n-1)) - 0.5) * bH * 0.68;
          const dy = Math.abs(ny - y);
          const my = (y + ny) / 2;
          [halfD + 0.002, -(halfD + 0.002)].forEach(zz => {
            g.add(mk(
              new THREE.BoxGeometry(0.013*sc, dy + 0.010, 0.013*sc),
              phong(GOLD, 55),
              hx, my, zz
            ));
          });
        }

        // horizontal thread: spine edge → peg
        const hLen = Math.abs(hx - sx) + 0.006;
        [halfD + 0.002, -(halfD + 0.002)].forEach(zz => {
          g.add(mk(
            new THREE.BoxGeometry(hLen, 0.013*sc, 0.013*sc),
            phong(GOLD, 55),
            sx + hLen/2 - 0.003, y, zz
          ));
        });
      }
    }

    /* ── COPTE ── */
    else if (bid === "copte") {
      const spX = sx - 0.006;
      const n   = 9;

      // headbands top & bottom
      [-bH * 0.470, bH * 0.470].forEach(y => {
        g.add(mk(
          new THREE.BoxGeometry(0.044*sc, 0.016*sc, fullD + 0.004),
          phong(WAX, 28),
          spX - 0.022*sc, y, 0
        ));
      });

      // alternating chevron stitches — wider spread, thicker tube
      for (let i = 0; i < n - 1; i++) {
        const y1 = ((i / (n-1)) - 0.5) * bH * 0.76;
        const y2 = (((i+1) / (n-1)) - 0.5) * bH * 0.76;
        const ym = (y1 + y2) / 2;
        const z1 =  (i % 2 === 0 ? 1 : -1) * (halfD - 0.008);
        const z2 = -z1;
        const pts = [
          new THREE.Vector3(spX - 0.002, y1, z1),
          new THREE.Vector3(spX - 0.026*sc, ym, 0),
          new THREE.Vector3(spX - 0.002, y2, z2),
        ];
        g.add(new THREE.Mesh(
          new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.011*sc, 7, false),
          phong(WAX, 50)
        ));
        // face link dot
        g.add(mk(
          new THREE.SphereGeometry(0.010*sc, 7, 7),
          phong(WAX, 50),
          spX - 0.002, y1, z1
        ));
      }
    }

    /* ── SPIRALE ── */
    else if (bid === "spirale") {
      const holeX  = sx - 0.005;            // coil center at spine edge
      const Rz     = halfD + 0.018 * sc;    // radius in Z: beyond both covers
      const Rx     = 0.042 * sc;            // radius in X: visible left protrusion
      const nTurns = 14, perTurn = 26;
      const steps  = nTurns * perTurn;
      const pts    = [];
      for (let i = 0; i <= steps; i++) {
        const a = (i / perTurn) * Math.PI * 2;
        const y = ((i / steps) - 0.5) * bH * 0.88;
        pts.push(new THREE.Vector3(
          holeX + Math.cos(a) * Rx,
          y,
          Math.sin(a) * Rz
        ));
      }
      const coil = new THREE.Mesh(
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), steps, 0.013*sc, 10, false),
        new THREE.MeshPhongMaterial({ color: SILVER, shininess: 155, specular: new THREE.Color(0xdce4f0) })
      );
      g.add(coil);
      // thin reinforcement bar
      const bar = mk(
        new THREE.BoxGeometry(0.014*sc, bH * 0.91, 0.014*sc),
        phong(SILVER.clone().multiplyScalar(0.72), 100),
        holeX, 0, 0
      );
      g.add(bar);
    }

    /* ── LONG STITCH ── */
    else if (bid === "longue") {
      const lsW = 0.048 * sc;
      const lsCX = sx - lsW / 2;

      // linen spine strip
      const ls = mk(
        new THREE.BoxGeometry(lsW, bH + 0.014, fullD),
        phong(LINEN, 6),
        lsCX, 0, 0
      );
      g.add(ls);

      const n  = 5;
      const hx = sx + 0.065 * sc;  // stitch x
      for (let i = 0; i < n; i++) {
        const y = ((i / (n-1)) - 0.5) * bH * 0.72;

        // horizontal bar visible on front & back faces
        const barLen = Math.abs(hx - sx) + 0.008;
        [halfD - 0.001, -(halfD - 0.001)].forEach(zz => {
          const bar = mk(
            new THREE.BoxGeometry(barLen, 0.012*sc, 0.012*sc),
            phong(GOLD, 62),
            sx + barLen/2 - 0.004, y, zz
          );
          g.add(bar);
        });

        // cross-through cylinder (full depth)
        const cr = mk(
          new THREE.CylinderGeometry(0.008*sc, 0.008*sc, fullD + 0.002, 8),
          phong(GOLD, 62),
          hx, y, 0, Math.PI / 2
        );
        g.add(cr);
      }
    }

    /* ── DOS CARRÉ COLLÉ ── */
    else if (bid === "parfaite") {
      const pw  = 0.030 * sc;
      const pCX = sx - pw / 2;

      // dark glue spine
      const sp = mk(
        new THREE.BoxGeometry(pw, bH + 0.006, fullD),
        new THREE.MeshLambertMaterial({ color: new THREE.Color("#131313") }),
        pCX, 0, 0
      );
      g.add(sp);

      // glue bleed seam on front & back
      [halfD - 0.001, -(halfD - 0.001)].forEach(zz => {
        const seam = mk(
          new THREE.BoxGeometry(pw + 0.006, bH + 0.008, 0.004),
          new THREE.MeshLambertMaterial({ color: new THREE.Color("#28180a") }),
          pCX, 0, zz
        );
        g.add(seam);
      });
    }

    /* ── AGRAFES ── */
    else if (bid === "agrafes") {
      const mat  = new THREE.MeshPhongMaterial({ color: SILVER, shininess: 130, specular: new THREE.Color(0xe0e8f0) });
      const agCX = sx - 0.008;
      const legZ = halfD + 0.004; // legs sit flush against outer face of covers

      [-bH * 0.24, bH * 0.24].forEach(y => {
        // main bar spanning full book depth
        const topBar = mk(
          new THREE.BoxGeometry(0.020*sc, 0.058*sc, fullD),
          mat.clone(),
          agCX, y, 0
        );
        g.add(topBar);
        // bent legs (front & back) — same Y as bar, flush against covers
        [-legZ, legZ].forEach(z => {
          const leg = mk(
            new THREE.BoxGeometry(0.020*sc, 0.058*sc, 0.018*sc),
            mat.clone(),
            agCX, y, z
          );
          g.add(leg);
        });
      });
    }

    /* ── BELGE (BRADEL) ── */
    else if (bid === "belge") {
      const bltW = 0.106 * sc;
      const bCX  = sx - bltW / 2;
      const beltC = LINEN.clone().lerp(new THREE.Color("#a09070"), 0.28);

      // main fabric belt
      const belt = mk(
        new THREE.BoxGeometry(bltW, bH + 0.028, fullD),
        phong(beltC, 7),
        bCX, 0, 0
      );
      g.add(belt);

      // linen grain lines
      const grainC = new THREE.MeshLambertMaterial({
        color: LINEN.clone().lerp(new THREE.Color("#888"), 0.20)
      });
      for (let i = 0; i < 11; i++) {
        const y = ((i / 10) - 0.5) * bH * 0.88;
        const gl = mk(
          new THREE.BoxGeometry(bltW + 0.003, 0.003*sc, fullD + 0.003),
          grainC,
          bCX, y, 0
        );
        g.add(gl);
      }

      // wide gold decorative band
      const band1 = mk(
        new THREE.BoxGeometry(bltW + 0.006, bH * 0.17, fullD + 0.006),
        phong(GOLD, 58),
        bCX, bH * 0.26, 0
      );
      g.add(band1);

      // thin gold line below
      const band2 = mk(
        new THREE.BoxGeometry(bltW + 0.006, bH * 0.024, fullD + 0.006),
        phong(GOLD.clone().lerp(new THREE.Color("#7a6020"), 0.32), 40),
        bCX, bH * 0.26 - bH * 0.105, 0
      );
      g.add(band2);
    }
  }

  /* ── drag / touch ── */
  const onMD = useCallback(e => {
    const ref = R.current;
    ref.drag = true; ref.lx = e.clientX; ref.ly = e.clientY;
    ref.autoRot = false; clearTimeout(ref.autoTimer);
  }, []);
  const onMM = useCallback(e => {
    const ref = R.current; if (!ref.drag) return;
    ref.ry += (e.clientX - ref.lx) * 0.011;
    ref.rx  = Math.max(-0.72, Math.min(0.72, ref.rx + (e.clientY - ref.ly) * 0.011));
    ref.lx = e.clientX; ref.ly = e.clientY;
  }, []);
  const onMU = useCallback(() => {
    const ref = R.current; ref.drag = false;
    ref.autoTimer = setTimeout(() => { ref.autoRot = true; }, 3200);
  }, []);
  const onTS = useCallback(e => {
    const ref = R.current, t = e.touches[0];
    ref.drag = true; ref.lx = t.clientX; ref.ly = t.clientY;
    ref.autoRot = false; clearTimeout(ref.autoTimer);
  }, []);
  const onTM = useCallback(e => {
    const ref = R.current; if (!ref.drag) return;
    const t = e.touches[0];
    ref.ry += (t.clientX - ref.lx) * 0.011;
    ref.rx  = Math.max(-0.72, Math.min(0.72, ref.rx + (t.clientY - ref.ly) * 0.011));
    ref.lx = t.clientX; ref.ly = t.clientY;
  }, []);

  return { onMD, onMM, onMU, onTS, onTM };
}

/* ══════════════════════════════════════════════════════════════ DRAW MODAL */

function DrawModal({ initial, onConfirm, onClose }) {
  const cr      = useRef(null);
  const drawing = useRef(false);
  const lastPt  = useRef(null);
  const [tool, setTool]   = useState("pen");
  const [color, setColor] = useState("#d4aa6a");
  const [size, setSize]   = useState(8);

  useEffect(() => {
    const c = cr.current, ctx = c.getContext("2d");
    ctx.clearRect(0, 0, c.width, c.height); // transparent by default
    if (initial) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, c.width, c.height);
      img.src = initial;
    }
  }, []);

  const getXY = (e, c) => {
    const r = c.getBoundingClientRect();
    return [(e.clientX - r.left) * (c.width / r.width), (e.clientY - r.top) * (c.height / r.height)];
  };
  const startDraw = e => {
    drawing.current = true;
    lastPt.current = { x: getXY(e, cr.current)[0], y: getXY(e, cr.current)[1] };
  };
  const moveDraw = e => {
    if (!drawing.current) return;
    const c = cr.current, ctx = c.getContext("2d");
    const [x, y] = getXY(e, c);
    ctx.globalCompositeOperation = tool === "eraser" ? "destination-out" : "source-over";
    ctx.strokeStyle = color; ctx.lineWidth = size;
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(lastPt.current.x, lastPt.current.y);
    ctx.lineTo(x, y);
    ctx.stroke();
    lastPt.current = { x, y };
  };
  const endDraw  = () => { drawing.current = false; lastPt.current = null; };
  const clear    = () => {
    const c = cr.current, ctx = c.getContext("2d");
    ctx.clearRect(0, 0, c.width, c.height);
  };
  const upload = e => {
    const f = e.target.files[0]; if (!f) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = () => {
        const c = cr.current, ctx = c.getContext("2d");
        ctx.clearRect(0, 0, c.width, c.height);
        const s = Math.min(c.width / img.width, c.height / img.height);
        ctx.drawImage(img, (c.width - img.width*s)/2, (c.height - img.height*s)/2, img.width*s, img.height*s);
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(f);
  };

  const tbtn = active => ({
    padding:"6px 14px", borderRadius:6, cursor:"pointer", fontSize:12,
    border:`1px solid ${active ? "#d4aa6a" : "rgba(255,255,255,0.10)"}`,
    background: active ? "rgba(212,170,106,0.18)" : "transparent",
    color: active ? "#d4aa6a" : "#8a7a60",
  });

  return (
    <div style={{ position:"fixed",inset:0,zIndex:1000,background:"rgba(10,7,4,0.90)",backdropFilter:"blur(8px)",display:"flex",alignItems:"center",justifyContent:"center" }}>
      <div style={{ background:"#1a1612",border:"1px solid rgba(212,170,106,0.18)",borderRadius:14,padding:24,width:516,maxWidth:"92vw",boxShadow:"0 24px 80px rgba(0,0,0,0.5)" }}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14 }}>
          <span style={{ fontFamily:"'Playfair Display',serif",fontSize:18,color:"#f0e6d3" }}>Personnalisation couverture</span>
          <button onClick={onClose} style={{ background:"none",border:"none",color:"#6a5a4a",fontSize:20,cursor:"pointer",lineHeight:1 }}>✕</button>
        </div>
        <div style={{ display:"flex",gap:7,flexWrap:"wrap",alignItems:"center",marginBottom:11 }}>
          <button style={tbtn(tool==="pen")}    onClick={() => setTool("pen")}>✏ Crayon</button>
          <button style={tbtn(tool==="eraser")} onClick={() => setTool("eraser")}>◻ Gomme</button>
          <label style={{ display:"flex",alignItems:"center",gap:5,fontSize:12,color:"#8a7a60",cursor:"pointer" }}>
            Couleur
            <input type="color" value={color} onChange={e => setColor(e.target.value)}
              style={{ cursor:"pointer",width:24,height:22,border:"none",background:"none" }}/>
          </label>
          <label style={{ display:"flex",alignItems:"center",gap:5,fontSize:12,color:"#8a7a60" }}>
            {size}px
            <input type="range" min={2} max={52} step={1} value={size}
              onChange={e => setSize(+e.target.value)} style={{ width:58 }}/>
          </label>
          <button style={tbtn(false)} onClick={clear}>Effacer</button>
          <label style={{ ...tbtn(false), display:"inline-block",cursor:"pointer" }}>
            Importer
            <input type="file" accept="image/*" onChange={upload} style={{ display:"none" }}/>
          </label>
        </div>
        <canvas ref={cr} width={468} height={330}
          style={{ border:"1px solid rgba(212,170,106,0.14)",borderRadius:8,display:"block",width:"100%",cursor: tool==="eraser"?"cell":"crosshair", background:"repeating-conic-gradient(#2a2420 0% 25%, #1a1612 0% 50%) 0 0 / 16px 16px" }}
          onMouseDown={startDraw} onMouseMove={moveDraw} onMouseUp={endDraw} onMouseLeave={endDraw}/>
        <div style={{ display:"flex",justifyContent:"flex-end",gap:10,marginTop:14 }}>
          <button onClick={onClose}
            style={{ padding:"10px 20px",borderRadius:8,border:"1px solid rgba(255,255,255,0.09)",background:"transparent",cursor:"pointer",fontSize:13,color:"#8a7a60" }}>
            Annuler
          </button>
          <button onClick={() => onConfirm(cr.current.toDataURL())}
            style={{ padding:"10px 24px",borderRadius:8,border:"none",background:"#d4aa6a",color:"#12100e",cursor:"pointer",fontWeight:600,fontSize:13 }}>
            ✓ Appliquer
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════ UI ATOMS */

const Divider = () => (
  <div style={{ height:1, background:"rgba(255,255,255,0.05)", margin:"14px 0 11px" }}/>
);

const SecTitle = ({ children }) => (
  <div style={{ fontSize:9.5, letterSpacing:2.8, textTransform:"uppercase", color:"#7a6a52", fontWeight:600, marginBottom:8 }}>
    {children}
  </div>
);

function OptionRow({ active, onClick, label, sub }) {
  const [hover, setHover] = useState(false);
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display:"block", width:"100%", textAlign:"left", padding:"8px 11px",
        borderRadius:7, marginBottom:3, cursor:"pointer",
        transition:"border-color .12s, background .12s",
        border:`1px solid ${active ? "rgba(212,170,106,0.50)" : hover ? "rgba(212,170,106,0.20)" : "rgba(255,255,255,0.055)"}`,
        background: active ? "rgba(212,170,106,0.11)" : hover ? "rgba(255,255,255,0.03)" : "transparent",
      }}>
      <div style={{ fontSize:13, fontWeight:active?500:400, color:active?"#e8d5b0":"#a8988a" }}>{label}</div>
      {sub && <div style={{ fontSize:10.5, color:"#5a4a3a", marginTop:1 }}>{sub}</div>}
    </button>
  );
}

/* ══════════════════════════════════════════════════════════════ APP */

export default function App() {
  const canvasRef = useRef(null);
  const [cfg, setCfg] = useState({
    size:"moyen", binding:"japonaise", paper:"dessin", format:"portrait", color:"#1e3a4c"
  });
  const [img, setImg]     = useState(null);
  const [modal, setModal] = useState(false);

  const ev = useNotebook(canvasRef, cfg, img);

  const price = useMemo(() => {
    const s = SIZES.find(x => x.id === cfg.size)?.price       || 0;
    const b = BINDINGS.find(x => x.id === cfg.binding)?.price || 0;
    const p = PAPERS.find(x => x.id === cfg.paper)?.price     || 0;
    const f = FORMATS.find(x => x.id === cfg.format)?.xtra    || 0;
    return s + b + p + f + (img ? 3 : 0);
  }, [cfg, img]);

  const up  = (k, v) => setCfg(c => ({ ...c, [k]: v }));
  const sd  = SIZES.find(s => s.id === cfg.size);
  const bd  = BINDINGS.find(b => b.id === cfg.binding);
  const pd  = PAPERS.find(p => p.id === cfg.paper);
  const fd  = FORMATS.find(f => f.id === cfg.format);

  const tags = [
    `${sd?.label} — ${sd?.price} €`,
    `${bd?.label} — +${bd?.price} €`,
    `${pd?.label} — +${pd?.price} €`,
    ...(cfg.format === "leporello" ? ["Leporello — +5 €"] : []),
    ...(img ? ["Illus. perso — +3 €"] : []),
  ];

  return (
    <div style={{ display:"flex", height:"100vh", overflow:"hidden", background:"#0e0c0a", fontFamily:"'DM Sans',system-ui,sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;1,400&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&display=swap');
        *, *::before, *::after { box-sizing:border-box; -webkit-font-smoothing:antialiased; }
        ::-webkit-scrollbar { width:3px; }
        ::-webkit-scrollbar-thumb { background:rgba(212,170,106,0.22); border-radius:2px; }
        ::-webkit-scrollbar-track { background:transparent; }
        button { font-family:inherit; outline:none; }
      `}</style>

      {/* ── SIDE PANEL ── */}
      <div style={{
        width:276, flexShrink:0,
        background:"#141210",
        borderRight:"1px solid rgba(255,255,255,0.055)",
        display:"flex", flexDirection:"column", overflowY:"auto",
      }}>
        {/* header */}
        <div style={{ padding:"22px 18px 15px", borderBottom:"1px solid rgba(255,255,255,0.055)" }}>
          <div style={{ fontSize:9, letterSpacing:3.5, textTransform:"uppercase", color:"#7a6a52", marginBottom:7 }}>
            Atelier du carnet
          </div>
          <h1 style={{ margin:0, fontFamily:"'Playfair Display',serif", fontSize:22, color:"#f0e6d3", lineHeight:1.22, fontWeight:400 }}>
            Composez votre<br/><em>carnet unique</em>
          </h1>
        </div>

        <div style={{ padding:"14px 15px", flex:1 }}>

          {/* SIZE */}
          <SecTitle>Taille</SecTitle>
          {SIZES.map(s => (
            <OptionRow key={s.id} active={cfg.size===s.id} onClick={() => up("size", s.id)}
              label={s.label} sub={`${s.dim} · ${s.price} €`}/>
          ))}

          <Divider/>

          {/* FORMAT */}
          <SecTitle>Format</SecTitle>
          <div style={{ display:"flex", gap:5, marginBottom:4 }}>
            {FORMATS.map(f => {
              const active = cfg.format === f.id;
              return (
                <button key={f.id} onClick={() => up("format", f.id)} style={{
                  flex:1, padding:"10px 4px", borderRadius:7, cursor:"pointer",
                  border:`1px solid ${active ? "rgba(212,170,106,0.50)" : "rgba(255,255,255,0.055)"}`,
                  background: active ? "rgba(212,170,106,0.11)" : "transparent",
                  display:"flex", flexDirection:"column", alignItems:"center", gap:3, transition:"all .12s",
                }}>
                  <span style={{ fontSize:17, color:active?"#d4aa6a":"#5a4a3a" }}>{f.icon}</span>
                  <span style={{ fontSize:11, color:active?"#e8d5b0":"#7a6a5a", fontWeight:active?500:400 }}>{f.label}</span>
                  {f.xtra > 0 && <span style={{ fontSize:9, color:"#d4aa6a" }}>+{f.xtra} €</span>}
                </button>
              );
            })}
          </div>

          <Divider/>

          {/* BINDING */}
          <SecTitle>Reliure</SecTitle>
          {BINDINGS.map(b => (
            <OptionRow key={b.id} active={cfg.binding===b.id} onClick={() => up("binding", b.id)}
              label={b.label} sub={`${b.desc}${b.price>0?` · +${b.price} €`:""}`}/>
          ))}

          <Divider/>

          {/* PAPER */}
          <SecTitle>Papier</SecTitle>
          {PAPERS.map(p => {
            const active = cfg.paper === p.id;
            return (
              <div key={p.id} onClick={() => up("paper", p.id)} style={{
                display:"flex", alignItems:"center", gap:10, padding:"7px 10px",
                borderRadius:7, marginBottom:3, cursor:"pointer", transition:"all .12s",
                border:`1px solid ${active ? "rgba(212,170,106,0.50)" : "rgba(255,255,255,0.055)"}`,
                background: active ? "rgba(212,170,106,0.10)" : "transparent",
              }}>
                <div style={{ width:22, height:22, borderRadius:4, flexShrink:0, background:p.pg, border:"1px solid rgba(255,255,255,0.14)" }}/>
                <div>
                  <div style={{ fontSize:12.5, color:active?"#e8d5b0":"#a09080", fontWeight:active?500:400 }}>{p.label}</div>
                  <div style={{ fontSize:10, color:"#4a3a2a" }}>{p.desc}{p.price>0?` · +${p.price} €`:""}</div>
                </div>
              </div>
            );
          })}

          <Divider/>

          {/* COVER COLOR */}
          <SecTitle>Couleur de couverture</SecTitle>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(6,1fr)", gap:6, marginBottom:6 }}>
            {COVER_COLORS.map(c => (
              <div key={c.hex} title={c.name} onClick={() => up("color", c.hex)} style={{
                width:"100%", paddingTop:"100%", borderRadius:5, cursor:"pointer",
                background:c.hex,
                boxShadow:`0 0 0 ${cfg.color===c.hex?"2px":"0px"} #d4aa6a, 0 0 0 ${cfg.color===c.hex?"4px":"0px"} rgba(0,0,0,0.55)`,
                transition:"box-shadow .13s",
                border:"1px solid rgba(255,255,255,0.07)",
              }}/>
            ))}
          </div>
          <div style={{ fontSize:11, color:"#6a5a4a", marginTop:2, minHeight:16 }}>
            {COVER_COLORS.find(c => c.hex === cfg.color)?.name}
          </div>

          <Divider/>

          {/* ILLUSTRATION */}
          <SecTitle>Illustration personnalisée</SecTitle>
          <button onClick={() => setModal(true)} style={{
            width:"100%", padding:"10px 12px", borderRadius:7, cursor:"pointer",
            border:`1px solid ${img ? "rgba(212,170,106,0.50)" : "rgba(255,255,255,0.08)"}`,
            background: img ? "rgba(212,170,106,0.10)" : "transparent",
            color: img ? "#d4aa6a" : "#7a6a5a", fontSize:12.5,
            display:"flex", alignItems:"center", justifyContent:"center", gap:8, transition:"all .12s",
          }}>
            ✎ {img ? "Modifier le dessin" : "Ajouter un dessin"}
            <span style={{ fontSize:10, color:"#5a4a3a" }}>+3 €</span>
          </button>
          {img && (
            <button onClick={() => setImg(null)} style={{
              width:"100%", marginTop:4, padding:"5px", borderRadius:7, cursor:"pointer",
              border:"1px solid rgba(255,255,255,0.055)", background:"transparent",
              fontSize:11, color:"#4a3a2a",
            }}>✕ Supprimer l'illustration</button>
          )}

          <div style={{ height:24 }}/>
        </div>
      </div>

      {/* ── STAGE ── */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", minWidth:0, background:"#0e0c0a" }}>

        {/* top bar */}
        <div style={{ padding:"10px 20px", display:"flex", alignItems:"center", justifyContent:"space-between", borderBottom:"1px solid rgba(255,255,255,0.045)" }}>
          <span style={{ fontSize:10.5, color:"#3a2e22", fontStyle:"italic" }}>Glissez pour faire pivoter</span>
          <span style={{ fontSize:10.5, color:"#3a2e22" }}>
            {sd?.label} · {fd?.label} · {bd?.label} · {pd?.label}
          </span>
        </div>

        {/* canvas */}
        <canvas ref={canvasRef}
          style={{ flex:1, display:"block", width:"100%", minHeight:0, cursor:"grab" }}
          onMouseDown={ev.onMD} onMouseMove={ev.onMM} onMouseUp={ev.onMU} onMouseLeave={ev.onMU}
          onTouchStart={ev.onTS} onTouchMove={ev.onTM} onTouchEnd={ev.onMU}
        />

        {/* bottom CTA */}
        <div style={{
          padding:"15px 24px",
          borderTop:"1px solid rgba(255,255,255,0.055)",
          background:"rgba(20,17,13,0.97)",
          display:"flex", alignItems:"center", justifyContent:"space-between",
        }}>
          <div>
            <div style={{ fontSize:9.5, letterSpacing:2.2, textTransform:"uppercase", color:"#5a4a3a", marginBottom:4 }}>
              Prix estimé
            </div>
            <div style={{ display:"flex", alignItems:"baseline", gap:10 }}>
              <span style={{ fontSize:36, fontFamily:"'Playfair Display',serif", color:"#f0e6d3", lineHeight:1, transition:"all .2s" }}>
                {price} €
              </span>
              <span style={{ fontSize:11, color:"#4a3a2a" }}>TTC · livraison offerte</span>
            </div>
            <div style={{ marginTop:6, display:"flex", flexWrap:"wrap", gap:4 }}>
              {tags.map((t, i) => (
                <span key={i} style={{
                  fontSize:10, padding:"2px 8px", borderRadius:4,
                  background:"rgba(212,170,106,0.07)",
                  border:"1px solid rgba(212,170,106,0.13)",
                  color:"#7a6a52",
                }}>{t}</span>
              ))}
            </div>
          </div>
          <div style={{ display:"flex", gap:10, flexShrink:0 }}>
            <button style={{
              padding:"12px 18px", borderRadius:9, cursor:"pointer", fontSize:13,
              border:"1px solid rgba(212,170,106,0.28)", background:"transparent", color:"#d4aa6a",
            }}>♡ Sauvegarder</button>
            <button style={{
              padding:"12px 30px", borderRadius:9, cursor:"pointer", fontSize:14, fontWeight:500,
              border:"none", background:"linear-gradient(135deg,#c8a458,#e0bf78)", color:"#12100e",
              letterSpacing:0.3, boxShadow:"0 4px 18px rgba(200,164,88,0.30)",
            }}>
              Commander · {price} €  →
            </button>
          </div>
        </div>
      </div>

      {modal && (
        <DrawModal
          initial={img}
          onConfirm={url => { setImg(url); setModal(false); }}
          onClose={() => setModal(false)}
        />
      )}
    </div>
  );
}
