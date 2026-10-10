import * as THREE from "three";
import type { AmbientSceneId } from "@/components/shop/ambient/constants";

export interface AmbientSceneRuntime {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  update: (delta: number, elapsed: number) => void;
  dispose: () => void;
}

const EMERALD = 0x34d399;
const CYAN = 0x22d3ee;
const AMBER = 0xfbbf24;

function disposeObject3D(root: THREE.Object3D) {
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const material = mesh.material;
    if (Array.isArray(material)) material.forEach((m) => m.dispose());
    else if (material) material.dispose();
  });
}

function makePointsMaterial(color: THREE.ColorRepresentation, size: number, opacity: number) {
  return new THREE.PointsMaterial({
    color,
    size,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });
}

function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function createRainScene(): AmbientSceneRuntime {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 120);
  camera.position.set(0, 0, 14);

  const count = 900;
  const positions = new Float32Array(count * 3);
  const velocities = new Float32Array(count);

  for (let i = 0; i < count; i += 1) {
    positions[i * 3] = randomRange(-18, 18);
    positions[i * 3 + 1] = randomRange(-10, 14);
    positions[i * 3 + 2] = randomRange(-6, 6);
    velocities[i] = randomRange(10, 16);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  const rain = new THREE.Points(
    geometry,
    makePointsMaterial(new THREE.Color(CYAN).offsetHSL(0, 0, 0.15), 0.08, 0.55),
  );
  scene.add(rain);

  const splashCount = 80;
  const splashPositions = new Float32Array(splashCount * 3);
  const splashLife = new Float32Array(splashCount);
  for (let i = 0; i < splashCount; i += 1) {
    splashPositions[i * 3 + 1] = -8;
    splashLife[i] = randomRange(0, 1);
  }
  const splashGeometry = new THREE.BufferGeometry();
  splashGeometry.setAttribute("position", new THREE.BufferAttribute(splashPositions, 3));
  const splashes = new THREE.Points(splashGeometry, makePointsMaterial(0x93c5fd, 0.12, 0.35));
  scene.add(splashes);

  return {
    scene,
    camera,
    update(delta, elapsed) {
      const pos = geometry.getAttribute("position") as THREE.BufferAttribute;
      for (let i = 0; i < count; i += 1) {
        let y = pos.getY(i) - velocities[i]! * delta;
        let x = pos.getX(i) + delta * 0.35;
        if (y < -9) {
          y = 12;
          x = randomRange(-18, 18);
          const splashIndex = i % splashCount;
          splashLife[splashIndex] = 0.35;
          splashPositions[splashIndex * 3] = x;
          splashPositions[splashIndex * 3 + 1] = -8.2;
        }
        pos.setXYZ(i, x, y, pos.getZ(i));
      }
      pos.needsUpdate = true;

      const splashPos = splashGeometry.getAttribute("position") as THREE.BufferAttribute;
      for (let i = 0; i < splashCount; i += 1) {
        splashLife[i] = Math.max(0, splashLife[i]! - delta);
        if (splashLife[i]! > 0) {
          splashPos.setY(i, -8.2 + (0.35 - splashLife[i]!) * 1.2);
        } else {
          splashPos.setY(i, -20);
        }
      }
      splashPos.needsUpdate = true;
      (splashes.material as THREE.PointsMaterial).opacity = 0.25 + Math.sin(elapsed * 2.2) * 0.08;
    },
    dispose() {
      disposeObject3D(scene);
    },
  };
}

