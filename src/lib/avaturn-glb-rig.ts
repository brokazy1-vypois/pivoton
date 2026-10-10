import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

export interface BlinkMorph {
  mesh: THREE.Mesh;
  index: number;
}

export interface GlbHeadRig {
  scene: THREE.Scene;
  model: THREE.Group;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  headBone: THREE.Object3D | null;
  blinkMorphs: BlinkMorph[];
  headCenterY: number;
  headHeight: number;
  dispose: () => void;
}

/** Vertical fraction of body height where the face center sits (feet at y=0). */
const HEAD_FRAC = 0.935;

export async function createGlbHeadRig(glbUrl: string, size = 512): Promise<GlbHeadRig> {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(glbUrl);

  const scene = new THREE.Scene();
  scene.background = null;

  const hemi = new THREE.HemisphereLight(0xffffff, 0x8899aa, 2.4);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xffffff, 1.55);
  key.position.set(1.5, 3.5, 2.5);
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xffffff, 0.7);
  fill.position.set(-2, 2.5, 1);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0xffffff, 0.5);
  rim.position.set(0, 2.5, -2.5);
  scene.add(rim);

  const model = gltf.scene.clone(true);
  scene.add(model);

  const box = new THREE.Box3().setFromObject(model);
  const bodySize = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  model.position.sub(center);
  model.position.y += bodySize.y / 2;

  const headHeight = Math.max(bodySize.y * 0.22, 0.16);
  const headCenterY = bodySize.y * HEAD_FRAC;
  const lookAtY = headCenterY - headHeight * 0.12;

  let headBone: THREE.Object3D | null = null;
  const blinkMorphs: BlinkMorph[] = [];

  model.traverse((child) => {
    if ((child as THREE.Bone).isBone && /head/i.test(child.name) && !headBone) {
      headBone = child;
    }

    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh || !mesh.morphTargetDictionary || !mesh.morphTargetInfluences) return;

    for (const [name, index] of Object.entries(mesh.morphTargetDictionary)) {
      if (/blink|eye.*close|eyes.*shut|eyelid/i.test(name)) {
        blinkMorphs.push({ mesh, index });
      }
    }
  });

  const camera = new THREE.PerspectiveCamera(20, 1, 0.01, 100);
  const faceDistance = Math.max(headHeight * 2.05, bodySize.y * 0.26);
  camera.position.set(0, headCenterY, faceDistance);
  camera.lookAt(0, lookAtY, 0);

  const mount = document.createElement("div");
  mount.style.cssText =
    "position:fixed;left:-10000px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;";
  document.body.appendChild(mount);

  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
    preserveDrawingBuffer: true,
  });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(1);
  renderer.setSize(size, size);
  mount.appendChild(renderer.domElement);

  return {
    scene,
    model,
    camera,
    renderer,
    headBone,
    blinkMorphs,
    headCenterY,
    headHeight,
    dispose: () => {
      renderer.dispose();
      scene.clear();
      mount.remove();
    },
  };
}

/** Apply idle motion for timeline t in [0, 1). */
export function applyIdleHeadMotion(rig: GlbHeadRig, elapsedSec: number): void {
  const yaw = Math.sin(elapsedSec * Math.PI * 2 * 0.45) * 0.07;
  const pitch = Math.sin(elapsedSec * Math.PI * 2 * 0.32 + 0.4) * 0.025;
  const roll = Math.sin(elapsedSec * Math.PI * 2 * 0.28 + 1.1) * 0.015;

  if (rig.headBone) {
    rig.headBone.rotation.y = yaw;
    rig.headBone.rotation.x = pitch;
    rig.headBone.rotation.z = roll;
  } else {
    rig.model.rotation.y = yaw * 0.6;
    rig.model.rotation.x = pitch * 0.5;
  }

  const blinkPhase = elapsedSec % 1.3;
  const blinkStrength =
    blinkPhase > 1.05 && blinkPhase < 1.18
      ? Math.sin(((blinkPhase - 1.05) / 0.13) * Math.PI)
      : 0;

  for (const { mesh, index } of rig.blinkMorphs) {
    if (mesh.morphTargetInfluences) {
      mesh.morphTargetInfluences[index] = blinkStrength;
    }
  }
}

export function renderRigFrame(rig: GlbHeadRig): void {
  rig.renderer.render(rig.scene, rig.camera);
}

export async function rigToPngBlob(rig: GlbHeadRig): Promise<Blob> {
  applyIdleHeadMotion(rig, 0.35);
  renderRigFrame(rig);

  return new Promise((resolve, reject) => {
    rig.renderer.domElement.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Could not export avatar PNG."));
      },
      "image/png",
      0.92,
    );
  });
}
