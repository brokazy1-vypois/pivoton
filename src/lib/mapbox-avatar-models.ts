import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import mapboxgl from "mapbox-gl";
import type { UserMapProfile } from "@/types/user-map-profile";

const LAYER_ID = "pivoton-avatar-3d";
const BASE_MODEL_HEIGHT = 1.75;
const POP_DURATION_MS = 480;
const DIP_DURATION_MS = 320;

interface AvatarModelEntry {
  userId: string;
  group: THREE.Group;
  mixer: THREE.AnimationMixer | null;
  lng: number;
  lat: number;
  variant: "self" | "member";
  focused: boolean;
  displayScale: number;
  targetScale: number;
  spawnProgress: number;
  dipProgress: number;
  dipActive: boolean;
  glbUrl: string;
}

function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

function modelTransformForLngLat(
  map: mapboxgl.Map,
  longitude: number,
  latitude: number,
  scaleMultiplier: number,
) {
  const mercator = mapboxgl.MercatorCoordinate.fromLngLat([longitude, latitude], 0);
  const meterScale = mercator.meterInMercatorCoordinateUnits();

  return {
    translateX: mercator.x,
    translateY: mercator.y,
    translateZ: mercator.z,
    rotateX: Math.PI / 2,
    rotateY: 0,
    rotateZ: 0,
    scale: meterScale * scaleMultiplier,
  };
}

function applyModelMatrix(
  matrix: number[],
  transform: ReturnType<typeof modelTransformForLngLat>,
  displayScale: number,
) {
  const rotationX = new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(1, 0, 0), transform.rotateX);
  const rotationY = new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(0, 1, 0), transform.rotateY);
  const rotationZ = new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(0, 0, 1), transform.rotateZ);

  const scale = transform.scale * displayScale;
  const local = new THREE.Matrix4()
    .makeTranslation(transform.translateX, transform.translateY, transform.translateZ)
    .scale(new THREE.Vector3(scale, -scale, scale))
    .multiply(rotationX)
    .multiply(rotationY)
    .multiply(rotationZ);

  return new THREE.Matrix4().fromArray(matrix).multiply(local);
}

export class MapAvatarModelManager {
  private map: mapboxgl.Map;
  private scene: THREE.Scene | null = null;
  private camera: THREE.Camera | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private clock = new THREE.Clock();
  private loader = new GLTFLoader();
  private models = new Map<string, AvatarModelEntry>();
  private layerAdded = false;
  private disposed = false;
  private lastFrameMs = 0;

  constructor(map: mapboxgl.Map) {
    this.map = map;
    this.ensureLayer();
  }

  syncProfiles(
    profiles: UserMapProfile[],
    options: { currentUserId?: string | null; focusUserId?: string | null },
  ) {
    if (this.disposed) return;

    const withGlb = profiles.filter((profile) => profile.avatar_glb_url);
    const nextIds = new Set(withGlb.map((profile) => profile.user_id));

    for (const userId of this.models.keys()) {
      if (!nextIds.has(userId)) {
        this.removeModel(userId);
      }
    }

    for (const profile of withGlb) {
      const variant = profile.user_id === options.currentUserId ? "self" : "member";
      const focused = profile.user_id === options.focusUserId;
      this.upsertModel(profile, variant, focused);
    }
  }

  destroy() {
    this.disposed = true;
    for (const userId of [...this.models.keys()]) {
      this.removeModel(userId);
    }
    if (this.layerAdded && this.map.getLayer(LAYER_ID)) {
      this.map.removeLayer(LAYER_ID);
    }
    this.layerAdded = false;
  }

  private ensureLayer() {
    if (this.layerAdded || this.disposed) return;

    const manager = this;
    const customLayer: mapboxgl.CustomLayerInterface = {
      id: LAYER_ID,
      type: "custom",
      renderingMode: "3d",
      onAdd(_map, gl) {
        manager.camera = new THREE.Camera();
        manager.scene = new THREE.Scene();

        const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 2.4);
        manager.scene.add(hemi);

        const key = new THREE.DirectionalLight(0xffffff, 1.6);
        key.position.set(10, 20, 10);
        manager.scene.add(key);

        manager.renderer = new THREE.WebGLRenderer({
          canvas: manager.map.getCanvas(),
          context: gl,
          antialias: true,
        });
        manager.renderer.autoClear = false;
      },
      render(_gl, matrix) {
        if (!manager.scene || !manager.camera || !manager.renderer) return;

        const delta = manager.clock.getDelta();
        const now = performance.now();
        const frameDelta = manager.lastFrameMs ? now - manager.lastFrameMs : 16;
        manager.lastFrameMs = now;

        manager.updateAnimations(delta, frameDelta);

        for (const entry of manager.models.values()) {
          const transform = modelTransformForLngLat(
            manager.map,
            entry.lng,
            entry.lat,
            BASE_MODEL_HEIGHT,
          );
          entry.group.matrixAutoUpdate = false;
          entry.group.matrix.copy(applyModelMatrix(matrix, transform, entry.displayScale));
        }

        manager.renderer.resetState();
        manager.renderer.render(manager.scene, manager.camera);
        manager.map.triggerRepaint();
      },
    };

