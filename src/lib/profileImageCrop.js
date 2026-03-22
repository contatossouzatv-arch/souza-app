function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function loadImageFromUrl(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Não foi possível carregar a imagem."));
    img.src = url;
  });
}

export function getProfileCropPreviewStyle(zoom = 1, offsetY = 0, offsetX = 0) {
  return {
    transform: `translate(${offsetX}px, ${offsetY}px) scale(${zoom})`,
    transformOrigin: "center center",
  };
}

export async function generateCroppedProfileImage(file, options = {}) {
  const size = Number(options.size || 512);
  const zoom = clamp(Number(options.zoom || 1), 1, 3);
  const offsetY = Number(options.offsetY || 0);
  const offsetX = Number(options.offsetX || 0);

  const sourceUrl = URL.createObjectURL(file);
  try {
    const image = await loadImageFromUrl(sourceUrl);
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      throw new Error("Falha ao preparar o recorte da imagem.");
    }

    const baseScale = Math.max(size / image.width, size / image.height);
    const drawWidth = image.width * baseScale * zoom;
    const drawHeight = image.height * baseScale * zoom;
    const maxOffsetX = Math.max(0, (drawWidth - size) / 2);
    const maxOffsetY = Math.max(0, (drawHeight - size) / 2);
    const clampedOffsetX = clamp(offsetX, -maxOffsetX, maxOffsetX);
    const clampedOffsetY = clamp(offsetY, -maxOffsetY, maxOffsetY);

    const drawX = (size - drawWidth) / 2 + clampedOffsetX;
    const drawY = (size - drawHeight) / 2 + clampedOffsetY;

    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);

    const blob = await new Promise((resolve) => {
      canvas.toBlob(resolve, "image/webp", 0.92);
    });

    if (!blob) {
      throw new Error("Não foi possível gerar o arquivo de imagem.");
    }

    return new File([blob], `profile-${Date.now()}.webp`, { type: "image/webp" });
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}
