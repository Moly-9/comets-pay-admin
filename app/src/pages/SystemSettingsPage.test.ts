import { describe, expect, it } from 'vitest';
import { LOCAL_ADMIN_ACCOUNT } from '../data';
import { ROLE_PERMISSION_IDS } from '../permissions';
import { INITIAL_SYSTEM_ACCOUNTS } from './SystemSettingsPage';

describe('SystemSettingsPage accounts', () => {
  it('lists the configured local administrator account', () => {
    const account = INITIAL_SYSTEM_ACCOUNTS.find((item) => item.email === LOCAL_ADMIN_ACCOUNT);

    expect(account).toMatchObject({
      id: 'USR-014',
      name: 'Liu Yao',
      role: 'admin',
      status: '已启用',
    });
    expect(account?.permissions).toEqual(ROLE_PERMISSION_IDS.admin);
  });
});
