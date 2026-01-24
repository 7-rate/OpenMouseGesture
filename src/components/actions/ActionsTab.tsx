import { useState } from "react";
import { Button } from "../common/Button";
import { ConfirmDialog } from "../common/Dialog";
import { ActionList } from "./ActionList";
import { ActionEditor } from "./ActionEditor";
import { useStore } from "../../store/useStore";
import * as api from "../../api/commands";
import type { Action } from "../../types";
import "./ActionsTab.css";

const getActionKey = (action: Action): string => {
  if (action.trigger_type === "wheel" || (!action.gesture && action.wheel_trigger)) {
    return `wheel_${action.wheel_trigger}`;
  }
  return action.gesture;
};

export function ActionsTab() {
  const {
    actions,
    gestures,
    selectedAction,
    setSelectedAction,
    addAction,
    updateAction,
    deleteAction,
    pushHistory,
  } = useStore();

  const [isNew, setIsNew] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedActionData = actions.find((a) => getActionKey(a) === selectedAction);
  const usedGestures = actions.map((a) => a.gesture).filter(g => g);

  const handleAdd = () => {
    setSelectedAction(null);
    setIsNew(true);
  };

  const handleSelect = (gesture: string | null) => {
    setSelectedAction(gesture);
    setIsNew(false);
  };

  const handleChange = async (action: Action) => {
    setError(null);
    try {
      if (isNew) {
        await api.addAction(action);
        addAction(action);
        pushHistory({
          type: "action",
          action: "add",
          data: action,
        });
        setIsNew(false);
        setSelectedAction(getActionKey(action));
      } else if (selectedAction) {
        const oldData = actions.find((a) => getActionKey(a) === selectedAction);
        const newKey = getActionKey(action);
        
        if (selectedAction !== newKey) {
          await api.deleteAction(selectedAction);
          await api.addAction(action);
          deleteAction(selectedAction);
          addAction(action);
        } else {
          await api.updateAction(selectedAction, action);
          updateAction(selectedAction, action);
        }
        
        pushHistory({
          type: "action",
          action: "update",
          data: action,
          previousData: oldData,
        });
        setSelectedAction(newKey);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleDelete = async () => {
    if (!selectedAction) return;
    setError(null);
    try {
      const oldData = actions.find((a) => getActionKey(a) === selectedAction);
      await api.deleteAction(selectedAction);
      deleteAction(selectedAction);
      pushHistory({
        type: "action",
        action: "delete",
        data: { gesture: selectedAction },
        previousData: oldData,
      });
      setShowDeleteConfirm(false);
      setSelectedAction(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="actions-tab">
      {error && <p className="error-message">{error}</p>}

      <div className="actions-content">
        <div className="actions-list-panel">
          <ActionList
            actions={actions}
            gestures={gestures}
            selectedAction={selectedAction}
            onSelect={handleSelect}
          />
        </div>

        <div className="actions-editor-panel">
          {(selectedAction || isNew) ? (
            <ActionEditor
              action={isNew ? null : selectedActionData || null}
              gestures={gestures}
              usedGestures={usedGestures}
              isNew={isNew}
              onChange={handleChange}
            />
          ) : (
            <div className="action-placeholder">
              <p>アクションを選択するか、「追加」ボタンで新規作成してください</p>
            </div>
          )}
        </div>
      </div>

      <div className="actions-footer">
        <Button variant="primary" onClick={handleAdd}>
          追加
        </Button>
        <Button
          variant="danger"
          onClick={() => setShowDeleteConfirm(true)}
          disabled={!selectedAction}
        >
          削除
        </Button>
      </div>

      <ConfirmDialog
        open={showDeleteConfirm}
        title="アクションの削除"
        message={`「${selectedAction}」のアクションを削除しますか？`}
        confirmLabel="削除"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
}
