/**
 * StoryPanel renders one timeline image as a WebGL plane.
 *
 * The texture's source image aspect ratio controls the plane geometry.
 * The plane is contained inside the timeline card's maximum display area,
 * so images are never cropped or stretched and panel.scale still controls
 * the overall maximum size.
 */

import { useFrame, useThree } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import {
  memo,
  useEffect,
  useRef,
  useState,
} from "react";
import * as THREE from "three";

import type { TimelinePanel } from "./timeline.types";

interface StoryPanelProps {
  panel: TimelinePanel;
  dimmed?: boolean;
}

/**
 * WebGL texture 必須以 CORS（anonymous）載入，而一般 DOM <img> 不帶 crossOrigin。
 * 兩者若共用同一個 URL，先被 no-cors 快取的回應沒有 Access-Control-Allow-Origin，
 * 之後的 texture 請求就會 CORS 失敗（RWD-002）。加上查詢參數讓 texture 使用獨立的快取鍵；
 * R2 public URL 會忽略查詢參數並回傳同一個物件。
 */
function textureRequestUrl(src: string) {
  if (!/^https?:\/\//i.test(src)) return src;
  return `${src}${src.includes("?") ? "&" : "?"}cors=texture`;
}

const BASE_MAX_WIDTH = 2.55;
const BASE_MAX_HEIGHT = 1.76;
const DEFAULT_ASPECT =
  BASE_MAX_WIDTH / BASE_MAX_HEIGHT;
const DIAGNOSTIC_INTERVAL_MS = 1000;

const mountCounts = new Map<string, number>();
const unmountCounts = new Map<string, number>();
const textureLoadCounts = new Map<string, number>();

function getPanelKey(panel: TimelinePanel) {
  return `${panel.id}:${panel.image}`;
}

function getDebugPanelId() {
  if (!import.meta.env.DEV || typeof window === "undefined") {
    return null;
  }

  return new URLSearchParams(window.location.search).get(
    "timelineDebugPanel",
  );
}

function getCount(
  counts: Map<string, number>,
  key: string,
) {
  return counts.get(key) ?? 0;
}

function incrementCount(
  counts: Map<string, number>,
  key: string,
) {
  const next = getCount(counts, key) + 1;
  counts.set(key, next);
  return next;
}

function getTotalCount(counts: Map<string, number>) {
  let total = 0;

  counts.forEach((count) => {
    total += count;
  });

  return total;
}

export function getTimelinePanelDiagnosticsSnapshot() {
  const debugPanelId = getDebugPanelId();
  let debugPanel:
    | {
        key: string;
        mountCount: number;
        unmountCount: number;
        textureLoadCount: number;
      }
    | undefined;

  if (debugPanelId) {
    for (const key of new Set([
      ...mountCounts.keys(),
      ...unmountCounts.keys(),
      ...textureLoadCounts.keys(),
    ])) {
      if (key.startsWith(`${debugPanelId}:`)) {
        debugPanel = {
          key,
          mountCount: getCount(mountCounts, key),
          unmountCount: getCount(unmountCounts, key),
          textureLoadCount: getCount(textureLoadCounts, key),
        };
        break;
      }
    }
  }

  return {
    debugPanel,
    totalMountCount: getTotalCount(mountCounts),
    totalUnmountCount: getTotalCount(unmountCounts),
    totalTextureLoadCount: getTotalCount(textureLoadCounts),
  };
}

interface TextureImageSize {
  naturalWidth?: number;
  naturalHeight?: number;
  width?: number;
  height?: number;
  currentSrc?: string;
  src?: string;
}

function getTextureImageAspect(
  texture: THREE.Texture,
): number {
  const image = texture.image as
    | TextureImageSize
    | undefined;

  const imageWidth =
    image?.naturalWidth ?? image?.width;
  const imageHeight =
    image?.naturalHeight ?? image?.height;

  const aspect =
    typeof imageWidth === "number" &&
    typeof imageHeight === "number" &&
    imageWidth > 0 &&
    imageHeight > 0
      ? imageWidth / imageHeight
      : DEFAULT_ASPECT;

  return Number.isFinite(aspect) && aspect > 0
    ? aspect
    : DEFAULT_ASPECT;
}

/**
 * Loads the R2 image texture, reads its original dimensions, and sizes both
 * the image plane and shadow plane with object-fit: contain behavior.
 */
function StoryPanelComponent({
  panel,
  dimmed = false,
}: StoryPanelProps) {
  const groupRef = useRef<THREE.Group>(null);
  const imageMeshRef = useRef<THREE.Mesh>(null);
  const [texture, setTexture] =
    useState<THREE.Texture | null>(null);
  const [loadFailed, setLoadFailed] =
    useState(false);
  const [imageAspect, setImageAspect] =
    useState(DEFAULT_ASPECT);
  const [hovered, setHovered] = useState(false);

  const invalidate = useThree((state) => state.invalidate);
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  const panelKey = getPanelKey(panel);
  const isDebugPanel =
    import.meta.env.DEV &&
    getDebugPanelId() === panel.id;
  const lastScreenDiagnosticAt = useRef(0);

  const shouldZeroRotation =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get(
      "timelineRotation",
    ) === "0";

  const effectiveRotation = shouldZeroRotation
    ? ([0, 0, 0] as [number, number, number])
    : panel.rotation;

  useEffect(() => {
    if (!import.meta.env.DEV) {
      return;
    }

    const mountCount = incrementCount(
      mountCounts,
      panelKey,
    );

    if (isDebugPanel) {
      console.table({
        panelId: panel.id,
        mountCount,
        unmountCount: getCount(
          unmountCounts,
          panelKey,
        ),
        textureLoadCount: getCount(
          textureLoadCounts,
          panelKey,
        ),
        src: panel.image,
      });
    }

    return () => {
      const unmountCount = incrementCount(
        unmountCounts,
        panelKey,
      );

      if (isDebugPanel) {
        console.table({
          panelId: panel.id,
          mountCount: getCount(
            mountCounts,
            panelKey,
          ),
          unmountCount,
          textureLoadCount: getCount(
            textureLoadCounts,
            panelKey,
          ),
          src: panel.image,
        });
      }
    };
  }, [isDebugPanel, panel.id, panel.image, panelKey]);

  useEffect(() => {
    let cancelled = false;
    let loadedTexture: THREE.Texture | null = null;

    const src = panel.image?.trim();

    setTexture(null);
    setLoadFailed(false);
    setImageAspect(DEFAULT_ASPECT);

    if (!src) {
      setLoadFailed(true);
      invalidate();
      return;
    }

    const loader = new THREE.TextureLoader();

    loader.setCrossOrigin("anonymous");

    if (import.meta.env.DEV) {
      const textureLoadCount = incrementCount(
        textureLoadCounts,
        panelKey,
      );

      if (isDebugPanel) {
        console.table({
          panelId: panel.id,
          mountCount: getCount(
            mountCounts,
            panelKey,
          ),
          unmountCount: getCount(
            unmountCounts,
            panelKey,
          ),
          textureLoadCount,
          src,
        });
      }
    }

    loader.load(
      textureRequestUrl(src),

      (nextTexture) => {
        if (cancelled) {
          nextTexture.dispose();
          return;
        }

        nextTexture.colorSpace = THREE.SRGBColorSpace;
        nextTexture.generateMipmaps = false;
        nextTexture.minFilter = THREE.LinearFilter;
        nextTexture.magFilter = THREE.LinearFilter;
        nextTexture.wrapS = THREE.ClampToEdgeWrapping;
        nextTexture.wrapT = THREE.ClampToEdgeWrapping;
        nextTexture.anisotropy = 4;
        nextTexture.needsUpdate = true;

        loadedTexture = nextTexture;
        const image = nextTexture.image as
          | TextureImageSize
          | undefined;

        if (import.meta.env.DEV && isDebugPanel) {
          console.groupCollapsed(
            `[Timeline Diagnostics] Texture ${panel.id}`,
          );
          console.table({
            src,
            currentSrc: image?.currentSrc,
            naturalWidth: image?.naturalWidth,
            naturalHeight: image?.naturalHeight,
            rawWidth: image?.width,
            rawHeight: image?.height,
            calculatedAspect:
              getTextureImageAspect(nextTexture),
            fallbackAspect: DEFAULT_ASPECT,
          });
          console.groupEnd();
        }

        setImageAspect(
          getTextureImageAspect(nextTexture),
        );
        setTexture(nextTexture);
        setLoadFailed(false);

        invalidate();
      },

      undefined,

      (error) => {
        if (cancelled) {
          return;
        }

        console.error(
          "[Timeline] Texture load failed:",
          src,
          error,
        );

        setLoadFailed(true);
        setTexture(null);

        invalidate();
      },
    );

    return () => {
      cancelled = true;

      if (loadedTexture) {
        loadedTexture.dispose();
      }
    };
  }, [isDebugPanel, panel.id, panel.image, panelKey, invalidate]);

  /*
   * The image plane keeps the original texture aspect ratio and is contained
   * inside the timeline card's max width/height. Texture UVs are unchanged,
   * so the image is fully visible with no crop or stretch.
   */
  const scale = panel.scale ?? 1;
  const maxWidth = BASE_MAX_WIDTH * scale;
  const maxHeight = BASE_MAX_HEIGHT * scale;
  const containerAspect = maxWidth / maxHeight;

  const width =
    imageAspect >= containerAspect
      ? maxWidth
      : maxHeight * imageAspect;
  const height =
    imageAspect >= containerAspect
      ? maxWidth / imageAspect
      : maxHeight;

  useEffect(() => {
    if (!import.meta.env.DEV || !isDebugPanel) {
      return;
    }

    console.groupCollapsed(
      `[Timeline Diagnostics] Plane ${panel.id}`,
    );
    console.table({
      imageAspect,
      width,
      height,
      planeAspect: width / height,
      difference: Math.abs(imageAspect - width / height),
      panelScale: scale,
      panelPosition: panel.position.join(", "),
      panelRotation: panel.rotation?.join(", "),
      effectiveRotation: Array.isArray(effectiveRotation)
        ? effectiveRotation.join(", ")
        : undefined,
      rotationMode: shouldZeroRotation ? "zero" : "data",
    });
    console.groupEnd();
  }, [
    effectiveRotation,
    height,
    imageAspect,
    isDebugPanel,
    panel.id,
    panel.position,
    panel.rotation,
    scale,
    shouldZeroRotation,
    width,
  ]);

  useFrame(() => {
    if (!import.meta.env.DEV || !isDebugPanel) {
      return;
    }

    if (!imageMeshRef.current) {
      return;
    }

    const now = performance.now();

    if (
      now - lastScreenDiagnosticAt.current <
      DIAGNOSTIC_INTERVAL_MS
    ) {
      return;
    }

    lastScreenDiagnosticAt.current = now;

    imageMeshRef.current.updateWorldMatrix(true, false);

    const mesh = imageMeshRef.current;
    const parent = groupRef.current;

    function projectCorner(corner: THREE.Vector3) {
      const projected = mesh
        .localToWorld(corner.clone())
        .project(camera);

      return new THREE.Vector2(
        ((projected.x + 1) / 2) * size.width,
        ((1 - projected.y) / 2) * size.height,
      );
    }

    const topLeft = projectCorner(
      new THREE.Vector3(-width / 2, height / 2, 0),
    );
    const topRight = projectCorner(
      new THREE.Vector3(width / 2, height / 2, 0),
    );
    const bottomLeft = projectCorner(
      new THREE.Vector3(-width / 2, -height / 2, 0),
    );
    const bottomRight = projectCorner(
      new THREE.Vector3(width / 2, -height / 2, 0),
    );

    const topWidth = topLeft.distanceTo(topRight);
    const bottomWidth =
      bottomLeft.distanceTo(bottomRight);
    const leftHeight = topLeft.distanceTo(bottomLeft);
    const rightHeight =
      topRight.distanceTo(bottomRight);
    const projectedWidth =
      (topWidth + bottomWidth) / 2;
    const projectedHeight =
      (leftHeight + rightHeight) / 2;
    const projectedAspect =
      projectedWidth / projectedHeight;

    console.groupCollapsed(
      `[Timeline Diagnostics] Transform and screen ${panel.id}`,
    );
    console.table({
      meshScaleX: mesh.scale.x,
      meshScaleY: mesh.scale.y,
      meshScaleZ: mesh.scale.z,
      parentScaleX: parent?.scale.x,
      parentScaleY: parent?.scale.y,
      parentScaleZ: parent?.scale.z,
      parentRotationX: parent?.rotation.x,
      parentRotationY: parent?.rotation.y,
      parentRotationZ: parent?.rotation.z,
      imageAspect,
      planeAspect: width / height,
      projectedAspect,
      projectedWidth,
      projectedHeight,
      topWidth,
      bottomWidth,
      leftHeight,
      rightHeight,
      canvasWidth: size.width,
      canvasHeight: size.height,
      cameraPositionX: camera.position.x,
      cameraPositionY: camera.position.y,
      cameraPositionZ: camera.position.z,
    });
    console.groupEnd();
  });

  function setPointer(
    event: ThreeEvent<PointerEvent>,
    next: boolean,
  ) {
    event.stopPropagation();

    setHovered(next);

    document.body.style.cursor = next
      ? "pointer"
      : "";
  }

  return (
    <group
      ref={groupRef}
      position={panel.position}
      rotation={effectiveRotation}
      onPointerEnter={(event) =>
        setPointer(event, true)
      }
      onPointerLeave={(event) =>
        setPointer(event, false)
      }
    >
      <mesh
        position={[0.08, -0.08, -0.03]}
        frustumCulled={false}
      >
        <planeGeometry
          args={[width, height]}
        />

        <meshBasicMaterial
          color="#101412"
          transparent
          opacity={dimmed ? 0.1 : 0.18}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>

      <mesh
        ref={imageMeshRef}
        scale={hovered ? 1.035 : 1}
        frustumCulled={false}
      >
        <planeGeometry
          args={[width, height]}
        />

        <meshBasicMaterial
          color={
            loadFailed
              ? "#d8cbbf"
              : "#ffffff"
          }
          map={texture ?? undefined}
          side={THREE.DoubleSide}
          transparent
          opacity={
            dimmed
              ? 0.58
              : 1
          }
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

export const StoryPanel =
  memo(StoryPanelComponent);
