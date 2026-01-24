import { GestureCanvas } from "../common/GestureCanvas";
import type { Action, GestureTemplate, WheelTrigger } from "../../types";
import "./ActionList.css";

interface ActionListProps {
  actions: Action[];
  gestures: GestureTemplate[];
  selectedAction: string | null;
  onSelect: (gesture: string) => void;
  onDelete: (gesture: string) => void;
  onAdd: () => void;
}

const actionTypeLabels: Record<string, string> = {
  keystroke: "キーストローク",
  command: "コマンド実行",
  url: "URLを開く",
  window_operation: "ウィンドウ操作",
};

const wheelTriggerLabels: Record<WheelTrigger, string> = {
  wheel_up: "ホイールアップ",
  wheel_down: "ホイールダウン",
  wheel_click: "ホイールクリック",
  x1_button: "X1ボタン",
  x2_button: "X2ボタン",
  leftclick_wheel_up: "左クリック+ホイールアップ",
  leftclick_wheel_down: "左クリック+ホイールダウン",
};

export function ActionList({ actions, gestures, selectedAction, onSelect, onDelete, onAdd }: ActionListProps) {

  const getGesturePoints = (gestureName: string): [number, number][] => {
    const gesture = gestures.find((g) => g.name === gestureName);
    return gesture?.points || [];
  };

  const isWheelAction = (action: Action): boolean => {
    return action.trigger_type === "wheel" || (!action.gesture && !!action.wheel_trigger);
  };

  const getActionKey = (action: Action): string => {
    if (action.trigger_type === "wheel" || (!action.gesture && action.wheel_trigger)) {
      return `wheel_${action.wheel_trigger}`;
    }
    return action.gesture;
  };

  const getActionDescription = (action: Action): string => {
    switch (action.action_type) {
      case "keystroke": {
        const mods = action.modifiers?.join("+") || "";
        const key = action.keystroke || "";
        return mods ? `${mods}+${key}` : key;
      }
      case "command":
        return action.command || "";
      case "url":
        return action.url || "";
      case "window_operation": {
        const operationLabels: Record<string, string> = {
          minimize: "最小化",
          maximize: "最大化",
          close: "閉じる",
        };
        return operationLabels[action.operation || ""] || "";
      }
      default:
        return "";
    }
  };

  return (
    <div className="action-list">
      <div className="action-list-header">
        <div className="action-col-name">アクション名</div>
        <div className="action-col-trigger">トリガー</div>
        <div className="action-col-action">アクション</div>
      </div>
      {actions.map((action) => {
        const actionKey = getActionKey(action);
        const isWheel = isWheelAction(action);
        return (
          <div
            key={actionKey}
            className={`action-item ${selectedAction === actionKey ? "selected" : ""}`}
            onClick={() => onSelect(actionKey)}
          >
            <button
              className="delete-button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(actionKey);
              }}
              aria-label="削除"
            >
              ×
            </button>
            <div className="action-col-name">
              {action.name && action.name.trim() ? action.name : "無し"}
            </div>
            <div className="action-col-trigger">
              {isWheel ? (
                <div className="wheel-trigger-label">
                  {action.wheel_trigger ? wheelTriggerLabels[action.wheel_trigger] : "ホイール"}
                </div>
              ) : (
                <div className="gesture-preview">
                  <GestureCanvas
                    points={getGesturePoints(action.gesture)}
                    width={70}
                    height={70}
                    strokeWidth={2}
                  />
                </div>
              )}
            </div>
            <div className="action-col-action">
              <div className="action-type">{actionTypeLabels[action.action_type]}</div>
              <div className="action-desc">{getActionDescription(action)}</div>
            </div>
          </div>
        );
      })}
      <div className="action-item add-action-item" onClick={onAdd}>
        <div className="action-col-name"></div>
        <div className="action-col-trigger">
          <span className="plus-icon">+</span>
        </div>
        <div className="action-col-action"></div>
      </div>
    </div>
  );
}
