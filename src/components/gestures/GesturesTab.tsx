import { useState } from "react";
import { Button } from "../common/Button";
import { ConfirmDialog } from "../common/Dialog";
import { GestureList } from "./GestureList";
import { GestureEditor } from "./GestureEditor";
import { GestureCanvas } from "../common/GestureCanvas";
import { useStore } from "../../store/useStore";
import * as api from "../../api/commands";
import "./GesturesTab.css";

export function GesturesTab() {
  const {
    gestures,
    selectedGesture,
    setSelectedGesture,
    addGesture,
    updateGesture,
    deleteGesture,
    pushHistory,
  } = useStore();

  const [isEditing, setIsEditing] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedGestureData = gestures.find((g) => g.name === selectedGesture);

  const handleAdd = () => {
    setSelectedGesture(null);
    setIsNew(true);
    setIsEditing(true);
  };

  const handleEdit = () => {
    if (selectedGesture) {
      setIsNew(false);
      setIsEditing(true);
    }
  };

  const handleSave = async (name: string, points: [number, number][]) => {
    setError(null);
    try {
      if (isNew) {
        await api.saveGesture(name, points);
        addGesture({ name, points });
        pushHistory({
          type: "gesture",
          action: "add",
          data: { name, points },
        });
      } else if (selectedGesture) {
        await api.updateGesture(selectedGesture, name, points);
        const oldData = gestures.find((g) => g.name === selectedGesture);
        updateGesture(selectedGesture, { name, points });
        pushHistory({
          type: "gesture",
          action: "update",
          data: { name, points },
          previousData: oldData,
        });
      }
      setIsEditing(false);
      setSelectedGesture(name);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleDelete = async () => {
    if (!selectedGesture) return;
    setError(null);
    try {
      const oldData = gestures.find((g) => g.name === selectedGesture);
      await api.deleteGesture(selectedGesture);
      deleteGesture(selectedGesture);
      pushHistory({
        type: "gesture",
        action: "delete",
        data: { name: selectedGesture },
        previousData: oldData,
      });
      setShowDeleteConfirm(false);
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setIsNew(false);
  };

  return (
    <div className="gestures-tab">
      {error && <p className="error-message">{error}</p>}

      <div className="gestures-content">
        <div className="gestures-list-panel">
          <GestureList
            gestures={gestures}
            selectedGesture={selectedGesture}
            onSelect={setSelectedGesture}
          />
        </div>

        <div className="gestures-editor-panel">
          {isEditing ? (
            <GestureEditor
              gesture={isNew ? null : selectedGestureData || null}
              isNew={isNew}
              onSave={handleSave}
              onDelete={() => setShowDeleteConfirm(true)}
              onCancel={handleCancel}
            />
          ) : selectedGestureData ? (
            <div className="gesture-preview">
              <h3>{selectedGestureData.name}</h3>
              <div className="preview-canvas">
                <GestureCanvas
                  points={selectedGestureData.points}
                  width={250}
                  height={250}
                  strokeWidth={3}
                />
              </div>
            </div>
          ) : (
            <div className="gesture-placeholder">
              <p>ジェスチャーを選択するか、「追加」ボタンで新規作成してください</p>
            </div>
          )}
        </div>
      </div>

      <div className="gestures-footer">
        <Button variant="primary" onClick={handleAdd}>
          追加
        </Button>
        <Button
          variant="secondary"
          onClick={handleEdit}
          disabled={!selectedGesture}
        >
          編集
        </Button>
        <Button
          variant="danger"
          onClick={() => setShowDeleteConfirm(true)}
          disabled={!selectedGesture}
        >
          削除
        </Button>
      </div>

      <ConfirmDialog
        open={showDeleteConfirm}
        title="ジェスチャーの削除"
        message={`「${selectedGesture}」を削除しますか？この操作は取り消せません。`}
        confirmLabel="削除"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
}