    const addLayer = () => {
      if (this.disposed || this.layerAdded) return;
      if (this.map.getLayer(LAYER_ID)) {
        this.layerAdded = true;
        return;
      }
      this.map.addLayer(customLayer);
      this.layerAdded = true;
    };

    if (this.map.isStyleLoaded()) {
      addLayer();
    } else {
      this.map.once("style.load", addLayer);
    }
  }

  private upsertModel(profile: UserMapProfile, variant: "self" | "member", focused: boolean) {
    const glbUrl = profile.avatar_glb_url!;
    const existing = this.models.get(profile.user_id);

    if (existing) {
      const moved =
        Math.abs(existing.lng - profile.longitude) > 1e-6 ||
        Math.abs(existing.lat - profile.latitude) > 1e-6;

      existing.lng = profile.longitude;
      existing.lat = profile.latitude;
      existing.variant = variant;
      existing.focused = focused;
      existing.targetScale = focused ? 1.18 : variant === "self" ? 1.08 : 1;

      if (existing.glbUrl !== glbUrl) {
        this.removeModel(profile.user_id);
        this.loadModel(profile, variant, focused, glbUrl);
        return;
      }

      if (moved) {
        existing.dipActive = true;
        existing.dipProgress = 0;
      }
      return;
    }

    this.loadModel(profile, variant, focused, glbUrl);
  }

  private loadModel(
    profile: UserMapProfile,
    variant: "self" | "member",
    focused: boolean,
    glbUrl: string,
  ) {
    const group = new THREE.Group();
    this.scene?.add(group);

    const entry: AvatarModelEntry = {
      userId: profile.user_id,
      group,
      mixer: null,
      lng: profile.longitude,
      lat: profile.latitude,
      variant,
      focused,
      displayScale: 0.001,
      targetScale: focused ? 1.18 : variant === "self" ? 1.08 : 1,
      spawnProgress: 0,
      dipProgress: 0,
      dipActive: false,
      glbUrl,
    };
    this.models.set(profile.user_id, entry);

    this.loader.load(
      glbUrl,
      (gltf) => {
        if (this.disposed || !this.models.has(profile.user_id)) {
          group.clear();
          return;
        }

        const model = gltf.scene;
        model.rotation.y = Math.PI;

        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        model.position.sub(center);
        model.position.y += size.y / 2;

        group.clear();
        group.add(model);

        if (gltf.animations.length > 0) {
          const mixer = new THREE.AnimationMixer(model);
          const clip =
            gltf.animations.find((animation) => /idle|stand|breath/i.test(animation.name)) ??
            gltf.animations[0];
          mixer.clipAction(clip).play();
          entry.mixer = mixer;
        }
      },
      undefined,
      () => {
        if (this.models.get(profile.user_id) === entry) {
          this.removeModel(profile.user_id);
        }
      },
    );
  }

  private removeModel(userId: string) {
    const entry = this.models.get(userId);
    if (!entry) return;
    entry.mixer?.stopAllAction();
    this.scene?.remove(entry.group);
    entry.group.clear();
    this.models.delete(userId);
  }

  private updateAnimations(delta: number, frameDeltaMs: number) {
    for (const entry of this.models.values()) {
      entry.mixer?.update(delta);

      if (entry.dipActive) {
        entry.dipProgress = Math.min(1, entry.dipProgress + frameDeltaMs / DIP_DURATION_MS);
        const dipT = easeInOutCubic(entry.dipProgress);
        const dipScale = dipT < 0.5 ? 1 - dipT * 0.35 : 0.825 + (dipT - 0.5) * 0.35;
        entry.displayScale = dipScale * entry.targetScale;
        if (entry.dipProgress >= 1) {
          entry.dipActive = false;
          entry.spawnProgress = 0;
        }
        continue;
      }

      if (entry.spawnProgress < 1) {
        entry.spawnProgress = Math.min(1, entry.spawnProgress + frameDeltaMs / POP_DURATION_MS);
        entry.displayScale = easeOutBack(entry.spawnProgress) * entry.targetScale;
      } else {
        const lerpFactor = Math.min(1, frameDeltaMs / 180);
        entry.displayScale += (entry.targetScale - entry.displayScale) * lerpFactor;
      }
    }
  }
}

export function profileHasMapAvatar(profile: UserMapProfile): boolean {
  return Boolean(profile.avatar_glb_url?.trim());
}
