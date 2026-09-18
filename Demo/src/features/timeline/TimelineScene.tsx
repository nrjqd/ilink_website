/**
 * 時間軸前端模組，呈現 I-LINK 空間敘事、3D 場景、進度與故事面板。
 *
 * 維護重點：
 * 1. CameraRig 負責依時間軸進度控制攝影機。
 * 2. FloatingPanels 負責決定目前需要顯示哪些故事面板。
 * 3. Canvas 保持持續渲染，避免圖片載入後必須等待 resize 才更新。
 */

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import {
  StoryPanel,
  getTimelinePanelDiagnosticsSnapshot,
} from "./StoryPanel";
import type { TimelineChapter } from "./timeline.types";

/**
 * CameraRigProps
 * 控制攝影機所需要的時間軸資料。
 */
interface CameraRigProps {
  progress: number;
  chapters: TimelineChapter[];
}

/**
 * CameraRig
 *
 * 根據目前 progress，在相鄰章節的 camera position / target
 * 之間進行線性插值，使攝影機平滑移動。
 */
function CameraRig({ progress, chapters }: CameraRigProps) {
  const target = useMemo(() => new THREE.Vector3(), []);
  const position = useMemo(() => new THREE.Vector3(), []);
  const toTarget = useMemo(() => new THREE.Vector3(), []);
  const toPosition = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ camera }) => {
    if (chapters.length === 0) {
      return;
    }

    // 只有一個章節時，不需要進行相鄰章節插值。
    if (chapters.length === 1) {
      const [chapter] = chapters;

      camera.position.fromArray(chapter.camera.position);
      camera.lookAt(target.fromArray(chapter.camera.target));

      return;
    }

    const max = chapters.length - 1;

    const scaled = THREE.MathUtils.clamp(
      progress * max,
      0,
      max,
    );

    const index = Math.min(
      max - 1,
      Math.floor(scaled),
    );

    const local = scaled - index;

    const from = chapters[index];
    const to = chapters[Math.min(max, index + 1)];

    position
      .fromArray(from.camera.position)
      .lerp(
        toPosition.fromArray(to.camera.position),
        local,
      );

    target
      .fromArray(from.camera.target)
      .lerp(
        toTarget.fromArray(to.camera.target),
        local,
      );

    camera.position.copy(position);
    camera.lookAt(target);
  });

  return null;
}

interface RenderPipelineDiagnosticsProps {
  visiblePanelCount: number;
}

function RenderPipelineDiagnostics({
  visiblePanelCount,
}: RenderPipelineDiagnosticsProps) {
  const gl = useThree((state) => state.gl);
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);

  useEffect(() => {
    if (!import.meta.env.DEV) {
      return;
    }

    const canvas = gl.domElement;
    const perspectiveCamera =
      camera instanceof THREE.PerspectiveCamera
        ? camera
        : null;

    console.groupCollapsed(
      "[Timeline Diagnostics] Camera and canvas",
    );
    console.table({
      cameraAspect: perspectiveCamera?.aspect,
      cameraFov: perspectiveCamera?.fov,
      cameraPositionX: camera.position.x,
      cameraPositionY: camera.position.y,
      cameraPositionZ: camera.position.z,
      cameraScaleX: camera.scale.x,
      cameraScaleY: camera.scale.y,
      cameraScaleZ: camera.scale.z,
      r3fSizeWidth: size.width,
      r3fSizeHeight: size.height,
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      clientWidth: canvas.clientWidth,
      clientHeight: canvas.clientHeight,
      bufferAspect: canvas.width / canvas.height,
      cssAspect: canvas.clientWidth / canvas.clientHeight,
      devicePixelRatio: window.devicePixelRatio,
      rotationMode:
        new URLSearchParams(window.location.search).get(
          "timelineRotation",
        ) === "0"
          ? "zero"
          : "data",
    });
    console.groupEnd();
  }, [camera, gl, size.height, size.width]);

  useEffect(() => {
    if (!import.meta.env.DEV) {
      return;
    }

    const canvas = gl.domElement;

    function getContextDiagnostics() {
      const panelDiagnostics =
        getTimelinePanelDiagnosticsSnapshot();

      return {
        canvasCount:
          document.querySelectorAll("canvas").length,
        visiblePanelCount,
        storyPanelMountCount:
          panelDiagnostics.totalMountCount,
        storyPanelUnmountCount:
          panelDiagnostics.totalUnmountCount,
        textureLoadCount:
          panelDiagnostics.totalTextureLoadCount,
        debugPanelKey:
          panelDiagnostics.debugPanel?.key,
        debugPanelMountCount:
          panelDiagnostics.debugPanel?.mountCount,
        debugPanelUnmountCount:
          panelDiagnostics.debugPanel?.unmountCount,
        debugPanelTextureLoadCount:
          panelDiagnostics.debugPanel?.textureLoadCount,
      };
    }

    function handleContextLost() {
      console.groupCollapsed(
        "[Timeline Diagnostics] WebGL context lost",
      );
      console.table(getContextDiagnostics());
      console.groupEnd();
    }

    function handleContextRestored() {
      console.groupCollapsed(
        "[Timeline Diagnostics] WebGL context restored",
      );
      console.table(getContextDiagnostics());
      console.groupEnd();
    }

    canvas.addEventListener(
      "webglcontextlost",
      handleContextLost,
    );
    canvas.addEventListener(
      "webglcontextrestored",
      handleContextRestored,
    );

    return () => {
      canvas.removeEventListener(
        "webglcontextlost",
        handleContextLost,
      );
      canvas.removeEventListener(
        "webglcontextrestored",
        handleContextRestored,
      );
    };
  }, [gl, visiblePanelCount]);

  return null;
}

