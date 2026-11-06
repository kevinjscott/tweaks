"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, OrbitControls, useTexture } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { memo, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { GROUND_W, MAP_CROP_PX, MASTER_H, M_PER_PX, degToRad } from "@/lib/geo";
import { LAYER_BY_ID, renderKind } from "@/lib/layers";
import { footprintBox, massingFor } from "@/lib/massing";
import { getModel } from "@/lib/modelStore";
import { isPlaced } from "@/lib/scene";
import { allTours, lerpPose, sampleTour, tourDuration, type Pose } from "@/lib/tours";
import { downscaleCanvas, registerCanvas, registerPoseGetter, registerViewportCapture } from "@/lib/viewport";
import type { Structure } from "@/lib/types";
import { useEffectiveScene, useStudio } from "@/store/studio";

const solid = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0.03 });
const symbolic = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, transparent: true, opacity: 0.55, depthWrite: false });
const shadowMat = new THREE.MeshBasicMaterial({ color: "#000", transparent: true, opacity: 0.28, depthWrite: false });

const toThree = (x: number, y: number, z: number) => new THREE.Vector3(x, z, -y);

function Ground() {
  const tex = useTexture("/images/master-plan.jpg");
  const opacity = useStudio((s) => s.groundOpacity);
  const { gl } = useThree();
  useMemo(() => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = Math.min(16, gl.capabilities.getMaxAnisotropy());
    const frac = MAP_CROP_PX / MASTER_H;
    tex.repeat.set(1, frac);
    tex.offset.set(0, 1 - frac);
    tex.needsUpdate = true;
  }, [tex, gl]);
  const h = MAP_CROP_PX * M_PER_PX;
  const centerY = -(MAP_CROP_PX / 2 - MASTER_H / 2) * M_PER_PX;
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, -centerY]} receiveShadow>
      <planeGeometry args={[GROUND_W, h]} />
      <meshBasicMaterial map={tex} toneMapped={false} transparent={opacity < 1} opacity={opacity} />
    </mesh>
  );
}

type Mark = "added" | "changed";

const MARK_COLOR: Record<Mark | "removed" | "selected" | "hover", string> = {
  added: "#4fe0a0",
  changed: "#f0a83c",
  removed: "#e0525a",
  selected: "#ffd75e",
  hover: "#ffffff",
};

function Outline({ w, l, h, color }: { w: number; l: number; h: number; color: string }) {
  const geo = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(w + 0.6, h + 0.6, l + 0.6)), [w, l, h]);
  return (
    <lineSegments geometry={geo} position={[0, h / 2, 0]}>
      <lineBasicMaterial color={color} depthTest={false} transparent opacity={0.95} />
    </lineSegments>
  );
}

function ImportedModel({ s }: { s: Structure }) {
  const [obj, setObj] = useState<THREE.Object3D | null>(null);
  useEffect(() => {
    let alive = true;
    if (!s.modelId) return;
    void getModel(s.modelId).then((buf) => {
      if (!buf || !alive) return;
      new GLTFLoader().parse(buf.slice(0), "", (g) => {
        const o = g.scene.clone(true);
        const box = new THREE.Box3().setFromObject(o);
        const size = box.getSize(new THREE.Vector3());
        const c = box.getCenter(new THREE.Vector3());
        const sx = s.w && size.x ? s.w / size.x : 1;
        const sz = s.l && size.z ? s.l / size.z : 1;
        const sy = s.h && size.y ? s.h / size.y : Math.min(sx, sz);
        const wrap = new THREE.Group();
        o.position.set(-c.x, -box.min.y, -c.z);
        wrap.add(o);
        wrap.scale.set(sx, sy, sz);
        if (alive) setObj(wrap);
      });
    });
    return () => {
      alive = false;
    };
  }, [s.modelId, s.w, s.l, s.h]);
  return obj ? <primitive object={obj} /> : null;
}

