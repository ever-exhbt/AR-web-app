import { describe, it, expect } from 'vitest';
import { validateExperiences } from '../src/content/schema.js';

describe('Experiences Schema Validation', () => {
  it('passes on valid experience configurations with model, video, image, and text', () => {
    const validConfig = {
      'spring-poster': {
        title: 'Spring Poster Experience',
        items: [
          { type: 'model', src: '/content/assets/sample-model.glb', scale: 0.5, animation: 'auto' },
          { type: 'video', src: '/content/assets/sample-video.mp4', poster: '/content/assets/sample-video-poster.webp', width: 0.8 },
          { type: 'image', src: '/content/assets/sample-badge.webp', width: 0.3, position: [0.2, 0.4, 0.01] },
          { type: 'text', text: 'Spring Collection 2026', color: '#ffffff', width: 0.7 }
        ],
        infoCard: {
          heading: 'Spring Poster',
          body: 'Augmented exhibition collection.'
        }
      }
    };

    const report = validateExperiences(validConfig);
    expect(report.valid).toBe(true);
    expect(report.errors.length).toBe(0);
  });

  it('fails when an unsupported item type is specified', () => {
    const invalidConfig = {
      'test-target': {
        items: [
          { type: 'unsupported-type', src: 'something' }
        ]
      }
    };

    const report = validateExperiences(invalidConfig);
    expect(report.valid).toBe(false);
    expect(report.errors.some(e => e.message.includes("invalid type 'unsupported-type'"))).toBe(true);
    expect(report.errors[0].targetId).toBe('test-target');
    expect(report.errors[0].itemIndex).toBe(0);
  });

  it('fails when position transform is not a 3-element numeric array', () => {
    const invalidConfig = {
      'test-target': {
        items: [
          { type: 'text', text: 'Hello', position: [0, 1] } // only 2 numbers
        ]
      }
    };

    const report = validateExperiences(invalidConfig);
    expect(report.valid).toBe(false);
    expect(report.errors.some(e => e.message.includes('position must be a 3-element numeric array'))).toBe(true);
  });

  it('fails when model or video items are missing required src attribute', () => {
    const invalidConfig = {
      'test-target': {
        items: [
          { type: 'model' } // missing src
        ]
      }
    };

    const report = validateExperiences(invalidConfig);
    expect(report.valid).toBe(false);
    expect(report.errors.some(e => e.message.includes("must have a valid 'src' path"))).toBe(true);
  });

  it('fails when infoCard is missing required heading or body', () => {
    const invalidConfig = {
      'test-target': {
        infoCard: {
          heading: '' // empty heading
        }
      }
    };

    const report = validateExperiences(invalidConfig);
    expect(report.valid).toBe(false);
    expect(report.errors.some(e => e.message.includes('infoCard.heading is required'))).toBe(true);
  });
});
