import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import * as THREE from "three";

/* ─── DATA ─────────────────────────────────────────────────────────────── */
const SIZES = [
  { id:"petit", label:"Petit",  dim:"A6 · 10,5 × 14,8 cm", price:6,  sc:0.70 },
  { id:"moyen", label:"Moyen",  dim:"A5 · 14,8 × 21 cm",   price:9,  sc:1.00 },
  { id:"grand", label:"Grand",  dim:"A4 · 21 × 29,7 cm",   price:12, sc:1.30 },
];
const BINDINGS = [
  { id:"japonaise", label:"Japonaise",       desc:"Couture apparente, piqûres côté", price:5 },
  { id:"copte",     label:"Copte",           desc:"Dos nu, chevrons de fil vus",     price:7 },
  { id:"spirale",   label:"Spirale",         desc:"Métal brossé, 360°",              price:3 },
  { id:"longue",    label:"Long stitch",     desc:"Coutures allongées élégantes",    price:6 },
  { id:"parfaite",  label:"Dos carré collé", desc:"Propre et minimaliste",           price:1 },
  { id:"agrafes",   label:"Agrafes",         desc:"Sobre et robuste",                price:0 },
  { id:"belge",     label:"Belge",           desc:"Toile dos, reliure haut de gamme",price:9 },
];
const PAPERS = [
  { id:"standard",  label:"Standard 80g",   desc:"Écriture & notes",        price:0,  pg:"#f6f4ef" },
  { id:"esquisse",  label:"Esquisse 100g",  desc:"Croquis & feutres",       price:2,  pg:"#f0ede4" },
  { id:"dessin",    label:"Dessin 180g",    desc:"Crayon, encre, pastels",  price:5,  pg:"#ede9de" },
  { id:"aquarelle", label:"Aquarelle 300g", desc:"Cold press, grain naturel",price:10, pg:"#e8ece8" },
  { id:"kraft",     label:"Kraft 120g",     desc:"Chaleureux & naturel",    price:3,  pg:"#b8845a" },
  { id:"noir",      label:"Vélin noir 120g",desc:"Pastels & encres claires",price:4,  pg:"#1a1a1a" },
];
const FORMATS = [
  { id:"portrait",  label:"Portrait",   icon:"▯", ar:1/Math.SQRT2, xtra:0 },
  { id:"paysage",   label:"Paysage",    icon:"▭", ar:Math.SQRT2,   xtra:0 },
  { id:"leporello", label:"Leporello",  icon:"⊞", ar:Math.SQRT2,   xtra:5 },
];

/* curated sophisticated palette */
const COVER_COLORS = [
  { hex:"#1c1410", name:"Noir d'encre"  },
  { hex:"#3b2a1e", name:"Brun bistre"   },
  { hex:"#5c2d1e", name:"Rouge brique"  },
  { hex:"#7a1c2e", name:"Bordeaux"      },
  { hex:"#1e3a4c", name:"Bleu nuit"     },
  { hex:"#2a3d2f", name:"Vert forêt"    },
  { hex:"#4a3860", name:"Prune"         },
  { hex:"#7c6040", name:"Tabac"         },
  { hex:"#8a7a60", name:"Sable"         },
  { hex:"#c8b49a", name:"Parchemin"     },
  { hex:"#d8cfc4", name:"Lin"           },
  { hex:"#f2ede6", name:"Ivoire"        },
];

/* ─── HELPERS ───────────────────────────────────────────────────────────── */
const phong = (c, sh=25, spec=0x443322) =>
  new THREE.MeshPhongMaterial({ color: c, shininess: sh, specular: spec });

