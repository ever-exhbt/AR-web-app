import * as THREE from 'three';

export interface PoseStabilizerOptions {
  /** Base lerp rate for position (1/second). Defaults to 25. */
  posLerpSpeed?: number;
  /** Base slerp rate for rotation (1/second). Defaults to 25. */
  rotLerpSpeed?: number;
  /** Minimum distance in target units before updating position. Eliminates resting micro-tremor. Defaults to 0.001 (~1mm). */
  deadbandDist?: number;
  /** Minimum angle in radians before updating orientation. Eliminates resting angular jitter. Defaults to 0.002 rad (~0.11 deg). */
  deadbandAngle?: number;
  /** Distance threshold in target units where catchup reaches maximum speed (zero latency). Defaults to 0.06. */
  fastCatchupDist?: number;
  /** Angle threshold in radians where rotation catchup reaches maximum speed. Defaults to 0.15 rad (~8.5 deg). */
  fastCatchupAngle?: number;
}

/**
 * High-performance adaptive pose stabilizer for WebAR tracking.
 * Decouples discrete ~20Hz camera computer-vision updates into buttery-smooth
 * 60Hz/120Hz display transforms while maintaining zero latency during rapid movement.
 *
 * Employs:
 * 1. Sub-millimeter position & sub-degree angular deadbands (freezes resting jitter completely)
 * 2. Velocity-dependent non-linear acceleration (eliminates lag during pans/tilts)
 * 3. Immediate snap on target acquisition or extreme displacement (no drift on spawn)
 * 4. Spherical linear interpolation (slerp) ensuring unit quaternion normalization
 */
export class PoseStabilizer {
  public readonly currentPos = new THREE.Vector3();
  public readonly currentQuat = new THREE.Quaternion();
  public readonly currentScale = new THREE.Vector3(1, 1, 1);

  private readonly posLerpSpeed: number;
  private readonly rotLerpSpeed: number;
  private readonly deadbandDist: number;
  private readonly deadbandAngle: number;
  private readonly fastCatchupDist: number;
  private readonly fastCatchupAngle: number;

  private initialized = false;

  constructor(options: PoseStabilizerOptions = {}) {
    this.posLerpSpeed = options.posLerpSpeed ?? 25;
    this.rotLerpSpeed = options.rotLerpSpeed ?? 25;
    this.deadbandDist = options.deadbandDist ?? 0.001;
    this.deadbandAngle = options.deadbandAngle ?? (0.12 * Math.PI / 180);
    this.fastCatchupDist = options.fastCatchupDist ?? 0.06;
    this.fastCatchupAngle = options.fastCatchupAngle ?? (8 * Math.PI / 180);
  }

  /**
   * Resets the filter state so the next update immediately snaps to the target.
   * Call when a target is lost or re-acquired.
   */
  public reset(): void {
    this.initialized = false;
  }

  /**
   * Returns whether the stabilizer has an active tracking reference.
   */
  public isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Updates smoothed pose against raw target transform.
   * @param targetPos Latest position from anchor matrix
   * @param targetQuat Latest quaternion from anchor matrix
   * @param targetScale Latest scale from anchor matrix
   * @param delta Elapsed time in seconds since last frame
   */
  public update(
    targetPos: THREE.Vector3,
    targetQuat: THREE.Quaternion,
    targetScale: THREE.Vector3,
    delta: number
  ): void {
    // 1. Instant snap on first frame after acquisition
    if (!this.initialized) {
      this.currentPos.copy(targetPos);
      this.currentQuat.copy(targetQuat);
      this.currentScale.copy(targetScale);
      this.initialized = true;
      return;
    }

    const dt = Math.max(0.001, Math.min(delta, 0.1));

    // 2. Adaptive Position Smoothing
    const dist = this.currentPos.distanceTo(targetPos);
    if (dist > this.deadbandDist) {
      if (dist > this.fastCatchupDist * 2.5) {
        // Instant snap on extreme leaps (e.g. target teleported across camera)
        this.currentPos.copy(targetPos);
      } else {
        const factor = Math.min(1.0, (dist - this.deadbandDist) / (this.fastCatchupDist - this.deadbandDist));
        const effectiveSpeed = this.posLerpSpeed * (1.0 + 5.0 * factor * factor);
        const alpha = Math.min(1.0, 1.0 - Math.exp(-effectiveSpeed * dt));
        this.currentPos.lerp(targetPos, alpha);
      }
    }

    // 3. Adaptive Rotation Smoothing (SLERP)
    const angle = this.currentQuat.angleTo(targetQuat);
    if (angle > this.deadbandAngle) {
      if (angle > this.fastCatchupAngle * 2.5) {
        // Instant snap on extreme rotation jump
        this.currentQuat.copy(targetQuat);
      } else {
        const factor = Math.min(1.0, (angle - this.deadbandAngle) / (this.fastCatchupAngle - this.deadbandAngle));
        const effectiveSpeed = this.rotLerpSpeed * (1.0 + 5.0 * factor * factor);
        const alpha = Math.min(1.0, 1.0 - Math.exp(-effectiveSpeed * dt));
        this.currentQuat.slerp(targetQuat, alpha);
      }
    }

    // 4. Scale Smoothing
    const scaleAlpha = Math.min(1.0, 1.0 - Math.exp(-15 * dt));
    this.currentScale.lerp(targetScale, scaleAlpha);
  }
}
