import React from "react";
import * as THREE from "three";
import chestBackgroundUrl from "../../../assets-para-app/bkagorund bau diario horizonte.png?url";

function createGlowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.2, "rgba(154,230,255,0.95)");
  gradient.addColorStop(0.45, "rgba(45,212,191,0.38)");
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(canvas);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeAngle(angle) {
  const fullTurn = Math.PI * 2;
  return THREE.MathUtils.euclideanModulo(angle + Math.PI, fullTurn) - Math.PI;
}

function easeChestSpin(progress) {
  const safe = clamp(progress, 0, 1);
  if (safe < 0.2) {
    return 0.18 * Math.pow(safe / 0.2, 2.1);
  }
  if (safe < 0.78) {
    const middleProgress = (safe - 0.2) / 0.58;
    return 0.18 + 0.68 * (1 - Math.cos(middleProgress * Math.PI)) * 0.5;
  }
  const finalProgress = (safe - 0.78) / 0.22;
  return 0.86 + 0.14 * (1 - Math.pow(1 - finalProgress, 2.2));
}

function createProceduralClosedChest() {
  const group = new THREE.Group();
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color("#2a1454"),
    metalness: 0.68,
    roughness: 0.26,
    emissive: new THREE.Color("#0ea5e9"),
    emissiveIntensity: 0.16,
  });
  const trimMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color("#f5d76e"),
    metalness: 0.92,
    roughness: 0.18,
    emissive: new THREE.Color("#fbbf24"),
    emissiveIntensity: 0.08,
  });

  const base = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.1, 1.8), bodyMaterial);
  base.castShadow = true;
  base.receiveShadow = true;
  base.position.y = 0.55;
  group.add(base);

  const lid = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.72, 1.9), bodyMaterial.clone());
  lid.castShadow = true;
  lid.position.y = 1.3;
  group.add(lid);

  const lock = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.52, 0.12), trimMaterial);
  lock.position.set(0, 0.86, 0.97);
  group.add(lock);

  const bandGeometry = new THREE.BoxGeometry(2.58, 0.12, 0.12);
  const topBand = new THREE.Mesh(bandGeometry, trimMaterial);
  topBand.position.set(0, 1.48, 0.96);
  group.add(topBand);
  const bottomBand = topBand.clone();
  bottomBand.position.set(0, 0.82, 0.96);
  group.add(bottomBand);

  group.userData.lid = lid;
  group.userData.materials = [bodyMaterial, lid.material, trimMaterial];
  return group;
}

function createProceduralOpenedChest() {
  const group = new THREE.Group();
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color("#231044"),
    metalness: 0.64,
    roughness: 0.24,
    emissive: new THREE.Color("#22d3ee"),
    emissiveIntensity: 0.14,
  });
  const trimMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color("#f8d973"),
    metalness: 0.96,
    roughness: 0.2,
  });

  const base = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.1, 1.8), bodyMaterial);
  base.castShadow = true;
  base.receiveShadow = true;
  base.position.y = 0.55;
  group.add(base);

  const lidPivot = new THREE.Group();
  lidPivot.position.set(0, 1.06, -0.72);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.72, 1.9), bodyMaterial.clone());
  lid.castShadow = true;
  lid.position.set(0, 0.18, 0.72);
  lidPivot.add(lid);
  group.add(lidPivot);

  const lock = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.52, 0.12), trimMaterial);
  lock.position.set(0, 0.86, 0.97);
  group.add(lock);

  lidPivot.rotation.x = -1.12;
  group.userData.lidPivot = lidPivot;
  group.userData.materials = [bodyMaterial, lid.material, trimMaterial];
  return group;
}

function getRenderableBounds(object) {
  const bounds = new THREE.Box3();
  const meshBounds = new THREE.Box3();
  let hasMesh = false;

  object.updateMatrixWorld(true);
  object.traverse((node) => {
    if (!node?.isMesh || !node.geometry) return;
    if (!node.geometry.boundingBox) {
      node.geometry.computeBoundingBox();
    }
    if (!node.geometry.boundingBox) return;
    meshBounds.copy(node.geometry.boundingBox);
    meshBounds.applyMatrix4(node.matrixWorld);
    if (!hasMesh) {
      bounds.copy(meshBounds);
      hasMesh = true;
      return;
    }
    bounds.union(meshBounds);
  });

  if (hasMesh) return bounds;
  return new THREE.Box3().setFromObject(object);
}

function fitObjectToHeight(object, targetHeight) {
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  const box = getRenderableBounds(object);
  box.getSize(size);
  box.getCenter(center);
  const reference = Math.max(size.y, size.x, size.z, 0.001);
  const scale = targetHeight / reference;
  object.scale.setScalar(scale);
  object.updateMatrixWorld(true);

  const scaledBox = getRenderableBounds(object);
  scaledBox.getCenter(center);
  object.position.set(-center.x, -scaledBox.min.y, -center.z);
  object.updateMatrixWorld(true);

  const centeredBox = getRenderableBounds(object);
  centeredBox.getCenter(center);
  object.position.x -= center.x;
}

function disposeObject(root) {
  if (!root) return;
  root.traverse((node) => {
    if (node.geometry) node.geometry.dispose?.();
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    materials.filter(Boolean).forEach((material) => {
      Object.values(material).forEach((value) => {
        if (value && typeof value === "object" && typeof value.dispose === "function" && value.isTexture) {
          value.dispose();
        }
      });
      material.dispose?.();
    });
  });
}

