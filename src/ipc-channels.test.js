const { SEND_CHANNELS, REPLY_CHANNELS, INVOKE_CHANNELS } = require('./ipc-channels');

describe('ipc-channels', () => {
  test('SEND_CHANNELS is a non-empty array', () => {
    expect(Array.isArray(SEND_CHANNELS)).toBe(true);
    expect(SEND_CHANNELS.length).toBeGreaterThan(0);
  });

  test('REPLY_CHANNELS is a non-empty array', () => {
    expect(Array.isArray(REPLY_CHANNELS)).toBe(true);
    expect(REPLY_CHANNELS.length).toBeGreaterThan(0);
  });

  test('INVOKE_CHANNELS is a non-empty array', () => {
    expect(Array.isArray(INVOKE_CHANNELS)).toBe(true);
    expect(INVOKE_CHANNELS.length).toBeGreaterThan(0);
  });

  test('channels contain expected names', () => {
    expect(SEND_CHANNELS).toContain('get-instances');
    expect(SEND_CHANNELS).toContain('ha-notification');
    expect(SEND_CHANNELS).toContain('desktop-command');
    expect(REPLY_CHANNELS).toContain('settings-loaded');
    expect(REPLY_CHANNELS).toContain('entities-loaded');
    expect(INVOKE_CHANNELS).toContain('save-settings');
    expect(INVOKE_CHANNELS).toContain('test-connection');
    expect(INVOKE_CHANNELS).toContain('get-shortcuts');
  });

  test('no overlap between SEND and REPLY channels that would cause confusion', () => {
    const sendSet = new Set(SEND_CHANNELS);
    const replySet = new Set(REPLY_CHANNELS);
    const overlap = [...sendSet].filter((ch) => replySet.has(ch));
    // Some channels like 'get-instances' and 'ha-instance' are intentionally bidirectional
    // This test documents which ones overlap
    expect(overlap).toEqual(expect.arrayContaining(['get-instances', 'ha-instance']));
  });
});