function createSnowScene(): AmbientSceneRuntime {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 120);
  camera.position.set(0, 0, 14);

  const count = 520;
  const positions = new Float32Array(count * 3);
  const drift = new Float32Array(count);
  const fall = new Float32Array(count);

  for (let i = 0; i < count; i += 1) {
    positions[i * 3] = randomRange(-20, 20);
    positions[i * 3 + 1] = randomRange(-10, 14);
    positions[i * 3 + 2] = randomRange(-8, 8);
    drift[i] = randomRange(-0.4, 0.4);
    fall[i] = randomRange(0.6, 1.4);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  const snow = new THREE.Points(geometry, makePointsMaterial(0xffffff, 0.14, 0.65));
  scene.add(snow);

  return {
    scene,
    camera,
    update(delta, elapsed) {
      const pos = geometry.getAttribute("position") as THREE.BufferAttribute;
      for (let i = 0; i < count; i += 1) {
        let x = pos.getX(i) + Math.sin(elapsed * 0.6 + i) * drift[i]! * delta;
        let y = pos.getY(i) - fall[i]! * delta * 1.8;
        if (y < -10) {
          y = 12;
          x = randomRange(-20, 20);
        }
        pos.setXYZ(i, x, y, pos.getZ(i));
      }
      pos.needsUpdate = true;
    },
    dispose() {
      disposeObject3D(scene);
    },
  };
}

function createLeavesScene(): AmbientSceneRuntime {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 120);
  camera.position.set(0, 0, 14);

  const count = 140;
  const positions = new Float32Array(count * 3);
  const speeds = new Float32Array(count * 2);

  for (let i = 0; i < count; i += 1) {
    positions[i * 3] = randomRange(-22, 10);
    positions[i * 3 + 1] = randomRange(-10, 14);
    positions[i * 3 + 2] = randomRange(-5, 5);
    speeds[i * 2] = randomRange(1.8, 3.4);
    speeds[i * 2 + 1] = randomRange(-1.2, -0.4);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    const tint =
      i % 3 === 0
        ? new THREE.Color(EMERALD)
        : i % 3 === 1
          ? new THREE.Color(AMBER)
          : new THREE.Color(0xf97316);
    colors[i * 3] = tint.r;
    colors[i * 3 + 1] = tint.g;
    colors[i * 3 + 2] = tint.b;
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: 0.22,
    transparent: true,
    opacity: 0.7,
    depthWrite: false,
    vertexColors: true,
    blending: THREE.NormalBlending,
  });

  const leaves = new THREE.Points(geometry, material);
  scene.add(leaves);

  return {
    scene,
    camera,
    update(delta) {
      const pos = geometry.getAttribute("position") as THREE.BufferAttribute;
      for (let i = 0; i < count; i += 1) {
        let x = pos.getX(i) + speeds[i * 2]! * delta;
        let y = pos.getY(i) + speeds[i * 2 + 1]! * delta;
        if (x > 22 || y < -11) {
          x = randomRange(-24, -8);
          y = randomRange(6, 14);
        }
        pos.setXYZ(i, x, y, pos.getZ(i));
      }
      pos.needsUpdate = true;
      leaves.rotation.z = Math.sin(performance.now() * 0.0003) * 0.04;
    },
    dispose() {
      disposeObject3D(scene);
    },
  };
}

