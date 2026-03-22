import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function toNum(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function rgbToHsl(r, g, b) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h /= 6;
  }
  return [h, s, l];
}

function hueToRgb(p, q, t) {
  let nextT = t;
  if (nextT < 0) nextT += 1;
  if (nextT > 1) nextT -= 1;
  if (nextT < 1 / 6) return p + (q - p) * 6 * nextT;
  if (nextT < 1 / 2) return q;
  if (nextT < 2 / 3) return p + (q - p) * (2 / 3 - nextT) * 6;
  return p;
}

function hslToRgb(h, s, l) {
  if (s === 0) {
    const gray = Math.round(l * 255);
    return [gray, gray, gray];
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    Math.round(hueToRgb(p, q, h + 1 / 3) * 255),
    Math.round(hueToRgb(p, q, h) * 255),
    Math.round(hueToRgb(p, q, h - 1 / 3) * 255),
  ];
}

function cloneImageToCanvas(image) {
  if (!image) return null;
  const width = Math.max(1, Math.floor(Number(image.width || image.videoWidth || image.naturalWidth || 0)));
  const height = Math.max(1, Math.floor(Number(image.height || image.videoHeight || image.naturalHeight || 0)));
  if (!width || !height) return null;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(image, 0, 0, width, height);
  return canvas;
}

function loadImageFromUrl(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Falha ao carregar textura."));
    img.src = url;
  });
}

function buildTextureFileName(label = "", slot = "front") {
  const safeLabel = String(label || "textura")
    .trim()
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `${safeLabel || "textura"}_${slot}_editada.png`;
}

