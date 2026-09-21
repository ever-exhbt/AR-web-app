import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { PoseStabilizer } from '../src/ar/pose-stabilizer.js';

describe('PoseStabilizer (Jitter Suppression & Zero Latency)', () => {
  it('instantly snaps to target transform on first frame after acquisition (zero spawn latency)', () => {
    const stabilizer = new PoseStabilizer();
    const targetPos = new THREE.Vector3(1.5, 2.5, -3.0);
    const targetQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.5);
    const targetScale = new THREE.Vector3(1, 1, 1);

    stabilizer.update(targetPos, targetQuat, targetScale, 0.016);

    expect(stabilizer.isInitialized()).toBe(true);
    expect(stabilizer.currentPos.x).toBeCloseTo(1.5);
    expect(stabilizer.currentPos.y).toBeCloseTo(2.5);
    expect(stabilizer.currentPos.z).toBeCloseTo(-3.0);
    expect(stabilizer.currentQuat.angleTo(targetQuat)).toBeCloseTo(0);
  });

  it('completely suppresses micro-jitter below deadband threshold at rest', () => {
    const stabilizer = new PoseStabilizer({ deadbandDist: 0.002, deadbandAngle: 0.005 });
    const basePos = new THREE.Vector3(0, 0, -2);
    const baseQuat = new THREE.Quaternion();
    const baseScale = new THREE.Vector3(1, 1, 1);

    // Initial frame
    stabilizer.update(basePos, baseQuat, baseScale, 0.016);
    const lockedX = stabilizer.currentPos.x;

    // Simulate 30 frames of camera micro-jitter within deadband (< 0.002)
    for (let i = 0; i < 30; i++) {
      const jitterPos = new THREE.Vector3(
        basePos.x + Math.sin(i) * 0.001,
        basePos.y + Math.cos(i) * 0.001,
        basePos.z
      );
      stabilizer.update(jitterPos, baseQuat, baseScale, 0.016);
      expect(stabilizer.currentPos.x).toBe(lockedX);
    }
  });

  it('catches up smoothly during normal movement without lag', () => {
    const stabilizer = new PoseStabilizer();
    const startPos = new THREE.Vector3(0, 0, 0);
    const quat = new THREE.Quaternion();
    const scale = new THREE.Vector3(1, 1, 1);

    stabilizer.update(startPos, quat, scale, 0.016);

    // Simulate steady motion: moving to x = 0.5 over 10 frames
    for (let i = 1; i <= 10; i++) {
      const stepPos = new THREE.Vector3(i * 0.05, 0, 0);
      stabilizer.update(stepPos, quat, scale, 0.016);
    }

    // Stabilizer should track closely behind the active motion
    expect(stabilizer.currentPos.x).toBeGreaterThan(0.40);
  });

  it('instantly snaps on extreme displacement to prevent visual gliding across room', () => {
    const stabilizer = new PoseStabilizer();
    const pos1 = new THREE.Vector3(0, 0, 0);
    const pos2 = new THREE.Vector3(10, 5, 0); // Large teleport
    const quat = new THREE.Quaternion();
    const scale = new THREE.Vector3(1, 1, 1);

    stabilizer.update(pos1, quat, scale, 0.016);
    stabilizer.update(pos2, quat, scale, 0.016);

    expect(stabilizer.currentPos.x).toBe(10);
    expect(stabilizer.currentPos.y).toBe(5);
  });

  it('properly resets initialized state so re-acquisition has zero delay', () => {
    const stabilizer = new PoseStabilizer();
    const pos1 = new THREE.Vector3(1, 2, 3);
    const pos2 = new THREE.Vector3(8, 9, 10);
    const quat = new THREE.Quaternion();
    const scale = new THREE.Vector3(1, 1, 1);

    stabilizer.update(pos1, quat, scale, 0.016);
    expect(stabilizer.isInitialized()).toBe(true);

    stabilizer.reset();
    expect(stabilizer.isInitialized()).toBe(false);

    // Next update should snap immediately to pos2
    stabilizer.update(pos2, quat, scale, 0.016);
    expect(stabilizer.currentPos.x).toBe(8);
  });
});