function createStarfallScene(): AmbientSceneRuntime {
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x050816, 0.045);

  const camera = new THREE.PerspectiveCamera(68, 1, 0.1, 220);
  camera.position.set(0, 0, 0);

  const count = 1600;
  const positions = new Float32Array(count * 3);
  const speeds = new Float32Array(count);

  for (let i = 0; i < count; i += 1) {
    positions[i * 3] = randomRange(-40, 40);
    positions[i * 3 + 1] = randomRange(-24, 24);
    positions[i * 3 + 2] = randomRange(-80, -4);
    speeds[i] = randomRange(8, 22);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  const stars = new THREE.Points(geometry, makePointsMaterial(0xffffff, 0.1, 0.85));
  scene.add(stars);

  const shooters = new THREE.Group();
  for (let i = 0; i < 6; i += 1) {
    const streakGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, -3.5),
    ]);
    const streak = new THREE.Line(
      streakGeo,
      new THREE.LineBasicMaterial({
        color: CYAN,
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending,
      }),
    );
    streak.position.set(randomRange(-18, 18), randomRange(4, 16), randomRange(-30, -10));
    streak.userData["speed"] = randomRange(18, 32);
    shooters.add(streak);
  }
  scene.add(shooters);

  let zoomPhase = 0;

  return {
    scene,
    camera,
    update(delta, elapsed) {
      zoomPhase += delta * 0.15;
      const zoom = 0.6 + (Math.sin(zoomPhase) + 1) * 0.55;
      camera.position.z = zoom * 2.2;

      const pos = geometry.getAttribute("position") as THREE.BufferAttribute;
      for (let i = 0; i < count; i += 1) {
        let z = pos.getZ(i) + speeds[i]! * delta * 2.4;
        if (z > 6) z = randomRange(-90, -20);
        pos.setZ(i, z);
      }
      pos.needsUpdate = true;

      shooters.children.forEach((child, index) => {
        child.position.z += (child.userData["speed"] as number) * delta;
        child.rotation.x = -0.35;
        child.rotation.y = 0.15 + index * 0.05;
        if (child.position.z > 8) {
          child.position.z = randomRange(-70, -25);
          child.position.x = randomRange(-20, 20);
          child.position.y = randomRange(2, 18);
        }
      });

      scene.rotation.y = Math.sin(elapsed * 0.08) * 0.06;
    },
    dispose() {
      disposeObject3D(scene);
    },
  };
}

function createSunnyScene(): AmbientSceneRuntime {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 120);
  camera.position.set(0, 0, 14);

  const rayGroup = new THREE.Group();
  for (let i = 0; i < 7; i += 1) {
    const rayGeo = new THREE.PlaneGeometry(0.35, 18);
    const rayMat = new THREE.MeshBasicMaterial({
      color: 0xfef3c7,
      transparent: true,
      opacity: 0.06 + i * 0.008,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const ray = new THREE.Mesh(rayGeo, rayMat);
    ray.position.set(-8 + i * 2.4, 6, -2 - i * 0.2);
    ray.rotation.z = -0.28 + i * 0.04;
    rayGroup.add(ray);
  }
  scene.add(rayGroup);

  const moteCount = 360;
  const positions = new Float32Array(moteCount * 3);
  for (let i = 0; i < moteCount; i += 1) {
    positions[i * 3] = randomRange(-18, 18);
    positions[i * 3 + 1] = randomRange(-2, 12);
    positions[i * 3 + 2] = randomRange(-6, 4);
  }
  const moteGeo = new THREE.BufferGeometry();
  moteGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const motes = new THREE.Points(moteGeo, makePointsMaterial(0xfde68a, 0.1, 0.45));
  scene.add(motes);

  return {
    scene,
    camera,
    update(delta, elapsed) {
      rayGroup.rotation.y = Math.sin(elapsed * 0.25) * 0.08;
      rayGroup.children.forEach((child, index) => {
        const mesh = child as THREE.Mesh;
        const mat = mesh.material as THREE.MeshBasicMaterial;
        mat.opacity = 0.05 + Math.abs(Math.sin(elapsed * 0.7 + index)) * 0.07;
      });

      const pos = moteGeo.getAttribute("position") as THREE.BufferAttribute;
      for (let i = 0; i < moteCount; i += 1) {
        const x = pos.getX(i) + Math.sin(elapsed * 0.5 + i) * delta * 0.25;
        const y = pos.getY(i) + Math.cos(elapsed * 0.35 + i * 0.2) * delta * 0.18;
        pos.setXYZ(i, x, y, pos.getZ(i));
      }
      pos.needsUpdate = true;
    },
    dispose() {
      disposeObject3D(scene);
    },
  };
}

export function createAmbientScene(sceneId: AmbientSceneId): AmbientSceneRuntime {
  switch (sceneId) {
    case "rain":
      return createRainScene();
    case "snow":
      return createSnowScene();
    case "leaves":
      return createLeavesScene();
    case "starfall":
      return createStarfallScene();
    case "sunny":
      return createSunnyScene();
    default:
      return createRainScene();
  }
}