const StructureNode = memo(function StructureNode({
  s,
  selected,
  hovered,
  mark,
  showLabel,
  onSelect,
  onHover,
}: {
  s: Structure & { x: number; y: number };
  selected: boolean;
  hovered: boolean;
  mark?: Mark;
  showLabel: boolean;
  onSelect: (id: string, additive: boolean) => void;
  onHover: (id: string | null) => void;
}) {
  const m = useMemo(() => massingFor(s), [s]);
  const box = footprintBox(s);
  const layer = LAYER_BY_ID[s.layer];
  const kind = renderKind(s).kind;
  return (
    <group
      position={[s.x, 0, -s.y]}
      rotation={[0, degToRad(s.rot), 0]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(s.id, e.nativeEvent.shiftKey);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        onHover(s.id);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        onHover(null);
        document.body.style.cursor = "";
      }}
    >
      {kind === "imported" ? <ImportedModel s={s} /> : <mesh geometry={m.geometry} material={m.symbolic ? symbolic : solid} />}
      {kind !== "pin" ? (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} material={shadowMat}>
          <planeGeometry args={[box.w + 3, box.l + 3]} />
        </mesh>
      ) : null}
      {m.symbolic ? (
        <lineSegments position={[0, box.h / 2, 0]}>
          <edgesGeometry args={[new THREE.BoxGeometry(box.w, box.h, box.l)]} />
          <lineDashedMaterial color={layer.color} dashSize={1.2} gapSize={0.8} />
        </lineSegments>
      ) : null}
      {selected ? <Outline w={box.w} l={box.l} h={box.h} color={MARK_COLOR.selected} /> : null}
      {!selected && hovered ? <Outline w={box.w} l={box.l} h={box.h} color={MARK_COLOR.hover} /> : null}
      {mark && !selected ? <Outline w={box.w} l={box.l} h={box.h} color={MARK_COLOR[mark]} /> : null}
      {selected || hovered || showLabel ? (
        <Html position={[0, box.h + 4, 0]} center zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
          <div className="html-label" style={{ borderColor: selected ? "#ffd75e" : layer.color }}>
            {s.name}
            {mark ? <span style={{ color: MARK_COLOR[mark] }}> · {mark}</span> : null}
          </div>
        </Html>
      ) : null}
    </group>
  );
});

function Structures() {
  const scene = useEffectiveScene();
  const committed = useStudio((s) => s.scene);
  const proposal = useStudio((s) => s.proposal);
  const layerVisible = useStudio((s) => s.layerVisible);
  const selection = useStudio((s) => s.selection);
  const hoverId = useStudio((s) => s.hoverId);
  const showLabels = useStudio((s) => s.showLabels);
  const select = useStudio((s) => s.select);
  const setHover = useStudio((s) => s.setHover);

  const marks = useMemo(() => {
    const m = new Map<string, Mark>();
    if (!proposal) return m;
    const before = new Map(committed.structures.map((x) => [x.id, x]));
    for (const s of scene.structures) {
      const o = before.get(s.id);
      if (!o) m.set(s.id, "added");
      else if (o !== s) m.set(s.id, "changed");
    }
    return m;
  }, [scene, committed, proposal]);

  const removed = useMemo(() => {
    if (!proposal) return [];
    const now = new Set(scene.structures.map((s) => s.id));
    return committed.structures.filter((s) => !now.has(s.id) && isPlaced(s));
  }, [scene, committed, proposal]);

  const bigLabels = useMemo(() => {
    const set = new Set<string>();
    if (!showLabels) return set;
    for (const s of scene.structures) if (s.w && s.l && s.w * s.l > 450) set.add(s.id);
    return set;
  }, [scene, showLabels]);

  return (
    <>
      {scene.structures.map((s) =>
        isPlaced(s) && layerVisible[s.layer] ? (
          <StructureNode
            key={s.id}
            s={s}
            selected={selection.includes(s.id)}
            hovered={hoverId === s.id}
            mark={marks.get(s.id)}
            showLabel={bigLabels.has(s.id)}
            onSelect={(id, add) => select([id], add)}
            onHover={setHover}
          />
        ) : null,
      )}
      {removed.map((s) => {
        const b = footprintBox(s);
        return (
          <group key={`rm-${s.id}`} position={[s.x as number, 0, -(s.y as number)]} rotation={[0, degToRad(s.rot), 0]}>
            <mesh position={[0, b.h / 2, 0]}>
              <boxGeometry args={[b.w, b.h, b.l]} />
              <meshBasicMaterial color={MARK_COLOR.removed} transparent opacity={0.28} depthWrite={false} />
            </mesh>
            <Outline w={b.w} l={b.l} h={b.h} color={MARK_COLOR.removed} />
            <Html position={[0, b.h + 4, 0]} center style={{ pointerEvents: "none" }}>
              <div className="html-label" style={{ borderColor: MARK_COLOR.removed }}>{s.name} · removed</div>
            </Html>
          </group>
        );
      })}
    </>
  );
}

