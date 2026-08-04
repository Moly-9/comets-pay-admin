import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  LoaderCircle,
  RefreshCw,
  ScanLine,
  ShieldCheck,
} from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { CURRENT_USER } from '../data';

type AuthMode = 'login' | 'register' | 'reset' | 'feishu';

const MODE_COPY: Record<Exclude<AuthMode, 'feishu'>, { title: string; subtitle: string }> = {
  login: {
    title: '账号登录',
    subtitle: '首次使用请先注册账号\n请使用@cometsgame.com飞书邮箱注册后再登录',
  },
  register: {
    title: '创建账号',
    subtitle: '请使用飞书邮箱注册登录',
  },
  reset: {
    title: '修改密码',
    subtitle: '验证账号后，设置一个新的登录密码',
  },
};

function BrandWordmark({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`auth-wordmark ${compact ? 'auth-wordmark-compact' : ''}`} aria-label="COMETS Pay">
      <strong>COMETS</strong>
      <span>Pay</span>
    </span>
  );
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  placeholder,
  autoComplete,
  action,
  required = true,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  autoComplete: string;
  action?: React.ReactNode;
  required?: boolean;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <label className="auth-field" htmlFor={id}>
      <span className="auth-field-label">
        <span>{label}</span>
        {action}
      </span>
      <span className="auth-input-shell">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required={required}
        />
        <button
          className="auth-input-action"
          type="button"
          aria-label={visible ? '隐藏密码' : '显示密码'}
          onClick={() => setVisible((current) => !current)}
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </span>
    </label>
  );
}

