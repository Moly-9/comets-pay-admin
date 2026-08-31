import { useEffect } from 'react';
import { Button, Modal } from './Common';
import './CreatorDraftExitDialog.css';

export function DraftExitDialog({
  open,
  title,
  description,
  onDiscard,
  onSave,
  onContinue,
}: {
  open: boolean;
  title: string;
  description: string;
  onDiscard: () => void;
  onSave: () => void;
  onContinue: () => void;
}) {
  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      onContinue();
    };
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [onContinue, open]);

  if (!open) return null;

  return (
    <Modal
      title={title}
      className="creator-draft-confirm"
      onClose={onContinue}
      width="448px"
      footer={(
        <div className="creator-draft-confirm-actions">
          <Button className="creator-draft-confirm-discard" variant="ghost" onClick={onDiscard}>放弃修改并退出</Button>
          <Button className="creator-draft-confirm-save" variant="secondary" onClick={onSave}>保存草稿并退出</Button>
          <Button className="creator-draft-confirm-continue" autoFocus onClick={onContinue}>继续编辑</Button>
        </div>
      )}
    >
      <p className="creator-draft-confirm-copy">{description}</p>
    </Modal>
  );
}
