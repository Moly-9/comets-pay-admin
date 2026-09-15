import {
  AlertCircle,
  CheckCircle2,
  Clipboard,
  Download,
  FileSpreadsheet,
  Link2,
  LoaderCircle,
  Mail,
  Search,
  Send,
  Upload,
} from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import {
  buildCreatorInvitationPreview,
  createCreatorInvitationRecords,
  createCreatorInvitationTemplate,
  CREATOR_INVITATION_MAX_ACCOUNTS,
  CREATOR_INVITATION_MAX_FILE_SIZE,
  CREATOR_INVITATION_STATUS_LABELS,
  filterCreatorInvitationRecords,
  formatCreatorInvitationDateTime,
  parseCreatorInvitationWorkbook,
  resolveCreatorInvitationStatus,
  validateCreatorInvitationFile,
  type CreatorInvitationImportIssue,
  type CreatorInvitationImportPreview,
  type CreatorInvitationRecord,
  type CreatorInvitationStatusFilter,
} from '../creatorInvitations';
import { downloadBlob } from '../invoice/invoiceUtils';
import type { CreatorProfile } from '../types';
import { Button, Modal, SelectField } from './Common';
import { SocialPlatformIcon } from './CreatorIdentity';
import { Pagination, usePagination } from './Pagination';

type Notify = (title: string, message: string) => void;

const INVITATION_TEMPLATE_FILENAME = 'COMETS_Pay_达人邀请名单模板_V1.0.xlsx';

const issueSummary = (issues: readonly CreatorInvitationImportIssue[]) => issues.reduce(
  (summary, issue) => ({
    ...summary,
    [issue.severity]: summary[issue.severity] + (issue.count ?? 1),
  }),
  { ERROR: 0, SKIP: 0 },
);

function InvitationAccountList({ record }: { record: CreatorInvitationRecord }) {
  return (
    <div className="creator-invitation-record-accounts">
      {record.socialAccounts.map((account) => (
        <a
          href={account.profileUrl}
          target="_blank"
          rel="noreferrer"
          aria-label={`打开 ${account.platform} 频道 ${account.handle}`}
          key={account.id}
        >
          <SocialPlatformIcon platform={account.platform} handle={account.handle} size={15} />
          <span><strong>{account.platform}</strong><small>{account.handle}</small></span>
          <Link2 size={13} aria-hidden="true" />
        </a>
      ))}
    </div>
  );
}

