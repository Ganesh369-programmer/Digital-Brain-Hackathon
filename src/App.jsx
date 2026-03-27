import { useEffect, useRef, useState, useCallback } from "react";

// ── Utility
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ─────────────────────────────────────────────────────────────────
// GLB MODEL PATHS - Hardcoded for your GitHub Pages deployment
// Your models are accessible at:
// https://ganesh369-programmer.github.io/Digital-Brain-Hackathon/3d/computer.glb
// ─────────────────────────────────────────────────────────────────
const GLB = {
  computer: "https://ganesh369-programmer.github.io/Digital-Brain-Hackathon/3d/computer.glb",
  cpu: "https://ganesh369-programmer.github.io/Digital-Brain-Hackathon/3d/cpu1.glb",
  ram: "https://ganesh369-programmer.github.io/Digital-Brain-Hackathon/3d/ram.glb",
  gpu: "https://ganesh369-programmer.github.io/Digital-Brain-Hackathon/3d/gpu.glb",
  storage: "https://ganesh369-programmer.github.io/Digital-Brain-Hackathon/3d/storage1.glb",
};

// ─────────────────────────────────────────────────────────────────
// Enhanced ModelViewer — with full mouse interaction controls
// ─────────────────────────────────────────────────────────────────
function ModelViewer({ src, glowColor = "#00ffc8", badge = null, label = "model" }) {
  const mountRef = useRef(null);
  const ctxRef = useRef({});
  const [status, setStatus] = useState("loading");
  const [loadPct, setLoadPct] = useState(0);
  const [autoRotate, setAutoRotate] = useState(true);
  const [showControls, setShowControls] = useState(false);

  // Debug: Log the src path to verify it's correct
  useEffect(() => {
    console.log(`Loading model for ${label}: ${src}`);
  }, [src, label]);

  const initThree = useCallback(() => {
    const THREE = window.THREE;
    const GLTFLoader = window.THREE.GLTFLoader;
    const mount = mountRef.current;
    
    if (!THREE || !GLTFLoader || !mount) { 
      setStatus("error"); 
      return; 
    }

    const W = mount.clientWidth || 340;
    const H = mount.clientHeight || 340;

    // Cleanup any existing renderer
    if (ctxRef.current.renderer) {
      ctxRef.current.renderer.dispose();
      if (mount.contains(ctxRef.current.renderer.domElement)) {
        mount.removeChild(ctxRef.current.renderer.domElement);
      }
    }

    // ── Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    // ── Scene / Camera
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 1000);
    camera.position.set(0, 0.5, 4);
    camera.lookAt(0, 0, 0);

    // ── Controls State
    let targetRotation = { x: 0, y: 0 };
    let currentRotation = { x: 0, y: 0 };
    let targetPan = { x: 0, y: 0 };
    let currentPan = { x: 0, y: 0 };
    let targetZoom = 4;
    let currentZoom = 4;
    let isDragging = false;
    let isRightDragging = false;
    let lastMouseX = 0;
    let lastMouseY = 0;
    let autoRotateSpeed = 0.005;

    // ── Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const hexInt = parseInt(glowColor.replace("#", ""), 16);
    
    const mainLight = new THREE.DirectionalLight(0xffffff, 1.2);
    mainLight.position.set(2, 3, 4);
    scene.add(mainLight);
    
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.5);
    fillLight.position.set(-2, 1, 2);
    scene.add(fillLight);
    
    const backLight = new THREE.DirectionalLight(0xffffff, 0.4);
    backLight.position.set(0, 0, -3);
    scene.add(backLight);
    
    const rimLight = new THREE.PointLight(hexInt, 0.8, 8);
    rimLight.position.set(1, 1, -2);
    scene.add(rimLight);
    
    const keyLight = new THREE.PointLight(hexInt, 1.2, 10);
    keyLight.position.set(2, 2, 2);
    scene.add(keyLight);

    // ── Load GLB with better error handling
    const loader = new GLTFLoader();
    
    // Add a timeout to detect if loading is taking too long
    const loadingTimeout = setTimeout(() => {
      if (status === "loading") {
        console.warn(`Model ${label} is taking too long to load, check if file exists at: ${src}`);
      }
    }, 10000);
    
    loader.load(
      src,
      (gltf) => {
        clearTimeout(loadingTimeout);
        const model = gltf.scene;
        
        // Auto-fit: centre + scale to ~2.2 unit cube
        const box = new THREE.Box3().setFromObject(model);
        const size = new THREE.Vector3();
        box.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 2.2 / maxDim;
        model.scale.setScalar(scale);
        
        const center = new THREE.Vector3();
        box.getCenter(center);
        model.position.x = -center.x * scale;
        model.position.y = -center.y * scale;
        model.position.z = -center.z * scale;

        // Improve material quality
        model.traverse(child => {
          if (child.isMesh) {
            if (child.material) {
              const mats = Array.isArray(child.material) ? child.material : [child.material];
              mats.forEach(m => {
                if (m.roughness !== undefined) m.roughness = Math.min(m.roughness, 0.3);
                if (m.metalness !== undefined) m.metalness = Math.max(m.metalness, 0.8);
                m.envMapIntensity = 1.5;
              });
            }
          }
        });

        scene.add(model);
        ctxRef.current.model = model;
        setStatus("ok");
        console.log(`✅ Model loaded successfully: ${label}`);
      },
      (xhr) => {
        if (xhr.total) {
          const percentage = Math.round((xhr.loaded / xhr.total) * 100);
          setLoadPct(percentage);
          if (percentage === 100) {
            console.log(`Model ${label} loading: ${percentage}%`);
          }
        }
      },
      (error) => {
        clearTimeout(loadingTimeout);
        console.error(`❌ Error loading model ${label} from ${src}:`, error);
        setStatus("error");
      }
    );

    // ── Mouse Event Handlers
    const onMouseDown = (e) => {
      e.preventDefault();
      if (e.button === 0) {
        isDragging = true;
        setAutoRotate(false);
      } else if (e.button === 2) {
        isRightDragging = true;
        setAutoRotate(false);
      }
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
      mount.style.cursor = 'grabbing';
    };

    const onMouseMove = (e) => {
      if (!isDragging && !isRightDragging) return;
      
      const deltaX = e.clientX - lastMouseX;
      const deltaY = e.clientY - lastMouseY;
      
      if (isDragging) {
        targetRotation.y += deltaX * 0.008;
        targetRotation.x += deltaY * 0.008;
        targetRotation.x = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, targetRotation.x));
      } else if (isRightDragging) {
        targetPan.x += deltaX * 0.01;
        targetPan.y -= deltaY * 0.01;
        targetPan.x = Math.max(-1.5, Math.min(1.5, targetPan.x));
        targetPan.y = Math.max(-1, Math.min(1, targetPan.y));
      }
      
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
    };

    const onMouseUp = () => {
      isDragging = false;
      isRightDragging = false;
      mount.style.cursor = 'grab';
    };

    const onWheel = (e) => {
      e.preventDefault();
      targetZoom -= e.deltaY * 0.005;
      targetZoom = Math.max(2, Math.min(8, targetZoom));
      setAutoRotate(false);
    };

    const onDoubleClick = () => {
      targetRotation = { x: 0, y: 0 };
      targetPan = { x: 0, y: 0 };
      targetZoom = 4;
      setAutoRotate(true);
    };

    const onMouseEnter = () => {
      setShowControls(true);
    };

    const onMouseLeave = () => {
      setShowControls(false);
      isDragging = false;
      isRightDragging = false;
      mount.style.cursor = 'grab';
    };

    const onContextMenu = (e) => {
      e.preventDefault();
      return false;
    };

    mount.addEventListener("mousedown", onMouseDown);
    mount.addEventListener("mousemove", onMouseMove);
    mount.addEventListener("mouseup", onMouseUp);
    mount.addEventListener("wheel", onWheel);
    mount.addEventListener("dblclick", onDoubleClick);
    mount.addEventListener("mouseenter", onMouseEnter);
    mount.addEventListener("mouseleave", onMouseLeave);
    mount.addEventListener("contextmenu", onContextMenu);
    mount.style.cursor = 'grab';

    // ── Resize
    const onResize = () => {
      const nW = mount.clientWidth;
      const nH = mount.clientHeight;
      if (nW && nH) {
        renderer.setSize(nW, nH);
        camera.aspect = nW / nH;
        camera.updateProjectionMatrix();
      }
    };
    
    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(mount);
    window.addEventListener("resize", onResize);

    // ── Animate Lights
    let time = 0;
    
    // ── Render loop
    let frameId;
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      time += 0.016;
      
      currentRotation.x += (targetRotation.x - currentRotation.x) * 0.1;
      currentRotation.y += (targetRotation.y - currentRotation.y) * 0.1;
      currentPan.x += (targetPan.x - currentPan.x) * 0.1;
      currentPan.y += (targetPan.y - currentPan.y) * 0.1;
      currentZoom += (targetZoom - currentZoom) * 0.1;
      
      camera.position.x = currentPan.x;
      camera.position.y = 0.5 + currentPan.y;
      camera.position.z = currentZoom;
      camera.lookAt(currentPan.x, 0.2 + currentPan.y * 0.5, 0);
      
      const m = ctxRef.current.model;
      if (m && status === "ok") {
        if (autoRotate && !isDragging && !isRightDragging) {
          targetRotation.y += autoRotateSpeed;
        }
        
        m.rotation.x = currentRotation.x;
        m.rotation.y = currentRotation.y;
        
        if (!isDragging && !isRightDragging && autoRotate) {
          m.position.y = Math.sin(time * 1.5) * 0.03;
        } else {
          m.position.y = 0;
        }
      }
      
      keyLight.position.x = Math.sin(time * 0.6) * 1.8;
      keyLight.position.z = Math.cos(time * 0.6) * 1.8 + 1;
      rimLight.intensity = 0.8 + Math.sin(time * 1.2) * 0.3;
      
      renderer.render(scene, camera);
    };
    animate();

    ctxRef.current.cleanup = () => {
      if (frameId) cancelAnimationFrame(frameId);
      window.removeEventListener("resize", onResize);
      resizeObserver.disconnect();
      mount.removeEventListener("mousedown", onMouseDown);
      mount.removeEventListener("mousemove", onMouseMove);
      mount.removeEventListener("mouseup", onMouseUp);
      mount.removeEventListener("wheel", onWheel);
      mount.removeEventListener("dblclick", onDoubleClick);
      mount.removeEventListener("mouseenter", onMouseEnter);
      mount.removeEventListener("mouseleave", onMouseLeave);
      mount.removeEventListener("contextmenu", onContextMenu);
      if (renderer) renderer.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
  }, [src, glowColor, status, label, autoRotate]);

  // ── Load Three.js r128 + GLTFLoader from CDN, then init
  useEffect(() => {
    let mounted = true;
    
    const loadScript = (id, url) => new Promise((resolve, reject) => {
      if (document.getElementById(id)) { 
        resolve(); 
        return; 
      }
      const s = document.createElement("script");
      s.id = id;
      s.src = url;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });

    const init = async () => {
      try {
        await loadScript(
          "three-r128",
          "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"
        );
        
        await loadScript(
          "three-gltf-r128",
          "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js"
        );
        
        await new Promise(resolve => setTimeout(resolve, 100));
        
        if (!mounted) return;
        
        if (!window.THREE || !window.THREE.GLTFLoader) {
          console.error("GLTFLoader not available");
          setStatus("error");
          return;
        }
        
        initThree();
      } catch (error) {
        console.error("Failed to load Three.js:", error);
        if (mounted) setStatus("error");
      }
    };
    
    init();

    return () => {
      mounted = false;
      if (ctxRef.current.cleanup) {
        ctxRef.current.cleanup();
      }
    };
  }, [initThree]);

  // Derive rgba string for CSS variables
  const rgb = (glowColor.replace("#","").match(/.{2}/g) || ["00","ff","c8"])
    .map(h => parseInt(h, 16)).join(",");

  return (
    <div className="mv-outer" style={{ "--glow": glowColor, "--glow-rgb": rgb }}>
      <div className="mv-grid" />
      <div className="mv-glow-ring" />
      <div ref={mountRef} className="mv-mount" />
      <div className="mv-scanlines" />
      {["tl","tr","bl","br"].map(c => (
        <div key={c} className={`mv-corner mv-corner-${c}`} />
      ))}

      {status === "ok" && showControls && (
        <div className="mv-control-panel">
          <button 
            className={`mv-control-btn ${autoRotate ? 'active' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              setAutoRotate(!autoRotate);
            }}
            title={autoRotate ? "Disable Auto-rotate" : "Enable Auto-rotate"}
          >
            ⟳
          </button>
          <button 
            className="mv-control-btn"
            onClick={(e) => {
              e.stopPropagation();
              const event = new Event('dblclick');
              mountRef.current?.dispatchEvent(event);
            }}
            title="Reset View"
          >
            ⌂
          </button>
        </div>
      )}

      {status === "ok" && showControls && (
        <div className="mv-controls-hint">
          
          <span>⚡ Double-click to reset</span>
        </div>
      )}

      {status === "loading" && (
        <div className="mv-overlay">
          <div className="mv-spinner" />
          <div className="mv-pct" style={{ color: glowColor }}>
            {loadPct > 0 ? `${loadPct}%` : "Loading 3D…"}
          </div>
          {loadPct > 0 && (
            <div className="mv-progress-track">
              <div className="mv-progress-bar" style={{ width: `${loadPct}%`, background: glowColor }} />
            </div>
          )}
        </div>
      )}

      {status === "error" && (
        <div className="mv-overlay mv-placeholder">
          <div className="mv-ph-icon" style={{ color: glowColor }}>⬡</div>
          <div className="mv-ph-title">3D Model Not Found</div>
          <code className="mv-ph-path" style={{ color: glowColor }}>
            {src}
          </code>
          <div className="mv-ph-hint">Place your {label}.glb file in public/3d/ folder</div>
          <div className="mv-ph-hint">Check browser console for details</div>
        </div>
      )}

      {badge && status === "ok" && (
        <div className="mv-badge"
          style={{ color: glowColor, borderColor: `rgba(${rgb},0.45)` }}>
          {badge}
        </div>
      )}
    </div>
  );
}

// ── Custom Cursor ─────────────────────────────────────────────────
function Cursor() {
  const dot = useRef(null);
  const ring = useRef(null);
  useEffect(() => {
    let mx = 0, my = 0, rx = 0, ry = 0, raf;
    const move = e => { mx = e.clientX; my = e.clientY; };
    window.addEventListener("mousemove", move);
    const loop = () => {
      rx += (mx - rx) * 0.12;
      ry += (my - ry) * 0.12;
      if (dot.current) dot.current.style.transform = `translate(${mx - 4}px,${my - 4}px)`;
      if (ring.current) ring.current.style.transform = `translate(${rx - 20}px,${ry - 20}px)`;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      window.removeEventListener("mousemove", move);
      cancelAnimationFrame(raf);
    };
  }, []);
  return (
    <>
      <div ref={dot} className="cursor-dot" />
      <div ref={ring} className="cursor-ring" />
    </>
  );
}

// ── Loader ────────────────────────────────────────────────────────
function Loader({ onDone }) {
  const bar = useRef(null);
  const txt = useRef(null);
  const wrap = useRef(null);
  useEffect(() => {
    const g = window.gsap;
    if (!g) {
      setTimeout(onDone, 1400);
      return;
    }
    g.timeline({ onComplete: onDone })
      .to(bar.current, { width: "100%", duration: 1.6, ease: "power3.inOut" })
      .to(txt.current, { opacity: 0, duration: 0.3 }, "-=0.2")
      .to(wrap.current, { yPercent: -100, duration: 0.8, ease: "power4.inOut" });
  }, [onDone]);
  return (
    <div ref={wrap} className="loader-wrap">
      <div ref={txt} className="loader-label">
        Booting Digital Brain<span className="loader-dots">...</span>
      </div>
      <div className="loader-track"><div ref={bar} className="loader-bar" /></div>
    </div>
  );
}

// ── Particles ─────────────────────────────────────────────────────
function Particles() {
  const canvas = useRef(null);
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;

    const ctx = c.getContext("2d");
    let W = window.innerWidth;
    let H = window.innerHeight;

    const resize = () => {
      W = window.innerWidth;
      H = window.innerHeight;
      c.width = W;
      c.height = H;
    };
    resize();

    window.addEventListener("resize", resize);

    const pts = Array.from({ length: 120 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - .5) * .4,
      vy: (Math.random() - .5) * .4,
      r: Math.random() * 1.5 + .5
    }));

    let raf;
    const draw = () => {
      if (!ctx) return;
      ctx.clearRect(0, 0, W, H);
      pts.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = W;
        if (p.x > W) p.x = 0;
        if (p.y < 0) p.y = H;
        if (p.y > H) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(0,255,200,.6)";
        ctx.fill();
      });

      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const dx = pts[i].x - pts[j].x,
            dy = pts[i].y - pts[j].y,
            d = Math.hypot(dx, dy);
          if (d < 100) {
            ctx.beginPath();
            ctx.moveTo(pts[i].x, pts[i].y);
            ctx.lineTo(pts[j].x, pts[j].y);
            ctx.strokeStyle = `rgba(0,255,200,${.15 * (1 - d / 100)})`;
            ctx.lineWidth = .5;
            ctx.stroke();
          }
        }
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(raf);
    };
  }, []);
  return <canvas ref={canvas} className="particles-canvas" />;
}

// ── CPU Visual ────────────────────────────────────────────────────
function CPUVisual() {
  return (
    <div className="cpu-grid">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="cpu-core" style={{ animationDelay: `${i * .18}s` }}>
          <div className="cpu-core-inner"><span className="cpu-core-label">C{i}</span></div>
          <div className="cpu-pulse" style={{ animationDelay: `${i * .18}s` }} />
        </div>
      ))}
      <div className="cpu-bus">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="cpu-bus-packet" style={{ animationDelay: `${i * .3}s` }} />
        ))}
      </div>
    </div>
  );
}

// ── RAM Visual ────────────────────────────────────────────────────
function RAMVisual() {
  const slots = [
    { label: "Chrome", size: "2.1 GB", color: "#00ffc8" },
    { label: "VS Code", size: "512 MB", color: "#7b61ff" },
    { label: "Slack", size: "380 MB", color: "#ff6b6b" },
    { label: "Docker", size: "1.4 GB", color: "#ffd166" },
    { label: "Node.js", size: "128 MB", color: "#06d6a0" },
    { label: "Figma", size: "650 MB", color: "#ef476f" },
  ];
  const [active, setActive] = useState(null);
  return (
    <div className="ram-grid">
      {slots.map((s, i) => (
        <div key={i}
          className={`ram-card ${active === i ? "ram-card-active" : ""}`}
          style={{ "--card-color": s.color, animationDelay: `${i * .12}s` }}
          onClick={() => setActive(active === i ? null : i)}>
          <div className="ram-card-bar" />
          <div className="ram-card-label">{s.label}</div>
          <div className="ram-card-size">{s.size}</div>
          {active === i && <div className="ram-card-badge">ACTIVE</div>}
        </div>
      ))}
    </div>
  );
}

// ── GPU Visual ────────────────────────────────────────────────────
function GPUVisual() {
  const canvas = useRef(null);
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    c.width = 480; c.height = 280; let t = 0, raf;
    const cols = [[139, 92, 246], [59, 130, 246], [16, 185, 129], [245, 158, 11]];
    const pts = [{ x: .2, y: .3 }, { x: .8, y: .2 }, { x: .6, y: .8 }, { x: .1, y: .7 }];
    const draw = () => {
      const W = c.width, H = c.height;
      ctx.clearRect(0, 0, W, H);
      pts.forEach((p, i) => {
        const ox = Math.sin(t * .7 + i * 1.3) * .12, oy = Math.cos(t * .5 + i * .9) * .12;
        const gx = (p.x + ox) * W, gy = (p.y + oy) * H;
        const gr = ctx.createRadialGradient(gx, gy, 0, gx, gy, 190);
        const [r, g2, b] = cols[i];
        gr.addColorStop(0, `rgba(${r},${g2},${b},.55)`);
        gr.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = gr;
        ctx.fillRect(0, 0, W, H);
      });
      for (let y = 0; y < c.height; y += 4) {
        ctx.fillStyle = "rgba(0,0,0,.06)";
        ctx.fillRect(0, y, W, 2);
      }
      t += .012;
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div className="gpu-canvas-wrap">
      <canvas ref={canvas} className="gpu-canvas" />
      <div className="gpu-label-top">RENDER PIPELINE ACTIVE</div>
      <div className="gpu-stats">
        <div className="gpu-stat"><span>FPS</span><b>144</b></div>
        <div className="gpu-stat"><span>VRAM</span><b>8 GB</b></div>
        <div className="gpu-stat"><span>CORES</span><b>4096</b></div>
      </div>
    </div>
  );
}

// ── Storage Visual ────────────────────────────────────────────────
function StorageVisual() {
  const [hov, setHov] = useState(null);
  const files = [
    { name: "system.bin", size: "4.2 GB", type: "SYS" },
    { name: "media.vault", size: "120 GB", type: "DATA" },
    { name: "kernel.img", size: "512 MB", type: "OS" },
    { name: "user_data", size: "85 GB", type: "USR" },
    { name: "cache.tmp", size: "2.1 GB", type: "TMP" },
  ];
  return (
    <div className="storage-wrap">
      <div className="storage-disk">
        <div className="storage-disk-ring" />
        <div className="storage-disk-ring storage-disk-ring-2" />
        <div className="storage-disk-center">NVMe</div>
      </div>
      <div className="storage-files">
        {files.map((f, i) => (
          <div key={i}
            className={`storage-file ${hov === i ? "storage-file-hover" : ""}`}
            style={{ animationDelay: `${i * .1}s` }}
            onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(null)}>
            <span className="storage-file-type">{f.type}</span>
            <span className="storage-file-name">{f.name}</span>
            <span className="storage-file-size">{f.size}</span>
            <div className="storage-file-bar">
              <div className="storage-file-fill"
                style={{ width: `${clamp(parseInt(f.size) / 2, 20, 95)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Network Visual ────────────────────────────────────────────────
function NetworkVisual() {
  const canvas = useRef(null);
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    c.width = 560; c.height = 290;
    const W = c.width, H = c.height;
    const nodes = [
      { x: 75, y: 145, label: "CLIENT" }, { x: 200, y: 72, label: "DNS" },
      { x: 200, y: 218, label: "FW" }, { x: 350, y: 145, label: "SERVER" },
      { x: 490, y: 72, label: "CDN" }, { x: 490, y: 218, label: "DB" },
    ];
    const edges = [[0, 1], [0, 2], [1, 3], [2, 3], [3, 4], [3, 5]];
    const pkts = edges.map(([a, b]) => ({ a, b, t: Math.random(), spd: .003 + Math.random() * .003 }));
    let raf;
    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      edges.forEach(([a, b]) => {
        ctx.beginPath();
        ctx.moveTo(nodes[a].x, nodes[a].y);
        ctx.lineTo(nodes[b].x, nodes[b].y);
        ctx.strokeStyle = "rgba(0,200,255,.18)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });
      pkts.forEach(p => {
        p.t += p.spd;
        if (p.t > 1) p.t = 0;
        const na = nodes[p.a], nb = nodes[p.b];
        const px = na.x + (nb.x - na.x) * p.t, py = na.y + (nb.y - na.y) * p.t;
        ctx.beginPath();
        ctx.arc(px, py, 4, 0, Math.PI * 2);
        ctx.fillStyle = "#00c8ff";
        ctx.shadowBlur = 10;
        ctx.shadowColor = "#00c8ff";
        ctx.fill();
        ctx.shadowBlur = 0;
      });
      nodes.forEach(n => {
        ctx.beginPath();
        ctx.arc(n.x, n.y, 14, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(0,200,255,.12)";
        ctx.strokeStyle = "rgba(0,200,255,.7)";
        ctx.lineWidth = 2;
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#00c8ff";
        ctx.font = "bold 8px monospace";
        ctx.textAlign = "center";
        ctx.fillText(n.label, n.x, n.y + 3);
      });
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={canvas} className="network-canvas" />;
}

// ── Neural Visual ─────────────────────────────────────────────────
function NeuralVisual() {
  const canvas = useRef(null);
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    c.width = 560; c.height = 300;
    const W = c.width, H = c.height;
    const layers = [3, 5, 5, 3];
    const np = [];
    layers.forEach((cnt, li) => {
      const x = (li + 1) * W / (layers.length + 1);
      np.push(Array.from({ length: cnt }, (_, ni) => ({ x, y: (ni + 1) * H / (cnt + 1) })));
    });
    let t = 0, raf;
    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      for (let li = 0; li < layers.length - 1; li++) {
        np[li].forEach(a => {
          np[li + 1].forEach(b => {
            const pulse = (Math.sin(t * 2 + a.x * .01 + b.y * .01) + 1) / 2;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = `rgba(139,92,246,${.08 + pulse * .18})`;
            ctx.lineWidth = .8;
            ctx.stroke();
          });
        });
      }
      np.forEach(layer => layer.forEach(n => {
        const glow = (Math.sin(t * 1.5 + n.y * .02) + 1) / 2;
        const r = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, 14);
        r.addColorStop(0, `rgba(167,139,250,${.7 + glow * .3})`);
        r.addColorStop(1, "rgba(139,92,246,0)");
        ctx.beginPath();
        ctx.arc(n.x, n.y, 8 + glow * 4, 0, Math.PI * 2);
        ctx.fillStyle = r;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(n.x, n.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = "#a78bfa";
        ctx.fill();
      }));
      t += .015;
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={canvas} className="neural-canvas" />;
}

// ── Scroll Arrow ──────────────────────────────────────────────────
function ScrollArrow() {
  return (
    <div className="scroll-arrow">
      <div className="scroll-arrow-line" />
      <div className="scroll-arrow-chevron" />
      <span className="scroll-arrow-text">SCROLL</span>
    </div>
  );
}

// ── Section wrapper ───────────────────────────────────────────────
function Section({ id, children, className = "" }) {
  return <section id={id} className={`section ${className}`}>{children}</section>;
}

// ── Main App ──────────────────────────────────────────────────────
export default function App() {
  const [loaded, setLoaded] = useState(false);
  const [gsapLoaded, setGsapLoaded] = useState(false);

  // Log the model paths for debugging
  useEffect(() => {
    console.log('Model paths:', GLB);
  }, []);

  // Load GSAP from CDN
  useEffect(() => {
    const loadScript = (src) => {
      return new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    };

    (async () => {
      try {
        await loadScript("https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js");
        await loadScript("https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js");
        if (window.gsap && window.ScrollTrigger) {
          window.gsap.registerPlugin(window.ScrollTrigger);
          setGsapLoaded(true);
        }
      } catch (error) {
        console.error("Failed to load GSAP:", error);
        setGsapLoaded(true);
      }
    })();
  }, []);

  // GSAP scroll animations (after site loads)
  useEffect(() => {
    if (!loaded || !gsapLoaded) return;
    const g = window.gsap;
    const ST = window.ScrollTrigger;
    if (!g || !ST) return;

    setTimeout(() => {
      g.utils.toArray(".reveal").forEach(el => {
        g.fromTo(el, { opacity: 0, y: 50 }, {
          opacity: 1, y: 0, duration: .9, ease: "power3.out",
          scrollTrigger: { trigger: el, start: "top 85%", toggleActions: "play none none none" }
        });
      });

      g.to(".hero-tagline", {
        yPercent: 30, ease: "none",
        scrollTrigger: { trigger: "#hero", start: "top top", end: "bottom top", scrub: true }
      });

      g.utils.toArray(".section-heading").forEach(el => {
        g.fromTo(el, { clipPath: "inset(0 100% 0 0)" }, {
          clipPath: "inset(0 0% 0 0)", duration: 1, ease: "power4.out",
          scrollTrigger: { trigger: el, start: "top 80%" }
        });
      });
    }, 100);

    return () => ST.getAll().forEach(t => t.kill());
  }, [loaded, gsapLoaded]);

  return (
    <>
      <style>{CSS}</style>
      {!loaded && <Loader onDone={() => setLoaded(true)} />}
      {loaded && (
        <>
          <Cursor />

          <nav className="nav">
            <div className="nav-logo">⬡ DIGIBRAIN</div>
            <div className="nav-links">
              {["cpu", "ram", "gpu", "storage", "network", "future"].map(id => (
                <a key={id} href={`#${id}`} className="nav-link">{id.toUpperCase()}</a>
              ))}
            </div>
          </nav>

          {/* ── HERO */}
          <Section id="hero" className="hero-section">
            <Particles />
            <div className="hero-content">
              <div className="hero-eyebrow reveal">INTERACTIVE EXPERIENCE</div>
              <h1 className="hero-heading reveal">
                Enter the<br /><span className="hero-accent">Digital Brain</span>
              </h1>
              <p className="hero-tagline reveal">
                An immersive journey through the architecture of modern computing
              </p>
              <a href="#intro" className="hero-cta reveal">Begin Journey</a>
            </div>
            <ScrollArrow />
          </Section>

          {/* ── INTRO */}
          <Section id="intro" className="intro-section">
            <div className="intro-inner">
              <div className="intro-text">
                <div className="section-eyebrow reveal">CHAPTER 01</div>
                <h2 className="section-heading reveal">What is a Computer?</h2>
                <p className="intro-body reveal">
                  At its core, a computer is a system of interconnected components
                  working in perfect harmony. Billions of transistors firing at nanosecond
                  intervals, transforming electrical signals into the digital world you
                  experience every day.
                </p>
                <p className="intro-body reveal">
                  Every click, every render, every calculation — an orchestra of silicon
                  and light performing the impossible, billions of times per second.
                </p>
              </div>
              <div className="intro-visual reveal">
                <ModelViewer
                  src={GLB.computer}
                  glowColor="#00ffc8"
                  badge="3D · COMPUTER"
                  label="computer"
                />
              </div>
            </div>
          </Section>

          {/* ── CPU */}
          <Section id="cpu" className="cpu-section">
            <div className="section-inner">
              <div className="section-eyebrow reveal">CHAPTER 02</div>
              <h2 className="section-heading reveal">The CPU — Digital Brain</h2>
              <p className="section-body reveal">
                The Central Processing Unit executes billions of instructions per second,
                orchestrating every operation across the system. Each core runs
                independently yet in parallel, a symphony of logical precision.
              </p>
              <div className="two-col reveal">
                <CPUVisual />
                <ModelViewer
                  src={GLB.cpu}
                  glowColor="#00ffc8"
                  badge="3D · CPU"
                  label="cpu"
                />
              </div>
              <div className="cpu-stats reveal">
                {[["3.9 GHz", "Clock Speed"], ["16 MB", "L3 Cache"],
                ["8 Cores", "16 Threads"], ["5 nm", "Process"]].map(([v, l]) => (
                  <div key={l} className="stat-card"><b>{v}</b><span>{l}</span></div>
                ))}
              </div>
            </div>
          </Section>

          {/* ── RAM */}
          <Section id="ram" className="ram-section">
            <div className="section-inner">
              <div className="section-eyebrow reveal">CHAPTER 03</div>
              <h2 className="section-heading reveal">RAM — Working Memory</h2>
              <p className="section-body reveal">
                Random Access Memory holds the data your CPU actively uses. Fast,
                volatile, and temporary — every running process claims its slice of
                this precious space. Click a card to activate it.
              </p>
              <div className="two-col reveal">
                <ModelViewer
                  src={GLB.ram}
                  glowColor="#7b61ff"
                  badge="3D · DDR5 32GB"
                  label="ram"
                />
                <RAMVisual />
              </div>
            </div>
          </Section>

          {/* ── GPU */}
          <Section id="gpu" className="gpu-section">
            <div className="section-inner">
              <div className="section-eyebrow reveal">CHAPTER 04</div>
              <h2 className="section-heading reveal">GPU — The Renderer</h2>
              <p className="section-body reveal">
                Where mathematics becomes light. The GPU's thousands of shader cores
                transform abstract geometry and pixel data into vivid images — frame
                after frame, at lightning speed.
              </p>
              <div className="two-col reveal">
                <GPUVisual />
                <ModelViewer
                  src={GLB.gpu}
                  glowColor="#a855f7"
                  badge="3D · RTX 4090"
                  label="gpu"
                />
              </div>
            </div>
          </Section>

          {/* ── STORAGE */}
          <Section id="storage" className="storage-section">
            <div className="section-inner">
              <div className="section-eyebrow reveal">CHAPTER 05</div>
              <h2 className="section-heading reveal">Storage — The Vault</h2>
              <p className="section-body reveal">
                Persistent memory that survives power loss. From spinning magnetic
                platters to NVMe SSDs reading at 7,000 MB/s — storage is the
                long-term memory of your digital life.
              </p>
              <div className="two-col reveal">
                <ModelViewer
                  src={GLB.storage}
                  glowColor="#00c8ff"
                  badge="3D · NVMe 2TB"
                  label="storage"
                />
                <StorageVisual />
              </div>
            </div>
          </Section>

          {/* ── NETWORK */}
          <Section id="network" className="network-section">
            <div className="section-inner">
              <div className="section-eyebrow reveal">CHAPTER 06</div>
              <h2 className="section-heading reveal">Network — The Nervous System</h2>
              <p className="section-body reveal">
                Data packets traveling at the speed of light through fiber optic cables,
                routers and switches, across continents — connecting billions of devices
                into a single, living digital organism.
              </p>
              <div className="reveal"><NetworkVisual /></div>
            </div>
          </Section>

          {/* ── FUTURE */}
          <Section id="future" className="future-section">
            <div className="section-inner">
              <div className="section-eyebrow reveal">CHAPTER 07</div>
              <h2 className="section-heading reveal">Future — Neural Computing</h2>
              <p className="section-body reveal">
                Neuromorphic chips, quantum processors, and artificial neural networks
                are redefining what computation means. The next generation will think,
                learn, and adapt — blurring the line between silicon and mind.
              </p>
              <div className="reveal"><NeuralVisual /></div>
              <div className="future-tags reveal">
                {["Quantum", "Neuromorphic", "Edge AI", "Photonic", "DNA Storage"].map(t => (
                  <span key={t} className="future-tag">{t}</span>
                ))}
              </div>
            </div>
          </Section>

          {/* ── CONCLUSION */}
          <Section id="conclusion" className="conclusion-section">
            <div className="conclusion-inner">
              <div className="section-eyebrow reveal">THE END</div>
              <h2 className="conclusion-heading reveal">
                You've Traveled<br /><span className="hero-accent">The Digital Universe</span>
              </h2>
              <p className="conclusion-body reveal">
                From the CPU's lightning logic to the future's neural frontiers —
                every component you explored is working right now, powering the
                screen you're reading this on.
              </p>
              <div className="conclusion-actions reveal">
                <button className="btn-primary"
                  onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
                  Restart Journey
                </button>
                <a href="https://en.wikipedia.org/wiki/Computer_hardware"
                  target="_blank" rel="noreferrer" className="btn-secondary">
                  Learn More
                </a>
              </div>
            </div>
            <div className="conclusion-glow" />
          </Section>
        </>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────
// INLINE CSS (Same as before - keeping it for brevity)
// ─────────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Syne:wght@400;600;700;800&display=swap');

*, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }

:root {
  --bg:#050810; --bg2:#080d1a;
  --cyan:#00ffc8; --blue:#00c8ff; --purple:#7b61ff;
  --text:#e2e8f0; --muted:#64748b;
  --border:rgba(255,255,255,0.07); --glass:rgba(255,255,255,0.04);
}

html { scroll-behavior:smooth; }
body { background:var(--bg); color:var(--text); font-family:'Syne',sans-serif; overflow-x:hidden; cursor:none; }

/* CURSOR */
.cursor-dot  { position:fixed; width:8px; height:8px; background:var(--cyan); border-radius:50%; pointer-events:none; z-index:9999; box-shadow:0 0 10px var(--cyan); }
.cursor-ring { position:fixed; width:40px; height:40px; border:1.5px solid rgba(0,255,200,.4); border-radius:50%; pointer-events:none; z-index:9998; }

/* LOADER */
.loader-wrap  { position:fixed; inset:0; background:var(--bg); display:flex; flex-direction:column; align-items:center; justify-content:center; z-index:99999; gap:24px; }
.loader-label { font-family:'Space Mono',monospace; font-size:14px; color:var(--cyan); letter-spacing:.1em; }
.loader-dots  { animation:blink 1s infinite; }
@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
.loader-track { width:300px; height:2px; background:rgba(255,255,255,.08); border-radius:2px; overflow:hidden; }
.loader-bar   { height:100%; width:0; background:linear-gradient(90deg,var(--cyan),var(--blue)); box-shadow:0 0 12px var(--cyan); }

/* NAV */
.nav { position:fixed; top:0; left:0; right:0; display:flex; align-items:center; justify-content:space-between; padding:20px 48px; z-index:100; background:linear-gradient(to bottom,rgba(5,8,16,.9),transparent); backdrop-filter:blur(4px); }
.nav-logo  { font-family:'Space Mono',monospace; font-size:14px; color:var(--cyan); letter-spacing:.15em; font-weight:700; }
.nav-links { display:flex; gap:32px; }
.nav-link  { font-family:'Space Mono',monospace; font-size:10px; color:var(--muted); text-decoration:none; letter-spacing:.2em; transition:color .2s; }
.nav-link:hover { color:var(--cyan); }

/* PARTICLES */
.particles-canvas { position:absolute; inset:0; width:100%; height:100%; pointer-events:none; }

/* SECTION BASE */
.section { min-height:100vh; position:relative; display:flex; align-items:center; justify-content:center; padding:120px 48px 80px; }
.section-inner { max-width:1020px; width:100%; display:flex; flex-direction:column; gap:32px; align-items:center; text-align:center; }
.section-eyebrow { font-family:'Space Mono',monospace; font-size:11px; letter-spacing:.3em; color:var(--cyan); text-transform:uppercase; }
.section-heading  { font-size:clamp(32px,5vw,56px); font-weight:800; line-height:1.1; color:#fff; overflow:hidden; }
.section-body     { font-size:17px; line-height:1.8; color:var(--muted); max-width:640px; }

/* HERO */
.hero-section  { flex-direction:column; gap:0; overflow:hidden; }
.hero-content  { position:relative; z-index:2; display:flex; flex-direction:column; align-items:center; text-align:center; gap:24px; }
.hero-eyebrow  { font-family:'Space Mono',monospace; font-size:11px; letter-spacing:.4em; color:var(--cyan); border:1px solid rgba(0,255,200,.25); padding:6px 18px; border-radius:100px; }
.hero-heading  { font-size:clamp(48px,8vw,100px); font-weight:800; line-height:1.0; color:#fff; }
.hero-accent   { background:linear-gradient(135deg,var(--cyan) 0%,var(--blue) 50%,var(--purple) 100%); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
.hero-tagline  { font-size:18px; color:var(--muted); max-width:480px; line-height:1.7; }
.hero-cta      { display:inline-block; padding:14px 40px; background:linear-gradient(135deg,var(--cyan),var(--blue)); color:#000; font-weight:700; font-size:13px; letter-spacing:.15em; text-decoration:none; border-radius:4px; transition:transform .2s,box-shadow .2s; box-shadow:0 0 32px rgba(0,255,200,.25); }
.hero-cta:hover { transform:translateY(-2px); box-shadow:0 0 48px rgba(0,255,200,.4); }

/* SCROLL ARROW */
.scroll-arrow { position:absolute; bottom:40px; left:50%; transform:translateX(-50%); display:flex; flex-direction:column; align-items:center; gap:6px; z-index:2; animation:floatY 2s ease-in-out infinite; }
@keyframes floatY { 0%,100%{transform:translateX(-50%) translateY(0)} 50%{transform:translateX(-50%) translateY(8px)} }
.scroll-arrow-line    { width:1px; height:40px; background:linear-gradient(to bottom,transparent,var(--cyan)); }
.scroll-arrow-chevron { width:8px; height:8px; border-right:1.5px solid var(--cyan); border-bottom:1.5px solid var(--cyan); transform:rotate(45deg); margin-top:-4px; }
.scroll-arrow-text    { font-family:'Space Mono',monospace; font-size:9px; letter-spacing:.3em; color:var(--muted); }

/* INTRO */
.intro-section { background:var(--bg2); }
.intro-inner   { display:grid; grid-template-columns:1fr 1fr; gap:64px; max-width:1100px; width:100%; align-items:center; }
.intro-text    { display:flex; flex-direction:column; gap:20px; }
.intro-body    { font-size:16px; line-height:1.85; color:var(--muted); }
.intro-visual  { display:flex; justify-content:center; }

/* TWO-COL */
.two-col { display:flex; align-items:center; gap:48px; flex-wrap:wrap; justify-content:center; width:100%; }

/* MODEL VIEWER */
.mv-outer {
  position: relative;
  width: 340px;
  height: 340px;
  flex-shrink: 0;
  border-radius: 20px;
  overflow: hidden;
  background: rgba(5,8,16,0.75);
  border: 1px solid rgba(var(--glow-rgb,0,255,200), 0.2);
  transition: border-color .35s, box-shadow .35s, transform 0.2s ease;
}
.mv-outer:hover {
  border-color: rgba(var(--glow-rgb,0,255,200), 0.6);
  box-shadow: 0 0 50px rgba(var(--glow-rgb,0,255,200), 0.18), 0 0 110px rgba(var(--glow-rgb,0,255,200), 0.08);
  transform: scale(1.02);
}
.mv-mount { position:absolute; inset:0; width:100%; height:100%; cursor: grab; }
.mv-mount:active { cursor: grabbing; }
.mv-mount canvas { display:block; width:100% !important; height:100% !important; }
.mv-grid {
  position:absolute; inset:0; z-index:1; pointer-events:none; border-radius:20px;
  background-image: linear-gradient(rgba(255,255,255,.022) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.022) 1px, transparent 1px);
  background-size:30px 30px;
}
.mv-glow-ring {
  position:absolute; inset:0; z-index:1; pointer-events:none; border-radius:20px;
  background: radial-gradient(ellipse at 50% 60%, rgba(var(--glow-rgb,0,255,200), 0.08) 0%, transparent 65%);
  transition:opacity .3s;
}
.mv-outer:hover .mv-glow-ring { opacity:1.7; }
.mv-scanlines {
  position:absolute; inset:0; z-index:3; pointer-events:none; border-radius:20px;
  background:repeating-linear-gradient(0deg, transparent 0px, transparent 3px, rgba(0,0,0,.05) 3px, rgba(0,0,0,.05) 4px);
}
.mv-corner { position:absolute; width:15px; height:15px; border-style:solid; border-color:var(--glow,#00ffc8); opacity:.4; z-index:5; transition:opacity .25s; }
.mv-outer:hover .mv-corner { opacity:1; }
.mv-corner-tl { top:10px; left:10px; border-width:2px 0 0 2px; }
.mv-corner-tr { top:10px; right:10px; border-width:2px 2px 0 0; }
.mv-corner-bl { bottom:10px; left:10px; border-width:0 0 2px 2px; }
.mv-corner-br { bottom:10px; right:10px; border-width:0 2px 2px 0; }
.mv-overlay {
  position:absolute; inset:0; z-index:6;
  display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px;
  background:rgba(5,8,16,.75); backdrop-filter:blur(6px); border-radius:20px;
}
.mv-spinner {
  width:38px; height:38px; border-radius:50%;
  border:2.5px solid rgba(255,255,255,.08);
  border-top-color:var(--glow,#00ffc8);
  animation:spin .75s linear infinite;
}
@keyframes spin { to { transform:rotate(360deg); } }
.mv-pct { font-family:'Space Mono',monospace; font-size:12px; letter-spacing:.15em; }
.mv-progress-track { width:140px; height:2px; background:rgba(255,255,255,.08); border-radius:2px; overflow:hidden; }
.mv-progress-bar { height:100%; border-radius:2px; transition:width .25s; }
.mv-placeholder { gap:10px; }
.mv-ph-icon { font-size:40px; opacity:.25; animation:spin 16s linear infinite; }
.mv-ph-title { font-family:'Space Mono',monospace; font-size:12px; color:var(--muted); letter-spacing:.08em; }
.mv-ph-path { font-family:'Space Mono',monospace; font-size:11px; }
.mv-ph-hint { font-family:'Space Mono',monospace; font-size:10px; color:var(--muted); opacity:.5; text-align:center; padding:0 18px; }
.mv-badge {
  position:absolute; bottom:13px; left:50%; transform:translateX(-50%);
  font-family:'Space Mono',monospace; font-size:9px; letter-spacing:.25em;
  border:1px solid; padding:3px 14px; border-radius:100px;
  z-index:6; white-space:nowrap;
  backdrop-filter:blur(8px); background:rgba(5,8,16,.8);
}

/* CONTROL PANEL */
.mv-control-panel {
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  gap: 8px;
  z-index: 10;
  animation: fadeIn 0.2s ease-out;
}

.mv-control-btn {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: rgba(5, 8, 16, 0.85);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(var(--glow-rgb, 0, 255, 200), 0.3);
  color: var(--glow, #00ffc8);
  font-size: 18px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  font-family: monospace;
}

.mv-control-btn:hover {
  background: rgba(var(--glow-rgb, 0, 255, 200), 0.2);
  border-color: rgba(var(--glow-rgb, 0, 255, 200), 0.8);
  transform: scale(1.05);
}

.mv-control-btn.active {
  background: rgba(var(--glow-rgb, 0, 255, 200), 0.3);
  border-color: var(--glow, #00ffc8);
  box-shadow: 0 0 12px rgba(var(--glow-rgb, 0, 255, 200), 0.3);
}

.mv-controls-hint {
  position: absolute;
  bottom: 12px;
  left: 12px;
  background: rgba(5, 8, 16, 0.75);
  backdrop-filter: blur(8px);
  padding: 8px 12px;
  border-radius: 8px;
  font-family: 'Space Mono', monospace;
  font-size: 9px;
  color: var(--muted);
  border: 1px solid rgba(var(--glow-rgb, 0, 255, 200), 0.2);
  display: flex;
  flex-direction: column;
  gap: 4px;
  z-index: 10;
  pointer-events: none;
  animation: fadeIn 0.2s ease-out;
}

.mv-controls-hint span {
  white-space: nowrap;
}

.mv-controls-hint span::before {
  content: "•";
  color: var(--glow, #00ffc8);
  margin-right: 6px;
  font-size: 10px;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-5px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* CPU SECTION */
.cpu-section { background:var(--bg); border-top:1px solid var(--border); }
.cpu-grid { width:310px; height:270px; display:grid; grid-template-columns:repeat(4,1fr); gap:10px; position:relative; padding:14px; background:rgba(0,255,200,.03); border:1px solid rgba(0,255,200,.12); border-radius:12px; }
.cpu-core { position:relative; display:flex; align-items:center; justify-content:center; animation:coreGlow 2s ease-in-out infinite; }
@keyframes coreGlow { 0%,100%{opacity:.7} 50%{opacity:1} }
.cpu-core-inner { width:54px; height:54px; border-radius:8px; background:rgba(0,255,200,.08); border:1px solid rgba(0,255,200,.3); display:flex; align-items:center; justify-content:center; position:relative; z-index:1; }
.cpu-core-label { font-family:'Space Mono',monospace; font-size:10px; color:var(--cyan); }
.cpu-pulse { position:absolute; width:54px; height:54px; border-radius:8px; border:1px solid var(--cyan); animation:pulsate 2s ease-out infinite; }
@keyframes pulsate { 0%{transform:scale(1);opacity:.8} 100%{transform:scale(1.85);opacity:0} }
.cpu-bus { position:absolute; bottom:-1px; left:14px; right:14px; height:2px; background:rgba(0,255,200,.1); overflow:hidden; }
.cpu-bus-packet { position:absolute; width:20px; height:2px; background:var(--cyan); box-shadow:0 0 8px var(--cyan); animation:busTravel 1.5s linear infinite; }
@keyframes busTravel { 0%{left:-20px} 100%{left:100%} }
.cpu-stats { display:flex; gap:14px; flex-wrap:wrap; justify-content:center; }
.stat-card { display:flex; flex-direction:column; align-items:center; gap:4px; padding:14px 22px; background:var(--glass); border:1px solid var(--border); border-radius:8px; min-width:95px; transition:border-color .2s,transform .2s; }
.stat-card:hover { border-color:rgba(0,255,200,.4); transform:translateY(-2px); }
.stat-card b { font-size:20px; color:var(--cyan); font-family:'Space Mono',monospace; }
.stat-card span { font-size:11px; color:var(--muted); letter-spacing:.1em; }

/* RAM SECTION */
.ram-section { background:var(--bg2); border-top:1px solid var(--border); }
.ram-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:13px; width:100%; max-width:600px; }
.ram-card { padding:18px 16px; border-radius:10px; background:var(--glass); border:1px solid var(--border); cursor:pointer; transition:transform .2s,border-color .2s; position:relative; overflow:hidden; animation:cardFloat 4s ease-in-out infinite; }
@keyframes cardFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
.ram-card:hover { border-color:var(--card-color,var(--cyan)); transform:translateY(-4px) !important; }
.ram-card-active { border-color:var(--card-color,var(--cyan)) !important; }
.ram-card-bar { position:absolute; top:0; left:0; right:0; height:3px; background:var(--card-color,var(--cyan)); border-radius:10px 10px 0 0; }
.ram-card-label { font-size:14px; font-weight:700; color:#fff; margin-bottom:5px; }
.ram-card-size { font-family:'Space Mono',monospace; font-size:12px; color:var(--muted); }
.ram-card-badge { position:absolute; top:10px; right:10px; font-family:'Space Mono',monospace; font-size:8px; color:var(--card-color,var(--cyan)); letter-spacing:.15em; border:1px solid var(--card-color,var(--cyan)); padding:2px 6px; border-radius:100px; }

/* GPU SECTION */
.gpu-section { background:var(--bg); border-top:1px solid var(--border); }
.gpu-canvas-wrap { position:relative; border-radius:12px; overflow:hidden; border:1px solid rgba(139,92,246,.25); }
.gpu-canvas { display:block; border-radius:12px; max-width:100%; }
.gpu-label-top { position:absolute; top:12px; left:16px; font-family:'Space Mono',monospace; font-size:9px; color:#a78bfa; letter-spacing:.25em; }
.gpu-stats { position:absolute; bottom:12px; right:16px; display:flex; gap:18px; }
.gpu-stat { display:flex; flex-direction:column; align-items:flex-end; }
.gpu-stat span { font-family:'Space Mono',monospace; font-size:8px; color:var(--muted); letter-spacing:.15em; }
.gpu-stat b { font-family:'Space Mono',monospace; font-size:14px; color:#a78bfa; }

/* STORAGE SECTION */
.storage-section { background:var(--bg2); border-top:1px solid var(--border); }
.storage-wrap { display:flex; gap:36px; align-items:center; width:100%; max-width:780px; flex-wrap:wrap; }
.storage-disk { flex-shrink:0; width:110px; height:110px; position:relative; display:flex; align-items:center; justify-content:center; }
.storage-disk-ring { position:absolute; width:94px; height:94px; border-radius:50%; border:2px solid rgba(0,200,255,.2); animation:spin .1s linear infinite; animation-duration:8s; }
.storage-disk-ring-2 { width:64px; height:64px; animation-duration:4s; animation-direction:reverse; border-color:rgba(0,200,255,.35); }
.storage-disk-center { font-family:'Space Mono',monospace; font-size:10px; color:var(--blue); letter-spacing:.1em; z-index:1; }
.storage-files { flex:1; min-width:200px; display:flex; flex-direction:column; gap:8px; }
.storage-file { display:flex; align-items:center; gap:10px; padding:8px 13px; border-radius:8px; background:var(--glass); border:1px solid var(--border); transition:border-color .2s; animation:revealSlide .5s both; }
@keyframes revealSlide { from{opacity:0;transform:translateX(20px)} to{opacity:1;transform:none} }
.storage-file-hover { border-color:var(--blue); }
.storage-file-type { font-family:'Space Mono',monospace; font-size:9px; color:var(--blue); border:1px solid rgba(0,200,255,.3); padding:2px 6px; border-radius:4px; white-space:nowrap; }
.storage-file-name { font-size:13px; color:#fff; flex:1; }
.storage-file-size { font-family:'Space Mono',monospace; font-size:11px; color:var(--muted); white-space:nowrap; }
.storage-file-bar { width:54px; height:3px; background:rgba(255,255,255,.08); border-radius:2px; flex-shrink:0; }
.storage-file-fill { height:100%; background:var(--blue); border-radius:2px; }

/* NETWORK SECTION */
.network-section { background:var(--bg); border-top:1px solid var(--border); }
.network-canvas { border-radius:12px; border:1px solid rgba(0,200,255,.15); display:block; max-width:100%; }

/* FUTURE SECTION */
.future-section { background:var(--bg2); border-top:1px solid var(--border); }
.neural-canvas { border-radius:12px; border:1px solid rgba(139,92,246,.2); display:block; max-width:100%; }
.future-tags { display:flex; gap:12px; flex-wrap:wrap; justify-content:center; }
.future-tag { font-family:'Space Mono',monospace; font-size:11px; color:#a78bfa; border:1px solid rgba(139,92,246,.3); padding:6px 18px; border-radius:100px; transition:background .2s,transform .2s; }
.future-tag:hover { background:rgba(139,92,246,.12); transform:translateY(-2px); }

/* CONCLUSION SECTION */
.conclusion-section { background:var(--bg); border-top:1px solid var(--border); position:relative; overflow:hidden; }
.conclusion-inner { max-width:700px; text-align:center; display:flex; flex-direction:column; gap:28px; align-items:center; position:relative; z-index:1; }
.conclusion-heading { font-size:clamp(36px,5vw,68px); font-weight:800; line-height:1.1; color:#fff; }
.conclusion-body { font-size:17px; line-height:1.8; color:var(--muted); }
.conclusion-actions { display:flex; gap:16px; flex-wrap:wrap; justify-content:center; }
.btn-primary { padding:14px 36px; background:linear-gradient(135deg,var(--cyan),var(--blue)); color:#000; font-weight:700; font-size:13px; letter-spacing:.1em; border:none; border-radius:4px; cursor:pointer; transition:transform .2s,box-shadow .2s; box-shadow:0 0 24px rgba(0,255,200,.2); }
.btn-primary:hover { transform:translateY(-2px); box-shadow:0 0 40px rgba(0,255,200,.35); }
.btn-secondary { padding:14px 36px; background:transparent; color:var(--text); font-weight:600; font-size:13px; letter-spacing:.1em; border:1px solid var(--border); border-radius:4px; text-decoration:none; transition:border-color .2s,color .2s; }
.btn-secondary:hover { border-color:rgba(255,255,255,.3); color:#fff; }
.conclusion-glow { position:absolute; bottom:-100px; left:50%; transform:translateX(-50%); width:600px; height:300px; background:radial-gradient(ellipse,rgba(0,255,200,.08) 0%,transparent 70%); pointer-events:none; }

/* REVEAL */
.reveal { opacity:1; }

/* RESPONSIVE */
@media (max-width:900px) {
  .intro-inner { grid-template-columns:1fr; }
  .intro-visual { justify-content:center; }
  .two-col { flex-direction:column; gap:32px; }
  .mv-outer { width:290px !important; height:290px !important; }
}
@media (max-width:768px) {
  .mv-controls-hint {
    display: none;
  }
  .mv-control-panel {
    top: 8px;
    right: 8px;
  }
  .mv-control-btn {
    width: 28px;
    height: 28px;
    font-size: 14px;
  }
}
@media (max-width:640px) {
  .nav { padding:16px 20px; }
  .nav-links { display:none; }
  .section { padding:100px 20px 60px; }
  .ram-grid { grid-template-columns:1fr 1fr; }
  .hero-heading { font-size:42px; }
  .mv-outer { width:260px !important; height:260px !important; }
}
`;