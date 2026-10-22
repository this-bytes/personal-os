import { describe, expect, it } from 'vitest';
import { mergeFeatureRooms, type FeatureManifestInput } from '../feature.js';

/**
 * The seam's own rules.
 *
 * The manifest is what a feature declares about itself, and the rules about
 * it are the rules that let two features be built at the same time. They are
 * checked here rather than in the feature that happens to break them.
 */

const mapFeature: FeatureManifestInput = {
  id: 'feat_forge_map',
  name: 'The Map',
  rooms: [{ id: 'map', label: 'Map', path: '/map', density: 'airy', order: 10 }],
};

const workFeature: FeatureManifestInput = {
  id: 'feat_conversations',
  name: 'Conversations',
  rooms: [{ id: 'work', label: 'Work', path: '/conversations', density: 'dense', order: 20 }],
};

describe('the rooms of the panel', () => {
  it('holds the rooms of every feature in one order', () => {
    const rooms = mergeFeatureRooms([workFeature, mapFeature]);

    expect(rooms.map((room) => room.path)).toEqual(['/map', '/conversations']);
  });

  it('fills in the defaults a feature left out', () => {
    const rooms = mergeFeatureRooms([
      { id: 'feat_plain', name: 'Plain', rooms: [{ id: 'plain', label: 'Plain', path: '/plain' }] },
    ]);

    expect(rooms[0]?.density).toBe('airy');
    expect(rooms[0]?.order).toBe(100);
  });

  it('refuses two features claiming the same path', () => {
    const clash: FeatureManifestInput = {
      id: 'feat_clash',
      name: 'Clash',
      rooms: [{ id: 'clash', label: 'Clash', path: '/map' }],
    };

    expect(() => mergeFeatureRooms([mapFeature, clash])).toThrow(/claimed by both/);
  });

  it('leaves a feature with no rooms with no rooms', () => {
    expect(mergeFeatureRooms([{ id: 'feat_bare', name: 'Bare' }])).toEqual([]);
  });
});