export function CreatorInvitationSendDialog({
  creators,
  records,
  onClose,
  onRecordsChange,
  onOpenRecords,
  notify,
}: {
  creators: readonly CreatorProfile[];
  records: readonly CreatorInvitationRecord[];
  onClose: () => void;
  onRecordsChange: (records: CreatorInvitationRecord[]) => void;
  onOpenRecords: () => void;
  notify: Notify;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedFilename, setSelectedFilename] = useState('');
  const [preview, setPreview] = useState<CreatorInvitationImportPreview | null>(null);
  const [fileIssues, setFileIssues] = useState<CreatorInvitationImportIssue[]>([]);
  const [createdRecords, setCreatedRecords] = useState<CreatorInvitationRecord[]>([]);
  const [downloading, setDownloading] = useState(false);
  const [reading, setReading] = useState(false);
  const [sending, setSending] = useState(false);
  const issueCounts = issueSummary(preview?.issues ?? fileIssues);

  const downloadTemplate = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const blob = await createCreatorInvitationTemplate();
      downloadBlob(blob, INVITATION_TEMPLATE_FILENAME);
      notify('邀请模板已下载', '请按模板填写达人邮箱、社媒平台和频道 URL，完成后上传识别。');
    } catch (error) {
      notify('邀请模板下载失败', error instanceof Error ? error.message : '无法生成 Excel 模板，请稍后重试。');
    } finally {
      setDownloading(false);
    }
  };

  const readFile = async (file: File) => {
    setSelectedFilename(file.name);
    setPreview(null);
    setCreatedRecords([]);
    const validationIssues = validateCreatorInvitationFile(file);
    setFileIssues(validationIssues);
    if (validationIssues.length) return;
    setReading(true);
    try {
      const workbook = await parseCreatorInvitationWorkbook(await file.arrayBuffer());
      const nextPreview = buildCreatorInvitationPreview({ workbook, creators, records });
      setPreview(nextPreview);
      setFileIssues([]);
    } catch (error) {
      setFileIssues([{
        code: 'INVALID_TEMPLATE',
        severity: 'ERROR',
        message: error instanceof Error ? error.message : '文件读取失败，请重新下载模板后再试',
      }]);
    } finally {
      setReading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const sendInvitations = () => {
    if (!preview?.groups.length || sending) return;
    setSending(true);
    try {
      const created = createCreatorInvitationRecords(preview.groups, records);
      onRecordsChange([...created, ...records]);
      setCreatedRecords(created);
      notify(
        '模拟发送成功',
        `已为 ${created.length} 位达人生成邀请码和 7 天有效期记录；本次不会投递真实邮件。`,
      );
    } catch (error) {
      notify('模拟发送失败', error instanceof Error ? error.message : '邀请码生成失败，请重新确认。');
    } finally {
      setSending(false);
    }
  };

  const resetUpload = () => {
    setSelectedFilename('');
    setPreview(null);
    setFileIssues([]);
    setCreatedRecords([]);
  };

  const footer = createdRecords.length ? (
    <>
      <Button variant="secondary" onClick={onClose}>完成</Button>
      <Button icon={<Clipboard size={16} />} onClick={onOpenRecords}>查看邀请记录</Button>
    </>
  ) : preview ? (
    <>
      <Button variant="ghost" onClick={resetUpload}>重新上传</Button>
      <Button
        icon={sending ? <LoaderCircle className="is-spinning" size={16} /> : <Send size={16} />}
        disabled={!preview.groups.length || sending}
        disabledReason={!preview.groups.length ? '没有可发送的有效邀请，请检查导入结果。' : '正在生成邀请记录。'}
        aria-busy={sending || undefined}
        onClick={sendInvitations}
      >
        {sending ? '正在模拟发送' : `确认模拟发送（${preview.readyInvitationCount}）`}
      </Button>
    </>
  ) : (
    <Button variant="secondary" onClick={onClose}>关闭</Button>
  );

  return (
    <Modal
      title="发送邀请链接"
      width="920px"
      className="creator-invitation-modal"
      onClose={onClose}
      footer={footer}
    >
      <div className="creator-invitation-steps" aria-label="邀请发送步骤">
        {['下载模板', '上传识别', '确认模拟发送'].map((label, index) => {
          const currentStep = createdRecords.length ? 3 : preview ? 3 : selectedFilename ? 2 : 1;
          const step = index + 1;
          return (
            <span className={step <= currentStep ? 'is-active' : ''} aria-current={step === currentStep ? 'step' : undefined} key={label}>
              <b>{step}</b>{label}
            </span>
          );
        })}
      </div>

      <div className="creator-invitation-simulation-note">
        <Mail size={19} aria-hidden="true" />
        <span>
          <strong>管理端邀请原型 · 仅模拟发送</strong>
          <small>系统只生成邀请码、有效期和邀请记录，不会发送真实邮件，也不会创建或打开达人 C 端页面。</small>
        </span>
      </div>

      {createdRecords.length ? (
        <section className="creator-invitation-complete" aria-live="polite">
          <CheckCircle2 size={34} aria-hidden="true" />
          <div>
            <h3>模拟发送成功</h3>
            <p>已生成 {createdRecords.length} 条邀请记录，有效期均为 7 天。未完成的邀请不会进入正式达人档案。</p>
          </div>
          <div className="creator-invitation-created-codes">
            {createdRecords.map((record) => (
              <article key={record.id}>
                <span>{record.email}<small>{record.socialAccounts.length} 个社媒账号</small></span>
                <strong>{record.invitationCode}</strong>
              </article>
            ))}
          </div>
        </section>
      ) : preview ? (
        <div className="creator-invitation-preview">
          <div className="creator-invitation-summary-grid" aria-label="导入识别结果">
            <article className="is-ready"><span>有效邀请</span><strong>{preview.readyInvitationCount}</strong><small>{preview.readyAccountCount} 个账号</small></article>
            <article className="is-skipped"><span>跳过账号</span><strong>{preview.skippedAccountCount}</strong><small>重复或存在冲突</small></article>
            <article className="is-error"><span>错误项</span><strong>{preview.errorCount}</strong><small>不会阻止有效邀请</small></article>
          </div>
          <section className="creator-invitation-preview-section">
            <header><h3>待模拟发送</h3><span>{selectedFilename}</span></header>
            {preview.groups.length ? (
              <div className="creator-invitation-preview-groups">
                {preview.groups.map((group) => (
                  <article key={group.email}>
                    <div><Mail size={17} /><span><strong>{group.email}</strong><small>将合并为 1 封邀请 · {group.socialAccounts.length} 个账号</small></span></div>
                    <div className="creator-invitation-preview-accounts">
                      {group.socialAccounts.map((account) => (
                        <span key={account.id}>
                          <SocialPlatformIcon platform={account.platform} handle={account.handle} size={15} />
                          {account.platform} · {account.handle}
                        </span>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="creator-invitation-empty"><AlertCircle size={21} /><span><strong>没有可发送的有效邀请</strong><small>请根据下方问题修改文件后重新上传。</small></span></div>
            )}
          </section>
          {preview.issues.length ? (
            <section className="creator-invitation-issues">
              <header><h3>跳过与错误明细</h3><span>{issueCounts.SKIP} 条跳过 · {issueCounts.ERROR} 条错误</span></header>
              <ul>
                {preview.issues.slice(0, 60).map((issue, index) => (
                  <li className={issue.severity === 'ERROR' ? 'is-error' : 'is-skip'} key={`${issue.code}-${issue.sourceRow ?? issue.email ?? index}-${index}`}>
                    <span>{issue.severity === 'ERROR' ? '错误' : '跳过'}</span>
                    {issue.message}
                  </li>
                ))}
              </ul>
              {preview.issues.length > 60 ? <p>另有 {preview.issues.length - 60} 条明细未展开，请修改文件后重新上传确认。</p> : null}
            </section>
          ) : null}
        </div>
      ) : (
        <div className="creator-invitation-upload-layout">
          <section className="creator-invitation-template-card">
            <span className="creator-invitation-card-icon"><FileSpreadsheet size={24} /></span>
            <div><h3>1. 下载 Excel 模板</h3><p>工作表固定为“达人邀请名单”，请保留表头、平台下拉选项和隐藏版本信息。</p></div>
            <Button
              variant="secondary"
              icon={downloading ? <LoaderCircle className="is-spinning" size={16} /> : <Download size={16} />}
              disabled={downloading}
              aria-busy={downloading || undefined}
              onClick={() => { void downloadTemplate(); }}
            >{downloading ? '正在生成' : '下载模板'}</Button>
          </section>
          <section className="creator-invitation-upload-card">
            <span className="creator-invitation-card-icon"><Upload size={24} /></span>
            <div><h3>2. 上传填写完成的名单</h3><p>仅支持 .xlsx，文件不超过 {CREATOR_INVITATION_MAX_FILE_SIZE / 1024 / 1024} MB，最多识别 {CREATOR_INVITATION_MAX_ACCOUNTS} 条社媒账号。</p></div>
            <input
              ref={inputRef}
              className="creator-invitation-file-input"
              type="file"
              tabIndex={-1}
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              aria-label="上传达人邀请名单"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void readFile(file);
              }}
            />
            <Button
              icon={reading ? <LoaderCircle className="is-spinning" size={16} /> : <Upload size={16} />}
              disabled={reading}
              aria-busy={reading || undefined}
              onClick={() => inputRef.current?.click()}
            >{reading ? '正在识别' : '选择 Excel 文件'}</Button>
          </section>
          {fileIssues.length ? (
            <div className="creator-invitation-file-errors" role="alert">
              <AlertCircle size={18} />
              <span><strong>{selectedFilename || '文件校验失败'}</strong>{fileIssues.map((issue) => <small key={issue.code}>{issue.message}</small>)}</span>
            </div>
          ) : null}
        </div>
      )}
    </Modal>
  );
}

const RECORD_STATUS_OPTIONS: ReadonlyArray<{ value: CreatorInvitationStatusFilter; label: string }> = [
  { value: 'all', label: '全部入驻状态' },
  { value: 'ACTIVE', label: '邀请中' },
  { value: 'SENT', label: '已发送' },
  { value: 'EXPIRED', label: '已失效' },
  { value: 'VERIFICATION_REQUESTED', label: '已请求邀请码' },
  { value: 'REGISTERING', label: '注册中' },
  { value: 'COMPLETED', label: '已完成' },
];

export function CreatorInvitationRecordsDialog({
  records,
  initialStatus = 'all',
  onClose,
  notify,
}: {
  records: readonly CreatorInvitationRecord[];
  initialStatus?: CreatorInvitationStatusFilter;
  onClose: () => void;
  notify: Notify;
}) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<CreatorInvitationStatusFilter>(initialStatus);
  const filteredRecords = useMemo(() => filterCreatorInvitationRecords(records, {
    search,
    status,
  }), [records, search, status]);
  const { page, pageItems, pageSize, setPage, setPageSize } = usePagination(filteredRecords, {
    resetKey: `${search}\u0000${status}`,
  });

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      notify('邀请码已复制', `${code} 已复制到剪贴板。`);
    } catch {
      notify('邀请码复制失败', '当前浏览器未开放剪贴板权限，请手动复制邀请码。');
    }
  };

  return (
    <Modal
      title="邀请记录"
      width="1120px"
      className="creator-invitation-records-modal"
      onClose={onClose}
      footer={<Button variant="secondary" onClick={onClose}>关闭</Button>}
    >
      <div className="creator-invitation-records-note">
        <Mail size={18} />
        <span><strong>管理端模拟邀请记录</strong><small>刷新后仍会保留在当前浏览器；当前不会投递真实邮件或创建正式达人档案。</small></span>
      </div>
      <div className="creator-invitation-record-filters">
        <label className="search-control page-search">
          <Search size={16} />
          <input
            aria-label="搜索邀请邮箱、平台或邀请码"
            placeholder="搜索邮箱、平台或邀请码"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <SelectField
          ariaLabel="邀请入驻状态筛选"
          className="creator-invitation-status-filter"
          value={status}
          options={RECORD_STATUS_OPTIONS}
          onChange={setStatus}
        />
      </div>
      <div className="table-scroll creator-invitation-record-table-scroll">
        <table className="data-table operational-table creator-invitation-record-table">
          <thead><tr><th>达人邮箱</th><th>平台及频道</th><th>邀请码</th><th>发送时间</th><th>失效时间</th><th>发送结果</th><th>入驻状态</th></tr></thead>
          <tbody>
            {pageItems.length ? pageItems.map((record) => {
              const resolvedStatus = resolveCreatorInvitationStatus(record);
              return (
                <tr key={record.id}>
                  <td><strong className="creator-invitation-email">{record.email}</strong></td>
                  <td><InvitationAccountList record={record} /></td>
                  <td>
                    <button className="creator-invitation-code" type="button" title="复制邀请码" onClick={() => { void copyCode(record.invitationCode); }}>
                      <span>{record.invitationCode}</span><Clipboard size={13} />
                    </button>
                  </td>
                  <td><time dateTime={record.sentAt}>{formatCreatorInvitationDateTime(record.sentAt)}</time></td>
                  <td><time dateTime={record.expiresAt}>{formatCreatorInvitationDateTime(record.expiresAt)}</time></td>
                  <td><span className="creator-invitation-delivery"><CheckCircle2 size={14} />模拟发送成功</span></td>
                  <td><span className={`creator-invitation-status is-${resolvedStatus.toLocaleLowerCase('en-US')}`}>{CREATOR_INVITATION_STATUS_LABELS[resolvedStatus]}</span></td>
                </tr>
              );
            }) : (
              <tr><td colSpan={7}><div className="creator-invitation-record-empty"><Mail size={22} /><span><strong>{records.length ? '没有匹配的邀请记录' : '暂无邀请记录'}</strong><small>{records.length ? '请调整搜索词或状态筛选。' : '通过“发送邀请链接”模拟发送后，记录会显示在这里。'}</small></span></div></td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="table-footer">
        <span>共 {filteredRecords.length} 条邀请记录</span>
        <Pagination
          ariaLabel="邀请记录分页"
          page={page}
          pageSize={pageSize}
          total={filteredRecords.length}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </div>
    </Modal>
  );
}