export function AuthPage({ onAuthenticated }: { onAuthenticated: (account: string, password: string) => string | null }) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [qrNonce, setQrNonce] = useState(1);

  useEffect(() => {
    if (mode !== 'feishu') return undefined;
    let active = true;
    const payload = `${window.location.origin}/feishu-auth?session=comets-pay-${qrNonce}`;
    import('qrcode')
      .then(({ default: QRCode }) => QRCode.toDataURL(payload, {
        width: 208,
        margin: 1,
        errorCorrectionLevel: 'H',
        color: { dark: '#17171d', light: '#ffffff' },
      }))
      .then((result) => {
        if (active) setQrCode(result);
      })
      .catch(() => {
        if (active) setQrCode('');
      });
    return () => {
      active = false;
    };
  }, [mode, qrNonce]);

  const changeMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setAccount('');
    setError('');
    setNotice('');
    setPassword('');
    setConfirmPassword('');
    setVerificationCode('');
  };

  const completeAfter = (callback: () => void) => {
    setSubmitting(true);
    window.setTimeout(() => {
      setSubmitting(false);
      callback();
    }, 720);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setNotice('');

    if (mode === 'login') {
      if (!account.trim()) {
        setError('请输入账号或工作邮箱。');
        return;
      }
      if (!password) {
        setError('请输入登录密码。');
        return;
      }
      completeAfter(() => {
        const authenticationError = onAuthenticated(account.trim(), password);
        if (authenticationError) setError(authenticationError);
      });
      return;
    }

    if (!account.trim()) {
      setError('请输入账号或工作邮箱。');
      return;
    }
    if (password.length < 6) {
      setError('密码至少需要 6 位。');
      return;
    }

    if (mode === 'register') {
      if (!displayName.trim()) {
        setError('请输入你的姓名。');
        return;
      }
      if (password !== confirmPassword) {
        setError('两次输入的密码不一致。');
        return;
      }
      completeAfter(() => {
        changeMode('login');
        setNotice('账号创建成功，请使用新账号登录。');
      });
      return;
    }

    if (mode === 'reset') {
      if (verificationCode.trim().length < 4) {
        setError('请输入邮箱收到的验证码。');
        return;
      }
      if (password !== confirmPassword) {
        setError('两次输入的新密码不一致。');
        return;
      }
      completeAfter(() => {
        changeMode('login');
        setNotice('密码修改成功，请重新登录。');
      });
      return;
    }

    completeAfter(() => onAuthenticated(account.trim(), password));
  };

  const renderLogin = () => (
    <form className="auth-form" onSubmit={handleSubmit}>
      <label className="auth-field" htmlFor="login-account">
        <span className="auth-field-label">账号 / 工作邮箱</span>
        <span className="auth-input-shell">
          <input
            id="login-account"
            type="text"
            value={account}
            onChange={(event) => setAccount(event.target.value)}
            placeholder="请输入账号或工作邮箱"
            autoComplete="username"
          />
        </span>
      </label>

      <PasswordField
        id="login-password"
        label="密码"
        value={password}
        onChange={setPassword}
        placeholder="请输入登录密码"
        autoComplete="current-password"
        action={(
          <button className="auth-text-button" type="button" onClick={() => changeMode('reset')}>
            忘记 / 修改密码
          </button>
        )}
      />

      <label className="auth-remember">
        <input type="checkbox" />
        <span>记住我的登录状态</span>
      </label>

      <button className="auth-primary-button" type="submit" disabled={submitting}>
        {submitting ? <LoaderCircle className="auth-spinner" size={18} /> : null}
        <span>{submitting ? '正在登录…' : '登录'}</span>
      </button>

      <p className="auth-switch-copy">
        还没有账号？
        <button type="button" onClick={() => changeMode('register')}>立即注册</button>
      </p>

      <div className="auth-divider"><span>或使用飞书扫码登录</span></div>

      <button className="auth-provider-button" type="button" onClick={() => changeMode('feishu')}>
        <span className="auth-provider-icon" aria-hidden="true"><ScanLine size={18} strokeWidth={2.3} /></span>
        <span>使用飞书扫码登录</span>
      </button>
    </form>
  );

  const renderRegister = () => (
    <form className="auth-form auth-form-dense" onSubmit={handleSubmit}>
      <label className="auth-field" htmlFor="register-name">
        <span className="auth-field-label">姓名</span>
        <span className="auth-input-shell">
          <input
            id="register-name"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="请输入真实姓名"
            autoComplete="name"
            required
          />
        </span>
      </label>
      <label className="auth-field" htmlFor="register-account">
        <span className="auth-field-label">工作邮箱</span>
        <span className="auth-input-shell">
          <input
            id="register-account"
            type="email"
            value={account}
            onChange={(event) => setAccount(event.target.value)}
            placeholder="name@company.com"
            autoComplete="email"
            required
          />
        </span>
      </label>
      <PasswordField
        id="register-password"
        label="设置密码"
        value={password}
        onChange={setPassword}
        placeholder="至少 6 位字符"
        autoComplete="new-password"
      />
      <PasswordField
        id="register-password-confirm"
        label="确认密码"
        value={confirmPassword}
        onChange={setConfirmPassword}
        placeholder="请再次输入密码"
        autoComplete="new-password"
      />
      <button className="auth-primary-button" type="submit" disabled={submitting}>
        {submitting ? <LoaderCircle className="auth-spinner" size={18} /> : null}
        <span>{submitting ? '正在创建…' : '创建账号'}</span>
      </button>
      <p className="auth-switch-copy">
        已有账号？
        <button type="button" onClick={() => changeMode('login')}>返回登录</button>
      </p>
    </form>
  );

  const renderReset = () => (
    <form className="auth-form auth-form-dense" onSubmit={handleSubmit}>
      <label className="auth-field" htmlFor="reset-account">
        <span className="auth-field-label">账号 / 工作邮箱</span>
        <span className="auth-input-shell">
          <input
            id="reset-account"
            value={account}
            onChange={(event) => setAccount(event.target.value)}
            placeholder="请输入需要修改密码的账号"
            autoComplete="username"
            required
          />
        </span>
      </label>
      <label className="auth-field" htmlFor="reset-code">
        <span className="auth-field-label">邮箱验证码</span>
        <span className="auth-code-row">
          <span className="auth-input-shell">
            <input
              id="reset-code"
              inputMode="numeric"
              value={verificationCode}
              onChange={(event) => setVerificationCode(event.target.value)}
              placeholder="请输入验证码"
              autoComplete="one-time-code"
              required
            />
          </span>
          <button className="auth-code-button" type="button" onClick={() => setNotice('验证码已发送，请查看工作邮箱。')}>
            获取验证码
          </button>
        </span>
      </label>
      <PasswordField
        id="reset-password"
        label="新密码"
        value={password}
        onChange={setPassword}
        placeholder="至少 6 位字符"
        autoComplete="new-password"
      />
      <PasswordField
        id="reset-password-confirm"
        label="确认新密码"
        value={confirmPassword}
        onChange={setConfirmPassword}
        placeholder="请再次输入新密码"
        autoComplete="new-password"
      />
      <button className="auth-primary-button" type="submit" disabled={submitting}>
        {submitting ? <LoaderCircle className="auth-spinner" size={18} /> : null}
        <span>{submitting ? '正在修改…' : '确认修改密码'}</span>
      </button>
      <button className="auth-back-button" type="button" onClick={() => changeMode('login')}>
        <ArrowLeft size={16} /> 返回登录
      </button>
    </form>
  );

  const renderFeishu = () => (
    <div className="auth-feishu-panel">
      <button className="auth-back-button auth-back-top" type="button" onClick={() => changeMode('login')}>
        <ArrowLeft size={16} /> 账号密码登录
      </button>
      <div className="auth-feishu-heading">
        <span className="auth-feishu-symbol" aria-hidden="true"><ScanLine size={22} strokeWidth={2.4} /></span>
        <div>
          <h1>飞书扫码登录</h1>
          <p>使用飞书移动端扫描二维码</p>
        </div>
      </div>
      <div className="auth-qr-frame">
        {qrCode ? <img src={qrCode} alt="COMETS Pay 飞书登录二维码" /> : <LoaderCircle className="auth-spinner" size={26} />}
        <span className="auth-qr-corner auth-qr-corner-one" />
        <span className="auth-qr-corner auth-qr-corner-two" />
        <span className="auth-qr-corner auth-qr-corner-three" />
        <span className="auth-qr-corner auth-qr-corner-four" />
      </div>
      <p className="auth-qr-hint">打开飞书「扫一扫」，并在手机端确认登录</p>
      <button className="auth-refresh-button" type="button" onClick={() => setQrNonce((current) => current + 1)}>
        <RefreshCw size={15} /> 刷新二维码
      </button>
      <button className="auth-primary-button auth-feishu-confirm" type="button" onClick={() => onAuthenticated(CURRENT_USER.account, '')}>
        我已在飞书完成确认
      </button>
      <div className="auth-security-note">
        <ShieldCheck size={16} />
        <span>扫码授权仅用于身份验证，不会读取聊天内容</span>
      </div>
    </div>
  );

  const copy = mode === 'feishu' ? null : MODE_COPY[mode];

  return (
    <main className="auth-page">
      <section className="auth-brand-panel" aria-label="COMETS Pay 品牌区">
        <BrandWordmark />
        <p className="auth-brand-caption">Creator Payouts &amp; Financial Collaboration</p>
      </section>

      <section className="auth-content-panel">
        <div className="auth-mobile-brand"><BrandWordmark compact /></div>

        <div className={`auth-content ${mode === 'feishu' ? 'auth-content-feishu' : ''}`}>
          {copy ? (
            <div className="auth-heading" key={`${mode}-heading`}>
              <h1>{copy.title}</h1>
              <p>{copy.subtitle}</p>
            </div>
          ) : null}

          {notice ? (
            <div className="auth-message auth-message-success" role="status">
              <CheckCircle2 size={17} />
              <span>{notice}</span>
            </div>
          ) : null}
          {error ? <div className="auth-message auth-message-error" role="alert">{error}</div> : null}

          {mode === 'login' ? renderLogin() : null}
          {mode === 'register' ? renderRegister() : null}
          {mode === 'reset' ? renderReset() : null}
          {mode === 'feishu' ? renderFeishu() : null}
        </div>

        <p className="auth-legal">
          登录即表示你已阅读并同意
          <button type="button">《服务协议》</button>
          和
          <button type="button">《隐私政策》</button>
        </p>
      </section>
    </main>
  );
}