function currentPose(camera: THREE.Camera, controls: OrbitControlsImpl | null): Pose {
  const t = controls?.target ?? new THREE.Vector3();
  return {
    pos: { x: camera.position.x, y: -camera.position.z, z: camera.position.y },
    target: { x: t.x, y: -t.z, z: t.y },
  };
}

let lastConsumedCommand = 0;

function applyPose(camera: THREE.Camera, controls: OrbitControlsImpl | null, p: Pose) {
  const pos = toThree(p.pos.x, p.pos.y, p.pos.z);
  const tgt = toThree(p.target.x, p.target.y, p.target.z);
  const flat = Math.abs(pos.x - tgt.x) < 0.05 && Math.abs(pos.z - tgt.z) < 0.05;
  if (flat) pos.z += 0.05;
  camera.position.copy(pos);
  if (controls) {
    controls.target.copy(tgt);
    controls.update();
  } else camera.lookAt(tgt);
}

function CameraRig() {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as unknown as OrbitControlsImpl | null;
  const cmd = useStudio((s) => s.cameraCommand);
  const anim = useRef<{ from: Pose; to: Pose; t: number; dur: number } | null>(null);

  useEffect(() => {
    if (!cmd || cmd.id === lastConsumedCommand || !controls) return;
    lastConsumedCommand = cmd.id;
    anim.current = { from: currentPose(camera, controls), to: cmd.pose, t: 0, dur: Math.max(0.01, cmd.seconds) };
  }, [cmd, camera, controls]);

  useFrame((_, dt) => {
    const a = anim.current;
    if (!a || !controls) return;
    a.t += dt;
    const u = Math.min(1, a.t / a.dur);
    applyPose(camera, controls, lerpPose(a.from, a.to, u));
    if (u >= 1) anim.current = null;
  });
  return null;
}

function TourPlayer() {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as unknown as OrbitControlsImpl | null;
  const scene = useEffectiveScene();
  const playback = useStudio((s) => s.playback);
  const setPlayback = useStudio((s) => s.setPlayback);
  const tRef = useRef(0);
  const lastPush = useRef(0);
  const lastSeek = useRef(0);
  const tour = useMemo(() => allTours(scene).find((t) => t.id === playback.tourId) ?? null, [scene, playback.tourId]);

  useEffect(() => {
    if (!controls) return;
    controls.enabled = playback.state !== "playing";
  }, [playback.state, controls]);

  useFrame((_, dt) => {
    if (!tour || !controls) return;
    const dur = tourDuration(tour);
    const seek = playback.seek;
    if (seek && seek.id !== lastSeek.current) {
      lastSeek.current = seek.id;
      tRef.current = Math.min(dur, Math.max(0, seek.t));
      const p = sampleTour(tour, tRef.current);
      if (p) applyPose(camera, controls, p);
    }
    if (playback.state !== "playing") return;
    tRef.current += dt * playback.speed;
    if (tRef.current >= dur) {
      if (playback.loop && !playback.recording) tRef.current = 0;
      else {
        tRef.current = dur;
        const p = sampleTour(tour, dur);
        if (p) applyPose(camera, controls, p);
        setPlayback({ state: "idle", t: dur });
        return;
      }
    }
    const p = sampleTour(tour, tRef.current);
    if (p) applyPose(camera, controls, p);
    const now = performance.now();
    if (now - lastPush.current > 90) {
      lastPush.current = now;
      setPlayback({ t: tRef.current });
    }
  });
  return null;
}