/* ─── 3-D HOOK ──────────────────────────────────────────────────────────── */
function useNotebook(canvasRef, config, imgUrl) {
  const refs = useRef({ scene:null, renderer:null, cam:null, group:null,
                        frame:null, ry:0.55, rx:-0.18,
                        drag:false, lx:0, ly:0, autoRot:true, autoTimer:null });

  useEffect(() => {
    const el = canvasRef.current; if (!el) return;
    const w = el.clientWidth||700, h = el.clientHeight||700;
    const scene    = new THREE.Scene();
    const renderer = new THREE.WebGLRenderer({ canvas:el, antialias:true, alpha:true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(w, h);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
    const cam = new THREE.PerspectiveCamera(30, w/h, 0.1, 100);
    cam.position.z = 5.8;

    /* warm key */
    const key = new THREE.DirectionalLight(0xfff2e0, 1.5);
    key.position.set(5, 6, 5); key.castShadow = true;
    key.shadow.mapSize.width = key.shadow.mapSize.height = 1024;
    scene.add(key);
    /* cool fill */
    const fill = new THREE.DirectionalLight(0xd6e4f0, 0.5);
    fill.position.set(-4, -2, 4); scene.add(fill);
    /* rim */
    const rim = new THREE.DirectionalLight(0xffe8c0, 0.35);
    rim.position.set(0, -5, -3); scene.add(rim);
    /* ambient */
    scene.add(new THREE.AmbientLight(0xfff8f0, 0.55));

    Object.assign(refs.current, { scene, renderer, cam });

    const tick = () => {
      refs.current.frame = requestAnimationFrame(tick);
      const R = refs.current;
      if (R.autoRot && R.group) R.ry += 0.003;
      if (R.group) {
        R.group.rotation.x = R.rx;
        R.group.rotation.y = R.ry;
        R.group.position.y = Math.sin(Date.now() * 0.0009) * 0.04;
      }
      renderer.render(scene, cam);
    };
    tick();

    const obs = new ResizeObserver(() => {
      const nw = el.clientWidth, nh = el.clientHeight;
      if (nw && nh) { renderer.setSize(nw, nh); cam.aspect = nw/nh; cam.updateProjectionMatrix(); }
    });
    obs.observe(el);
    return () => { cancelAnimationFrame(refs.current.frame); obs.disconnect(); renderer.dispose(); };
  }, []);

  useEffect(() => { rebuild(config, imgUrl); }, [config, imgUrl]);

  function disposeGroup() {
    const R = refs.current;
    if (!R.group || !R.scene) return;
    R.scene.remove(R.group);
    R.group.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) [].concat(o.material).forEach(m => { if (m.map) m.map.dispose(); m.dispose(); });
    });
    R.group = null;
  }

  function rebuild(cfg, imgUrl) {
    disposeGroup();
    const R = refs.current;
    if (!R.scene) return;

    const sd = SIZES.find(s => s.id === cfg.size) || SIZES[1];
    const fd = FORMATS.find(f => f.id === cfg.format) || FORMATS[0];
    const pd = PAPERS.find(p => p.id === cfg.paper) || PAPERS[0];
    const sc = sd.sc, ar = fd.ar;

    let bW, bH;
    if (ar < 1) { bH = 1.65*sc; bW = bH*ar; } else { bW = 1.65*sc; bH = bW/ar; }
    const bD = ({ petit:0.10, moyen:0.15, grand:0.21 }[cfg.size] || 0.15) * sc;
    const cvT = 0.028 * sc; // cover thickness

    const CC = new THREE.Color(cfg.color || "#1e3a4c");
    const PC = new THREE.Color(pd.pg);

    /* ── Cover texture canvas ── */
    const cW = 512, cH = Math.round(512 * bH / bW);
    const cvs = document.createElement("canvas"); cvs.width=cW; cvs.height=cH;
    const ctx = cvs.getContext("2d");
    ctx.fillStyle = cfg.color || "#1e3a4c"; ctx.fillRect(0,0,cW,cH);
    /* subtle cloth-grain texture */
    const id = ctx.createImageData(cW,cH);
    for (let k=0; k<id.data.length; k+=4) {
      const v = (Math.random()-0.5)*20;
      id.data[k]=id.data[k+1]=id.data[k+2]=128+v; id.data[k+3]=18;
    }
    ctx.putImageData(id,0,0);
    /* subtle vignette */
    const vg = ctx.createRadialGradient(cW/2,cH/2,cH*0.2,cW/2,cH/2,cH*0.75);
    vg.addColorStop(0,"rgba(255,255,255,0.04)"); vg.addColorStop(1,"rgba(0,0,0,0.22)");
    ctx.fillStyle=vg; ctx.fillRect(0,0,cW,cH);
    const tex = new THREE.CanvasTexture(cvs);
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;

    if (imgUrl) {
      const im = new Image();
      im.onload = () => {
        ctx.fillStyle = cfg.color || "#1e3a4c"; ctx.fillRect(0,0,cW,cH);
        const s = Math.min(cW/im.width, cH/im.height);
        ctx.drawImage(im, (cW-im.width*s)/2, (cH-im.height*s)/2, im.width*s, im.height*s);
        tex.needsUpdate = true;
      };
      im.src = imgUrl;
    }

    const g = new THREE.Group();

    /* ── Pages block ── */
    const pageC = PC.clone();
    const pgMats = [
      phong(pageC.clone().multiplyScalar(0.78), 4),
      phong(pageC.clone().multiplyScalar(0.92), 4),
      phong(pageC.clone().multiplyScalar(0.88), 4),
      phong(pageC.clone().multiplyScalar(0.88), 4),
      phong(pageC, 4),
      phong(pageC, 4),
    ];
    const pagesGeo = new THREE.BoxGeometry(bW*0.965, bH*0.980, bD*0.992);
    g.add(new THREE.Mesh(pagesGeo, pgMats));

    /* page line texture on visible face */
    const lineC = pageC.clone().lerp(new THREE.Color("#888"), 0.25);
    for (let i=0; i<24; i++) {
      const z = ((i/23)-.5)*bD*0.85;
      const l = new THREE.Mesh(
        new THREE.BoxGeometry(0.003*sc, bH*0.965, 0.0008),
        new THREE.MeshLambertMaterial({ color: lineC })
      );
      l.position.set(bW*0.479, 0, z); g.add(l);
    }

    /* ── Front cover ── */
    const frontMats = [
      phong(CC), phong(CC), phong(CC), phong(CC),
      new THREE.MeshPhongMaterial({ map:tex, shininess:55, specular:0x3a2a18 }),
      phong(CC.clone().multiplyScalar(0.88))
    ];
    const front = new THREE.Mesh(new THREE.BoxGeometry(bW, bH, cvT), frontMats);
    front.position.z = bD/2 + cvT/2 + 0.003; g.add(front);

    /* ── Back cover ── */
    const backMats = [
      phong(CC.clone().multiplyScalar(0.90)),
      phong(CC.clone().multiplyScalar(0.90)),
      phong(CC.clone().multiplyScalar(0.88)),
      phong(CC.clone().multiplyScalar(0.88)),
      phong(CC.clone().multiplyScalar(0.86)),
      phong(CC),
    ];
    const back = new THREE.Mesh(new THREE.BoxGeometry(bW, bH, cvT), backMats);
    back.position.z = -(bD/2 + cvT/2 + 0.003); g.add(back);

    /* ── Spine strip ── */
    const spineColor = CC.clone().lerp(new THREE.Color("#000"), 0.18);
    const spine = new THREE.Mesh(
      new THREE.BoxGeometry(0.06*sc, bH, bD + cvT*2 + 0.006),
      phong(spineColor, 8)
    );
    spine.position.x = -bW/2 - 0.03*sc; g.add(spine);

    /* ── Binding ── */
    addBinding(g, cfg.binding, bW, bH, bD, sc, cvT);

    /* ── Leporello accordion pages ── */
    if (fd.id === "leporello") {
      for (let i=0; i<8; i++) {
        const fc = i%2===0
          ? pageC.clone().lerp(new THREE.Color("#fff"), 0.20)
          : pageC.clone().lerp(new THREE.Color("#666"), 0.15);
        const fold = new THREE.Mesh(
          new THREE.BoxGeometry(0.088*sc, bH*0.958, bD*0.86),
          phong(fc, 3)
        );
        fold.position.x = bW*0.5 + (i+0.5)*0.088*sc; g.add(fold);
      }
    }

    g.rotation.x = R.rx; g.rotation.y = R.ry;
    R.scene.add(g); R.group = g;
  }

  function addBinding(g, bid, bW, bH, bD, sc, cvT) {
    const THREAD_GOLD = new THREE.Color("#d4aa6a");
    const THREAD_WAX  = new THREE.Color("#c89050");
    const METAL_BRUSH = new THREE.Color("#b0b8c1");
    const LEATHER     = new THREE.Color("#6b4820");
    const LINEN       = new THREE.Color("#c8b898");
    const sx   = -bW / 2;          /* right edge of spine area */
    const fullD = bD + cvT * 2 + 0.012; /* full book thickness incl. both covers */

    if (bid === "japonaise") {
      const n = 7;
      /* hole column x: 0.08*sc inside the spine edge, clearly visible */
      const hx = sx + 0.082 * sc;
      for (let i = 0; i < n; i++) {
        const y  = ((i / (n - 1)) - 0.5) * bH * 0.68;
        /* peg through the book along Z */
        const peg = new THREE.Mesh(
          new THREE.CylinderGeometry(0.018*sc, 0.018*sc, fullD, 12),
          new THREE.MeshPhongMaterial({ color: THREAD_GOLD, shininess: 70 })
        );
        peg.rotation.x = Math.PI / 2;
        peg.position.set(hx, y, 0); g.add(peg);
        /* vertical thread on front & back face between consecutive pegs */
        if (i < n - 1) {
          const ny = (((i + 1) / (n - 1)) - 0.5) * bH * 0.68;
          const dy = Math.abs(ny - y);
          [fullD / 2 - 0.002, -(fullD / 2 - 0.002)].forEach(zz => {
            const vl = new THREE.Mesh(
              new THREE.BoxGeometry(0.013*sc, dy, 0.013*sc),
              new THREE.MeshPhongMaterial({ color: THREAD_GOLD, shininess: 55 })
            );
            vl.position.set(hx, (y + ny) / 2, zz); g.add(vl);
          });
        }
        /* horizontal thread: from spine edge to peg, front & back face */
        [fullD / 2 - 0.002, -(fullD / 2 - 0.002)].forEach(zz => {
          const hl = new THREE.Mesh(
            new THREE.BoxGeometry(Math.abs(hx - sx) + 0.004, 0.013*sc, 0.013*sc),
            new THREE.MeshPhongMaterial({ color: THREAD_GOLD, shininess: 55 })
          );
          hl.position.set((hx + sx) / 2 + 0.002, y, zz); g.add(hl);
        });
      }
    }

    else if (bid === "copte") {
      /* leather spine strip */
      const stripW = 0.065 * sc;
      const sm = new THREE.Mesh(
        new THREE.BoxGeometry(stripW, bH + 0.015, fullD),
        phong(LEATHER, 12)
      );
      sm.position.x = sx - stripW / 2; g.add(sm);

      /* chevron stitches visible on the SIDE face of the spine strip */
      const faceX = sx - stripW; /* left face of spine strip */
      const n = 10;
      for (let i = 0; i < n - 1; i++) {
        const y1 = ((i       / (n - 1)) - 0.5) * bH * 0.74;
        const y2 = (((i + 1) / (n - 1)) - 0.5) * bH * 0.74;
        const ym = (y1 + y2) / 2;
        /* V shape on the spine face: top of V at center z, tips at ±bD*0.35+cvT */
        const pts = [
          new THREE.Vector3(faceX - 0.002, y1,  bD * 0.36 + cvT),
          new THREE.Vector3(faceX - 0.002, ym,  0),
          new THREE.Vector3(faceX - 0.002, y2, -(bD * 0.36 + cvT)),
        ];
        const curve = new THREE.CatmullRomCurve3(pts);
        g.add(new THREE.Mesh(
          new THREE.TubeGeometry(curve, 14, 0.010*sc, 7, false),
          new THREE.MeshPhongMaterial({ color: THREAD_WAX, shininess: 45 })
        ));
        /* link thread going through book (front/back) */
        const lt = new THREE.Mesh(
          new THREE.CylinderGeometry(0.007*sc, 0.007*sc, fullD, 8),
          new THREE.MeshPhongMaterial({ color: THREAD_WAX, shininess: 45 })
        );
        lt.rotation.x = Math.PI / 2;
        lt.position.set(faceX - 0.002, y1, 0); g.add(lt);
      }
    }

    else if (bid === "spirale") {
      /* coil centered at the spine so it visibly wraps around pages */
      const R2     = 0.078 * sc;
      const coilCX = sx - R2 * 0.45; /* center: left of spine, right half threads pages */
      const nTurns = 16, steps = nTurns * 26;
      const pts = [];
      for (let i = 0; i <= steps; i++) {
        const a = (i / 26) * Math.PI * 2;
        const y = ((i / steps) - 0.5) * bH * 0.88;
        pts.push(new THREE.Vector3(coilCX + Math.cos(a) * R2, y, Math.sin(a) * R2));
      }
      g.add(new THREE.Mesh(
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), steps, 0.012*sc, 10, false),
        new THREE.MeshPhongMaterial({ color: METAL_BRUSH, shininess: 150, specular: 0xd8e0e8 })
      ));
      /* backing reinforcement bar */
      g.add(Object.assign(
        new THREE.Mesh(
          new THREE.BoxGeometry(0.020*sc, bH * 0.92, 0.020*sc),
          phong(METAL_BRUSH.clone().multiplyScalar(0.75), 90)
        ),
        { position: new THREE.Vector3(coilCX, 0, 0) }
      ));
    }

    else if (bid === "longue") {
      /* linen spine strip first */
      const lsW = 0.050 * sc;
      g.add(Object.assign(
        new THREE.Mesh(
          new THREE.BoxGeometry(lsW, bH + 0.012, fullD),
          phong(LINEN, 6)
        ),
        { position: new THREE.Vector3(sx - lsW / 2, 0, 0) }
      ));
      /* 5 long stitch rows */
      const n  = 5;
      const hx = sx + 0.072 * sc;
      for (let i = 0; i < n; i++) {
        const y = ((i / (n - 1)) - 0.5) * bH * 0.72;
        /* horizontal bar on front face and back face */
        [fullD / 2 - 0.002, -(fullD / 2 - 0.002)].forEach(zz => {
          g.add(Object.assign(
            new THREE.Mesh(
              new THREE.BoxGeometry(Math.abs(hx - sx) + 0.006, 0.012*sc, 0.012*sc),
              new THREE.MeshPhongMaterial({ color: THREAD_GOLD, shininess: 60 })
            ),
            { position: new THREE.Vector3((hx + sx) / 2, y, zz) }
          ));
        });
        /* spine cross-through — full book depth */
        const cr = new THREE.Mesh(
          new THREE.CylinderGeometry(0.008*sc, 0.008*sc, fullD, 8),
          new THREE.MeshPhongMaterial({ color: THREAD_GOLD, shininess: 60 })
        );
        cr.rotation.x = Math.PI / 2;
        cr.position.set(hx, y, 0); g.add(cr);
      }
    }

    else if (bid === "parfaite") {
      /* clean glued spine */
      const pw = 0.032 * sc;
      g.add(Object.assign(
        new THREE.Mesh(
          new THREE.BoxGeometry(pw, bH + 0.004, fullD),
          new THREE.MeshLambertMaterial({ color: new THREE.Color("#1a1a1a") })
        ),
        { position: new THREE.Vector3(sx - pw / 2, 0, 0) }
      ));
      /* glue seam line on front face */
      [fullD / 2 - 0.002, -(fullD / 2 - 0.002)].forEach(zz => {
        g.add(Object.assign(
          new THREE.Mesh(
            new THREE.BoxGeometry(pw + 0.004, bH + 0.006, 0.004),
            new THREE.MeshLambertMaterial({ color: new THREE.Color("#2c2010") })
          ),
          { position: new THREE.Vector3(sx - pw / 2, 0, zz) }
        ));
      });
    }

    else if (bid === "agrafes") {
      const mc = new THREE.MeshPhongMaterial({ color: METAL_BRUSH, shininess: 120, specular: 0xe0e8f0 });
      const barZ = bD * 0.46 + cvT; /* inner face of covers */
      [-bH * 0.22, bH * 0.22].forEach(y => {
        /* top bar spanning full depth */
        g.add(Object.assign(
          new THREE.Mesh(new THREE.BoxGeometry(0.024*sc, 0.060*sc, fullD - 0.004), mc.clone()),
          { position: new THREE.Vector3(sx - 0.006, y, 0) }
        ));
        /* two legs — front & back, bent inward */
        [-barZ, barZ].forEach(z => {
          g.add(Object.assign(
            new THREE.Mesh(new THREE.BoxGeometry(0.024*sc, 0.020*sc, 0.022*sc), mc.clone()),
            { position: new THREE.Vector3(sx - 0.006, y + 0.020*sc, z) }
          ));
        });
      });
    }

    else if (bid === "belge") {
      const beltW = 0.105 * sc;
      /* main fabric belt */
      const beltColor = LINEN.clone().lerp(new THREE.Color("#a89070"), 0.30);
      g.add(Object.assign(
        new THREE.Mesh(
          new THREE.BoxGeometry(beltW, bH + 0.026, fullD),
          phong(beltColor, 8)
        ),
        { position: new THREE.Vector3(sx - beltW / 2, 0, 0) }
      ));
      /* linen grain lines */
      const grainC = LINEN.clone().lerp(new THREE.Color("#888"), 0.22);
      for (let i = 0; i < 13; i++) {
        const y = ((i / 12) - 0.5) * bH * 0.90;
        g.add(Object.assign(
          new THREE.Mesh(
            new THREE.BoxGeometry(beltW + 0.002, 0.003*sc, fullD + 0.002),
            new THREE.MeshLambertMaterial({ color: grainC })
          ),
          { position: new THREE.Vector3(sx - beltW / 2, y, 0) }
        ));
      }
      /* decorative gold title band */
      g.add(Object.assign(
        new THREE.Mesh(
          new THREE.BoxGeometry(beltW + 0.004, bH * 0.16, fullD + 0.004),
          phong(THREAD_GOLD, 55)
        ),
        { position: new THREE.Vector3(sx - beltW / 2, bH * 0.27, 0) }
      ));
      /* second thin band */
      g.add(Object.assign(
        new THREE.Mesh(
          new THREE.BoxGeometry(beltW + 0.004, bH * 0.028, fullD + 0.004),
          phong(THREAD_GOLD.clone().multiplyScalar(0.82), 40)
        ),
        { position: new THREE.Vector3(sx - beltW / 2, bH * 0.27 - bH * 0.10, 0) }
      ));
    }
  }

  /* ── drag ── */
  const onMD = useCallback(e => {
    const R = refs.current;
    R.drag=true; R.lx=e.clientX; R.ly=e.clientY;
    R.autoRot=false; clearTimeout(R.autoTimer);
  },[]);
  const onMM = useCallback(e => {
    const R = refs.current; if (!R.drag) return;
    R.ry += (e.clientX-R.lx)*0.011;
    R.rx  = Math.max(-0.75, Math.min(0.75, R.rx+(e.clientY-R.ly)*0.011));
    R.lx=e.clientX; R.ly=e.clientY;
  },[]);
  const onMU = useCallback(() => {
    const R = refs.current; R.drag=false;
    R.autoTimer = setTimeout(()=>{ R.autoRot=true; }, 3500);
  },[]);
  const onTS = useCallback(e=>{
    const R=refs.current,t=e.touches[0];
    R.drag=true; R.lx=t.clientX; R.ly=t.clientY; R.autoRot=false; clearTimeout(R.autoTimer);
  },[]);
  const onTM = useCallback(e=>{
    const R=refs.current; if(!R.drag)return;
    const t=e.touches[0];
    R.ry+=(t.clientX-R.lx)*0.011;
    R.rx=Math.max(-0.75,Math.min(0.75,R.rx+(t.clientY-R.ly)*0.011));
    R.lx=t.clientX; R.ly=t.clientY;
  },[]);
  return { onMD, onMM, onMU, onTS, onTM };
}

