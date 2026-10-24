import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { listAdapterPresets } from '@personal-os/contracts';
import { AgentConnectionForm, type AgentFormInput } from '../AgentConnectionForm';

/**
 * The preset picker.
 *
 * A template is what the owner starts from instead of a blank form: it
 * fills the configuration and the persona, every field stays editable
 * afterwards, and a template nobody has run against a real runtime says so
 * where the owner reads it.
 */

const presets = listAdapterPresets();

function renderForm(overrides: Partial<Parameters<typeof AgentConnectionForm>[0]> = {}) {
  const onSubmit = vi.fn<(input: AgentFormInput) => void>();
  render(
    <AgentConnectionForm
      open
      onOpenChange={() => undefined}
      onSubmit={onSubmit}
      presets={presets}
      {...overrides}
    />,
  );
  return { onSubmit };
}

/** The picker's own options, apart from the adapter type list. */
function templateOptions(): HTMLElement {
  return screen.getByLabelText('Template');
}

/** Choose a template in the picker. */
function chooseTemplate(id: string): void {
  fireEvent.change(templateOptions(), { target: { value: id } });
}

/** Choose an adapter type. */
function chooseType(value: string): void {
  fireEvent.change(screen.getByLabelText('Adapter type'), { target: { value } });
}

describe('the preset picker', () => {
  it('offers the templates of the chosen adapter type', () => {
    renderForm();

    expect(
      within(templateOptions()).getByRole('option', { name: 'Built-in echo (local test)' }),
    ).toBeInTheDocument();

    chooseType('cli');

    expect(
      within(templateOptions()).getByRole('option', { name: 'Pi (command line subprocess)' }),
    ).toBeInTheDocument();
    expect(
      within(templateOptions()).queryByRole('option', { name: 'Built-in echo (local test)' }),
    ).toBeNull();

    // Codex has its own adapter type, because it reports its work as an
    // event stream rather than as text on standard output.
    chooseType('codex');

    expect(
      within(templateOptions()).getByRole('option', { name: 'Codex (command line)' }),
    ).toBeInTheDocument();
    expect(
      within(templateOptions()).queryByRole('option', { name: 'Pi (command line subprocess)' }),
    ).toBeNull();
  });

  it('fills the configuration and the persona from the template', () => {
    renderForm();

    chooseTemplate('echo-local');

    expect(screen.getByLabelText('Reply')).toHaveValue('pong');
    expect(screen.getByLabelText('Role')).toHaveValue('Echo tester');
    expect((screen.getByLabelText('Standing instructions') as HTMLTextAreaElement).value).toContain(
      'built-in test agent',
    );
  });

  it('fills a runtime template with the command line it starts from', () => {
    renderForm();

    chooseType('codex');
    chooseTemplate('codex-cli');

    expect(screen.getByLabelText('Command')).toHaveValue('codex');
    // The adapter builds the `exec` subcommand and the event flags itself,
    // so the template carries none of them.
    expect(screen.getByLabelText('Arguments')).toHaveValue('');
    expect(screen.getByLabelText('Sandbox')).toHaveValue('read-only');
    expect(screen.getByLabelText('Role')).toHaveValue('Codex lead');
  });

  it('fills the App Server template with the command and the permission setting', () => {
    renderForm();

    // The App Server is a different route from the command line one: it has
    // threads, turns and approval requests of its own.
    chooseType('codex-app-server');
    chooseTemplate('codex-app-server');

    expect(screen.getByLabelText('Command')).toHaveValue('codex');
    expect(screen.getByLabelText('Sandbox')).toHaveValue('read-only');
    expect(screen.getByLabelText('Permission requests')).toHaveValue('on-request');
    expect(screen.getByLabelText('Role')).toHaveValue('Codex lead');
  });

  it('sends the App Server configuration with the connection', () => {
    const { onSubmit } = renderForm();

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Codex' } });
    chooseType('codex-app-server');
    chooseTemplate('codex-app-server');
    fireEvent.click(screen.getByRole('button', { name: 'Create connection' }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const input = onSubmit.mock.calls[0]![0];
    expect(input.presetId).toBe('codex-app-server');
    expect(input.adapterType).toBe('codex-app-server');
    expect(input.config).toMatchObject({
      command: 'codex',
      sandbox: 'read-only',
      approvalPolicy: 'on-request',
      // The thread is kept, so the next turn goes back into it.
      ephemeral: false,
    });
  });

  it('leaves every field editable after the template is applied', () => {
    renderForm();

    chooseType('codex');
    chooseTemplate('codex-cli');

    fireEvent.change(screen.getByLabelText('Command'), { target: { value: '/opt/codex' } });
    fireEvent.change(screen.getByLabelText('Role'), { target: { value: 'My own role' } });

    expect(screen.getByLabelText('Command')).toHaveValue('/opt/codex');
    expect(screen.getByLabelText('Role')).toHaveValue('My own role');
  });

  it('shows what a demonstrated template rests on', () => {
    renderForm();

    chooseType('acp');
    chooseTemplate('hermes-acp');

    expect(screen.getByText('demonstrated here')).toBeInTheDocument();
    expect(screen.getByText('What the demonstration rests on')).toBeInTheDocument();
    // The owner reads which runtime answered, which version, and when.
    expect(screen.getByText(/Hermes 0\.21\.0/)).toBeInTheDocument();
    expect(screen.getByText(/2026-10-23/)).toBeInTheDocument();
  });

  it('says that a template nobody has run is not demonstrated', () => {
    renderForm();

    // Codex and OpenCode have been demonstrated; Pi has not, and the panel
    // says so where the owner reads it.
    chooseType('cli');
    chooseTemplate('pi-cli');

    const badge = screen.getByText('not demonstrated');
    expect(badge).toBeInTheDocument();
    // A notice that is not a failure carries an icon beside it.
    expect(badge.querySelector('svg')).not.toBeNull();
    expect(screen.getByText(/has not been demonstrated in this repository/)).toBeInTheDocument();
  });

  it('shows what the OpenCode template rests on', () => {
    renderForm();

    chooseType('acp');
    chooseTemplate('opencode-acp');

    // The template was run against a real OpenCode, and the panel says which
    // one, which version and when.
    expect(screen.getByText('demonstrated here')).toBeInTheDocument();
    expect(screen.getByText(/OpenCode 1\.19\.4/)).toBeInTheDocument();
    expect(screen.getByText(/2026-10-24/)).toBeInTheDocument();
  });

  it('names what the owner still has to supply', () => {
    renderForm();

    chooseType('codex');
    chooseTemplate('codex-cli');

    expect(screen.getByText('What you still have to supply')).toBeInTheDocument();
    expect(screen.getByText(/An installed `codex` binary on PATH\./)).toBeInTheDocument();
    // The credential stays in Codex, and the panel says so rather than
    // asking the owner for a secret the runtime already holds.
    expect(screen.getByText(/run `codex login` there/)).toBeInTheDocument();
  });

  it('sends the template with the connection', () => {
    const { onSubmit } = renderForm();

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Codex' } });
    chooseTemplate('echo-local');
    fireEvent.click(screen.getByRole('button', { name: 'Create connection' }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const input = onSubmit.mock.calls[0]![0];
    expect(input.presetId).toBe('echo-local');
    expect(input.adapterType).toBe('echo');
    expect(input.config).toMatchObject({ reply: 'pong' });
    expect(input.persona).toMatchObject({ role: 'Echo tester' });
  });

  it('works with no template chosen', async () => {
    const { onSubmit } = renderForm({ presets: [] });

    expect(screen.queryByLabelText('Template')).toBeNull();

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Plain' } });
    fireEvent.change(screen.getByLabelText('Reply'), { target: { value: 'hello' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create connection' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const input = onSubmit.mock.calls[0]![0];
    expect(input.presetId).toBeNull();
    expect(input.adapterType).toBe('echo');
    expect(input.config).toMatchObject({ reply: 'hello' });
  });

  it('starts from the template the owner chose on the page', async () => {
    renderForm({ initialPresetId: 'echo-local' });

    await waitFor(() => expect(screen.getByLabelText('Reply')).toHaveValue('pong'));
    expect(screen.getByLabelText('Role')).toHaveValue('Echo tester');
    expect((templateOptions() as HTMLSelectElement).value).toBe('echo-local');
  });
});
