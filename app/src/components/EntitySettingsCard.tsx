import { CheckCircle2, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Button, Modal } from './Common';

export type EntitySettingsItem<TId extends string> = {
  id: TId;
  name: string;
  address: string;
};

export type EntitySettingsErrors = Partial<Record<'name' | 'address' | 'duplicate', string>>;

type EntitySettingsCardProps<TId extends string> = {
  icon: ReactNode;
  title: string;
  description: string;
  addLabel: string;
  createTitle: string;
  editTitle: string;
  deleteTitle: string;
  nameLabel: string;
  addressLabel: string;
  entityNoun: string;
  defaultGroupLabel: string;
  defaultInputName: string;
  note: string;
  deleteHistoryNote: string;
  entities: EntitySettingsItem<TId>[];
  defaultEntityId: TId;
  validate: (
    draft: Pick<EntitySettingsItem<TId>, 'name' | 'address'>,
    entities: EntitySettingsItem<TId>[],
    editingId?: TId,
  ) => EntitySettingsErrors;
  onCreate: (draft: Pick<EntitySettingsItem<TId>, 'name' | 'address'>) => void;
  onUpdate: (entity: EntitySettingsItem<TId>) => void;
  onDefaultChange: (id: TId) => void;
  onDelete: (entity: EntitySettingsItem<TId>) => void;
};

export function EntitySettingsCard<TId extends string>({
  icon,
  title,
  description,
  addLabel,
  createTitle,
  editTitle,
  deleteTitle,
  nameLabel,
  addressLabel,
  entityNoun,
  defaultGroupLabel,
  defaultInputName,
  note,
  deleteHistoryNote,
  entities,
  defaultEntityId,
  validate,
  onCreate,
  onUpdate,
  onDefaultChange,
  onDelete,
}: EntitySettingsCardProps<TId>) {
  const [editor, setEditor] = useState<{
    mode: 'create' | 'edit';
    id?: TId;
    name: string;
    address: string;
  } | null>(null);
  const [errors, setErrors] = useState<EntitySettingsErrors>({});
  const [deleteTarget, setDeleteTarget] = useState<EntitySettingsItem<TId> | null>(null);

  const openEditor = (entity?: EntitySettingsItem<TId>) => {
    setErrors({});
    setEditor(entity ? {
      mode: 'edit',
      id: entity.id,
      name: entity.name,
      address: entity.address,
    } : {
      mode: 'create',
      name: '',
      address: '',
    });
  };

  const save = () => {
    if (!editor) return;
    const nextErrors = validate(editor, entities, editor.id);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    const draft = { name: editor.name.trim(), address: editor.address.trim() };
    if (editor.mode === 'edit' && editor.id) onUpdate({ id: editor.id, ...draft });
    else onCreate(draft);
    setEditor(null);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    onDelete(deleteTarget);
    setDeleteTarget(null);
  };

  return (
    <>
      <section className="profile-form-card invoice-entity-card">
        <div className="invoice-entity-section-head">
          <div className="form-section-head">
            <span>{icon}</span>
            <div><h2>{title}</h2><p>{description}</p></div>
          </div>
          <Button variant="secondary" icon={<Plus size={16} />} onClick={() => openEditor()}>{addLabel}</Button>
        </div>
        <div className="invoice-entity-list" role="radiogroup" aria-label={defaultGroupLabel}>
          {entities.map((entity) => {
            const isDefault = entity.id === defaultEntityId;
            const deleteDisabled = isDefault || entities.length === 1;
            const deleteHint = entities.length === 1
              ? `至少需要保留一个${entityNoun}`
              : isDefault
                ? '请先将其他主体设为默认后再删除'
                : `删除 ${entity.name}`;
            return (
              <div className={`invoice-entity-row${isDefault ? ' is-default' : ''}`} key={entity.id}>
                <label className="invoice-entity-default-control">
                  <input
                    type="radio"
                    name={defaultInputName}
                    checked={isDefault}
                    onChange={() => onDefaultChange(entity.id)}
                  />
                  <span>{isDefault ? '默认主体' : '设为默认'}</span>
                </label>
                <div className="invoice-entity-row-content">
                  <strong>{entity.name}</strong>
                  <p>{entity.address}</p>
                </div>
                <div className="invoice-entity-row-actions">
                  <button className="icon-button" type="button" aria-label={`编辑 ${entity.name}`} title={editTitle} onClick={() => openEditor(entity)}>
                    <Pencil size={17} />
                  </button>
                  <button className="icon-button is-danger" type="button" aria-label={`删除 ${entity.name}`} title={deleteHint} disabled={deleteDisabled} onClick={() => setDeleteTarget(entity)}>
                    <Trash2 size={17} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <div className="invoice-entity-note"><CheckCircle2 size={16} /><span>{note}</span></div>
      </section>
      {editor ? (
        <Modal
          title={editor.mode === 'create' ? createTitle : editTitle}
          className="invoice-entity-editor-modal"
          onClose={() => setEditor(null)}
          footer={(
            <>
              <Button variant="secondary" onClick={() => setEditor(null)}>取消</Button>
              <Button onClick={save}>{editor.mode === 'create' ? '确认添加' : '保存修改'}</Button>
            </>
          )}
        >
          <div className="form-grid invoice-entity-editor-form">
            <label className={`full-width ${errors.name || errors.duplicate ? 'has-error' : ''}`}>
              <span>{nameLabel} * <small>{editor.name.length} / 100</small></span>
              <input
                value={editor.name}
                maxLength={100}
                autoComplete="organization"
                onChange={(event) => {
                  setEditor((current) => current ? { ...current, name: event.target.value } : current);
                  setErrors((current) => ({ ...current, name: undefined, duplicate: undefined }));
                }}
              />
              <small role={errors.name || errors.duplicate ? 'alert' : undefined}>{errors.name ?? errors.duplicate}</small>
            </label>
            <label className={`full-width ${errors.address ? 'has-error' : ''}`}>
              <span>{addressLabel} * <small>{editor.address.length} / 500</small></span>
              <textarea
                value={editor.address}
                maxLength={500}
                autoComplete="street-address"
                onChange={(event) => {
                  setEditor((current) => current ? { ...current, address: event.target.value } : current);
                  setErrors((current) => ({ ...current, address: undefined, duplicate: undefined }));
                }}
              />
              <small role={errors.address ? 'alert' : undefined}>{errors.address}</small>
            </label>
          </div>
        </Modal>
      ) : null}
      {deleteTarget ? (
        <Modal
          title={deleteTitle}
          onClose={() => setDeleteTarget(null)}
          footer={(
            <>
              <Button variant="secondary" onClick={() => setDeleteTarget(null)}>取消</Button>
              <Button variant="danger" onClick={confirmDelete}>确认删除</Button>
            </>
          )}
        >
          <p>确定删除“{deleteTarget.name}”吗？{deleteHistoryNote}</p>
        </Modal>
      ) : null}
    </>
  );
}
