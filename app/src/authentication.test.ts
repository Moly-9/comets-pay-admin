import { afterEach, describe, expect, it, vi } from 'vitest';
import { authenticateSystemUser } from './data';

const configuredPassword = 'local-demo-password';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('system user authentication', () => {
  it('accepts the configured password for every demo account', () => {
    vi.stubEnv('VITE_DEMO_LOGIN_PASSWORD', configuredPassword);

    for (const account of ['media.demo', 'pm.demo', 'project.demo', 'owner.demo', 'finance.demo', 'admin.demo']) {
      expect(authenticateSystemUser(account, configuredPassword).user?.account).toBe(account);
    }
  });

  it('rejects an incorrect demo password', () => {
    vi.stubEnv('VITE_DEMO_LOGIN_PASSWORD', configuredPassword);

    expect(authenticateSystemUser('finance.demo', 'incorrect')).toEqual({
      error: '体验账号密码不正确，请重新输入。',
    });
  });

  it('fails closed when the demo password is not configured', () => {
    vi.stubEnv('VITE_DEMO_LOGIN_PASSWORD', '');

    expect(authenticateSystemUser('finance.demo', configuredPassword)).toEqual({
      error: '体验账号密码尚未配置，请联系管理员。',
    });
  });

  it('does not accept arbitrary passwords for formal accounts without original records', () => {
    vi.stubEnv('VITE_DEMO_LOGIN_PASSWORD', configuredPassword);

    expect(authenticateSystemUser('xiwenhui', configuredPassword)).toEqual({
      error: '该账号没有可恢复的原始密码记录，请使用体验账号登录。',
    });
  });

  it('preserves the passwordless handoff used by the simulated Feishu confirmation', () => {
    expect(authenticateSystemUser('xiwenhui', '').user?.account).toBe('xiwenhui');
  });
});