export default function DailyChestScene({
  stageState = "available",
  viewMode = "main",
  tapProgress = 0,
  tapGoal = 4,
  rarity = "rare",
  theme = "aurora",
  tapPulseToken = 0,
  spinToken = 0,
  rewardLabel = "",
  rewardDescription = "",
  rewardPool = [],
  slotSummary = {},
  statusInfo = null,
  onSceneReady,
}) {
  const mountRef = React.useRef(null);
  const runtimeRef = React.useRef({
    stageState,
    tapProgress,
    tapGoal,
    tapPulseToken,
    spinToken,
  });

  React.useEffect(() => {
    runtimeRef.current = {
      stageState,
      tapProgress,
      tapGoal,
      viewMode,
      tapPulseToken,
      spinToken,
      rewardLabel,
      rewardDescription,
      rewardPool,
      slotSummary,
      statusInfo,
    };
  }, [rewardDescription, rewardLabel, rewardPool, slotSummary, spinToken, stageState, statusInfo, tapGoal, tapProgress, tapPulseToken, viewMode]);

  React.useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const isLowPerf =
      (typeof navigator !== "undefined" && Number(navigator.deviceMemory || 8) <= 4) ||
      (typeof navigator !== "undefined" && Number(navigator.hardwareConcurrency || 8) <= 4);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(theme === "nebula" ? "#070714" : "#04121f", isLowPerf ? 0.038 : 0.028);

    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(0, 2.55, 8.7);
    camera.lookAt(0, 1.4, 0);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isLowPerf,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isLowPerf ? 1.25 : 1.65));
    renderer.setSize(mount.clientWidth, mount.clientHeight, true);
    renderer.shadowMap.enabled = !isLowPerf;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";
    mount.appendChild(renderer.domElement);

    const backgroundGroup = new THREE.Group();
    scene.add(backgroundGroup);
    let hasSignaledReady = false;
    const loadingManager = new THREE.LoadingManager();
    loadingManager.onLoad = () => {
      if (!mounted || hasSignaledReady) return;
      hasSignaledReady = true;
      window.requestAnimationFrame(() => {
        if (!mounted) return;
        onSceneReady?.();
      });
    };
    const textureLoader = new THREE.TextureLoader(loadingManager);

    const backgroundTexture = textureLoader.load(chestBackgroundUrl);
    backgroundTexture.colorSpace = THREE.SRGBColorSpace;

    const backdropPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 12),
      new THREE.MeshBasicMaterial({
        map: backgroundTexture,
        transparent: true,
        opacity: 0.98,
        depthWrite: false,
      })
    );
    backdropPlane.position.set(0, 3.2, -9.6);
    scene.add(backdropPlane);

    const hemi = new THREE.HemisphereLight("#7dd3fc", "#020617", 1.2);
    scene.add(hemi);

    const keyLight = new THREE.SpotLight("#9be7ff", 14, 40, 0.36, 0.55, 1.2);
    keyLight.position.set(0.8, 9.5, 6.2);
    keyLight.target.position.set(0, 1.2, 0);
    keyLight.castShadow = !isLowPerf;
    scene.add(keyLight);
    scene.add(keyLight.target);

    const rimLight = new THREE.PointLight("#8b5cf6", 3.8, 22, 2);
    rimLight.position.set(-4.4, 2.2, -5.6);
    scene.add(rimLight);

    const chestLight = new THREE.PointLight("#34d399", 2.8, 12, 2);
    chestLight.position.set(0, 1.4, 1.2);
    scene.add(chestLight);

    const platformGroup = new THREE.Group();
    scene.add(platformGroup);

    const platform = new THREE.Mesh(
      new THREE.CylinderGeometry(3.3, 3.9, 0.7, isLowPerf ? 24 : 40, 1, false),
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#081422"),
        metalness: 0.58,
        roughness: 0.4,
        emissive: new THREE.Color("#0f172a"),
        emissiveIntensity: 0.26,
      })
    );
    platform.receiveShadow = true;
    platform.position.y = -0.32;
    platformGroup.add(platform);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(2.92, 0.1, 18, isLowPerf ? 50 : 90),
      new THREE.MeshBasicMaterial({
        color: rarity === "legendary" ? "#fbbf24" : rarity === "epic" ? "#c084fc" : "#22d3ee",
        transparent: true,
        opacity: 0.72,
      })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.08;
    platformGroup.add(ring);

    const glowTexture = createGlowTexture();
    const aura = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTexture,
        transparent: true,
        opacity: 0.8,
        color: new THREE.Color(theme === "violet" ? "#c084fc" : "#67e8f9"),
        depthWrite: false,
      })
    );
    aura.scale.set(8.6, 8.6, 1);
    aura.position.set(0, 2.1, -2.6);
    scene.add(aura);

    const innerAura = aura.clone();
    innerAura.material = aura.material.clone();
    innerAura.material.opacity = 0.46;
    innerAura.scale.set(5.4, 5.4, 1);
    innerAura.position.set(0, 1.3, -0.8);
    scene.add(innerAura);

    for (let index = 0; index < 5; index += 1) {
      const line = new THREE.Mesh(
        new THREE.PlaneGeometry(7.8, 0.05),
        new THREE.MeshBasicMaterial({
          color: index % 2 === 0 ? "#22d3ee" : "#8b5cf6",
          transparent: true,
          opacity: isLowPerf ? 0.08 : 0.12,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      line.position.set(0, 0.8 + index * 0.72, -6.2 - index * 0.8);
      line.rotation.z = (index - 2) * 0.07;
      backgroundGroup.add(line);
    }

    const particleCount = isLowPerf ? 28 : 56;
    const particlePositions = new Float32Array(particleCount * 3);
    const particleAlpha = new Float32Array(particleCount);
    const particleMeta = Array.from({ length: particleCount }, (_, index) => ({
      radius: 2 + Math.random() * 2.4,
      baseY: -0.2 + Math.random() * 4.2,
      offset: Math.random() * Math.PI * 2,
      speed: 0.18 + Math.random() * 0.6,
      drift: index % 2 === 0 ? 1 : -1,
    }));

    const particlesGeometry = new THREE.BufferGeometry();
    particlesGeometry.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));
    particlesGeometry.setAttribute("alpha", new THREE.BufferAttribute(particleAlpha, 1));
    const particlesMaterial = new THREE.PointsMaterial({
      color: theme === "violet" ? "#d8b4fe" : "#a5f3fc",
      size: isLowPerf ? 0.08 : 0.11,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      map: glowTexture,
      alphaMap: glowTexture,
    });
    const particles = new THREE.Points(particlesGeometry, particlesMaterial);
    scene.add(particles);

    const chestRoot = new THREE.Group();
    chestRoot.position.y = 0.08;
    scene.add(chestRoot);

    const rewardAnchor = new THREE.Group();
    rewardAnchor.position.set(0, 1.22, 0.42);
    chestRoot.add(rewardAnchor);

    const viewportState = {
      sceneCenterX: 0,
      horizontalOffset: 0,
      chestBaseScale: 1,
      platformScale: 1,
      cameraY: 2.55,
      cameraZ: 8.7,
      lookAtY: 1.4,
      verticalOffset: 0.08,
      auraY: 2.1,
      innerAuraY: 1.3,
      targetScreenY: 0,
      rewardCardScale: [2.25, 1.55],
      rewardCardSpacing: 2.35,
      statusMainScale: [3.2, 2.05],
        statusMiniScale: [1.6, 1.15],
        statusMiniSpacing: 2.1,
        rulesCardScale: [3.45, 2.28],
        rulesCardSpacing: 2.1,
      infoRootY: 1.35,
      infoRootZ: 0.6,
      minCameraZ: 6.6,
      maxCameraZ: 11.4,
    };

    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(1.9, isLowPerf ? 28 : 42),
      new THREE.MeshBasicMaterial({ color: "#020617", transparent: true, opacity: 0.4 })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.02;
    chestRoot.add(shadow);

    const closedChest = new THREE.Group();
    chestRoot.add(closedChest);

    let proceduralFallback = createProceduralClosedChest();
    closedChest.add(proceduralFallback);

    function createRewardTexture(label, description) {
      const canvas = document.createElement("canvas");
      canvas.width = 1024;
      canvas.height = 640;
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      gradient.addColorStop(0, "rgba(8,15,34,0.96)");
      gradient.addColorStop(1, "rgba(12,30,53,0.92)");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.roundRect(42, 52, 940, 536, 54);
      ctx.fill();

      ctx.strokeStyle = "rgba(103,232,249,0.85)";
      ctx.lineWidth = 8;
      ctx.stroke();

      ctx.fillStyle = "rgba(186,230,253,0.9)";
      ctx.font = "700 44px Arial";
      ctx.textAlign = "center";
      ctx.fillText("PARABENS!", canvas.width / 2, 152);

      ctx.fillStyle = "#ffffff";
      ctx.font = "900 76px Arial";
      const safeLabel = String(label || "Recompensa liberada").trim() || "Recompensa liberada";
      const words = safeLabel.split(/\s+/);
      const lines = [];
      let currentLine = "";
      words.forEach((word) => {
        const nextLine = currentLine ? `${currentLine} ${word}` : word;
        if (ctx.measureText(nextLine).width > 760 && currentLine) {
          lines.push(currentLine);
          currentLine = word;
          return;
        }
        currentLine = nextLine;
      });
      if (currentLine) lines.push(currentLine);
      const visibleLines = lines.slice(0, 2);
      visibleLines.forEach((line, index) => {
        ctx.fillText(line, canvas.width / 2, 256 + index * 84);
      });

      const safeDescription = String(description || "").trim();
      if (safeDescription) {
        ctx.fillStyle = "rgba(226,232,240,0.88)";
        ctx.font = "600 30px Arial";
        const descriptionWords = safeDescription.split(/\s+/);
        const descriptionLines = [];
        let currentDescription = "";
        descriptionWords.forEach((word) => {
          const nextLine = currentDescription ? `${currentDescription} ${word}` : word;
          if (ctx.measureText(nextLine).width > 760 && currentDescription) {
            descriptionLines.push(currentDescription);
            currentDescription = word;
            return;
          }
          currentDescription = nextLine;
        });
        if (currentDescription) descriptionLines.push(currentDescription);
        descriptionLines.slice(0, 3).forEach((line, index) => {
          ctx.fillText(line, canvas.width / 2, 396 + index * 42);
        });
      }

      ctx.fillStyle = "rgba(165,243,252,0.82)";
      ctx.font = "600 34px Arial";
      ctx.fillText("Bau Diario", canvas.width / 2, 556);

      const texture = new THREE.CanvasTexture(canvas);
      texture.needsUpdate = true;
      return texture;
    }

    const rewardTextureRef = { current: null };
    const rewardSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false,
      })
    );
    rewardSprite.scale.set(4.1, 2.05, 1);
    rewardSprite.visible = false;
    rewardAnchor.add(rewardSprite);

    const rewardHalo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTexture,
        transparent: true,
        opacity: 0,
        color: new THREE.Color("#67e8f9"),
        depthWrite: false,
      })
    );
    rewardHalo.scale.set(3.8, 3.8, 1);
    rewardAnchor.add(rewardHalo);

    const burstCount = isLowPerf ? 42 : 88;
    const burstPositions = new Float32Array(burstCount * 3);
    const burstScales = new Float32Array(burstCount);
    const burstMeta = Array.from({ length: burstCount }, () => ({
      theta: Math.random() * Math.PI * 2,
      phi: Math.random() * Math.PI,
      speed: 1.2 + Math.random() * 2.4,
      lift: 0.4 + Math.random() * 1.6,
      spread: 0.8 + Math.random() * 1.6,
    }));
    const burstGeometry = new THREE.BufferGeometry();
    burstGeometry.setAttribute("position", new THREE.BufferAttribute(burstPositions, 3));
    burstGeometry.setAttribute("scale", new THREE.BufferAttribute(burstScales, 1));
    const burstMaterial = new THREE.PointsMaterial({
      color: "#fef08a",
      size: isLowPerf ? 0.09 : 0.12,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      map: glowTexture,
      alphaMap: glowTexture,
    });
    const burstPoints = new THREE.Points(burstGeometry, burstMaterial);
    rewardAnchor.add(burstPoints);

    function drawRoundRect(ctx, x, y, width, height, radius) {
      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.lineTo(x + width - radius, y);
      ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
      ctx.lineTo(x + width, y + height - radius);
      ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
      ctx.lineTo(x + radius, y + height);
      ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.closePath();
    }

    function wrapLines(ctx, text, maxWidth) {
      const words = String(text || "").split(/\s+/).filter(Boolean);
      const lines = [];
      let current = "";
      words.forEach((word) => {
        const next = current ? `${current} ${word}` : word;
        if (ctx.measureText(next).width > maxWidth && current) {
          lines.push(current);
          current = word;
        } else {
          current = next;
        }
      });
      if (current) lines.push(current);
      return lines;
    }

    function createInfoCardTexture({
      eyebrow = "",
      title = "",
      value = "",
      body = "",
      accent = "#67e8f9",
      compactLayout = false,
      centeredBody = false,
    }) {
      const canvas = document.createElement("canvas");
      canvas.width = 768;
      canvas.height = 512;
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      gradient.addColorStop(0, "rgba(6,14,28,0.98)");
      gradient.addColorStop(1, "rgba(9,22,39,0.96)");
      drawRoundRect(ctx, 26, 26, 716, 460, 42);
      ctx.fillStyle = gradient;
      ctx.fill();
      ctx.lineWidth = 6;
      ctx.strokeStyle = accent;
      ctx.stroke();

      ctx.fillStyle = "rgba(186,230,253,0.88)";
      ctx.font = "700 28px Arial";
      ctx.textAlign = "left";
      ctx.fillText(String(eyebrow || "").toUpperCase(), 62, 86);

      ctx.fillStyle = "#ffffff";
      ctx.font = "900 56px Arial";
      const titleLines = wrapLines(ctx, title, compactLayout ? 644 : 620).slice(0, compactLayout ? 3 : 2);
      titleLines.forEach((line, index) => {
        ctx.fillText(line, 62, 160 + index * 54);
      });

      let bodyStartY = compactLayout ? 244 + Math.max(0, titleLines.length - 1) * 18 : 352;
      if (value) {
        ctx.fillStyle = accent;
        ctx.font = "900 52px Arial";
        ctx.fillText(value, 62, 292);
        bodyStartY = 352;
      }

      ctx.fillStyle = "rgba(226,232,240,0.9)";
      ctx.font = "600 26px Arial";
      ctx.textAlign = centeredBody ? "center" : "left";
      wrapLines(ctx, body, 620)
        .slice(0, compactLayout ? 5 : 4)
        .forEach((line, index) => {
          ctx.fillText(line, centeredBody ? canvas.width / 2 : 62, bodyStartY + index * 36);
        });
      ctx.textAlign = "left";

      if (compactLayout && !value) {
        ctx.strokeStyle = "rgba(103,232,249,0.18)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(62, Math.min(canvas.height - 34, bodyStartY + 176));
        ctx.lineTo(canvas.width - 62, Math.min(canvas.height - 34, bodyStartY + 176));
        ctx.stroke();
      }

      const texture = new THREE.CanvasTexture(canvas);
      texture.needsUpdate = true;
      return texture;
    }

    const infoRoot = new THREE.Group();
    infoRoot.position.set(0, viewportState.infoRootY, viewportState.infoRootZ);
    scene.add(infoRoot);
    const infoCards = [];
    const infoCardTextures = [];

    function clearInfoCards() {
      while (infoRoot.children.length) {
        const child = infoRoot.children.pop();
        if (child?.material?.map?.dispose) child.material.map.dispose();
        child?.material?.dispose?.();
      }
      infoCards.splice(0, infoCards.length);
      infoCardTextures.splice(0, infoCardTextures.length);
    }

    function createInfoSprite(config, scale = [3.1, 2.05], position = [0, 0, 0], rotationY = 0) {
      const texture = createInfoCardTexture(config);
      infoCardTextures.push(texture);
      const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const sprite = new THREE.Sprite(material);
      sprite.scale.set(scale[0], scale[1], 1);
      sprite.position.set(position[0], position[1], position[2]);
      sprite.userData = {
        basePosition: new THREE.Vector3(...position),
        rotationY,
        scale: new THREE.Vector3(scale[0], scale[1], 1),
      };
      infoRoot.add(sprite);
      infoCards.push(sprite);
      return sprite;
    }

    function getProbabilityLabel(pool, reward) {
      const totalWeight = pool.reduce((sum, entry) => sum + Math.max(0, Number(entry.weight || 0)), 0);
      if (totalWeight <= 0) return "Chance controlada";
      const probability = (Math.max(0, Number(reward.weight || 0)) / totalWeight) * 100;
      return `${probability.toFixed(probability < 1 ? 2 : 1)}%`;
    }

    let lastInfoSignature = "";
    function syncInfoCards(runtime) {
      const pool = Array.isArray(runtime.rewardPool) ? runtime.rewardPool.filter((entry) => entry.active !== false) : [];
      const signature = JSON.stringify({
        mode: runtime.viewMode,
        stageState: runtime.stageState,
        rewardLabel: runtime.rewardLabel,
        pool: pool.map((entry) => [entry.id, entry.title, entry.rewardAmount, entry.weight, entry.dailyCap, entry.rarity]),
        slots: runtime.slotSummary,
        status: runtime.statusInfo,
      });
      if (signature === lastInfoSignature) return;
      lastInfoSignature = signature;
      clearInfoCards();

      if (runtime.viewMode === "rewards") {
        pool.slice(0, 5).forEach((entry, index) => {
          const accent =
            entry.rarity === "legendary" ? "#fbbf24" : entry.rarity === "epic" ? "#c084fc" : "#67e8f9";
          const x = (index - Math.min(pool.length - 1, 4) / 2) * viewportState.rewardCardSpacing;
          createInfoSprite(
            {
              eyebrow: entry.isFallback ? "Garantido" : "Premio do dia",
              title: entry.title || "Premio",
              value: `${String(entry.rewardAmount || 0).replace(".", ",")} ${entry.rewardUnit || ""}`.trim(),
              body: `${getProbabilityLabel(pool, entry)} de chance • Limite do dia: ${Number(entry.dailyCap || 0) > 0 ? entry.dailyCap : "livre"}`,
              accent,
            },
            viewportState.rewardCardScale,
            [x, 0.18 + Math.abs(index - 2) * -0.06, -Math.abs(index - 2) * 0.48],
            x * -0.08
          );
        });
      } else if (runtime.viewMode === "status") {
        createInfoSprite(
          {
            eyebrow: "Status",
            title: runtime.statusInfo?.title || "Bau Diario",
            value: `${Math.max(0, Number(runtime.slotSummary?.remaining || 0))} bau(s)`,
            body: runtime.statusInfo?.body || "Acompanhe o ciclo do bau.",
            accent: "#67e8f9",
          },
          viewportState.statusMainScale,
          [0, 0.18, 0]
        );
        createInfoSprite(
          {
            eyebrow: "Toques",
            title: "Progresso",
            value: `${Math.min(Number(runtime.tapProgress || 0), Number(runtime.tapGoal || 0))}/${Number(runtime.tapGoal || 0)}`,
            body: "Meta de toques para abrir.",
            accent: "#a78bfa",
          },
          viewportState.statusMiniScale,
          [-viewportState.statusMiniSpacing, -0.82, -0.4]
        );
        createInfoSprite(
          {
            eyebrow: "Bonus",
            title: "Baus extras",
            value: `${Math.max(0, Number(runtime.slotSummary?.bonus || 0))}`,
            body: "Liberados por depositos aprovados.",
            accent: "#34d399",
          },
          viewportState.statusMiniScale,
          [viewportState.statusMiniSpacing, -0.82, -0.4]
        );
        } else if (runtime.viewMode === "rules") {
          createInfoSprite(
            {
              eyebrow: "Regras do bau",
              title: "Como funciona hoje",
              body: [
                "Cada bau pode ser usado uma vez por ciclo e o giro confirma o premio no backend.",
                "Depositos aprovados podem liberar baus extras no mesmo dia.",
                `Hoje voce tem ${Math.max(0, Number(runtime.slotSummary?.total || 0))} bau(s) liberado(s) no total.`,
              ].join("  "),
              accent: "#67e8f9",
            },
            viewportState.rulesCardScale,
            [0, 0.12, -0.08]
          );
        }
    }

    let mounted = true;

    const stateRef = {
      lastTime: performance.now(),
      impact: 0,
      glowBoost: 0,
      lastTapPulseToken: tapPulseToken,
      lastSpinToken: spinToken,
      openProgress: stageState === "opened" || stageState === "claimed" ? 1 : 0,
      spinElapsed: 999,
      spinDuration: 1.45,
      spinStartRotation: 0,
      spinTargetRotation: 0,
      lastSpinAngle: 0,
      spinVelocity: 0,
      lastStageState: stageState,
      revealElapsed: stageState === "opened" || stageState === "claimed" ? 1 : 0,
      panelProgress: viewMode === "main" ? 0 : 1,
      carouselOffset: 0,
      carouselTargetOffset: 0,
      chestDragRotation: 0,
      chestDragVelocity: 0,
      focusedCardIndex: -1,
      cameraZoomOffset: 0,
      cameraZoomTarget: 0,
    };

    const dragState = {
      active: false,
      moved: false,
      startX: 0,
      startOffset: 0,
      mode: "main",
    };

    const pinchState = {
      active: false,
      startDistance: 0,
      startZoomTarget: 0,
    };

    const activePointers = new Map();

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    function getCarouselBounds(runtime) {
      if (runtime.viewMode === "rewards") {
        const count = Math.min(Array.isArray(runtime.rewardPool) ? runtime.rewardPool.filter((entry) => entry.active !== false).length : 0, 5);
        return Math.max(0, ((count - 1) * viewportState.rewardCardSpacing) / 2);
      }
      if (runtime.viewMode === "rules") {
        return viewportState.rulesCardSpacing * 0.55;
      }
      if (runtime.viewMode === "status") {
        return viewportState.statusMiniSpacing * 0.38;
      }
      return 0;
    }

    function clampCarouselOffset(runtime, value) {
      const bound = getCarouselBounds(runtime);
      return clamp(value, -bound, bound);
    }

    function clampCameraZoom(value) {
      return clamp(value, viewportState.minCameraZ - viewportState.cameraZ, viewportState.maxCameraZ - viewportState.cameraZ);
    }

    function getPointerDistance() {
      const pointers = Array.from(activePointers.values());
      if (pointers.length < 2) return 0;
      const [first, second] = pointers;
      const dx = second.clientX - first.clientX;
      const dy = second.clientY - first.clientY;
      return Math.hypot(dx, dy);
    }

    renderer.domElement.style.willChange = "transform";
    renderer.domElement.style.touchAction = "none";

    function handlePointerDown(event) {
      const runtime = runtimeRef.current;
      activePointers.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY });
      if (activePointers.size >= 2) {
        pinchState.active = true;
        pinchState.startDistance = getPointerDistance();
        pinchState.startZoomTarget = stateRef.cameraZoomTarget;
        dragState.active = false;
        return;
      }
      dragState.active = true;
      dragState.moved = false;
      dragState.mode = runtime.viewMode;
      dragState.startX = event.clientX;
      dragState.startOffset = stateRef.carouselTargetOffset;
      if (runtime.viewMode === "main") {
        stateRef.focusedCardIndex = -1;
      }
      renderer.domElement.style.cursor = "grabbing";
    }

    function handlePointerMove(event) {
      if (activePointers.has(event.pointerId)) {
        activePointers.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY });
      }
      if (pinchState.active && activePointers.size >= 2) {
        const distance = getPointerDistance();
        if (distance > 0 && pinchState.startDistance > 0) {
          const delta = (distance - pinchState.startDistance) * -0.008;
          stateRef.cameraZoomTarget = clampCameraZoom(pinchState.startZoomTarget + delta);
        }
        return;
      }
      if (!dragState.active) return;
      const runtime = runtimeRef.current;
      const deltaX = event.clientX - dragState.startX;
      if (Math.abs(deltaX) > 4) {
        dragState.moved = true;
      }
      if (dragState.mode === "main") {
        stateRef.chestDragRotation = normalizeAngle(stateRef.chestDragRotation + deltaX * 0.003);
        stateRef.chestDragVelocity = clamp(deltaX * 0.0025, -0.22, 0.22);
        dragState.startX = event.clientX;
        return;
      }
      const nextOffset = dragState.startOffset + deltaX * 0.01;
      stateRef.carouselTargetOffset = clampCarouselOffset(runtime, nextOffset);
    }

    function handlePointerUp(event) {
      const runtime = runtimeRef.current;
      activePointers.delete(event.pointerId);
      if (activePointers.size < 2) {
        pinchState.active = false;
      }
      if (dragState.active && !dragState.moved && runtime.viewMode !== "main") {
        const rect = renderer.domElement.getBoundingClientRect();
        pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);
        const intersects = raycaster.intersectObjects(infoCards, false);
        if (intersects.length > 0) {
          const hitIndex = infoCards.findIndex((sprite) => sprite === intersects[0].object);
          stateRef.focusedCardIndex = stateRef.focusedCardIndex === hitIndex ? -1 : hitIndex;
        } else {
          stateRef.focusedCardIndex = -1;
        }
      }
      dragState.active = false;
      renderer.domElement.style.cursor = runtime.viewMode === "main" ? "grab" : "grab";
    }

    function handleWheel(event) {
      const runtime = runtimeRef.current;
      event.preventDefault();
      if (runtime.viewMode === "main") {
        stateRef.cameraZoomTarget = clampCameraZoom(stateRef.cameraZoomTarget + event.deltaY * 0.0035);
        return;
      }
      const delta = event.deltaX !== 0 ? event.deltaX : event.deltaY;
      stateRef.carouselTargetOffset = clampCarouselOffset(runtime, stateRef.carouselTargetOffset + delta * 0.0045);
    }

    renderer.domElement.addEventListener("pointerdown", handlePointerDown);
    renderer.domElement.addEventListener("wheel", handleWheel, { passive: false });
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    renderer.domElement.style.cursor = "grab";

    function resize() {
      if (!mount) return;
      const width = mount.clientWidth || 1;
      const height = mount.clientHeight || 1;
      const isPortraitMobile = width < 640 && height > width;
      const veryNarrowMobile = width < 430 && height > width;
      const ultraNarrowMobile = width < 380 && height > width;
      const tallPhone = isPortraitMobile && height / Math.max(width, 1) > 1.9;

      camera.fov = ultraNarrowMobile ? 52 : veryNarrowMobile ? 48 : isPortraitMobile ? 44 : 38;
      viewportState.cameraY = ultraNarrowMobile ? 2.36 : veryNarrowMobile ? 2.42 : isPortraitMobile ? 2.5 : 2.55;
      viewportState.cameraZ = ultraNarrowMobile ? 10.9 : veryNarrowMobile ? 10.2 : isPortraitMobile ? 9.3 : 8.7;
      viewportState.minCameraZ = ultraNarrowMobile ? 8.2 : veryNarrowMobile ? 7.8 : isPortraitMobile ? 7.1 : 6.6;
      viewportState.maxCameraZ = ultraNarrowMobile ? 12.2 : veryNarrowMobile ? 11.6 : isPortraitMobile ? 10.8 : 9.8;
      viewportState.lookAtY = ultraNarrowMobile ? 1.28 : veryNarrowMobile ? 1.34 : isPortraitMobile ? 1.38 : 1.4;
      viewportState.chestBaseScale = ultraNarrowMobile ? 0.78 : veryNarrowMobile ? 0.84 : isPortraitMobile ? 0.92 : 1;
      viewportState.platformScale = ultraNarrowMobile ? 0.92 : veryNarrowMobile ? 0.96 : isPortraitMobile ? 1 : 1;
      viewportState.verticalOffset = ultraNarrowMobile ? 0.3 : veryNarrowMobile ? 0.24 : isPortraitMobile ? 0.2 : 0.08;
      viewportState.sceneCenterX = 0;
      viewportState.horizontalOffset = viewportState.sceneCenterX;
      viewportState.auraY = ultraNarrowMobile ? 1.84 : veryNarrowMobile ? 1.92 : isPortraitMobile ? 2 : 2.1;
      viewportState.innerAuraY = ultraNarrowMobile ? 1.12 : veryNarrowMobile ? 1.18 : isPortraitMobile ? 1.22 : 1.3;
      viewportState.targetScreenY = isPortraitMobile ? 0.03 : 0.02;
      viewportState.rewardCardScale = ultraNarrowMobile
        ? [1.52, 1.04]
        : veryNarrowMobile
        ? [1.68, 1.12]
        : isPortraitMobile
        ? [1.82, 1.2]
        : width < 1100
        ? [2.02, 1.38]
        : [2.25, 1.55];
      viewportState.rewardCardSpacing = ultraNarrowMobile ? 1.42 : veryNarrowMobile ? 1.52 : isPortraitMobile ? 1.68 : width < 1100 ? 1.92 : 2.35;
      viewportState.statusMainScale = ultraNarrowMobile
        ? [2.04, 1.36]
        : veryNarrowMobile
        ? [2.2, 1.46]
        : isPortraitMobile
        ? [2.42, 1.58]
        : width < 1100
        ? [2.72, 1.8]
        : [3.2, 2.05];
      viewportState.statusMiniScale = ultraNarrowMobile
        ? [1.12, 0.82]
        : veryNarrowMobile
        ? [1.18, 0.86]
        : isPortraitMobile
        ? [1.26, 0.9]
        : width < 1100
        ? [1.42, 1.02]
        : [1.6, 1.15];
      viewportState.statusMiniSpacing = ultraNarrowMobile ? 1.25 : veryNarrowMobile ? 1.34 : isPortraitMobile ? 1.46 : width < 1100 ? 1.7 : 2.1;
        viewportState.rulesCardScale = ultraNarrowMobile
          ? [2.16, 1.42]
          : veryNarrowMobile
          ? [2.32, 1.52]
          : isPortraitMobile
          ? [2.5, 1.62]
          : width < 1100
          ? [2.92, 1.94]
          : [3.45, 2.28];
      viewportState.rulesCardSpacing = ultraNarrowMobile ? 1.36 : veryNarrowMobile ? 1.46 : isPortraitMobile ? 1.56 : width < 1100 ? 1.78 : 2.1;
      viewportState.infoRootY = ultraNarrowMobile ? 1.42 : veryNarrowMobile ? 1.4 : isPortraitMobile ? 1.38 : 1.35;
      viewportState.infoRootZ = ultraNarrowMobile ? 0.72 : isPortraitMobile ? 0.68 : 0.6;

      if (tallPhone) {
        viewportState.cameraZ -= 0.25;
        viewportState.chestBaseScale *= 1.04;
        viewportState.verticalOffset += 0.03;
      }

      stateRef.cameraZoomTarget = clampCameraZoom(stateRef.cameraZoomTarget);
      stateRef.cameraZoomOffset = clampCameraZoom(stateRef.cameraZoomOffset);
      camera.position.set(0, viewportState.cameraY, viewportState.cameraZ + stateRef.cameraZoomOffset);
      camera.lookAt(viewportState.sceneCenterX * 0.2, viewportState.lookAtY, 0);
      platformGroup.position.x = viewportState.sceneCenterX;
      aura.position.set(viewportState.sceneCenterX, viewportState.auraY, -2.6);
      innerAura.position.set(viewportState.sceneCenterX, viewportState.innerAuraY, -0.8);
      platformGroup.scale.setScalar(viewportState.platformScale);
      infoRoot.position.set(viewportState.sceneCenterX, viewportState.infoRootY, viewportState.infoRootZ);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, true);
      renderer.domElement.style.cursor = "grab";
    }

    window.addEventListener("resize", resize);
    resize();

    let rafId = 0;
    const animate = () => {
      rafId = requestAnimationFrame(animate);
      const now = performance.now();
      const dt = clamp((now - stateRef.lastTime) / 1000, 0.001, 0.04);
      stateRef.lastTime = now;
      const elapsed = now * 0.001;
      const runtime = runtimeRef.current;
      const rewardText = String(runtime.rewardLabel || "").trim() || "Recompensa liberada";
      const rewardBody = String(runtime.rewardDescription || "").trim();
      syncInfoCards(runtime);
      const panelTarget = runtime.viewMode === "main" ? 0 : 1;

      if (stateRef.lastTapPulseToken !== runtime.tapPulseToken) {
        stateRef.lastTapPulseToken = runtime.tapPulseToken;
        stateRef.impact = 1;
        stateRef.glowBoost = Math.min(1.4, stateRef.glowBoost + 0.34);
      }

      if (stateRef.lastSpinToken !== runtime.spinToken) {
        stateRef.lastSpinToken = runtime.spinToken;
        stateRef.spinElapsed = 0;
        stateRef.chestDragRotation = 0;
        stateRef.chestDragVelocity = 0;
        stateRef.spinStartRotation = chestRoot.rotation.y || 0;
        stateRef.spinTargetRotation = stateRef.spinStartRotation + Math.PI * 4;
        stateRef.lastSpinAngle = stateRef.spinStartRotation;
        stateRef.spinVelocity = 0;
        stateRef.impact = 1;
        stateRef.glowBoost = Math.min(1.8, stateRef.glowBoost + 0.42);
      }

      if (stateRef.lastStageState !== runtime.stageState) {
        const wasClosed = stateRef.lastStageState !== "opened" && stateRef.lastStageState !== "claimed";
        const becameOpen = runtime.stageState === "opened" || runtime.stageState === "claimed";
        if (wasClosed && becameOpen) {
          stateRef.revealElapsed = 0;
        }
        stateRef.lastStageState = runtime.stageState;
      }

      stateRef.impact = Math.max(0, stateRef.impact - dt * 2.7);
      stateRef.glowBoost = Math.max(0, stateRef.glowBoost - dt * 0.65);
      stateRef.panelProgress += (panelTarget - stateRef.panelProgress) * Math.min(1, dt * 4.6);
      stateRef.carouselTargetOffset = clampCarouselOffset(runtime, stateRef.carouselTargetOffset);
      stateRef.carouselOffset += (stateRef.carouselTargetOffset - stateRef.carouselOffset) * Math.min(1, dt * 7);
      stateRef.cameraZoomTarget = clampCameraZoom(stateRef.cameraZoomTarget);
      stateRef.cameraZoomOffset += (stateRef.cameraZoomTarget - stateRef.cameraZoomOffset) * Math.min(1, dt * 7);
      stateRef.chestDragRotation = normalizeAngle(stateRef.chestDragRotation + stateRef.chestDragVelocity);
      stateRef.chestDragVelocity *= 0.92;
      camera.position.z = viewportState.cameraZ + stateRef.cameraZoomOffset;
      camera.lookAt(viewportState.sceneCenterX * 0.2, viewportState.lookAtY, 0);

      const shouldOpen =
        (runtime.stageState === "opened" || runtime.stageState === "claimed") &&
        stateRef.spinElapsed >= stateRef.spinDuration;
      const openTarget = shouldOpen ? 1 : 0;
      stateRef.openProgress += (openTarget - stateRef.openProgress) * Math.min(1, dt * (shouldOpen ? 2.4 : 4.2));

      const progressRatio = runtime.tapGoal > 0 ? runtime.tapProgress / runtime.tapGoal : 0;
      const breathing = 1 + Math.sin(elapsed * 1.4) * 0.018;
      const floatOffset = Math.sin(elapsed * 1.2) * 0.12;
      const impactStrength = Math.sin((1 - stateRef.impact) * Math.PI * 5) * stateRef.impact * 0.12;
      const idleTwist = Math.sin(elapsed * 1.6) * 0.08 + impactStrength + progressRatio * 0.12;

      stateRef.spinElapsed = Math.min(stateRef.spinDuration, stateRef.spinElapsed + dt);
      const spinRatio = clamp(stateRef.spinElapsed / stateRef.spinDuration, 0, 1);
      const easedSpin = easeChestSpin(spinRatio);
      const spinAngle = stateRef.spinElapsed < stateRef.spinDuration
        ? THREE.MathUtils.lerp(stateRef.spinStartRotation, stateRef.spinTargetRotation, easedSpin)
        : stateRef.spinTargetRotation;
      stateRef.spinVelocity = (spinAngle - stateRef.lastSpinAngle) / Math.max(dt, 0.001);
      stateRef.lastSpinAngle = spinAngle;
      stateRef.revealElapsed = clamp(stateRef.revealElapsed + (shouldOpen ? dt * 1.9 : -dt * 3.5), 0, 1.4);
      const revealProgress = clamp(stateRef.revealElapsed, 0, 1);
      const revealEase = 1 - Math.pow(1 - revealProgress, 3);

      const panelEase = 1 - Math.pow(1 - clamp(stateRef.panelProgress, 0, 1), 3);
      const hiddenX = viewportState.sceneCenterX - 6.4;
      chestRoot.position.x = THREE.MathUtils.lerp(viewportState.horizontalOffset, hiddenX, panelEase);
      chestRoot.position.y =
        viewportState.verticalOffset +
        floatOffset +
        progressRatio * 0.02 -
        panelEase * 0.18;
      chestRoot.rotation.y = stateRef.spinElapsed < stateRef.spinDuration ? spinAngle : idleTwist + stateRef.chestDragRotation;
      chestRoot.rotation.x = impactStrength * 0.14;
      chestRoot.scale.setScalar(
        viewportState.chestBaseScale *
          THREE.MathUtils.lerp(
            breathing + progressRatio * 0.02 + stateRef.impact * 0.04,
            0.62,
            panelEase
          )
      );

      const visibleBounds = getRenderableBounds(closedChest);
      const visibleCenter = visibleBounds.getCenter(new THREE.Vector3());
      const projectedCenter = visibleCenter.clone().project(camera);
      const desiredPoint = new THREE.Vector3(0, viewportState.targetScreenY, projectedCenter.z).unproject(camera);
      const correction = desiredPoint.sub(visibleCenter);
      chestRoot.position.x += clamp(correction.x * 0.18, -0.12, 0.12);
      chestRoot.position.y += clamp(correction.y * 0.18, -0.12, 0.12);

      renderer.domElement.style.filter = runtime.stageState === "locked"
        ? "grayscale(1) brightness(0.72)"
        : "none";

      closedChest.visible = true;
      closedChest.scale.setScalar(1 - revealEase * 0.74);
      closedChest.position.y = stateRef.openProgress * 0.06 + revealEase * 0.2;

      aura.material.opacity =
        (0.56 + Math.sin(elapsed * 1.7) * 0.12 + progressRatio * 0.14 + stateRef.glowBoost * 0.18) *
        (1 - panelEase * 0.58);
      aura.scale.setScalar(7.8 + Math.sin(elapsed * 0.9) * 0.24 + progressRatio * 0.6 + stateRef.glowBoost * 0.9);
      innerAura.material.opacity = (0.3 + progressRatio * 0.12 + stateRef.openProgress * 0.3) * (1 - panelEase * 0.62);
      innerAura.scale.setScalar(4.8 + progressRatio * 0.34 + stateRef.openProgress * 0.82);
      ring.material.opacity = (0.44 + progressRatio * 0.18 + stateRef.glowBoost * 0.14) * (1 - panelEase * 0.4);
      ring.scale.setScalar(1 + Math.sin(elapsed * 1.1) * 0.02 + progressRatio * 0.03);
      chestLight.intensity = 2.6 + progressRatio * 1.4 + stateRef.glowBoost * 1.6 + stateRef.openProgress * 5.4;

      const activeClosedMaterials = [];
      closedChest.traverse((node) => {
        const materials = Array.isArray(node.material) ? node.material : [node.material];
        materials.filter(Boolean).forEach((material) => {
          if (material.emissive) {
            activeClosedMaterials.push(material);
          }
        });
      });
      activeClosedMaterials.forEach((material) => {
        material.emissiveIntensity = 0.08 + progressRatio * 0.35 + stateRef.glowBoost * 0.55;
        material.transparent = revealEase > 0.02;
        material.opacity = clamp(1 - revealEase * 1.28, 0, 1);
      });

      if (
        rewardTextureRef.current?.label !== rewardText ||
        rewardTextureRef.current?.description !== rewardBody
      ) {
        rewardTextureRef.current?.texture?.dispose?.();
        rewardTextureRef.current = {
          label: rewardText,
          description: rewardBody,
          texture: createRewardTexture(rewardText, rewardBody),
        };
        rewardSprite.material.map = rewardTextureRef.current.texture;
        rewardSprite.material.needsUpdate = true;
      }

      rewardSprite.visible = revealEase > 0.02;
      rewardSprite.material.opacity = clamp(revealEase * 1.18, 0, 1);
      rewardSprite.scale.setScalar(1);
      rewardSprite.scale.set(3.4 + revealEase * 1.3, 1.7 + revealEase * 0.64, 1);
      rewardSprite.position.set(0, revealEase * 0.52, 0.52);
      rewardSprite.material.rotation = Math.sin(elapsed * 1.6) * 0.02;
      rewardHalo.material.opacity = clamp(revealEase * 0.75, 0, 0.75);
      rewardHalo.scale.set(3.4 + revealEase * 2.2, 3.4 + revealEase * 2.2, 1);

      infoCards.forEach((sprite, index) => {
        const basePosition = sprite.userData.basePosition || new THREE.Vector3();
        const bob = Math.sin(elapsed * 1.6 + index * 0.65) * 0.05;
        const modeVisible = runtime.viewMode !== "main";
        const spreadMultiplier = runtime.viewMode === "rewards" ? 1 : runtime.viewMode === "rules" ? 0.9 : 0.7;
        const offsetX = stateRef.carouselOffset * spreadMultiplier;
        const isFocused = stateRef.focusedCardIndex === index;
        sprite.visible = modeVisible;
        sprite.material.opacity += ((modeVisible ? 1 : 0) - sprite.material.opacity) * Math.min(1, dt * 5.5);
        const focusX = isFocused ? 0 : basePosition.x + offsetX;
        const focusY = isFocused ? 0.08 : basePosition.y + bob + panelEase * 0.04;
        const focusZ = isFocused ? 0.55 : basePosition.z;
        sprite.position.set(
          THREE.MathUtils.lerp(sprite.position.x, focusX, Math.min(1, dt * 9)),
          THREE.MathUtils.lerp(sprite.position.y, focusY, Math.min(1, dt * 9)),
          THREE.MathUtils.lerp(sprite.position.z, focusZ, Math.min(1, dt * 9))
        );
        sprite.scale.set(
          sprite.userData.scale.x * (isFocused ? 1.42 : 0.92 + panelEase * 0.08),
          sprite.userData.scale.y * (isFocused ? 1.42 : 0.92 + panelEase * 0.08),
          1
        );
        sprite.material.rotation = isFocused ? Math.sin(elapsed * 0.8) * 0.01 : 0;
      });

      burstMaterial.opacity = clamp((1 - revealProgress) * 1.8, 0, 0.95);
      burstMeta.forEach((entry, index) => {
        const burstRadius = revealEase * entry.spread;
        burstPositions[index * 3] = Math.cos(entry.theta) * burstRadius;
        burstPositions[index * 3 + 1] = revealEase * entry.lift + Math.sin(entry.phi + elapsed * 0.4) * 0.12;
        burstPositions[index * 3 + 2] = Math.sin(entry.theta) * burstRadius * 0.5;
        burstScales[index] = clamp(1 - revealProgress * 0.65, 0.2, 1);
      });
      burstGeometry.attributes.position.needsUpdate = true;
      burstGeometry.attributes.scale.needsUpdate = true;

      particleMeta.forEach((entry, index) => {
        const phase = elapsed * entry.speed + entry.offset;
        const radius = entry.radius + Math.sin(phase * 1.8) * 0.18;
        const orbitLift = 0.85 + Math.sin(phase * 2.2) * 0.26;
        particlePositions[index * 3] = Math.cos(phase * entry.drift) * radius;
        particlePositions[index * 3 + 1] = orbitLift + entry.baseY * 0.18;
        particlePositions[index * 3 + 2] = Math.sin(phase * entry.drift) * radius * 0.34;
        particleAlpha[index] = 0.36 + Math.sin(phase * 2.6) * 0.18 + progressRatio * 0.14 + stateRef.openProgress * 0.28;
      });
      particlesGeometry.attributes.position.needsUpdate = true;
      particlesGeometry.attributes.alpha.needsUpdate = true;
      particles.position.copy(chestRoot.position).add(new THREE.Vector3(0, 0.5, 0));
      particles.rotation.y += dt * 0.74;

      backgroundGroup.children.forEach((line, index) => {
        line.position.x = Math.sin(elapsed * 0.25 + index) * 0.4;
        line.material.opacity = 0.04 + progressRatio * 0.06 + Math.sin(elapsed + index) * 0.015;
      });

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      mounted = false;
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
      renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
      renderer.domElement.removeEventListener("wheel", handleWheel);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      mount.removeChild(renderer.domElement);
      backdropPlane.geometry.dispose();
      backdropPlane.material.dispose();
      backgroundTexture.dispose();
      glowTexture.dispose();
      particlesGeometry.dispose();
      particlesMaterial.dispose();
      burstGeometry.dispose();
      burstMaterial.dispose();
      rewardTextureRef.current?.texture?.dispose?.();
      clearInfoCards();
      disposeObject(closedChest);
      renderer.dispose();
    };
  }, [onSceneReady, rarity, theme]);

  return <div ref={mountRef} className="h-full w-full" />;
}