/**
 * TimelineSceneProps
 */
interface TimelineSceneProps {
  progress: number;
  chapters: TimelineChapter[];
}

/**
 * FloatingPanelsProps
 */
interface FloatingPanelsProps {
  progress: number;
  chapters: TimelineChapter[];
}

/**
 * FloatingPanels
 *
 * 只保留目前章節，以及前後各一個鄰近章節，
 * 避免一次建立過多 WebGL Texture / Mesh。
 */
function FloatingPanels({
  progress,
  chapters,
}: FloatingPanelsProps) {
  const group = useRef<THREE.Group>(null);

  const visibleChapters = useMemo(() => {
    if (chapters.length === 0) {
      return [];
    }

    const activeIndex = Math.min(
      chapters.length - 1,
      Math.round(
        progress * (chapters.length - 1),
      ),
    );

    return chapters
      .map((chapter, index) => ({
        chapter,
        index,
        distance: Math.abs(index - activeIndex),
      }))
      .filter((item) => item.distance <= 1);
  }, [chapters, progress]);

  /**
   * 保持 group 每個 frame 都有更新。
   *
   * Canvas 同時使用 frameloop="always"，
   * 因此 Texture 載入完成後不需要等到使用者手動 resize
   * 才有下一次畫面更新。
   */
  useFrame(() => {
    if (!group.current) {
      return;
    }

    group.current.position.y =
      Math.sin(progress * Math.PI * 2) * 0.08;
  });

  if (visibleChapters.length === 0) {
    return null;
  }

  return (
    <group ref={group}>
      {visibleChapters.flatMap(
        ({ chapter, index: chapterIndex, distance }) =>
          chapter.panels
            .slice(0, distance === 0 ? 4 : 1)
            .map((panel) => (
              <StoryPanel
                /*
                 * 不只使用 panel.id。
                 *
                 * 如果不同 chapter 裡剛好存在相同 panel.id，
                 * React 可能錯誤重用舊的 StoryPanel，
                 * 造成 Texture 沒有重新載入。
                 */
                key={`${chapterIndex}-${panel.id}-${panel.image}`}
                panel={panel}
                dimmed={distance > 0}
              />
            )),
      )}
    </group>
  );
}

/**
 * TimelineScene
 *
 * Three.js Timeline 的 Canvas 根元件。
 */
export function TimelineScene({
  progress,
  chapters,
}: TimelineSceneProps) {
  const visiblePanelCount = useMemo(() => {
    if (chapters.length === 0) {
      return 0;
    }

    const activeIndex = Math.min(
      chapters.length - 1,
      Math.round(
        progress * (chapters.length - 1),
      ),
    );

    return chapters.reduce(
      (count, chapter, index) => {
        const distance = Math.abs(index - activeIndex);

        if (distance > 1) {
          return count;
        }

        return (
          count +
          chapter.panels.slice(
            0,
            distance === 0 ? 4 : 1,
          ).length
        );
      },
      0,
    );
  }, [chapters, progress]);

  return (
    <Canvas
      camera={{
        position: [0, 0, 8],
        fov: 38,
        near: 0.1,
        far: 100,
      }}

      /*
       * 明確要求 React Three Fiber 持續 render。
       *
       * 圖片 Texture 是非同步載入，
       * 持續 render 可以避免 Texture 已完成，
       * 但畫面仍停留在舊 frame 的情況。
       */
      frameloop="always"

      /*
       * Canvas 尺寸改變時立即重新計算。
       *
       * 特別針對：
       * - 瀏覽器縮放
       * - responsive layout
       * - Timeline 容器尺寸改變
       */
      resize={{
        scroll: true,
        debounce: {
          scroll: 0,
          resize: 0,
        },
      }}

      /*
       * 降低 GPU 負擔。
       * 圖片原始尺寸不同不影響 Canvas 是否渲染。
       */
      dpr={[1, 1.25]}

      gl={{
        antialias: false,
        powerPreference: "high-performance",
      }}

      /*
       * Canvas 永遠填滿父容器。
       */
      style={{
        width: "100%",
        height: "100%",
        display: "block",
      }}
    >
      <color
        attach="background"
        args={["#f6f0e5"]}
      />

      <CameraRig
        progress={progress}
        chapters={chapters}
      />

      <RenderPipelineDiagnostics
        visiblePanelCount={visiblePanelCount}
      />

      <FloatingPanels
        progress={progress}
        chapters={chapters}
      />
    </Canvas>
  );
}
