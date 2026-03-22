import React from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { resolveAssetUrl } from "@/api/base44Client";

function resolveSceneUploadUrl(url) {
  const raw = String(url || "").trim();
  if (!raw) return "";
  if (raw.startsWith("blob:") || raw.startsWith("data:")) return raw;
  if (raw.startsWith("/uploads/") || raw.startsWith("/api/uploads/")) return resolveAssetUrl(raw);
  if (raw.startsWith("uploads/") || raw.startsWith("api/uploads/")) return resolveAssetUrl(`/${raw}`);
  if (raw.startsWith("\\uploads\\") || raw.startsWith("uploads\\") || raw.startsWith("\\api\\uploads\\")) {
    return resolveAssetUrl(raw.replace(/\\/g, "/").replace(/^\/?/, "/"));
  }
  return raw;
}

function detectModelExt(url) {
  const safe = String(url || "").toLowerCase().split("?")[0].split("#")[0];
  if (safe.endsWith(".fbx")) return "fbx";
  if (safe.endsWith(".obj")) return "obj";
  if (safe.endsWith(".stl")) return "stl";
  return "gltf";
}

function cloneMaterial(material) {
  if (!material) return new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.75, metalness: 0.08 });
  if (Array.isArray(material)) return material.map((item) => cloneMaterial(item));
  const cloned = material.clone?.() || material;
  if (cloned?.map?.isTexture) {
    cloned.map = cloned.map.clone();
    cloned.map.needsUpdate = true;
    cloned.map.colorSpace = THREE.SRGBColorSpace;
  }
  return cloned;
}

