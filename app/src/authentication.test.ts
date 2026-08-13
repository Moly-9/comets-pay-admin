import { afterEach, describe, expect, it, vi } from 'vitest';
import { authenticateSystemUser, LOCAL_ADMIN_ACCOUNT } from './data';

const configuredPassword = 'local-demo-password';
const configuredAdminPassword = 'local-admin-password';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('system user authentication', () => {
  it('accepts the independently configured local administrator password', () => {
    vi.stubEnv('VITE_LIUYAO_ADMIN_PASSWORD', configuredAdminPassword);

    expect(authenticateSystemUser(LOCAL_ADMIN_ACCOUNT, configuredAdminPassword).user).toMatchObject({
      account: LOCAL_ADMIN_ACCOUNT,
      email: LOCAL_ADMIN_ACCOUNT,
      roleKey: 'admin',
      role: '管理员账号',
    });
  });

  it('rejects an incorrect local administrator password', () => {
    vi.stubEnv('VITE_LIUYAO_ADMIN_PASSWORD', configuredAdminPassword);

    expect(authenticateSystemUser(LOCAL_ADMIN_ACCOUNT, 'incorrect')).toEqual({
      error: '管理员账号密码不正确，请重新输入。',
    });
  });

  it('fails closed when the local administrator password is not configured', () => {
    vi.stubEnv('VITE_LIUYAO_ADMIN_PASSWORD', '');

    expect(authenticateSystemUser(LOCAL_ADMIN_ACCOUNT, configuredAdminPassword)).toEqual({
      error: '管理员账号密码尚未配置，请联系管理员。',
    });
  });

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
