import { useEffect } from 'react';
import { Button, Modal } from './Common';
import './CreatorDraftExitDialog.css';

export function CreatorDraftExitDialog({
  open,
  onDiscard,
  onSave,
  onContinue,
}: {
  open: boolean;
  onDiscard: () => void;
  onSave: () => void;
  onContinue: () => void;
}) {
  useEffect(() => {
    if (!open) return undefined;
    const underlyingDialogs = [...document.querySelectorAll<HTMLElement>('.modal-panel:not(.creator-draft-confirm)')];
    const previousInertValues = underlyingDialogs.map((dialog) => dialog.inert);
    underlyingDialogs.forEach((dialog) => { dialog.inert = true; });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      onContinue();
    };
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      underlyingDialogs.forEach((dialog, index) => {
        dialog.inert = previousInertValues[index];
      });
    };
  }, [onContinue, open]);

  if (!open) return null;

  return (
    <Modal
      title="退出新建达人档案？"
      className="creator-draft-confirm"
      onClose={onContinue}
      width="448px"
      footer={(
        <div className="creator-draft-confirm-actions">
          <Button className="creator-draft-confirm-discard" variant="ghost" onClick={onDiscard}>放弃并退出</Button>
          <Button className="creator-draft-confirm-save" variant="secondary" onClick={onSave}>保存草稿并退出</Button>
          <Button className="creator-draft-confirm-continue" autoFocus onClick={onContinue}>继续编辑</Button>
        </div>
      )}
    >
      <p className="creator-draft-confirm-copy">当前内容尚未保存，你可以保存为草稿后退出。</p>
    </Modal>
  );
}