function Capture() {
  const { gl, scene, camera } = useThree();
  const controls = useThree((s) => s.controls) as unknown as OrbitControlsImpl | null;
  useEffect(() => {
    registerPoseGetter(() => currentPose(camera, controls));
    return () => registerPoseGetter(null);
  }, [camera, controls]);
  useEffect(() => {
    registerCanvas(gl.domElement);
    registerViewportCapture(() => {
      gl.render(scene, camera);
      return downscaleCanvas(gl.domElement);
    });
    return () => {
      registerCanvas(null);
      registerViewportCapture(null);
    };
  }, [gl, scene, camera]);
  return null;
}

function Beacons() {
  const scene = useEffectiveScene();
  const layerVisible = useStudio((s) => s.layerVisible);
  const show = useStudio((s) => s.showBeacons);
  const ref = useRef<THREE.Points>(null);
  const camera = useThree((st) => st.camera);
  const geo = useMemo(() => {
    const list = scene.structures.filter((s) => isPlaced(s) && layerVisible[s.layer]);
    const pos = new Float32Array(list.length * 3);
    const col = new Float32Array(list.length * 3);
    list.forEach((s, i) => {
      const b = footprintBox(s);
      pos.set([s.x as number, b.h + 3, -(s.y as number)], i * 3);
      const c = new THREE.Color(LAYER_BY_ID[s.layer].color);
      col.set([c.r, c.g, c.b], i * 3);
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    return g;
  }, [scene, layerVisible]);
  useFrame(() => {
    if (ref.current) ref.current.visible = show && camera.position.y > 140;
  });
  return (
    <points ref={ref} geometry={geo} frustumCulled={false}>
      <pointsMaterial vertexColors size={7} sizeAttenuation={false} depthTest={false} transparent opacity={0.92} />
    </points>
  );
}

function GridOverlay() {
  const show = useStudio((s) => s.showGrid);
  if (!show) return null;
  return <gridHelper args={[4000, 80, "#c9a24a", "#3c5a80"]} position={[0, 0.1, 0]} />;
}

export default function SiteCanvas() {
  const select = useStudio((s) => s.select);
  return (
    <Canvas
      gl={{ preserveDrawingBuffer: true, antialias: true, powerPreference: "high-performance" }}
      dpr={[1, 1.75]}
      camera={{ position: [0, 1500, 1900], fov: 42, near: 1, far: 40000 }}
      onPointerMissed={() => select([])}
    >
      <color attach="background" args={["#050d19"]} />
      <hemisphereLight args={["#dbe8ff", "#3a3f33", 1.05]} />
      <directionalLight position={[-600, 900, 500]} intensity={2.1} color="#fff4de" />
      <directionalLight position={[500, 300, -400]} intensity={0.45} color="#9db8ff" />
      <Suspense fallback={null}>
        <Ground />
      </Suspense>
      <GridOverlay />
      <Structures />
      <Beacons />
      <OrbitControls makeDefault enableDamping dampingFactor={0.12} maxPolarAngle={Math.PI / 2.02} minDistance={12} maxDistance={9000} zoomSpeed={1.1} />
      <CameraRig />
      <TourPlayer />
      <Capture />
    </Canvas>
  );
}