export default function ImportedModelViewport({
  modelUrl = "",
  className = "",
  onError = null,
  fallbackGeometry = null,
  fallbackMaterial = null,
  preferFallback = false,
  onAnimationInfo = null,
}) {
  const rootRef = React.useRef(null);

  React.useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    const width = root.clientWidth || 640;
    const height = root.clientHeight || 420;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#050816");
    const camera = new THREE.PerspectiveCamera(50, width / Math.max(1, height), 0.01, 2000);
    camera.position.set(2.8, 2.2, 3.2);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    root.innerHTML = "";
    root.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.set(0, 0.8, 0);
    controls.update();

    scene.add(new THREE.AmbientLight(0xffffff, 0.75));
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.05);
    keyLight.position.set(4, 8, 5);
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0x9ac7ff, 0.45);
    fillLight.position.set(-5, 3, -4);
    scene.add(fillLight);

    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(6, 80),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.95, metalness: 0.02 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.001;
    scene.add(ground);

    const grid = new THREE.GridHelper(10, 20, 0x1f2937, 0x111827);
    grid.position.y = 0;
    scene.add(grid);

    let modelRoot = null;
    let mixer = null;
    const clock = new THREE.Clock();
    const loadingManager = new THREE.LoadingManager();
    const dracoLoader = new DRACOLoader(loadingManager);
    dracoLoader.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.7/");
    const ktx2Loader = new KTX2Loader(loadingManager);
    ktx2Loader.setTranscoderPath("https://unpkg.com/three@0.162.0/examples/jsm/libs/basis/");
    ktx2Loader.detectSupport(renderer);
    const gltfLoader = new GLTFLoader(loadingManager);
    gltfLoader.setDRACOLoader(dracoLoader);
    gltfLoader.setKTX2Loader(ktx2Loader);
    gltfLoader.setMeshoptDecoder(MeshoptDecoder);
    const fbxLoader = new FBXLoader(loadingManager);
    const objLoader = new OBJLoader(loadingManager);
    const stlLoader = new STLLoader(loadingManager);
    const safeUrl = resolveSceneUploadUrl(modelUrl);

    const fitCameraToObject = (object3d) => {
      const box = new THREE.Box3().setFromObject(object3d);
      const size = new THREE.Vector3();
      const center = new THREE.Vector3();
      box.getSize(size);
      box.getCenter(center);
      const maxDim = Math.max(size.x, size.y, size.z, 0.1);
      const distance = maxDim * 2.2;
      camera.near = Math.max(0.01, distance / 150);
      camera.far = Math.max(100, distance * 30);
      camera.updateProjectionMatrix();
      camera.position.set(center.x + distance * 0.7, center.y + distance * 0.45, center.z + distance);
      controls.target.copy(center);
      controls.update();
    };

    const normalizeModel = (object3d) => {
      const box = new THREE.Box3().setFromObject(object3d);
      const size = new THREE.Vector3();
      box.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z, 0.0001);
      const scale = 1.8 / maxDim;
      object3d.scale.setScalar(scale);
      const recentered = new THREE.Box3().setFromObject(object3d);
      const center = new THREE.Vector3();
      recentered.getCenter(center);
      object3d.position.sub(center);
      object3d.position.y -= recentered.min.y;
    };

    const ext = detectModelExt(safeUrl);
    const handleLoaded = (loaded) => {
      const object3d = loaded?.scene || loaded;
      if (!object3d) return;
      modelRoot = object3d;
      modelRoot.traverse((node) => {
        if (!node.isMesh) return;
        node.castShadow = false;
        node.receiveShadow = false;
        if (!node.material) {
          node.material = new THREE.MeshStandardMaterial({
            color: 0xcbd5e1,
            roughness: 0.75,
            metalness: 0.08,
          });
        }
      });
      normalizeModel(modelRoot);
      scene.add(modelRoot);
      fitCameraToObject(modelRoot);
      const clips = Array.isArray(loaded?.animations) && loaded.animations.length
        ? loaded.animations
        : Array.isArray(object3d?.animations) && object3d.animations.length
          ? object3d.animations
          : [];
      if (clips.length) {
        mixer = new THREE.AnimationMixer(modelRoot);
        const action = mixer.clipAction(clips[0]);
        action.reset();
        action.play();
        onAnimationInfo?.({
          available: true,
          count: clips.length,
          activeName: String(clips[0]?.name || "clip_1"),
          source: "model",
        });
      } else {
        onAnimationInfo?.({ available: false, count: 0, activeName: "", source: "model" });
      }
    };

    const handleError = (error) => {
      if (typeof onError === "function") onError(error);
      if (fallbackGeometry?.attributes?.position) {
        const geometry = fallbackGeometry.clone();
        geometry.computeBoundingBox();
        geometry.computeBoundingSphere();
        const mesh = new THREE.Mesh(
          geometry,
          cloneMaterial(fallbackMaterial)
        );
        const box = geometry.boundingBox?.clone() || new THREE.Box3(new THREE.Vector3(-0.5, 0, -0.5), new THREE.Vector3(0.5, 1, 0.5));
        const center = box.getCenter(new THREE.Vector3());
        mesh.position.set(-center.x, -box.min.y, -center.z);
        modelRoot = mesh;
        scene.add(modelRoot);
        fitCameraToObject(modelRoot);
        onAnimationInfo?.({ available: false, count: 0, activeName: "", source: "fallback" });
      }
    };

    if (!preferFallback && safeUrl) {
      try {
        if (ext === "fbx") fbxLoader.load(safeUrl, handleLoaded, undefined, handleError);
        else if (ext === "obj") objLoader.load(safeUrl, handleLoaded, undefined, handleError);
        else if (ext === "stl") {
          stlLoader.load(
            safeUrl,
            (geometry) => {
              const mesh = new THREE.Mesh(
                geometry,
                new THREE.MeshStandardMaterial({
                  color: 0xcbd5e1,
                  roughness: 0.78,
                  metalness: 0.04,
                })
              );
              handleLoaded(mesh);
            },
            undefined,
            handleError
          );
        }
        else gltfLoader.load(safeUrl, handleLoaded, undefined, handleError);
      } catch {
        handleError();
      }
    } else if (fallbackGeometry?.attributes?.position) {
      handleError();
    }

    let raf = 0;
    const animate = () => {
      controls.update();
      if (mixer) mixer.update(clock.getDelta());
      else clock.getDelta();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);

    const onResize = () => {
      const w = root.clientWidth || width;
      const h = root.clientHeight || height;
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      controls.dispose();
      dracoLoader.dispose();
      ktx2Loader.dispose();
      mixer?.stopAllAction?.();
      mixer = null;
      renderer.dispose();
      scene.traverse((node) => {
        if (!node.isMesh) return;
        node.geometry?.dispose?.();
        if (Array.isArray(node.material)) node.material.forEach((m) => m?.dispose?.());
        else node.material?.dispose?.();
      });
      if (root.contains(renderer.domElement)) root.removeChild(renderer.domElement);
      modelRoot = null;
    };
  }, [fallbackGeometry, fallbackMaterial, modelUrl, onAnimationInfo, onError, preferFallback]);

  return <div ref={rootRef} className={className} />;
}