/* ─── DRAWING MODAL ─────────────────────────────────────────────────────── */
function DrawModal({ initial, onConfirm, onClose }) {
  const cr = useRef(null);
  const drawing = useRef(false);
  const lastPt = useRef(null);
  const [tool, setTool] = useState("pen");
  const [color, setColor] = useState("#d4aa6a");
  const [size, setSize] = useState(8);

  useEffect(() => {
    const c = cr.current, ctx = c.getContext("2d");
    ctx.fillStyle = "#f0ece4"; ctx.fillRect(0,0,c.width,c.height);
    if (initial) { const i=new Image(); i.onload=()=>ctx.drawImage(i,0,0,c.width,c.height); i.src=initial; }
  }, []);

  const getXY = (e, c) => {
    const r = c.getBoundingClientRect();
    return [(e.clientX-r.left)*(c.width/r.width), (e.clientY-r.top)*(c.height/r.height)];
  };
  const startDraw = e => {
    drawing.current=true;
    const [x,y] = getXY(e, cr.current);
    lastPt.current={x,y};
  };
  const moveDraw = e => {
    if (!drawing.current) return;
    const c=cr.current, ctx=c.getContext("2d");
    const [x,y] = getXY(e,c);
    ctx.globalCompositeOperation = tool==="eraser"?"destination-out":"source-over";
    ctx.strokeStyle = color; ctx.lineWidth = size;
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(lastPt.current.x, lastPt.current.y);
    ctx.lineTo(x,y); ctx.stroke();
    lastPt.current={x,y};
  };
  const endDraw = () => { drawing.current=false; lastPt.current=null; };

  const clear = () => {
    const c=cr.current,ctx=c.getContext("2d");
    ctx.clearRect(0,0,c.width,c.height);
    ctx.fillStyle="#f0ece4"; ctx.fillRect(0,0,c.width,c.height);
  };
  const upload = e => {
    const f=e.target.files[0]; if(!f)return;
    const r=new FileReader();
    r.onload=ev=>{
      const img=new Image();
      img.onload=()=>{
        const c=cr.current,ctx=c.getContext("2d");
        ctx.fillStyle="#f0ece4"; ctx.fillRect(0,0,c.width,c.height);
        const s=Math.min(c.width/img.width,c.height/img.height);
        ctx.drawImage(img,(c.width-img.width*s)/2,(c.height-img.height*s)/2,img.width*s,img.height*s);
      };
      img.src=ev.target.result;
    };
    r.readAsDataURL(f);
  };

  const S={
    overlay:{ position:"fixed",inset:0,zIndex:1000,background:"rgba(10,7,4,0.88)",display:"flex",alignItems:"center",justifyContent:"center" },
    box:{ background:"#1e1a15",border:"1px solid rgba(212,170,106,0.2)",borderRadius:14,padding:26,width:520,maxWidth:"92vw" },
    label:{ fontSize:11,letterSpacing:2,textTransform:"uppercase",color:"#8a7a60",marginBottom:12,display:"block" },
    tbtn:(a)=>({ padding:"6px 14px",borderRadius:6,border:`1px solid ${a?"#d4aa6a":"rgba(255,255,255,0.1)"}`,background:a?"rgba(212,170,106,0.18)":"transparent",color:a?"#d4aa6a":"#8a7a60",cursor:"pointer",fontSize:12 }),
    canvas:{ border:"1px solid rgba(212,170,106,0.15)",borderRadius:8,display:"block",width:"100%",cursor:tool==="eraser"?"cell":"crosshair" },
    btnSec:{ padding:"10px 20px",borderRadius:8,border:"1px solid rgba(255,255,255,0.1)",background:"transparent",cursor:"pointer",fontSize:13,color:"#8a7a60" },
    btnPri:{ padding:"10px 24px",borderRadius:8,border:"none",background:"#d4aa6a",color:"#1e1a15",cursor:"pointer",fontWeight:600,fontSize:13 },
  };

  return (
    <div style={S.overlay}>
      <div style={S.box}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <span style={{fontFamily:"'Playfair Display',serif",fontSize:18,color:"#f0e6d3"}}>Personnalisation de la couverture</span>
          <button onClick={onClose} style={{background:"none",border:"none",color:"#8a7a60",fontSize:18,cursor:"pointer",lineHeight:1}}>✕</button>
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center",marginBottom:12}}>
          <button style={S.tbtn(tool==="pen")} onClick={()=>setTool("pen")}>✏ Dessin</button>
          <button style={S.tbtn(tool==="eraser")} onClick={()=>setTool("eraser")}>◻ Gomme</button>
          <label style={{display:"flex",alignItems:"center",gap:6,fontSize:12,color:"#8a7a60",cursor:"pointer"}}>
            Couleur
            <input type="color" value={color} onChange={e=>setColor(e.target.value)}
              style={{cursor:"pointer",width:24,height:22,border:"none",background:"none"}}/>
          </label>
          <label style={{display:"flex",alignItems:"center",gap:6,fontSize:12,color:"#8a7a60"}}>
            Taille {size}px
            <input type="range" min={2} max={48} step={1} value={size} onChange={e=>setSize(+e.target.value)} style={{width:60}}/>
          </label>
          <button style={S.tbtn(false)} onClick={clear}>Effacer</button>
          <label style={{...S.tbtn(false),display:"inline-block",cursor:"pointer"}}>
            Importer
            <input type="file" accept="image/*" onChange={upload} style={{display:"none"}}/>
          </label>
        </div>
        <canvas ref={cr} width={468} height={330} style={S.canvas}
          onMouseDown={startDraw} onMouseMove={moveDraw} onMouseUp={endDraw} onMouseLeave={endDraw}/>
        <div style={{display:"flex",justifyContent:"flex-end",gap:10,marginTop:14}}>
          <button style={S.btnSec} onClick={onClose}>Annuler</button>
          <button style={S.btnPri} onClick={()=>onConfirm(cr.current.toDataURL())}>✓ Appliquer à la couverture</button>
        </div>
      </div>
    </div>
  );
}