export default function ImportedTextureEditorDialog({
  open,
  onOpenChange,
  sourceImage = null,
  sourceUrl = "",
  modelLabel = "",
  slot = "front",
  previewGeometry = null,
  previewMaterialTemplates = null,
  onPreviewChange,
  onApply,
}) {
  const previewCanvasRef = React.useRef(null);
  const canvasViewportRef = React.useRef(null);
  const baseCanvasRef = React.useRef(null);
  const overlayCanvasRef = React.useRef(null);
  const modelPreviewMountRef = React.useRef(null);
  const modelPreviewMeshRef = React.useRef(null);
  const modelPreviewMaterialRef = React.useRef(null);
  const fileInputRef = React.useRef(null);
  const rafRef = React.useRef(0);
  const strokeStateRef = React.useRef({
    active: false,
    lastX: 0,
    lastY: 0,
    mode: "",
    panStartX: 0,
    panStartY: 0,
    startOffsetX: 0,
    startOffsetY: 0,
  });
  const [sourceReady, setSourceReady] = React.useState(false);
  const [sourceError, setSourceError] = React.useState("");
  const [isSaving, setIsSaving] = React.useState(false);
  const [previewRevision, setPreviewRevision] = React.useState(0);
  const [textureZoom, setTextureZoom] = React.useState(1);
  const [texturePan, setTexturePan] = React.useState({ x: 0, y: 0 });
  const [brushCursor, setBrushCursor] = React.useState({ visible: false, x: 0, y: 0 });
  const [brushColor, setBrushColor] = React.useState("#ff7b7b");
  const [brushSize, setBrushSize] = React.useState(26);
  const [brushOpacity, setBrushOpacity] = React.useState(0.8);
  const [brushMode, setBrushMode] = React.useState("paint");
  const [brightness, setBrightness] = React.useState(0);
  const [contrast, setContrast] = React.useState(0);
  const [saturation, setSaturation] = React.useState(0);
  const [hue, setHue] = React.useState(0);
  const [tintColor, setTintColor] = React.useState("#ffffff");
  const [tintStrength, setTintStrength] = React.useState(0);

  const resetAdjustments = React.useCallback(() => {
    setBrightness(0);
    setContrast(0);
    setSaturation(0);
    setHue(0);
    setTintColor("#ffffff");
    setTintStrength(0);
  }, []);

  const resetTextureView = React.useCallback(() => {
    setTextureZoom(1);
    setTexturePan({ x: 0, y: 0 });
  }, []);

  const clearOverlay = React.useCallback(() => {
    const overlayCanvas = overlayCanvasRef.current;
    if (!overlayCanvas) return;
    const overlayCtx = overlayCanvas.getContext("2d", { willReadFrequently: true });
    if (!overlayCtx) return;
    overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
  }, []);

  const emitPreview = React.useCallback(() => {
    if (typeof onPreviewChange === "function" && previewCanvasRef.current) {
      onPreviewChange(previewCanvasRef.current);
    }
  }, [onPreviewChange]);

  const renderPreview = React.useCallback(() => {
    const baseCanvas = baseCanvasRef.current;
    const previewCanvas = previewCanvasRef.current;
    const overlayCanvas = overlayCanvasRef.current;
    if (!baseCanvas || !previewCanvas || !overlayCanvas) return;
    if (previewCanvas.width !== baseCanvas.width || previewCanvas.height !== baseCanvas.height) {
      previewCanvas.width = baseCanvas.width;
      previewCanvas.height = baseCanvas.height;
    }
    if (overlayCanvas.width !== baseCanvas.width || overlayCanvas.height !== baseCanvas.height) {
      overlayCanvas.width = baseCanvas.width;
      overlayCanvas.height = baseCanvas.height;
    }
    const previewCtx = previewCanvas.getContext("2d", { willReadFrequently: true });
    const baseCtx = baseCanvas.getContext("2d", { willReadFrequently: true });
    if (!previewCtx || !baseCtx) return;

    previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    previewCtx.drawImage(baseCanvas, 0, 0);
    const imageData = previewCtx.getImageData(0, 0, previewCanvas.width, previewCanvas.height);
    const data = imageData.data;
    const brightnessOffset = (clamp(brightness, -100, 100) / 100) * 255;
    const contrastFactor = Math.max(0, 1 + clamp(contrast, -100, 100) / 100);
    const saturationFactor = Math.max(0, 1 + clamp(saturation, -100, 100) / 100);
    const hueShift = clamp(hue, -180, 180) / 360;
    const tintMix = clamp(tintStrength, 0, 100) / 100;
    const tintRgb = [
      Number.parseInt(String(tintColor || "#ffffff").slice(1, 3), 16) || 255,
      Number.parseInt(String(tintColor || "#ffffff").slice(3, 5), 16) || 255,
      Number.parseInt(String(tintColor || "#ffffff").slice(5, 7), 16) || 255,
    ];

    for (let i = 0; i < data.length; i += 4) {
      let r = data[i];
      let g = data[i + 1];
      let b = data[i + 2];

      r = clamp((r - 128) * contrastFactor + 128 + brightnessOffset, 0, 255);
      g = clamp((g - 128) * contrastFactor + 128 + brightnessOffset, 0, 255);
      b = clamp((b - 128) * contrastFactor + 128 + brightnessOffset, 0, 255);

      let [nextH, nextS, nextL] = rgbToHsl(r, g, b);
      nextH = (nextH + hueShift + 1) % 1;
      nextS = clamp(nextS * saturationFactor, 0, 1);
      [r, g, b] = hslToRgb(nextH, nextS, nextL);

      if (tintMix > 0) {
        r = clamp(r * (1 - tintMix) + tintRgb[0] * tintMix, 0, 255);
        g = clamp(g * (1 - tintMix) + tintRgb[1] * tintMix, 0, 255);
        b = clamp(b * (1 - tintMix) + tintRgb[2] * tintMix, 0, 255);
      }

      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
    }

    previewCtx.putImageData(imageData, 0, 0);
    previewCtx.drawImage(overlayCanvas, 0, 0);
    setPreviewRevision((prev) => prev + 1);
    emitPreview();
  }, [brightness, contrast, emitPreview, hue, saturation, tintColor, tintStrength]);

  const scheduleRender = React.useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      renderPreview();
    });
  }, [renderPreview]);

  const initializeFromSource = React.useCallback(
    async (nextSourceImage, nextSourceUrl) => {
      if (!open) return;
      setSourceReady(false);
      setSourceError("");
      try {
        const image =
          nextSourceImage ||
          (String(nextSourceUrl || "").trim() ? await loadImageFromUrl(String(nextSourceUrl || "").trim()) : null);
        const canvas = cloneImageToCanvas(image);
        if (!canvas) throw new Error("Textura sem imagem utilizavel.");
        baseCanvasRef.current = canvas;
        const overlayCanvas = document.createElement("canvas");
        overlayCanvas.width = canvas.width;
        overlayCanvas.height = canvas.height;
        overlayCanvasRef.current = overlayCanvas;
        const previewCanvas = previewCanvasRef.current;
        if (previewCanvas) {
          previewCanvas.width = canvas.width;
          previewCanvas.height = canvas.height;
        }
        resetTextureView();
        setSourceReady(true);
        scheduleRender();
      } catch (error) {
        setSourceError(String(error?.message || "Falha ao preparar a textura."));
        setSourceReady(false);
      }
    },
    [open, resetTextureView, scheduleRender]
  );

  React.useEffect(() => {
    if (!open) return undefined;
    initializeFromSource(sourceImage, sourceUrl);
    return undefined;
  }, [initializeFromSource, open, sourceImage, sourceUrl]);

  React.useEffect(() => {
    if (!open || !sourceReady) return undefined;
    scheduleRender();
    return undefined;
  }, [brightness, contrast, hue, open, saturation, scheduleRender, sourceReady, tintColor, tintStrength]);

  React.useEffect(() => {
    if (!open) return undefined;
    const handlePaste = (event) => {
      const items = Array.from(event.clipboardData?.items || []);
      const fileItem = items.find((item) => item.type?.startsWith("image/"));
      const file = fileItem?.getAsFile?.();
      if (!file) return;
      event.preventDefault();
      const url = URL.createObjectURL(file);
      initializeFromSource(null, url).finally(() => {
        URL.revokeObjectURL(url);
      });
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [initializeFromSource, open]);

  React.useEffect(() => {
    if (!open && typeof onPreviewChange === "function") onPreviewChange(null);
  }, [onPreviewChange, open]);

  React.useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const handleReplaceTexture = React.useCallback(async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    try {
      await initializeFromSource(null, url);
    } finally {
      URL.revokeObjectURL(url);
      event.target.value = "";
    }
  }, [initializeFromSource]);

  const getCanvasPoint = React.useCallback((event) => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((event.clientY - rect.top) / rect.height) * canvas.height;
    return {
      x: clamp(x, 0, canvas.width),
      y: clamp(y, 0, canvas.height),
    };
  }, []);

  const updateBrushCursorFromEvent = React.useCallback((event) => {
    const canvas = previewCanvasRef.current;
    const viewport = canvasViewportRef.current;
    if (!canvas || !viewport) {
      setBrushCursor((prev) => ({ ...prev, visible: false }));
      return;
    }
    const canvasRect = canvas.getBoundingClientRect();
    const viewportRect = viewport.getBoundingClientRect();
    const inside =
      canvasRect.width > 0 &&
      canvasRect.height > 0 &&
      event.clientX >= canvasRect.left &&
      event.clientX <= canvasRect.right &&
      event.clientY >= canvasRect.top &&
      event.clientY <= canvasRect.bottom;
    if (!inside) {
      setBrushCursor((prev) => ({ ...prev, visible: false }));
      return;
    }
    setBrushCursor({
      visible: true,
      x: event.clientX - viewportRect.left,
      y: event.clientY - viewportRect.top,
    });
  }, []);

  const paintStroke = React.useCallback((from, to) => {
    const overlayCanvas = overlayCanvasRef.current;
    if (!overlayCanvas) return;
    const overlayCtx = overlayCanvas.getContext("2d", { willReadFrequently: true });
    if (!overlayCtx) return;
    overlayCtx.save();
    overlayCtx.lineCap = "round";
    overlayCtx.lineJoin = "round";
    overlayCtx.lineWidth = clamp(Number(brushSize) || 26, 1, 400);
    overlayCtx.globalCompositeOperation = brushMode === "erase" ? "destination-out" : "source-over";
    overlayCtx.globalAlpha = clamp(Number(brushOpacity) || 0.8, 0.05, 1);
    overlayCtx.strokeStyle = brushColor || "#ff7b7b";
    overlayCtx.beginPath();
    overlayCtx.moveTo(from.x, from.y);
    overlayCtx.lineTo(to.x, to.y);
    overlayCtx.stroke();
    overlayCtx.restore();
    scheduleRender();
  }, [brushColor, brushMode, brushOpacity, brushSize, scheduleRender]);

  const handlePointerDown = React.useCallback((event) => {
    if (!sourceReady) return;
    if (event.button === 1 || event.button === 2) {
      strokeStateRef.current = {
        ...strokeStateRef.current,
        active: true,
        mode: "pan",
        panStartX: event.clientX,
        panStartY: event.clientY,
        startOffsetX: texturePan.x,
        startOffsetY: texturePan.y,
      };
      event.currentTarget.setPointerCapture?.(event.pointerId);
      updateBrushCursorFromEvent(event);
      return;
    }
    const point = getCanvasPoint(event);
    if (!point) return;
    strokeStateRef.current = {
      active: true,
      lastX: point.x,
      lastY: point.y,
      mode: "paint",
      panStartX: 0,
      panStartY: 0,
      startOffsetX: 0,
      startOffsetY: 0,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    updateBrushCursorFromEvent(event);
    paintStroke(point, point);
  }, [getCanvasPoint, paintStroke, sourceReady, texturePan.x, texturePan.y, updateBrushCursorFromEvent]);

  const handlePointerMove = React.useCallback((event) => {
    updateBrushCursorFromEvent(event);
    if (!strokeStateRef.current.active) return;
    if (strokeStateRef.current.mode === "pan") {
      setTexturePan({
        x: strokeStateRef.current.startOffsetX + (event.clientX - strokeStateRef.current.panStartX),
        y: strokeStateRef.current.startOffsetY + (event.clientY - strokeStateRef.current.panStartY),
      });
      return;
    }
    const point = getCanvasPoint(event);
    if (!point) return;
    paintStroke(
      { x: strokeStateRef.current.lastX, y: strokeStateRef.current.lastY },
      point
    );
    strokeStateRef.current.lastX = point.x;
    strokeStateRef.current.lastY = point.y;
  }, [getCanvasPoint, paintStroke, updateBrushCursorFromEvent]);

  const handlePointerUp = React.useCallback((event) => {
    strokeStateRef.current.active = false;
    strokeStateRef.current.mode = "";
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  }, []);

  const handleCanvasWheel = React.useCallback((event) => {
    event.preventDefault();
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const offsetX = event.clientX - rect.left - rect.width / 2;
    const offsetY = event.clientY - rect.top - rect.height / 2;
    const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
    setTextureZoom((prevZoom) => {
      const nextZoom = clamp(prevZoom * factor, 0.35, 10);
      const ratio = nextZoom / prevZoom;
      setTexturePan((prevPan) => ({
        x: prevPan.x - offsetX * (ratio - 1),
        y: prevPan.y - offsetY * (ratio - 1),
      }));
      return nextZoom;
    });
    updateBrushCursorFromEvent(event);
  }, [updateBrushCursorFromEvent]);

  const handleApply = React.useCallback(async () => {
    const previewCanvas = previewCanvasRef.current;
    if (!previewCanvas || typeof onApply !== "function") return;
    setIsSaving(true);
    try {
      const blob = await new Promise((resolve, reject) => {
        previewCanvas.toBlob((nextBlob) => {
          if (nextBlob) resolve(nextBlob);
          else reject(new Error("Falha ao gerar imagem final."));
        }, "image/png");
      });
      const file = new File([blob], buildTextureFileName(modelLabel, slot), { type: "image/png" });
      await onApply({
        file,
        slot,
        width: previewCanvas.width,
        height: previewCanvas.height,
      });
    } finally {
      setIsSaving(false);
    }
  }, [modelLabel, onApply, slot]);

  const textureSizeLabel = sourceReady && baseCanvasRef.current
    ? `${baseCanvasRef.current.width}x${baseCanvasRef.current.height}`
    : "--";

  React.useEffect(() => {
    const mount = modelPreviewMountRef.current;
    if (!open || !mount || !previewGeometry?.attributes?.position) return undefined;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#09111f");

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(mount.clientWidth || 1, mount.clientHeight || 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(42, Math.max(1, mount.clientWidth) / Math.max(1, mount.clientHeight), 0.01, 400);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = true;
    controls.screenSpacePanning = true;
    controls.zoomToCursor = true;
    controls.minDistance = 0.08;
    controls.maxDistance = 80;

    scene.add(new THREE.AmbientLight(0xffffff, 0.95));
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.25);
    keyLight.position.set(3, 5, 4);
    scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight(0x67e8f9, 0.55);
    rimLight.position.set(-2, 3, -4);
    scene.add(rimLight);

    const geometry = previewGeometry.clone();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    const box = geometry.boundingBox?.clone() || new THREE.Box3(new THREE.Vector3(-0.5, 0, -0.5), new THREE.Vector3(0.5, 1, 0.5));
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const radius = Math.max(0.001, geometry.boundingSphere?.radius || size.length() * 0.5 || 1);

    const buildMaterial = () => {
      const canvas = previewCanvasRef.current;
      const map = canvas ? new THREE.CanvasTexture(canvas) : null;
      if (map) {
        map.colorSpace = THREE.SRGBColorSpace;
        map.flipY = false;
        map.needsUpdate = true;
      }
      return new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map,
        roughness: 0.82,
        metalness: 0.04,
      });
    };

    let material = buildMaterial();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(-center.x, -box.min.y, -center.z);
    modelPreviewMeshRef.current = mesh;
    modelPreviewMaterialRef.current = material;
    scene.add(mesh);

    const fitDistance = Math.max(radius * 2.6, size.y * 1.35, 1.4);
    controls.target.set(0, Math.max(size.y * 0.45, 0.35), 0);
    camera.position.set(radius * 0.35, Math.max(size.y * 0.8, 0.7), fitDistance);
    camera.near = Math.max(0.01, fitDistance / 500);
    camera.far = Math.max(50, fitDistance * 40);
    camera.updateProjectionMatrix();
    controls.update();

    const resizeObserver = new ResizeObserver(() => {
      const width = Math.max(1, mount.clientWidth || 1);
      const height = Math.max(1, mount.clientHeight || 1);
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    });
    resizeObserver.observe(mount);

    let frame = 0;
    const renderLoop = () => {
      controls.update();
      renderer.render(scene, camera);
      frame = requestAnimationFrame(renderLoop);
    };
    renderLoop();

    return () => {
      if (frame) cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      controls.dispose();
      scene.remove(mesh);
      modelPreviewMeshRef.current = null;
      modelPreviewMaterialRef.current = null;
      geometry.dispose();
      material?.map?.dispose?.();
      material?.dispose?.();
      renderer.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
  }, [open, previewGeometry, previewMaterialTemplates]);

  React.useEffect(() => {
    const mesh = modelPreviewMeshRef.current;
    if (!open || !mesh) return;
    const prev = modelPreviewMaterialRef.current;
    const canvas = previewCanvasRef.current;
    const map = canvas ? new THREE.CanvasTexture(canvas) : null;
    if (map) {
      map.colorSpace = THREE.SRGBColorSpace;
      map.flipY = false;
      map.needsUpdate = true;
    }
    const nextMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map,
      roughness: 0.82,
      metalness: 0.04,
    });
    mesh.material = nextMaterial;
    modelPreviewMaterialRef.current = nextMaterial;
    prev?.map?.dispose?.();
    prev?.dispose?.();
  }, [open, previewRevision]);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && typeof onOpenChange === "function") onOpenChange(false);
      }}
    >
      <DialogContent
        overlayClassName="z-[120] bg-slate-950/72 backdrop-blur-sm"
        className="z-[121] flex max-h-[92dvh] w-[calc(100vw-1rem)] max-w-6xl flex-col overflow-hidden border border-cyan-500/30 bg-slate-950 p-0 text-white"
      >
        <DialogHeader className="border-b border-slate-800 px-5 py-4">
          <DialogTitle className="text-base font-bold text-cyan-100">
            Editor de textura ao vivo ({slot}) 
          </DialogTitle>
        </DialogHeader>
        <div className="grid min-h-0 flex-1 gap-0 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.95fr)_360px]">
          <div className="min-h-0 border-b border-slate-800 xl:border-b-0 xl:border-r">
            <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3 text-[11px] text-slate-300">
              <span>Canvas editavel</span>
              <span>{textureSizeLabel}</span>
            </div>
            <div
              ref={canvasViewportRef}
              className="relative flex h-[58dvh] items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.08),_transparent_45%),linear-gradient(135deg,_rgba(15,23,42,0.96),_rgba(2,6,23,1))] p-4"
              onWheel={handleCanvasWheel}
            >
              {sourceError ? (
                <p className="text-sm text-rose-300">{sourceError}</p>
              ) : (
                <>
                  <canvas
                    ref={previewCanvasRef}
                    className="max-h-full max-w-full touch-none rounded-lg border border-cyan-500/25 bg-slate-900 shadow-[0_0_30px_rgba(34,211,238,0.08)]"
                    style={{
                      transform: `translate(${texturePan.x}px, ${texturePan.y}px) scale(${textureZoom})`,
                      transformOrigin: "center center",
                      cursor: strokeStateRef.current.mode === "pan" ? "grabbing" : "none",
                    }}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerLeave={(event) => {
                      setBrushCursor((prev) => ({ ...prev, visible: false }));
                      handlePointerUp(event);
                    }}
                    onPointerCancel={handlePointerUp}
                    onContextMenu={(event) => event.preventDefault()}
                  />
                  {brushCursor.visible ? (
                    <div
                      className="pointer-events-none absolute rounded-full border border-cyan-200/90 bg-cyan-200/10"
                      style={{
                        width: `${Math.max(8, brushSize * textureZoom)}px`,
                        height: `${Math.max(8, brushSize * textureZoom)}px`,
                        left: `${brushCursor.x}px`,
                        top: `${brushCursor.y}px`,
                        transform: "translate(-50%, -50%)",
                        opacity: strokeStateRef.current.mode === "pan" ? 0.35 : 1,
                        boxShadow: "0 0 0 1px rgba(8,145,178,0.35)",
                      }}
                    />
                  ) : null}
                  <div className="pointer-events-none absolute bottom-3 left-3 rounded border border-cyan-500/35 bg-slate-950/80 px-2 py-1 text-[10px] text-cyan-100">
                    Zoom {Math.round(textureZoom * 100)}%
                  </div>
                </>
              )}
            </div>
            <div className="grid gap-2 border-t border-slate-800 px-4 py-3 text-[11px] sm:grid-cols-2 xl:grid-cols-4">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded border border-cyan-500/60 bg-cyan-900/25 px-3 py-2 text-cyan-100"
              >
                Trocar imagem
              </button>
              <button
                type="button"
                onClick={resetAdjustments}
                className="rounded border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100"
              >
                Resetar ajustes
              </button>
              <button
                type="button"
                onClick={resetTextureView}
                className="rounded border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100"
              >
                Resetar zoom
              </button>
              <button
                type="button"
                onClick={() => {
                  clearOverlay();
                  scheduleRender();
                }}
                className="rounded border border-amber-500/60 bg-amber-900/25 px-3 py-2 text-amber-100"
              >
                Limpar pintura
              </button>
              <button
                type="button"
                onClick={handleApply}
                disabled={!sourceReady || isSaving}
                className={`rounded border px-3 py-2 ${
                  sourceReady && !isSaving
                    ? "border-emerald-500/70 bg-emerald-900/35 text-emerald-100"
                    : "cursor-not-allowed border-slate-700 bg-slate-900 text-slate-500"
                }`}
              >
                {isSaving ? "Aplicando..." : "Aplicar no personagem"}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleReplaceTexture}
              />
            </div>
          </div>
          <div className="min-h-0 border-b border-slate-800 xl:border-b-0 xl:border-r">
            <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3 text-[11px] text-slate-300">
              <span>Preview do personagem</span>
              <span>Gire, arraste e de zoom</span>
            </div>
            <div className="flex h-[38dvh] items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.12),_transparent_42%),linear-gradient(180deg,_rgba(9,17,31,1),_rgba(2,6,23,1))] p-3 xl:h-[58dvh]">
              <div ref={modelPreviewMountRef} className="h-full w-full overflow-hidden rounded-xl border border-cyan-500/25 shadow-[0_0_30px_rgba(34,211,238,0.08)]" />
            </div>
            <div className="border-t border-slate-800 px-4 py-3 text-[11px] text-slate-300">
              Scroll aproxima onde o mouse estiver. Botao direito arrasta a camera. As alteracoes da textura aparecem aqui em tempo real.
            </div>
          </div>
          <div className="min-h-0 overflow-y-auto px-4 py-4">
            <div className="grid gap-4">
              <div className="rounded border border-slate-800 bg-slate-900/70 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200">Fluxo</p>
                <p className="mt-2 text-[11px] text-slate-300">
                  A textura do material atual vira a base. Os ajustes aparecem no viewport 3D em tempo real.
                  Voce pode trocar a imagem, pintar em cima e colar uma nova textura com Ctrl+V.
                </p>
              </div>

              <div className="rounded border border-slate-800 bg-slate-900/70 p-3">
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200">Ajustes globais</p>
                <div className="grid gap-3 text-[11px] text-slate-200">
                  <label className="grid gap-1">
                    <span>Brilho ({brightness})</span>
                    <input type="range" min="-100" max="100" step="1" value={brightness} onChange={(e) => setBrightness(toNum(e.target.value, 0))} />
                  </label>
                  <label className="grid gap-1">
                    <span>Contraste ({contrast})</span>
                    <input type="range" min="-100" max="100" step="1" value={contrast} onChange={(e) => setContrast(toNum(e.target.value, 0))} />
                  </label>
                  <label className="grid gap-1">
                    <span>Saturacao ({saturation})</span>
                    <input type="range" min="-100" max="100" step="1" value={saturation} onChange={(e) => setSaturation(toNum(e.target.value, 0))} />
                  </label>
                  <label className="grid gap-1">
                    <span>Matiz ({hue})</span>
                    <input type="range" min="-180" max="180" step="1" value={hue} onChange={(e) => setHue(toNum(e.target.value, 0))} />
                  </label>
                  <div className="grid grid-cols-[1fr_84px] gap-2">
                    <label className="grid gap-1">
                      <span>Tinta global ({tintStrength}%)</span>
                      <input type="range" min="0" max="100" step="1" value={tintStrength} onChange={(e) => setTintStrength(toNum(e.target.value, 0))} />
                    </label>
                    <label className="grid gap-1">
                      <span>Cor</span>
                      <input type="color" value={tintColor} onChange={(e) => setTintColor(e.target.value)} className="h-10 w-full rounded border border-slate-700 bg-slate-950 p-1" />
                    </label>
                  </div>
                </div>
              </div>

              <div className="rounded border border-slate-800 bg-slate-900/70 p-3">
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200">Pintura local</p>
                <div className="grid gap-3 text-[11px] text-slate-200">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setBrushMode("paint")}
                      className={`rounded border px-3 py-2 ${brushMode === "paint" ? "border-fuchsia-400 bg-fuchsia-900/35 text-white" : "border-slate-700 bg-slate-950 text-slate-300"}`}
                    >
                      Pintar
                    </button>
                    <button
                      type="button"
                      onClick={() => setBrushMode("erase")}
                      className={`rounded border px-3 py-2 ${brushMode === "erase" ? "border-amber-400 bg-amber-900/35 text-white" : "border-slate-700 bg-slate-950 text-slate-300"}`}
                    >
                      Apagar
                    </button>
                  </div>
                  <div className="grid grid-cols-[1fr_84px] gap-2">
                    <label className="grid gap-1">
                      <span>Tamanho ({brushSize}px)</span>
                      <input type="range" min="1" max="180" step="1" value={brushSize} onChange={(e) => setBrushSize(toNum(e.target.value, 26))} />
                    </label>
                    <label className="grid gap-1">
                      <span>Cor</span>
                      <input type="color" value={brushColor} onChange={(e) => setBrushColor(e.target.value)} className="h-10 w-full rounded border border-slate-700 bg-slate-950 p-1" />
                    </label>
                  </div>
                  <label className="grid gap-1">
                    <span>Opacidade ({Math.round(brushOpacity * 100)}%)</span>
                    <input type="range" min="0.05" max="1" step="0.01" value={brushOpacity} onChange={(e) => setBrushOpacity(clamp(toNum(e.target.value, 0.8), 0.05, 1))} />
                  </label>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onOpenChange?.(false)}
                className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-[11px] text-slate-200"
              >
                Fechar editor
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
