import { describe, expect, it } from 'vitest';
import { adapterTypeSchema } from '../agent.js';
import { parseAdapterConfig } from '../adapter-config.js';
import {
  ADAPTER_PRESET_RUNTIMES,
  adapterPresetSchema,
  getAdapterPreset,
  listAdapterPresets,
  listAdapterPresetsFor,
} from '../adapter-presets.js';

/**
 * The preset catalogue.
 *
 * A preset is what the owner starts from instead of a blank form, so it has
 * to be usable: the configuration has to parse against the schema for its own
 * adapter type, and the persona has to say what the agent is for. And it has
 * to be honest: a runtime nobody has demonstrated is a starting point, and
 * the catalogue says so in the data as well as in the copy.
 */

const presets = listAdapterPresets();

describe('the preset catalogue', () => {
  it('has a preset for every adapter type', () => {
    for (const type of adapterTypeSchema.options) {
      expect(
        listAdapterPresetsFor(type).length,
        `no preset for the "${type}" adapter type`,
      ).toBeGreaterThan(0);
    }
  });

  it('gives every preset a configuration that parses against its own adapter type', () => {
    for (const preset of presets) {
      const parsed = parseAdapterConfig(preset.config);

      expect(parsed.adapterType).toBe(preset.adapterType);
      expect(parsed).toBeTruthy();
    }
  });

  it('gives every preset a role and standing instructions', () => {
    for (const preset of presets) {
      expect(preset.persona.role?.trim().length ?? 0, `${preset.id} has no role`).toBeGreaterThan(
        0,
      );
      expect(
        preset.persona.instructions?.trim().length ?? 0,
        `${preset.id} has no standing instructions`,
      ).toBeGreaterThan(0);
    }
  });

  it('gives every preset a name and a description the owner can read', () => {
    for (const preset of presets) {
      expect(preset.name.trim().length).toBeGreaterThan(0);
      expect(preset.description.trim().length).toBeGreaterThan(0);
    }
  });

  it('carries no credential value and no secret reference', () => {
    for (const preset of presets) {
      const config = preset.config as Record<string, unknown>;
      expect(config['apiKey'], `${preset.id} carries an API key`).toBeUndefined();
      expect(config['authToken'], `${preset.id} carries an auth token`).toBeUndefined();
      expect(config['apiKeyRef'], `${preset.id} names a secret record`).toBeUndefined();
      expect(config['authTokenRef'], `${preset.id} names a secret record`).toBeUndefined();
    }
  });
});

describe('the runtime presets', () => {
  it('has a preset for each of the five approved target runtimes', () => {
    for (const runtime of ADAPTER_PRESET_RUNTIMES) {
      const found = presets.filter((preset) => preset.runtime === runtime);
      expect(found.length, `no preset for the ${runtime} runtime`).toBeGreaterThan(0);
    }
  });

  it('claims no runtime to be verified', () => {
    for (const preset of presets.filter((entry) => entry.runtime !== undefined)) {
      expect(
        preset.verified,
        `${preset.id} claims to be verified, and no runtime has been demonstrated in this repository`,
      ).toBe(false);
    }
  });

  it('says in its own copy that the integration has not been demonstrated', () => {
    for (const preset of presets.filter((entry) => entry.runtime !== undefined)) {
      expect(
        preset.description.toLowerCase(),
        `${preset.id} does not say that it has not been demonstrated`,
      ).toContain('not been demonstrated');
    }
  });

  it('names the surface it uses, and the alternative that exists', () => {
    const hermes = getAdapterPreset('hermes-http');
    const openclaw = getAdapterPreset('openclaw-http');
    const opencode = getAdapterPreset('opencode-acp');
    const codex = getAdapterPreset('codex-cli');

    expect(hermes?.adapterType).toBe('http');
    expect(hermes?.description).toContain('ACP');
    expect(openclaw?.adapterType).toBe('http');
    expect(openclaw?.description).toContain('ACP');
    expect(opencode?.adapterType).toBe('acp');
    expect(opencode?.description.toLowerCase()).toContain('http');
    expect(codex?.adapterType).toBe('cli');
    expect(codex?.description).toContain('App Server');
  });
});

describe('a preset that cannot be used', () => {
  it('is refused by the schema rather than served', () => {
    const broken = {
      id: 'broken',
      adapterType: 'cli',
      name: 'Broken',
      description: 'A preset whose configuration belongs to another adapter.',
      config: { adapterType: 'http', baseUrl: 'https://example.com' },
      persona: { role: 'Role', instructions: 'Instructions' },
      capabilities: {
        chat: true,
        streaming: false,
        persistentSessions: false,
        backgroundTasks: false,
        cancel: false,
        approvals: false,
        artifacts: false,
      },
      requires: [],
      verified: false,
    };

    const parsed = adapterPresetSchema.safeParse(broken);
    expect(parsed.success).toBe(false);
  });

  it('is refused when the persona is only half a persona', () => {
    const half = {
      id: 'half',
      adapterType: 'echo',
      name: 'Half',
      description: 'A preset with a role and no instructions.',
      config: { adapterType: 'echo' },
      persona: { role: 'Role only' },
      capabilities: {
        chat: true,
        streaming: true,
        persistentSessions: false,
        backgroundTasks: false,
        cancel: true,
        approvals: false,
        artifacts: false,
      },
      requires: [],
      verified: false,
    };

    expect(adapterPresetSchema.safeParse(half).success).toBe(false);
  });
});

describe('the catalogue as a pure function', () => {
  it('hands out a copy, so a caller cannot change the catalogue', () => {
    const first = listAdapterPresets();
    const target = first[0]!;
    target.name = 'Changed';

    const second = listAdapterPresets();
    expect(second[0]?.name).not.toBe('Changed');
  });

  it('returns only the presets of the type that was asked for', () => {
    for (const preset of listAdapterPresetsFor('cli')) {
      expect(preset.adapterType).toBe('cli');
    }
  });

  it('finds a preset by its id, and nothing for an id it does not have', () => {
    expect(getAdapterPreset('echo-local')?.id).toBe('echo-local');
    expect(getAdapterPreset('no-such-preset')).toBeUndefined();
  });
});
