import * as THREE from 'three';
import { TargetExperience, ExperienceItem, RenderableItem } from './types.js';
import { createTextItem } from './item-text.js';
import { createImageItem } from './item-image.js';
import { createVideoItem } from './item-video.js';
import { createModelItem } from './item-model.js';

export interface LoadedExperience {
  targetId: string;
  group: THREE.Group;
  items: RenderableItem[];
  dispose: () => void;
  play: () => void;
  pause: () => void;
  update: (delta: number) => void;
}

export class ExperienceManager {
  private experiences: Record<string, TargetExperience>;
  private lruCache: Map<string, LoadedExperience> = new Map();
  private maxCacheSize: number;
  private onTimeMeasured?: (targetId: string, timeMs: number) => void;

  constructor(
    experiences: Record<string, TargetExperience>,
    options: { maxCacheSize?: number; onTimeMeasured?: (targetId: string, timeMs: number) => void } = {}
  ) {
    this.experiences = experiences;
    this.maxCacheSize = options.maxCacheSize || 3;
    this.onTimeMeasured = options.onTimeMeasured;
  }

  /**
   * Checks if target content is already loaded in LRU cache
   */
  public hasTargetLoaded(targetId: string): boolean {
    return this.lruCache.has(targetId);
  }

  /**
   * Retrieves or progressively loads target experience onto the anchor group
   */
  public async loadTargetExperience(
    targetId: string,
    anchorGroup: THREE.Group
  ): Promise<LoadedExperience> {
    const startTime = performance.now();

    // 1. Cache hit (Instant on re-detection)
    if (this.lruCache.has(targetId)) {
      const existing = this.lruCache.get(targetId)!;
      // Refresh LRU position
      this.lruCache.delete(targetId);
      this.lruCache.set(targetId, existing);

      if (!anchorGroup.children.includes(existing.group)) {
        anchorGroup.add(existing.group);
      }
      existing.play();

      if (this.onTimeMeasured) {
        this.onTimeMeasured(targetId, Math.round(performance.now() - startTime));
      }
      return existing;
    }

    const expConfig = this.experiences[targetId];
    const experienceGroup = new THREE.Group();
    anchorGroup.add(experienceGroup);

    const loadedItems: RenderableItem[] = [];

    if (!expConfig || !expConfig.items || expConfig.items.length === 0) {
      const emptyExp: LoadedExperience = {
        targetId,
        group: experienceGroup,
        items: [],
        play: () => {},
        pause: () => {},
        update: () => {},
        dispose: () => {
          anchorGroup.remove(experienceGroup);
        }
      };
      this.putLRU(targetId, emptyExp);
      return emptyExp;
    }

    // Sort items by progressive reveal hierarchy:
    // 1. text (0ms) -> 2. image & video (small assets) -> 3. model
    const textItems = expConfig.items.filter((i) => i.type === 'text');
    const imageItems = expConfig.items.filter((i) => i.type === 'image');
    const videoItems = expConfig.items.filter((i) => i.type === 'video');
    const modelItems = expConfig.items.filter((i) => i.type === 'model');

    // Stage 1: Reveal instant items (text)
    for (const item of textItems) {
      const renderable = createTextItem(item);
      experienceGroup.add(renderable.object3d);
      loadedItems.push(renderable);
    }

    // Notify time-to-first-content immediately upon stage 1 mounting
    if (this.onTimeMeasured) {
      this.onTimeMeasured(targetId, Math.round(performance.now() - startTime));
    }

    // Stage 2 & 3: Load image and video streams in parallel
    const parallelMediaPromises = [
      ...imageItems.map(async (item) => {
        const renderable = await createImageItem(item);
        experienceGroup.add(renderable.object3d);
        loadedItems.push(renderable);
      }),
      ...videoItems.map(async (item) => {
        const renderable = await createVideoItem(item);
        experienceGroup.add(renderable.object3d);
        loadedItems.push(renderable);
        renderable.play?.();
      })
    ];

    // Stage 4: Load 3D models (with temporary on-anchor indicator)
    const modelPromises = modelItems.map(async (item) => {
      // Small on-anchor pulse marker until model arrives
      const placeholderGeo = new THREE.RingGeometry(0.08, 0.1, 32);
      const placeholderMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide });
      const placeholder = new THREE.Mesh(placeholderGeo, placeholderMat);
      if (item.position) placeholder.position.set(item.position[0], item.position[1], item.position[2]);
      experienceGroup.add(placeholder);

      try {
        const renderable = await createModelItem(item);
        experienceGroup.remove(placeholder);
        placeholderGeo.dispose();
        placeholderMat.dispose();

        // Fade-in model
        renderable.object3d.scale.multiplyScalar(0.01);
        experienceGroup.add(renderable.object3d);
        loadedItems.push(renderable);

        // Simple smooth entrance scale
        let scaleProgress = 0.01;
        const animateIn = () => {
          if (scaleProgress < 1) {
            scaleProgress += 0.1;
            renderable.object3d.scale.setScalar(Math.min(scaleProgress, 1));
            requestAnimationFrame(animateIn);
          }
        };
        animateIn();
        renderable.play?.();
      } catch (err) {
        console.error(`Error loading model for target ${targetId}:`, err);
        experienceGroup.remove(placeholder);
      }
    });

    // Execute background asset downloads
    Promise.all([...parallelMediaPromises, ...modelPromises]).catch(console.error);

    const loadedExp: LoadedExperience = {
      targetId,
      group: experienceGroup,
      items: loadedItems,
      play: () => {
        loadedItems.forEach((i) => i.play?.());
      },
      pause: () => {
        loadedItems.forEach((i) => i.pause?.());
      },
      update: (delta: number) => {
        loadedItems.forEach((i) => i.update?.(delta));
      },
      dispose: () => {
        anchorGroup.remove(experienceGroup);
        loadedItems.forEach((i) => i.dispose());
        loadedItems.length = 0;
      }
    };

    this.putLRU(targetId, loadedExp);
    return loadedExp;
  }

  /**
   * LRU eviction management
   */
  private putLRU(targetId: string, exp: LoadedExperience) {
    if (this.lruCache.has(targetId)) {
      this.lruCache.delete(targetId);
    } else if (this.lruCache.size >= this.maxCacheSize) {
      // Evict oldest entry
      const oldestKey = this.lruCache.keys().next().value;
      if (oldestKey) {
        const evicted = this.lruCache.get(oldestKey);
        if (evicted) {
          console.log(`[ExperienceManager] LRU evicting oldest target '${oldestKey}' to reclaim memory.`);
          evicted.dispose();
        }
        this.lruCache.delete(oldestKey);
      }
    }
    this.lruCache.set(targetId, exp);
  }

  /**
   * Disposes all loaded experiences
   */
  public disposeAll() {
    this.lruCache.forEach((exp) => exp.dispose());
    this.lruCache.clear();
  }
}
