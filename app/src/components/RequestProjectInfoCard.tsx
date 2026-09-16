type RequestProjectInfoCardProps = {
  requestCode: string;
  cooperationProjectName: string;
  cooperationProjectCode?: string;
  brand?: string;
  pm: string;
  paymentChannel?: string;
  paymentEntity?: string;
  projectCostAttribution?: string;
  expectedPaymentDate?: string;
  costType?: string;
  costTypeDetail?: string;
  media: string;
  createdAt?: string;
  reason?: string;
  remark?: string;
  title?: string;
  requestCodeLabel?: string;
};

const formatCreatedAt = (value?: string) => {
  if (!value) return '未记录';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
};

export function RequestProjectInfoCard({
  requestCode,
  cooperationProjectName,
  cooperationProjectCode,
  brand,
  pm,
  paymentChannel,
  paymentEntity,
  projectCostAttribution,
  expectedPaymentDate,
  costType,
  costTypeDetail,
  media,
  createdAt,
  reason,
  remark,
  title = '请款项目信息',
  requestCodeLabel = '项目编号',
}: RequestProjectInfoCardProps) {
  return (
    <section className="project-detail-card">
      <header className="project-detail-card-header">
        <div><h2>{title}</h2><p>查看关联项目、付款安排与付款背景。</p></div>
      </header>
      <dl className="project-info-grid">
        <div><dt>{requestCodeLabel}</dt><dd>{requestCode}</dd></div>
        <div><dt>关联项目</dt><dd>{cooperationProjectName}<small className="cell-subtext">{cooperationProjectCode || '待同步'}</small></dd></div>
        <div><dt>品牌</dt><dd>{brand || '未填写（非必填）'}</dd></div>
        <div><dt>负责 PM</dt><dd>{pm || '未指定'}</dd></div>
        <div><dt>付款渠道</dt><dd>{paymentChannel || '待补充'}</dd></div>
        <div><dt>付款主体</dt><dd>{paymentEntity || '待补充'}</dd></div>
        <div><dt>项目费用归属</dt><dd>{projectCostAttribution || '待补充'}</dd></div>
        <div><dt>预计付款时间</dt><dd>{expectedPaymentDate || '待补充'}</dd></div>
        <div><dt>成本类型</dt><dd>{costType || '待补充'}</dd></div>
        <div><dt>成本类型明细</dt><dd>{costType === '采购成本' ? costTypeDetail || '待补充' : '—'}</dd></div>
        <div><dt>项目媒介</dt><dd>{media}</dd></div>
        <div><dt>创建时间</dt><dd>{formatCreatedAt(createdAt)}</dd></div>
        <div className="project-info-wide"><dt>付款事由</dt><dd>{reason || '待补充'}</dd></div>
        <div className="project-info-wide"><dt>备注</dt><dd>{remark || '未填写'}</dd></div>
      </dl>
    </section>
  );
}