/* ─── UI PIECES ─────────────────────────────────────────────────────────── */
const SectionTitle = ({children}) => (
  <div style={{fontSize:9.5,letterSpacing:2.8,textTransform:"uppercase",color:"#8a7a60",fontWeight:600,marginBottom:9,marginTop:4}}>{children}</div>
);

const OptionRow = ({active, onClick, label, sub}) => (
  <button onClick={onClick} style={{
    display:"block",width:"100%",textAlign:"left",padding:"8px 11px",
    borderRadius:7,marginBottom:3,cursor:"pointer",transition:"all .14s",
    border:`1px solid ${active?"rgba(212,170,106,0.5)":"rgba(255,255,255,0.06)"}`,
    background:active?"rgba(212,170,106,0.12)":"transparent",
  }}>
    <div style={{fontSize:13,fontWeight:active?500:400,color:active?"#e8d5b0":"#b0a898"}}>{label}</div>
    {sub && <div style={{fontSize:10.5,color:"#6a5a4a",marginTop:1}}>{sub}</div>}
  </button>
);

/* ─── MAIN APP ───────────────────────────────────────────────────────────── */
export default function App() {
  const canvasRef = useRef(null);
  const [cfg, setCfg] = useState({ size:"moyen", binding:"japonaise", paper:"dessin", format:"portrait", color:"#1e3a4c" });
  const [img, setImg]   = useState(null);
  const [modal, setModal] = useState(false);
  const [activeSection, setActiveSection] = useState(null);

  const ev = useNotebook(canvasRef, cfg, img);

  const price = useMemo(() => {
    const s = SIZES.find(x=>x.id===cfg.size)?.price || 0;
    const b = BINDINGS.find(x=>x.id===cfg.binding)?.price || 0;
    const p = PAPERS.find(x=>x.id===cfg.paper)?.price || 0;
    const f = FORMATS.find(x=>x.id===cfg.format)?.xtra || 0;
    return s + b + p + f + (img?3:0);
  }, [cfg, img]);

  const up = (k,v) => setCfg(c=>({...c,[k]:v}));

  const sd = SIZES.find(s=>s.id===cfg.size);
  const bd = BINDINGS.find(b=>b.id===cfg.binding);
  const pd = PAPERS.find(p=>p.id===cfg.paper);

  /* sidebar scrollable */
  const panel = {
    width:272, flexShrink:0,
    background:"#161210",
    borderRight:"1px solid rgba(255,255,255,0.06)",
    display:"flex",flexDirection:"column",overflowY:"auto",
    fontFamily:"'DM Sans',system-ui,sans-serif",
  };

  return (
    <div style={{display:"flex",height:"100vh",overflow:"hidden",background:"#0e0c0a",fontFamily:"'DM Sans',system-ui,sans-serif"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&display=swap');
        *{box-sizing:border-box;-webkit-font-smoothing:antialiased}
        ::-webkit-scrollbar{width:3px}
        ::-webkit-scrollbar-thumb{background:rgba(212,170,106,0.25);border-radius:2px}
        ::-webkit-scrollbar-track{background:transparent}
        button{font-family:'DM Sans',system-ui,sans-serif;outline:none}
      `}</style>

      {/* ── LEFT PANEL ── */}
      <div style={panel}>
        {/* Header */}
        <div style={{padding:"22px 18px 16px",borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
          <div style={{fontSize:9,letterSpacing:3.5,textTransform:"uppercase",color:"#8a7a60",marginBottom:6}}>Atelier du carnet</div>
          <h1 style={{margin:0,fontFamily:"'Playfair Display',serif",fontSize:22,color:"#f0e6d3",lineHeight:1.2,fontWeight:400}}>
            Composez votre<br/><em>carnet sur-mesure</em>
          </h1>
        </div>

        <div style={{padding:"14px 15px",flex:1}}>

          {/* SIZE */}
          <SectionTitle>Taille</SectionTitle>
          {SIZES.map(s=>(
            <OptionRow key={s.id} active={cfg.size===s.id} onClick={()=>up("size",s.id)}
              label={s.label} sub={`${s.dim} · ${s.price} €`}/>
          ))}

          {/* FORMAT */}
          <div style={{height:1,background:"rgba(255,255,255,0.05)",margin:"14px 0 10px"}}/>
          <SectionTitle>Format</SectionTitle>
          <div style={{display:"flex",gap:5,marginBottom:4}}>
            {FORMATS.map(f=>(
              <button key={f.id} onClick={()=>up("format",f.id)} style={{
                flex:1,padding:"10px 4px",borderRadius:7,cursor:"pointer",
                border:`1px solid ${cfg.format===f.id?"rgba(212,170,106,0.5)":"rgba(255,255,255,0.06)"}`,
                background:cfg.format===f.id?"rgba(212,170,106,0.12)":"transparent",
                display:"flex",flexDirection:"column",alignItems:"center",gap:3,transition:"all .14s",
              }}>
                <span style={{fontSize:17,color:cfg.format===f.id?"#d4aa6a":"#6a5a4a"}}>{f.icon}</span>
                <span style={{fontSize:11,color:cfg.format===f.id?"#e8d5b0":"#8a7a60",fontWeight:cfg.format===f.id?500:400}}>{f.label}</span>
                {f.xtra>0 && <span style={{fontSize:9,color:"#d4aa6a"}}>+{f.xtra} €</span>}
              </button>
            ))}
          </div>

          {/* BINDING */}
          <div style={{height:1,background:"rgba(255,255,255,0.05)",margin:"14px 0 10px"}}/>
          <SectionTitle>Reliure</SectionTitle>
          {BINDINGS.map(b=>(
            <OptionRow key={b.id} active={cfg.binding===b.id} onClick={()=>up("binding",b.id)}
              label={b.label} sub={`${b.desc}${b.price>0?` · +${b.price} €`:""}`}/>
          ))}

          {/* PAPER */}
          <div style={{height:1,background:"rgba(255,255,255,0.05)",margin:"14px 0 10px"}}/>
          <SectionTitle>Papier</SectionTitle>
          {PAPERS.map(p=>(
            <div key={p.id} onClick={()=>up("paper",p.id)} style={{
              display:"flex",alignItems:"center",gap:10,padding:"7px 10px",
              borderRadius:7,marginBottom:3,cursor:"pointer",transition:"all .14s",
              border:`1px solid ${cfg.paper===p.id?"rgba(212,170,106,0.5)":"rgba(255,255,255,0.06)"}`,
              background:cfg.paper===p.id?"rgba(212,170,106,0.10)":"transparent",
            }}>
              <div style={{width:22,height:22,borderRadius:4,flexShrink:0,background:p.pg,border:"1px solid rgba(255,255,255,0.15)"}}/>
              <div>
                <div style={{fontSize:12.5,color:cfg.paper===p.id?"#e8d5b0":"#a09080",fontWeight:cfg.paper===p.id?500:400}}>{p.label}</div>
                <div style={{fontSize:10,color:"#5a4a3a"}}>{p.desc}{p.price>0?` · +${p.price} €`:""}</div>
              </div>
            </div>
          ))}

          {/* COVER COLOR */}
          <div style={{height:1,background:"rgba(255,255,255,0.05)",margin:"14px 0 10px"}}/>
          <SectionTitle>Couleur de couverture</SectionTitle>
          <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:6,marginBottom:6}}>
            {COVER_COLORS.map(c=>(
              <div key={c.hex} title={c.name} onClick={()=>up("color",c.hex)} style={{
                width:"100%",paddingTop:"100%",position:"relative",borderRadius:5,cursor:"pointer",
                background:c.hex,
                boxShadow:`0 0 0 ${cfg.color===c.hex?"2px":"0px"} #d4aa6a, 0 0 0 ${cfg.color===c.hex?"4px":"0px"} rgba(0,0,0,0.5)`,
                transition:"box-shadow .14s",border:"1px solid rgba(255,255,255,0.08)",
              }}/>
            ))}
          </div>
          <div style={{fontSize:11,color:"#6a5a4a",marginTop:2}}>
            {COVER_COLORS.find(c=>c.hex===cfg.color)?.name || "—"}
          </div>

          {/* CUSTOM ART */}
          <div style={{height:1,background:"rgba(255,255,255,0.05)",margin:"14px 0 10px"}}/>
          <SectionTitle>Illustration personnalisée</SectionTitle>
          <button onClick={()=>setModal(true)} style={{
            width:"100%",padding:"10px 12px",borderRadius:7,cursor:"pointer",
            border:`1px solid ${img?"rgba(212,170,106,0.5)":"rgba(255,255,255,0.08)"}`,
            background:img?"rgba(212,170,106,0.10)":"transparent",
            color:img?"#d4aa6a":"#8a7a60",fontSize:12.5,
            display:"flex",alignItems:"center",justifyContent:"center",gap:8,
          }}>
            <span>{img?"✎ Modifier le dessin":"✎ Ajouter un dessin"}</span>
            <span style={{fontSize:10,color:"#6a5a4a"}}>+3 €</span>
          </button>
          {img && (
            <button onClick={()=>setImg(null)} style={{
              width:"100%",marginTop:4,padding:"5px",borderRadius:7,cursor:"pointer",
              border:"1px solid rgba(255,255,255,0.06)",background:"transparent",
              fontSize:10.5,color:"#5a4a3a",
            }}>✕ Supprimer</button>
          )}

          <div style={{height:20}}/>
        </div>
      </div>

      {/* ── MAIN STAGE ── */}
      <div style={{flex:1,display:"flex",flexDirection:"column",minWidth:0,position:"relative",background:"#0e0c0a"}}>

        {/* Top hint bar */}
        <div style={{padding:"10px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:"1px solid rgba(255,255,255,0.05)"}}>
          <span style={{fontSize:10.5,color:"#4a3a2a",fontStyle:"italic"}}>Faites pivoter le carnet à la souris</span>
          <span style={{fontSize:10.5,color:"#4a3a2a"}}>
            {sd?.label} · {FORMATS.find(f=>f.id===cfg.format)?.label} · {bd?.label} · {pd?.label}
          </span>
        </div>

        {/* 3D canvas */}
        <canvas ref={canvasRef}
          style={{flex:1,display:"block",width:"100%",minHeight:0,cursor:"grab"}}
          onMouseDown={ev.onMD} onMouseMove={ev.onMM}
          onMouseUp={ev.onMU} onMouseLeave={ev.onMU}
          onTouchStart={ev.onTS} onTouchMove={ev.onTM} onTouchEnd={ev.onMU}
        />

        {/* ── BOTTOM RECAP & CTA ── */}
        <div style={{
          padding:"16px 24px",
          borderTop:"1px solid rgba(255,255,255,0.06)",
          background:"rgba(22,18,14,0.96)",
          display:"flex",alignItems:"center",justifyContent:"space-between",
        }}>
          <div>
            <div style={{fontSize:10,letterSpacing:2,textTransform:"uppercase",color:"#6a5a4a",marginBottom:4}}>Prix estimé</div>
            <div style={{display:"flex",alignItems:"baseline",gap:10}}>
              <span style={{fontSize:34,fontFamily:"'Playfair Display',serif",color:"#f0e6d3",lineHeight:1}}>{price} €</span>
              <span style={{fontSize:11,color:"#5a4a3a"}}>TTC · livraison offerte</span>
            </div>
            <div style={{marginTop:5,display:"flex",flexWrap:"wrap",gap:5}}>
              {[
                `${sd?.label} ${sd?.price} €`,
                `${bd?.label} +${bd?.price} €`,
                `${pd?.label} +${pd?.price} €`,
                ...(cfg.format==="leporello"?["Leporello +5 €"]:[]),
                ...(img?["Illus. +3 €"]:[]),
              ].map((t,i)=>(
                <span key={i} style={{fontSize:10,padding:"2px 7px",borderRadius:4,background:"rgba(212,170,106,0.08)",border:"1px solid rgba(212,170,106,0.15)",color:"#8a7a60"}}>{t}</span>
              ))}
            </div>
          </div>
          <div style={{display:"flex",gap:10,flexShrink:0}}>
            <button style={{
              padding:"12px 18px",borderRadius:9,cursor:"pointer",fontSize:12.5,
              border:"1px solid rgba(212,170,106,0.3)",background:"transparent",color:"#d4aa6a",
            }}>♡ Sauvegarder</button>
            <button style={{
              padding:"12px 28px",borderRadius:9,cursor:"pointer",fontSize:14,fontWeight:500,
              border:"none",background:"#d4aa6a",color:"#12100e",letterSpacing:0.4,
            }}>
              Commander · {price} €  →
            </button>
          </div>
        </div>
      </div>

      {modal && (
        <DrawModal
          initial={img}
          onConfirm={url=>{ setImg(url); setModal(false); }}
          onClose={()=>setModal(false)}
        />
      )}
    </div>
  );
}
