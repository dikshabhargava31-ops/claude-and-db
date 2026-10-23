      // ---------------------------------------------------------------------------------------------
      // The 3D world. Seven sets sit side by side in one scene; every shot is a camera on one set.
      // Everything on screen is a pure function of time: renderAt(t).
      // ---------------------------------------------------------------------------------------------
      const W = 1080, H = 1920;
      const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById("stage"), antialias: true, preserveDrawingBuffer: true });
      renderer.setPixelRatio(1);
      renderer.setSize(W, H, false);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.setScissorTest(true);

      const scene = new THREE.Scene();
      scene.background = new THREE.Color("#0f1a3a");
      const cam = new THREE.PerspectiveCamera(42, W / H, 0.1, 200);
      const camL = new THREE.PerspectiveCamera(42, W / 2 / H, 0.1, 200);
      const camR = new THREE.PerspectiveCamera(42, W / 2 / H, 0.1, 200);

      // light: a cool night fill everywhere, a warm key and one practical light that follow the shot
      scene.add(new THREE.HemisphereLight("#9fb4ff", "#3a2a22", 1.2));
      const fill = new THREE.DirectionalLight("#fff1e0", 1.0); scene.add(fill, fill.target);
      const key = new THREE.DirectionalLight("#ffd9b0", 2.5);
      key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
      Object.assign(key.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 0.5, far: 30 });
      scene.add(key, key.target);
      const prac = new THREE.PointLight("#ffb062", 5, 7, 1.6); scene.add(prac);

      const M = {};
      const mat = (c, r = 0.75, e) => { const k = c + r + (e || ""); return M[k] || (M[k] = new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: r, metalness: 0 }, e ? { emissive: e, emissiveIntensity: 0.9 } : {}))); };
      const mesh = (geo, m, x = 0, y = 0, z = 0, parent = scene) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; parent.add(o); return o; };
      const box = (w, h, d, c, x, y, z, parent, r) => mesh(new THREE.BoxGeometry(w, h, d), typeof c === "string" ? mat(c, r) : c, x, y, z, parent);
      const clamp = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
      const ease = (a) => { a = clamp(a); return a * a * (3 - 2 * a); };
      // camera moves keep drifting to the cut (an ease-out that never stops), so no shot freezes before the next
      const drift = (a) => { a = clamp(a); return 0.5 * a + 0.5 * (1 - (1 - a) * (1 - a)); };
      const lerp = (a, b, k) => a + (b - a) * k;
      const backOut = (a) => { a = clamp(a); const c = 1.9; return 1 + (c + 1) * Math.pow(a - 1, 3) + c * Math.pow(a - 1, 2); };
      const room = (ox, floor, wall, w = 12, d = 10) => {
        box(w, 0.2, d, floor, ox, -0.1, 0, scene, 0.85);
        box(w, 6, 0.2, wall, ox, 3, -3.2);
        box(0.2, 6, d, wall, ox - w / 2, 3, 0);
        box(0.2, 6, d, wall, ox + w / 2, 3, 0);
      };

      // ---------------- people: soft clay figures built from primitives
      const SKIN = mat("#f0bf8f", 0.55);
      const PEOPLE = [];
      function person({ top, pants, hair, scale = 1, glasses = false, bag = false, grey = false, longHair = false, shoes = "#2a1d16" }) {
        const g = new THREE.Group(), p = {};
        const legGeo = new THREE.CapsuleGeometry(0.11, 0.55, 6, 12);
        ["L", "R"].forEach((s, i) => {
          const hip = new THREE.Group(); hip.position.set(i ? 0.14 : -0.14, 0.9, 0);
          mesh(legGeo, mat(pants), 0, -0.42, 0, hip); box(0.22, 0.12, 0.34, shoes, 0, -0.84, 0.06, hip);
          p["hip" + s] = hip; g.add(hip);
        });
        p.body = new THREE.Group(); p.body.position.y = 0.9; g.add(p.body);
        const torso = mesh(new THREE.CapsuleGeometry(0.42, 0.32, 8, 24), mat(top), 0, 0.42, 0, p.body); torso.scale.z = 0.85;
        mesh(new THREE.TorusGeometry(0.17, 0.05, 8, 20), mat("#f3eee4"), 0, 0.86, 0.04, p.body);
        const armGeo = new THREE.CapsuleGeometry(0.12, 0.36, 6, 12);
        ["L", "R"].forEach((s, i) => {
          const sh = new THREE.Group(); sh.position.set(i ? 0.5 : -0.5, 0.74, 0);
          mesh(armGeo, mat(top), 0, -0.28, 0, sh); mesh(new THREE.SphereGeometry(0.1, 16, 12), SKIN, 0, -0.58, 0, sh);
          p["sh" + s] = sh; p.body.add(sh);
        });
        p.phone = box(0.12, 0.24, 0.04, mat("#111", 0.3), 0.06, -0.6, 0.08, p.shR); p.phone.visible = false;
        p.held = box(0.22, 0.38, 0.04, mat("#111", 0.3, "#3b82f6"), 0, 0.42, 0.5, p.body); p.held.rotation.x = -0.9; p.held.visible = false;
        p.head = new THREE.Group(); p.head.position.y = 1.0; p.body.add(p.head);
        mesh(new THREE.SphereGeometry(0.46, 40, 30), SKIN, 0, 0.42, 0, p.head);
        const hm = mesh(new THREE.SphereGeometry(0.48, 40, 30, 0, Math.PI * 2, 0, Math.PI * 0.42), mat(hair, 0.9), 0, 0.43, -0.03, p.head); hm.rotation.x = -0.55;
        if (longHair) { const lh = mesh(new THREE.CapsuleGeometry(0.36, 0.5, 8, 16), mat(hair, 0.9), 0, 0.15, -0.22, p.head); lh.scale.z = 0.6; }
        if (grey) [-1, 1].forEach((s) => { const sb = mesh(new THREE.SphereGeometry(0.16, 16, 12), mat("#a7a7a7", 0.9), s * 0.4, 0.48, -0.08, p.head); sb.scale.x = 0.45; });
        [-0.16, 0.16].forEach((x) => { const e = mesh(new THREE.SphereGeometry(0.05, 12, 10), mat("#1b1410", 0.3), x, 0.43, 0.43, p.head); e.scale.set(0.8, 1.25, 0.5); });
        if (glasses) {
          [-0.17, 0.17].forEach((x) => mesh(new THREE.TorusGeometry(0.115, 0.024, 8, 24), mat("#111", 0.4), x, 0.42, 0.43, p.head));
          box(0.11, 0.025, 0.025, "#111", 0, 0.43, 0.45, p.head);
        }
        if (bag) box(0.6, 0.66, 0.26, "#1f2f63", 0, 0.42, -0.45, p.body);
        g.scale.setScalar(scale);
        scene.add(g);
        const who = { g, p }; PEOPLE.push(who);
        return who;
      }
      // pose from a small description; everything resets each frame so any frame renders on its own
      function pose(who, o, t) {
        const p = who.p; who.g.visible = true;
        p.hipL.rotation.set(0, 0, 0); p.hipR.rotation.set(0, 0, 0);
        p.shL.rotation.set(0, 0, -0.08); p.shR.rotation.set(0, 0, 0.08);
        p.head.rotation.set(o.nod || 0, o.look || 0, 0);
        p.body.position.y = 0.9 + Math.sin(t * 2.2 + (o.seed || 0)) * 0.008;
        p.phone.visible = !!o.phone; p.held.visible = !!o.hold;
        who.g.position.set(o.x, o.y || 0, o.z); who.g.rotation.y = o.face || 0;
        if (o.walk) {
          const s = Math.sin(t * 9 + (o.seed || 0));
          p.hipL.rotation.x = s * 0.55; p.hipR.rotation.x = -s * 0.55; p.shL.rotation.x = -s * 0.45; p.shR.rotation.x = s * 0.45;
          p.body.position.y = 0.9 + Math.abs(Math.cos(t * 9 + (o.seed || 0))) * 0.05;
        }
        if (o.sit) { p.hipL.rotation.x = p.hipR.rotation.x = -1.5; who.g.position.y = (o.y || 0) + 0.5 - 0.9 + 0.12; }
        if (o.phone) p.shR.rotation.z = 3.0;
        if (o.hold) { p.shR.rotation.set(-1.15, 0, 0.3); p.shL.rotation.set(-1.15, 0, -0.3); }
        if (o.wave !== undefined) p.shR.rotation.z = 2.6 + Math.sin(o.wave * 9) * 0.35;
        if (o.point) p.shR.rotation.z = 1.5;
        if (o.shake !== undefined) { p.shR.rotation.x = -1.25; p.shR.rotation.z = 0.15; p.shR.rotation.x += Math.sin(o.shake * 14) * 0.08; }
        if (o.hop) who.g.position.y += o.hop;
      }

      // ---------------- canvas textures (sign, board, bubbles, calendar, sheet, labels)
      function tex(w, h, draw) {
        const c = document.createElement("canvas"); c.width = w; c.height = h;
        const g = c.getContext("2d"); draw(g, w, h);
        const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 4; return tx;
      }
      function rr(g, x, y, w, h, r, fillStyle) { g.beginPath(); g.roundRect(x, y, w, h, r); g.fillStyle = fillStyle; g.fill(); }
      function sprite(texture, w, h) {
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
        s.scale.set(w, h, 1); s.renderOrder = 10; s.visible = false; scene.add(s); s.userData.base = [w, h]; return s;
      }
      function bubble(text, { bg = "#ffffff", fg = "#111b21", sub, w = 900, size = 52, tail = "left" } = {}) {
        const lines = text.split("\n"), lh = Math.round(size * 1.32);
        const h = (sub ? 110 : 40) + lines.length * lh + (sub ? 20 : 40);
        return tex(w, h + 30, (g) => {
          g.shadowColor = "rgba(0,0,0,0.35)"; g.shadowBlur = 18; g.shadowOffsetY = 8;
          rr(g, 10, 10, w - 20, h - 10, 40, bg); g.shadowColor = "transparent";
          g.beginPath(); const tx0 = tail === "left" ? 70 : w - 70; g.moveTo(tx0 - 26, h - 2); g.lineTo(tx0, h + 26); g.lineTo(tx0 + 26, h - 2); g.fillStyle = bg; g.fill();
          g.fillStyle = fg; g.textBaseline = "middle";
          let y0 = (h + 10) / 2 - ((lines.length - 1) * lh) / 2;
          if (sub) { g.font = "600 34px Inter"; g.globalAlpha = 0.7; g.fillText(sub, 46, 62); g.globalAlpha = 1; y0 = 140; }
          g.font = `${lines.length > 1 ? 600 : 700} ${size}px Inter`;
          lines.forEach((ln, i) => g.fillText(ln, 46, y0 + i * lh));
        });
      }
      const label = (text, { bg = "#0b1226", fg = "#ffffff", w = 520, size = 60 } = {}) => tex(w, 130, (g) => {
        rr(g, 6, 6, w - 12, 118, 28, bg); g.fillStyle = fg; g.font = `800 ${size}px Inter`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(text, w / 2, 68);
      });

      // ---------------- the sets
      const S = { office: 0, street: 40, home: 80, class: 120, mum: 160, sheet: 200, chart: 240 };
      let world;
      function build() {
        const w = {};
        // OFFICE: the teacher's desk at night
        let o = S.office;
        room(o, "#5e4434", "#1d2b58");
        box(0.1, 1.8, 2.4, mat("#26407f", 0.5, "#2a4b9a"), o - 5.88, 2.6, -1.0);
        mesh(new THREE.SphereGeometry(0.22, 24, 16), mat("#ffffff", 0.5, "#e8eeff"), o - 5.8, 3.1, -0.5);
        box(2.4, 0.86, 1.0, "#6e4528", o, 0.43, -1.0); box(2.5, 0.06, 1.1, "#9a6a43", o, 0.89, -1.0);
        box(0.7, 0.06, 0.5, "#22305c", o, 0.5, -1.95); box(0.7, 0.7, 0.06, "#22305c", o, 0.85, -2.25);
        box(0.7, 0.04, 0.5, "#c9ccd3", o - 0.6, 0.94, -1.05, scene, 0.4);
        const scr = box(0.7, 0.45, 0.03, mat("#0d1530", 0.4, "#2f6fd6"), o - 0.6, 1.17, -1.3); scr.rotation.x = -0.25;
        box(0.16, 0.02, 0.32, mat("#111", 0.3, "#3b82f6"), o + 0.45, 0.93, -0.8);
        box(0.08, 0.6, 0.08, "#222", o + 0.95, 1.2, -1.35);
        const sh = mesh(new THREE.ConeGeometry(0.2, 0.25, 20, 1, true), mat("#2b2b2b", 0.5, "#ffb05c"), o + 0.85, 1.55, -1.3); sh.rotation.z = 0.6;
        box(1.6, 2.0, 0.4, "#4a2f1f", o - 2.4, 1.0, -2.95);
        ["#c0392b", "#2e86de", "#f1c40f", "#27ae60", "#8e44ad", "#e67e22"].forEach((c, k) => box(0.18, 0.5, 0.3, c, o - 3.0 + k * 0.22, 1.45 + (k % 2) * 0.0, -2.9));
        w.teacherA = person({ top: "#7a5638", pants: "#3c3a37", hair: "#2a2420", glasses: true, grey: true });
        w.notes = []; w.notesG = [];
        const names = ["Rohan ke Papa", "Priya ki Mummy", "Aman ke Papa", "Sneha", "Kabir ke Papa", "Dev ki Mummy", "Riya", "Arjun ke Papa", "Isha ki Mummy", "Meera", "Kunal ke Papa", "Yash", "Tanvi ki Mummy", "Om ke Papa", "Zoya"];
        const asks = ["Fees kitni hai?", "Admission open hai?", "Timing kya hai?", "Demo milega?", "Batch kab se?"];
        names.forEach((n, k) => {
          const bt = bubble(asks[k % 5], { sub: n, w: 760, size: 48 });
          const gt = bubble("Admission done", { sub: n, w: 760, size: 48, bg: "#d9fdd3", fg: "#0b5d2a" });
          const x = o - 1.3 + (k % 3) * 1.25 + (k % 2) * 0.15, y = 1.75 + Math.floor(k / 3) * 0.48, z = -1.2;
          const a = sprite(bt, 1.15, 0.36); a.position.set(x, y, z); w.notes.push(a);
          const b = sprite(gt, 1.15, 0.36); b.position.set(x, y, z); w.notesG.push(b);
        });
        w.fee = sprite(bubble("Fees ₹2,500 / month", { bg: "#d9fdd3", sub: "Aap", w: 820, tail: "right" }), 1.25, 0.39); w.fee.position.set(o + 0.35, 2.35, -0.9);
        w.calA = sprite(tex(600, 640, (g) => { rr(g, 10, 10, 580, 620, 30, "#fff"); rr(g, 10, 10, 580, 150, 30, "#e53935"); g.fillRect(10, 110, 580, 50);
          g.fillStyle = "#fff"; g.font = "800 72px Inter"; g.textAlign = "center"; g.fillText("CENTRE VISIT", 300, 112);
          g.fillStyle = "#0b1226"; g.font = "800 150px Inter"; g.fillText("SAT", 300, 350); g.font = "700 90px Inter"; g.fillText("5:00 PM", 300, 500);
          g.strokeStyle = "#e53935"; g.lineWidth = 14; g.beginPath(); g.ellipse(300, 300, 230, 120, -0.05, 0, Math.PI * 2); g.stroke(); }), 0.8, 0.85);
        w.calA.position.set(o + 0.2, 2.45, -0.6);

        // STREET: the centre at night
        o = S.street;
        box(24, 0.2, 30, "#23262f", o, -0.1, 0, scene, 0.9);
        box(24, 0.3, 2.4, "#6b6b70", o, 0.15, -0.2);
        box(7, 3.6, 3, "#d9c7a6", o, 1.8, -3.2);
        box(1.8, 2.3, 0.1, mat("#ffcf8a", 0.6, "#ffb45c"), o, 1.15, -1.66);
        box(1.9, 0.35, 0.3, "#5c5f66", o, 2.45, -1.6);
        [-2.4, 2.4].forEach((x) => box(1.1, 1.0, 0.1, mat("#ffe0a8", 0.6, "#ffb45c"), o + x, 1.9, -1.66));
        const sign = box(4.2, 0.7, 0.12, mat("#ffffff", 0.6), o, 3.1, -1.6);
        sign.material = new THREE.MeshStandardMaterial({ map: tex(1200, 200, (g) => { rr(g, 0, 0, 1200, 200, 0, "#0b1226"); g.fillStyle = "#fbb524"; g.font = "900 110px Inter"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("COACHING KA SYSTEM", 600, 105); }), emissive: "#ffffff", emissiveIntensity: 0.35, emissiveMap: null, roughness: 0.6 });
        [-2.4, 2.4].forEach((x) => box(0.35, 1.4, 0.35, "#cfc3b0", o + x, 0.7, 0.6));
        box(0.12, 4.2, 0.12, "#2b2b30", o - 3.6, 2.1, 0.9);
        mesh(new THREE.SphereGeometry(0.22, 16, 12), mat("#fff", 0.4, "#ffd38a"), o - 3.3, 4.15, 0.9);
        [[-5.5, -1.5], [5.6, -1.2], [-7, 1.5]].forEach(([x, z]) => { box(0.25, 1.6, 0.25, "#4a3222", o + x, 0.8, z); mesh(new THREE.SphereGeometry(1.0, 18, 14), mat("#2f6b3a", 0.9), o + x, 2.2, z); });
        box(1.1, 0.45, 0.4, "#5a7d8c", o + 3.6, 0.55, 0.9); [3.15, 4.05].forEach((x) => mesh(new THREE.TorusGeometry(0.2, 0.07, 8, 16), mat("#222"), o + x, 0.27, 0.9).rotation.y = Math.PI / 2);
        w.papaS = person({ top: "#7c1f2c", pants: "#5d1a22", hair: "#1c1612" });
        w.kidS = person({ top: "#eeeae2", pants: "#e6e2da", hair: "#3a2a20", scale: 0.72, bag: true });

        // PAPA'S HOME
        o = S.home;
        room(o, "#4b3a30", "#2a3a5e");
        box(2.4, 0.45, 0.9, "#5a2533", o - 1.2, 0.3, -2.2); box(2.4, 0.75, 0.25, "#5a2533", o - 1.2, 0.75, -2.65);
        box(1.2, 0.8, 0.06, "#c9a86a", o + 1.6, 2.4, -3.08); box(1.0, 0.6, 0.07, "#6a8fb5", o + 1.6, 2.4, -3.04);
        box(0.08, 1.7, 0.08, "#222", o + 2.6, 0.85, -2.2); mesh(new THREE.ConeGeometry(0.3, 0.35, 20, 1, true), mat("#e9d8b8", 0.5, "#ffcf8a"), o + 2.6, 1.8, -2.2);
        mesh(new THREE.CylinderGeometry(0.25, 0.2, 0.45, 16), mat("#a0522d"), o - 2.8, 0.22, -2.5); mesh(new THREE.SphereGeometry(0.45, 14, 12), mat("#2f7a3a", 0.9), o - 2.8, 0.85, -2.5);
        w.papaH = person({ top: "#7c1f2c", pants: "#5d1a22", hair: "#1c1612" });
        w.tags = [["₹2,200", "Coaching A"], ["₹2,500", "Aapka centre"], ["₹3,000", "Coaching B"]].map(([p, n], k) => {
          const s = sprite(tex(560, 300, (g) => { rr(g, 10, 10, 540, 280, 34, k === 1 ? "#fbb524" : "#ffffff"); g.fillStyle = "#0b1226"; g.textAlign = "center"; g.font = "900 110px Inter"; g.fillText(p, 280, 150); g.font = "700 46px Inter"; g.fillText(n, 280, 240); }), 0.95, 0.51);
          s.position.set(o + [-0.75, 0.15, 0.95][k], [2.25, 2.75, 1.85][k], 0.3); return s;
        });
        w.soch = sprite(bubble("Soch ke batate hain…", { sub: "Rohan ke Papa", w: 860 }), 1.35, 0.4); w.soch.position.set(o + 0.2, 2.35, 0.1);
        w.sochG = sprite(bubble("Soch ke batate hain…", { sub: "… 7 din se koi call nahi", w: 860, bg: "#9aa3b2", fg: "#2a2f3a" }), 1.35, 0.4); w.sochG.position.copy(w.soch.position);

        // CLASSROOM
        o = S.class;
        room(o, "#6a4a35", "#1d2b58");
        box(4.2, 1.9, 0.08, "#3a3f4a", o, 2.6, -3.05);
        const board = box(4.0, 1.7, 0.1, "#f1efe8", o, 2.6, -3.0, scene, 0.35);
        board.material = new THREE.MeshStandardMaterial({ roughness: 0.4, map: tex(1200, 510, (g) => { rr(g, 0, 0, 1200, 510, 0, "#f4f2ea"); g.fillStyle = "#1f3b8a"; g.font = "700 70px Inter"; g.fillText("Chapter 4 · Algebra", 70, 120); g.font = "600 92px Inter"; g.fillText("x + 5 = 12", 70, 290); g.fillStyle = "#c62828"; g.fillText("x = 7", 70, 430); }) });
        const desk = (x, z) => { box(1.3, 0.08, 0.7, "#b37b48", o + x, 0.78, z, scene, 0.6); [[-0.58, -0.28], [0.58, -0.28], [-0.58, 0.28], [0.58, 0.28]].forEach(([a, b]) => box(0.06, 0.78, 0.06, "#3b2a1e", o + x + a, 0.39, z + b)); box(0.6, 0.06, 0.5, "#22305c", o + x, 0.46, z + 0.65); box(0.6, 0.55, 0.06, "#22305c", o + x, 0.74, z + 0.9); };
        [[-2.4, -0.6], [0, -0.6], [2.4, -0.6], [-2.4, 1.4], [0, 1.4], [2.4, 1.4]].forEach(([x, z]) => desk(x, z));
        box(0.1, 2.4, 1.2, "#5b3a22", o + 5.9, 1.2, 1.2);
        w.teacherC = person({ top: "#7a5638", pants: "#3c3a37", hair: "#2a2420", glasses: true, grey: true });
        w.papaC = person({ top: "#7c1f2c", pants: "#5d1a22", hair: "#1c1612" });
        w.kidC = person({ top: "#eeeae2", pants: "#e6e2da", hair: "#3a2a20", scale: 0.72, bag: true });
        w.students = [["#2e86de", "#2a2a40", "#2b1f18"], ["#e74c3c", "#2a2a40", "#1a1210"], ["#16a085", "#2a2a40", "#3a2a20"], ["#8e44ad", "#2a2a40", "#1a1210"]]
          .map(([tp, pn, hr], k) => person({ top: tp, pants: pn, hair: hr, scale: 0.72, longHair: k % 2 === 1 }));
        w.calC = sprite(tex(600, 640, (g) => { rr(g, 10, 10, 580, 620, 30, "#fff"); rr(g, 10, 10, 580, 150, 30, "#22c55e"); g.fillRect(10, 110, 580, 50);
          g.fillStyle = "#0b1226"; g.font = "800 72px Inter"; g.textAlign = "center"; g.fillText("TRIAL CLASS", 300, 112);
          g.font = "800 150px Inter"; g.fillText("MON", 300, 350); g.font = "700 90px Inter"; g.fillText("4:00 PM", 300, 500);
          g.strokeStyle = "#22c55e"; g.lineWidth = 14; g.beginPath(); g.ellipse(300, 300, 230, 120, -0.05, 0, Math.PI * 2); g.stroke(); }), 0.9, 0.96);
        w.calC.position.set(o + 2.9, 2.2, -2.9);

        // MUM'S HOME
        o = S.mum;
        room(o, "#4e3b2e", "#1f4a4f");
        box(2.6, 0.45, 0.9, "#c58b4a", o, 0.3, -1.9); box(2.6, 0.75, 0.25, "#c58b4a", o, 0.75, -2.35);
        box(0.08, 1.7, 0.08, "#222", o + 1.9, 0.85, -2.0); mesh(new THREE.ConeGeometry(0.3, 0.35, 20, 1, true), mat("#e9d8b8", 0.5, "#ffcf8a"), o + 1.9, 1.8, -2.0);
        box(1.4, 1.0, 0.06, mat("#26407f", 0.5, "#2a4b9a"), o - 1.6, 2.4, -3.06);
        w.mumH = person({ top: "#1f8a7a", pants: "#6b2350", hair: "#1a1210", longHair: true });
        // the Day 2 follow-up: a professional message from the institute
        const msgTex = bubble("Hello! This is Coaching Ka System.\nThank you for your enquiry about Class 9\nadmission. We would love for you to visit the\ncentre, see the classroom and meet our teachers.\nWould this Saturday at 5 PM work for you?", { bg: "#d9fdd3", sub: "Coaching Ka System · Day 2", w: 1060, size: 40 });
        w.msg = sprite(msgTex, 1.86, 1.86 * msgTex.image.height / msgTex.image.width); w.msg.position.set(o - 0.1, 2.15, -0.2);
        w.ring = sprite(tex(700, 200, (g) => { rr(g, 10, 10, 680, 180, 90, "#22c55e"); g.fillStyle = "#fff"; g.font = "800 60px Inter"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("Week 1 · Incoming call", 350, 102); }), 1.2, 0.34); w.ring.position.set(o - 0.75, 1.5, -0.4);
        w.kab = sprite(bubble("\"When can you visit this week?\"", { bg: "#fbb524", w: 1000, size: 52, tail: "right" }), 1.45, 0.3); w.kab.position.set(o + 0.2, 1.45, -0.3);

        // SHEET: the tracker on a laptop
        o = S.sheet;
        room(o, "#3c2c22", "#16213f");
        box(5, 0.12, 2.6, "#8a5a36", o, 0.9, -0.6, scene, 0.6);
        box(3.0, 0.08, 1.9, "#c9ccd3", o, 1.0, -0.6, scene, 0.35);
        const cols = ["Naam", "Class", "Phone", "Enquiry", "Visit", "Admission"];
        const rows = [["Rohan", "9th", "98•• ••4512", "2 Oct", "Haan", "Haan"], ["Priya", "10th", "97•• ••8830", "3 Oct", "Haan", "—"], ["Aman", "8th", "99•• ••1207", "5 Oct", "Nahi", "—"], ["Sneha", "11th", "98•• ••6671", "6 Oct", "Haan", "Haan"], ["Kabir", "9th", "96•• ••3349", "8 Oct", "Nahi", "—"]];
        w.sheetTex = [0, 1, 2, 3, 4, 5].map((n) => tex(1600, 1000, (g) => {
          rr(g, 0, 0, 1600, 1000, 0, "#ffffff"); rr(g, 0, 0, 1600, 110, 0, "#0f9d58");
          g.fillStyle = "#fff"; g.font = "700 56px Inter"; g.fillText("Enquiry Tracker · October", 40, 74);
          const xs = [40, 330, 520, 900, 1150, 1360];
          rr(g, 0, 110, 1600, 110, 0, "#f1f3f4"); g.fillStyle = "#1f1f1f"; g.font = "700 44px Inter"; cols.forEach((c, i) => g.fillText(c, xs[i], 180));
          g.strokeStyle = "#e1e3e1"; g.lineWidth = 3; for (let r = 0; r <= 6; r++) { g.beginPath(); g.moveTo(0, 220 + r * 130); g.lineTo(1600, 220 + r * 130); g.stroke(); }
          xs.slice(1).forEach((x) => { g.beginPath(); g.moveTo(x - 20, 110); g.lineTo(x - 20, 1000); g.stroke(); });
          rows.slice(0, n).forEach((row, r) => row.forEach((v, i) => {
            const y = 300 + r * 130;
            if (i >= 4) { const ok = v === "Haan"; rr(g, xs[i] - 6, y - 46, 150, 64, 32, v === "—" ? "#f1f3f4" : ok ? "#d4edbc" : "#ffcfc9"); g.fillStyle = v === "—" ? "#888" : ok ? "#11734b" : "#b10202"; g.font = "600 40px Inter"; g.fillText(v, xs[i] + 14, y); }
            else { g.fillStyle = "#1f1f1f"; g.font = "500 44px Inter"; g.fillText(v, xs[i], y); }
          }));
        }));
        w.screen = box(3.0, 1.9, 0.06, new THREE.MeshBasicMaterial({ map: w.sheetTex[0], toneMapped: false }), o, 1.95, -1.5); w.screen.rotation.x = -0.12;
        box(3.15, 2.05, 0.05, "#2a2a2e", o, 1.95, -1.54).rotation.x = -0.12;

        // CHART: this week's count
        o = S.chart;
        room(o, "#1b2238", "#141c36", 14, 12);
        w.bars = [["#3b82f6", 3.0, "Enquiries", "15"], ["#fbb524", 1.7, "Visits", "8"], ["#22c55e", 1.0, "Admissions", "5"]].map(([c, h, l, n], k) => {
          const b = box(1.1, 1, 1.1, mat(c, 0.5), o - 1.7 + k * 1.7, 0.5, 0); b.userData.h = h;
          const lab = sprite(label(l, { w: 600, size: 62 }), 1.15, 0.25); lab.position.set(o - 1.7 + k * 1.7, -0.05, 0.8); lab.visible = true;
          const num = sprite(label(n, { bg: c, fg: "#0b1226", w: 260, size: 92 }), 0.55, 0.28); num.userData.x = o - 1.7 + k * 1.7;
          return { b, lab, num, h };
        });
        w.exampleTag = sprite(label("Example week", { bg: "#26324f", fg: "#c7cfe0", w: 560, size: 50 }), 1.0, 0.23); w.exampleTag.position.set(o, 3.35, 0);
        return w;
      }

      // ---------------- shots
      const shotAt = (t) => T.shots.find((s) => t >= s.a && t < s.b) || T.shots[T.shots.length - 1];
      const E = T.ev;
      function lightFor(ox, lamp) {
        key.position.set(ox + 4, 7, 5); key.target.position.set(ox, 0, -1);
        fill.position.set(ox, 3, 10); fill.target.position.set(ox, 1, 0);
        prac.position.set(ox + lamp[0], lamp[1], lamp[2]);
      }
      function look(c, p, tgt) { c.position.set(p[0], p[1], p[2]); c.lookAt(tgt[0], tgt[1], tgt[2]); }
      const mix = (a, b, k) => a.map((v, i) => lerp(v, b[i], k));
      function popSprite(s, t, at, keep = 99) {
        const on = t >= at && t < at + keep; s.visible = on;
        if (on) { const k = backOut((t - at) / 0.3); s.scale.set(s.userData.base[0] * k, s.userData.base[1] * k, 1); s.material.opacity = 1; }
      }
      function hideAllSprites() { scene.traverse((o) => { if (o.isSprite && !o.userData.always) o.visible = false; }); }

      function renderAt(t) {
        if (!world) return;
        const w = world, sh = shotAt(t), u = clamp((t - sh.a) / (sh.b - sh.a));
        hideAllSprites(); PEOPLE.forEach((q) => (q.g.visible = false));
        w.bars.forEach((b) => (b.lab.visible = sh.n === "chart"));
        let split = false;
        switch (sh.n) {
          case "desk": {
            lightFor(S.office, [0.85, 1.6, -1.0]);
            pose(w.teacherA, { x: S.office, z: -1.9, sit: true, nod: 0.3 + Math.sin(t * 1.3) * 0.03 }, t);
            E.bubbles.forEach((a, k) => {
              const s = w.notes[k], age = t - a;
              if (age >= 0 && age < 1.6 && t < E.green) {
                s.visible = true; const k2 = backOut(age / 0.3);
                s.scale.set(s.userData.base[0] * k2, s.userData.base[1] * k2, 1);
                s.position.set(S.office - 1.15 + ((k * 7) % 5) * 0.58, 1.15 + age * 0.55 + (k % 2) * 0.12, -0.4);
                s.material.opacity = age > 1.25 ? 1 - (age - 1.25) / 0.35 : 1;
              }
            });
            [0, 5, 10].forEach((k, j) => { const s = w.notesG[k]; s.position.set(S.office - 1.05 + j * 1.05, 2.45 - (j % 2) * 0.42, -0.4); popSprite(s, t, E.green + j * 0.15); s.scale.set(s.userData.base[0] * 0.85 * (s.scale.x / s.userData.base[0]), s.userData.base[1] * 0.85 * (s.scale.y / s.userData.base[1]), 1); });
            look(cam, mix([S.office + 0.2, 2.9, 8.6], [S.office + 0.25, 2.5, 6.6], drift(u)), [S.office + 0.1, 1.55, -1.1]);
            break;
          }
          case "street": {
            lightFor(S.street, [-3.3, 4.0, 1.2]);
            const k = ease(u * 1.1);
            pose(w.papaS, { x: lerp(S.street + 3.8, S.street + 0.35, k), z: lerp(3.4, -1.0, k), walk: u < 0.9, face: -2.4 }, t);
            pose(w.kidS, { x: lerp(S.street + 4.5, S.street + 1.0, k), z: lerp(3.8, -0.8, k), walk: u < 0.9, face: -2.4, seed: 1 }, t);
            look(cam, mix([S.street + 0.6, 2.8, 19], [S.street + 0.3, 2.3, 10.5], drift(u)), [S.street, lerp(2.2, 1.9, u), -1.6]);
            break;
          }
          case "home": case "home2": {
            lightFor(S.home, [2.6, 1.8, -2.2]);
            const down = sh.n === "home2" && t > E.grey;
            pose(w.papaH, { x: S.home + 0.2, z: -0.6, phone: !down, nod: down ? 0.25 : Math.sin(t * 3) * 0.04, look: sh.n === "home" ? Math.sin(t * 1.1) * 0.25 : 0 }, t);
            if (sh.n === "home") w.tags.forEach((s, k) => popSprite(s, t, E.tags[k]));
            else { popSprite(w.soch, t, E.soch, E.grey - E.soch); popSprite(w.sochG, t, E.grey); w.sochG.scale.set(1.35, 0.4, 1); }
            const p0 = sh.n === "home" ? [S.home + 0.6, 2.4, 8.4] : [S.home - 0.9, 2.3, 8.0];
            const p1 = sh.n === "home" ? [S.home + 0.3, 2.2, 6.6] : [S.home - 0.4, 2.2, 6.6];
            look(cam, mix(p0, p1, drift(u)), [S.home + 0.1, 1.55, -0.6]);
            break;
          }
          case "class": case "shake": case "tour": case "bye": {
            lightFor(S.class, [0, 3.6, 0]);
            const st = [[-2.4, -0.6], [0, -0.6], [-2.4, 1.4], [2.4, 1.4]];
            w.students.forEach((s, k) => pose(s, { x: S.class + st[k][0], z: st[k][1] + 0.65, sit: true, face: Math.PI, nod: 0.12 + Math.sin(t * 2 + k) * 0.06, seed: k }, t));
            if (sh.n === "class") {
              pose(w.teacherC, { x: S.class + 1.2, z: -2.3, point: true, face: -0.4 }, t);
              pose(w.papaC, { x: S.class + 3.4, z: 2.6, face: -2.5, look: lerp(-0.3, 0.4, u) }, t);
              pose(w.kidC, { x: S.class + 4.1, z: 2.9, face: -2.5, seed: 1 }, t);
              const a = [S.class + 4.6, 3.3, 9.5], b = [S.class + 2.4, 3.0, 8.2], c = [S.class - 0.4, 3.4, 7.6];
              const ka = ease((t - E.see[0] + 0.3) / 0.8), kb = ease((t - E.see[2] + 0.3) / 0.8);
              look(cam, kb > 0 ? mix(b, c, kb) : mix(a, b, ka), kb > 0 ? [S.class - 0.8, 0.9, 0.2] : [S.class + lerp(1.6, 1.2, ka), 1.4, -1.2]);
            } else if (sh.n === "shake") {
              const s = t > E.shake ? t - E.shake : undefined;
              pose(w.teacherC, { x: S.class + 0.55, z: 0.4, face: Math.PI / 2 - 0.35, shake: s, nod: s ? Math.sin(s * 6) * 0.08 : 0 }, t);
              pose(w.papaC, { x: S.class + 1.75, z: 0.5, face: -Math.PI / 2 + 0.35, shake: s }, t);
              pose(w.kidC, { x: S.class + 2.5, z: 0.95, face: -Math.PI / 2 + 0.6, hop: t > E.shake + 0.6 && t < E.shake + 1.1 ? Math.sin(((t - E.shake - 0.6) / 0.5) * Math.PI) * 0.2 : 0 }, t);
              look(cam, mix([S.class + 1.15, 2.4, 8.2], [S.class + 1.15, 2.2, 6.8], drift(u)), [S.class + 1.15, 1.35, 0.4]);
            } else if (sh.n === "tour") {
              const k = ease(u / 0.45);
              pose(w.papaC, { x: lerp(S.class + 4.6, S.class + 1.6, k), z: lerp(3.4, 0.5, k), walk: u < 0.45, face: k < 1 ? -2.4 : -1.9 }, t);
              pose(w.kidC, { x: lerp(S.class + 5.3, S.class + 2.3, k), z: lerp(3.8, 0.9, k), walk: u < 0.45, face: k < 1 ? -2.4 : -1.9, seed: 1 }, t);
              const s = t > E.three[1] && t < E.three[1] + 1.4 ? t - E.three[1] : undefined;
              pose(w.teacherC, { x: S.class + 0.6, z: 0.2, face: s !== undefined ? 1.2 : 0.5, point: t > E.three[0] && t < E.three[1], wave: t > E.three[2] ? t : undefined }, t);
              popSprite(w.calC, t, E.three[2]);
              look(cam, mix([S.class + 3.6, 3.2, 10.5], [S.class + 1.6, 2.6, 8.2], drift(u)), [S.class + 1.4, 1.3, -0.4]);
            } else {
              pose(w.teacherC, { x: S.class, z: 0.8, face: 0, wave: t }, t);
              pose(w.papaC, { x: S.class - 1.3, z: 0.6, face: 0.3 }, t);
              pose(w.kidC, { x: S.class + 1.2, z: 0.9, face: -0.3, hop: Math.max(0, Math.sin(t * 5)) * 0.12, seed: 1 }, t);
              look(cam, mix([S.class, 2.6, 9.2], [S.class, 2.3, 7.6], drift(u)), [S.class, 1.3, 0.6]);
            }
            break;
          }
          case "deskcall": {
            lightFor(S.office, [0.85, 1.6, -1.0]);
            pose(w.teacherA, { x: S.office, z: -1.9, sit: true, phone: true, nod: Math.sin(t * 4) * 0.05 }, t);
            popSprite(w.fee, t, E.fee);
            look(cam, mix([S.office + 0.9, 2.6, 7.2], [S.office + 0.5, 2.3, 5.8], drift(u)), [S.office, 1.55, -1.6]);
            break;
          }
          case "call": {
            split = true;
            lightFor(S.office, [0.85, 1.6, -1.0]);
            pose(w.papaH, { x: S.home + 0.2, z: -0.6, phone: true, nod: t > E.cal ? Math.sin((t - E.cal) * 7) * 0.1 : Math.sin(t * 3) * 0.04 }, t);
            pose(w.teacherA, { x: S.office, z: -1.9, sit: true, phone: true, nod: Math.sin(t * 4.2) * 0.06 }, t);
            popSprite(w.calA, t, E.cal);
            look(camL, [S.home + 0.25, 2.2, lerp(7.8, 7.0, ease(u))], [S.home + 0.2, 1.45, -0.6]);
            look(camR, [S.office + 0.15, 2.2, lerp(7.2, 6.4, ease(u))], [S.office + 0.2, 1.35, -1.6]);
            break;
          }
          case "mum": {
            lightFor(S.mum, [1.9, 1.8, -2.0]);
            const onCall = t > E.ring + 0.5;
            pose(w.mumH, { x: S.mum, z: -1.95, sit: true, hold: !onCall, phone: onCall, nod: onCall ? Math.sin(t * 3.5) * 0.06 : 0.25 }, t);
            popSprite(w.msg, t, E.msg, E.ring - E.msg);
            popSprite(w.ring, t, E.ring, E.kab - E.ring);
            popSprite(w.kab, t, E.kab);
            const a = lerp(-0.25, 0.25, drift(u));
            look(cam, [S.mum + Math.sin(a) * 6.8, 2.3, -1.6 + Math.cos(a) * 6.8], [S.mum, 1.45, -1.6]);
            break;
          }
          case "sheet": {
            lightFor(S.sheet, [0, 3.4, 1.0]);
            const n = E.rows.filter((r) => t >= r).length;
            w.screen.material.map = w.sheetTex[n];
            look(cam, mix([S.sheet + 0.3, 2.5, 7.8], [S.sheet + 0.05, 2.2, 6.4], drift(u)), [S.sheet, 1.75, -1.5]);
            break;
          }
          case "chart": {
            lightFor(S.chart, [0, 4.5, 2.5]);
            w.bars.forEach((b, k) => {
              const g = backOut((t - E.bars[k]) / 0.6) * (t >= E.bars[k] ? 1 : 0.02);
              const h = Math.max(0.02, b.h * g);
              b.b.scale.y = h; b.b.position.y = h / 2;
              b.num.visible = t >= E.bars[k]; b.num.position.set(b.num.userData.x, h + 0.3, 0);
            });
            w.exampleTag.visible = true;
            look(cam, mix([S.chart + 0.8, 1.9, 15.5], [S.chart, 1.6, 13.5], drift(u)), [S.chart, 0.55, 0]);
            break;
          }
        }
        if (!split) {
          renderer.setViewport(0, 0, W, H); renderer.setScissor(0, 0, W, H); renderer.render(scene, cam);
        } else {
          renderer.setViewport(0, 0, W / 2, H); renderer.setScissor(0, 0, W / 2, H); renderer.render(scene, camL);
          renderer.setViewport(W / 2, 0, W / 2, H); renderer.setScissor(W / 2, 0, W / 2, H); renderer.render(scene, camR);
        }
      }

      // canvas text needs the fonts first; the frame waits for this
      window.__hf = window.__hf || {};
      window.__hf.buildReady = window.__hf.buildReady || {};
      const ready = Promise.all(["900 60px Inter", "800 60px Inter", "700 60px Inter", "600 60px Inter", "500 60px Inter"].map((f) => document.fonts.load(f)))
        .then(() => { world = build(); renderAt(0); });
      window.__hf.buildReady.world = ready;
      window.addEventListener("hf-seek", (e) => {
        if (world) renderAt(e.detail.time);
        else if (e.detail.waitUntil) e.detail.waitUntil(ready.then(() => renderAt(e.detail.time)));
      });
