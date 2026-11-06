"use client";

import * as THREE from "three";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { GROUND_W, MAP_CROP_PX, MASTER_H, M_PER_PX, degToRad } from "./geo";
import { massingFor } from "./massing";
import { isPlaced } from "./scene";
import type { LayerId, SceneState } from "./types";

export interface GlbOptions {
  visibleLayers?: Partial<Record<LayerId, boolean>>;
  includeGround?: boolean;
}

export async function buildExportGroup(scene: SceneState, opts: GlbOptions = {}) {
  const root = new THREE.Group();
  root.name = "PGA27 Buildout (planning concept - not for construction)";
  root.userData = {
    note: "Planning concept - not for construction. Units: metres. +X east, +Y up, -Z north. Origin: centre of master-plan image.",
    event: "2027 PGA Championship, Fields Ranch East, PGA Frisco",
  };
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.02 });
  for (const s of scene.structures) {
    if (!isPlaced(s) || s.modelId || opts.visibleLayers?.[s.layer] === false) continue;
    const m = massingFor(s);
    const mesh = new THREE.Mesh(m.geometry, mat);
    mesh.name = `${s.name} [${s.id}]`;
    mesh.position.set(s.x, 0, -s.y);
    mesh.rotation.y = degToRad(s.rot);
    mesh.userData = { id: s.id, layer: s.layer, type: s.type, width_m: s.w, length_m: s.l, height_m: s.h, levels: s.levels, symbolic: m.symbolic };
    root.add(mesh);
  }
  if (opts.includeGround) {
    const tex = await new THREE.TextureLoader().loadAsync("/images/master-plan.jpg");
    tex.colorSpace = THREE.SRGBColorSpace;
    const frac = MAP_CROP_PX / MASTER_H;
    tex.repeat.set(1, frac);
    tex.offset.set(0, 1 - frac);
    const h = MAP_CROP_PX * M_PER_PX;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(GROUND_W, h), new THREE.MeshBasicMaterial({ map: tex }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -0.05, (MAP_CROP_PX / 2 - MASTER_H / 2) * M_PER_PX);
    ground.name = "Master plan ground (not georeferenced)";
    root.add(ground);
  }
  return root;
}

export async function exportGlb(scene: SceneState, opts: GlbOptions = {}): Promise<ArrayBuffer> {
  const group = await buildExportGroup(scene, opts);
  const exporter = new GLTFExporter();
  const result = await exporter.parseAsync(group, { binary: true, onlyVisible: false });
  return result as ArrayBuffer;
}

export async function measureGlb(buf: ArrayBuffer): Promise<{ w: number; l: number; h: number; meshes: number }> {
  const gltf = await new GLTFLoader().parseAsync(buf.slice(0), "");
  const box = new THREE.Box3().setFromObject(gltf.scene);
  const size = box.getSize(new THREE.Vector3());
  let meshes = 0;
  gltf.scene.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) meshes += 1;
  });
  return { w: size.x, l: size.z, h: size.y, meshes };
}
