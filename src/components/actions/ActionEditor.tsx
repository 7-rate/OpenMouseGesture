import { useState, useEffect, useRef } from "react";
import { Button } from "../common/Button";
import { GestureCanvas } from "../common/GestureCanvas";
import type { Action, GestureTemplate, WheelTrigger } from "../../types";
import "./ActionEditor.css";

interface ActionEditorProps {
  action: Action | null;
  gestures: GestureTemplate[];
  usedGestures: string[];
  isNew?: boolean;
  onChange: (action: Action) => void;
}

const modifierOptions = ["Ctrl", "Shift", "Alt", "Win"];
const keyOptions = [
  ...Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i)),
  ...Array.from({ length: 12 }, (_, i) => `F${i + 1}`),
  "Left",
  "Right",
  "Up",
  "Down",
  "Tab",
  "Escape",
  "Enter",
  "Space",
  "VolumeUp",
  "VolumeDown",
  "VolumeMute",
  "MediaPlayPause",
  "MediaStop",
  "MediaNext",
  "MediaPrev",
];

const wheelTriggerOptions: { value: WheelTrigger; label: string }[] = [
  { value: "wheel_up", label: "ホイールアップ" },
  { value: "wheel_down", label: "ホイールダウン" },
  { value: "wheel_click", label: "ホイールクリック" },
  { value: "x1_button", label: "X1ボタン" },
  { value: "x2_button", label: "X2ボタン" },
  { value: "leftclick_wheel_up", label: "左クリック+ホイールアップ" },
  { value: "leftclick_wheel_down", label: "左クリック+ホイールダウン" },
];

export function ActionEditor({
  action,
  gestures,
  usedGestures,
  isNew = false,
  onChange,
}: ActionEditorProps) {
  const [name, setName] = useState(action?.name || "");
  const [triggerType, setTriggerType] = useState<"gesture" | "wheel">(
    action?.trigger_type || "gesture"
  );
  const [gesture, setGesture] = useState(action?.gesture || "");
  const [wheelTrigger, setWheelTrigger] = useState<WheelTrigger | "">(action?.wheel_trigger || "");
  const [actionType, setActionType] = useState<"keystroke" | "command" | "url" | "window_operation">(
    action?.action_type || "keystroke"
  );
  const [keystroke, setKeystroke] = useState(action?.keystroke || "");
  const [modifiers, setModifiers] = useState<string[]>(action?.modifiers || []);
  const [command, setCommand] = useState(action?.command || "");
  const [url, setUrl] = useState(action?.url || "");
  const [operation, setOperation] = useState<"minimize" | "maximize" | "close">(action?.operation || "minimize");
  const [ignoreExe, setIgnoreExe] = useState(action?.ignore_exe?.join("\n") || "");
  const [error, setError] = useState<string | null>(null);
  
  const actionJsonRef = useRef<string>("");

  useEffect(() => {
    const newActionJson = JSON.stringify(action);
    if (newActionJson !== actionJsonRef.current) {
      actionJsonRef.current = newActionJson;
      setName(action?.name || "");
      setTriggerType(action?.trigger_type || "gesture");
      setGesture(action?.gesture || "");
      setWheelTrigger(action?.wheel_trigger || "");
      setActionType(action?.action_type || "keystroke");
      setKeystroke(action?.keystroke || "");
      setModifiers(action?.modifiers || []);
      setCommand(action?.command || "");
      setUrl(action?.url || "");
      setOperation(action?.operation || "minimize");
      setIgnoreExe(action?.ignore_exe?.join("\n") || "");
      setError(null);
    }
  }, [action]);

  const availableGestures = gestures.filter(
    (g) => !usedGestures.includes(g.name) || g.name === action?.gesture || g.name === gesture
  );

  const selectedGestureData = triggerType === "gesture" && gesture ? gestures.find((g) => g.name === gesture) : null;

  const toggleModifier = (mod: string) => {
    setModifiers((prev) =>
      prev.includes(mod) ? prev.filter((m) => m !== mod) : [...prev, mod]
    );
  };

  const handleTriggerTypeChange = (newType: "gesture" | "wheel") => {
    setTriggerType(newType);
    if (newType === "wheel") {
      setGesture("");
      if (!wheelTrigger) {
        setWheelTrigger("wheel_up");
      }
    } else {
      setWheelTrigger("");
    }
  };

  const validateAndSave = () => {
    if (triggerType === "gesture" && !gesture) {
      setError("ジェスチャーを選択してください");
      return false;
    }

    if (triggerType === "wheel" && !wheelTrigger) {
      setError("ホイールトリガーを選択してください");
      return false;
    }

    if (actionType === "keystroke" && !keystroke) {
      setError("キーを選択してください");
      return false;
    }
    if (actionType === "command" && !command.trim()) {
      setError("コマンドを入力してください");
      return false;
    }
    if (actionType === "url" && !url.trim()) {
      setError("URLを入力してください");
      return false;
    }

    const ignoreExeList = ignoreExe
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s);

    setError(null);
    onChange({
      name: name.trim() || undefined,
      trigger_type: triggerType,
      gesture: triggerType === "gesture" ? gesture : "",
      wheel_trigger: triggerType === "wheel" && wheelTrigger ? wheelTrigger : undefined,
      action_type: actionType,
      keystroke: actionType === "keystroke" ? keystroke : undefined,
      modifiers: actionType === "keystroke" && modifiers.length > 0 ? modifiers : undefined,
      command: actionType === "command" ? command.trim() : undefined,
      url: actionType === "url" ? url.trim() : undefined,
      operation: actionType === "window_operation" ? operation : undefined,
      ignore_exe: ignoreExeList.length > 0 ? ignoreExeList : undefined,
    });
    return true;
  };

  const handleFieldChange = () => {
    if (!isNew) {
      const timer = setTimeout(() => {
        validateAndSave();
      }, 500);
      return () => clearTimeout(timer);
    }
  };

  useEffect(() => {
    if (!isNew && actionType) {
      const cleanup = handleFieldChange();
      return cleanup;
    }
  }, [name, triggerType, gesture, wheelTrigger, actionType, keystroke, modifiers, command, url, operation, ignoreExe]);

  return (
    <div className="action-editor">
      <h3 className="editor-title">
        {isNew ? "新規アクション" : "アクション編集"}
      </h3>

      <div className="editor-form">
        <div className="form-group">
          <label htmlFor="action-name">アクション名</label>
          <input
            id="action-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="アクションの説明"
          />
        </div>

        <div className="section-divider" />

        <div className="form-group">
          <h3 className="editor-title">トリガー</h3>
          <label htmlFor="trigger-type">トリガータイプ</label>
          <select
            id="trigger-type"
            value={triggerType}
            onChange={(e) => handleTriggerTypeChange(e.target.value as "gesture" | "wheel")}
          >
            <option value="gesture">ジェスチャー</option>
            <option value="wheel">ホイール</option>
          </select>
        </div>

        {triggerType === "wheel" && (
          <div className="form-group">
            <label htmlFor="wheel-trigger">ホイールトリガー</label>
            <select
              id="wheel-trigger"
              value={wheelTrigger}
              onChange={(e) => setWheelTrigger(e.target.value as WheelTrigger)}
            >
              <option value="">選択してください</option>
              {wheelTriggerOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {triggerType === "gesture" && (
          <div className="form-group">
            <label htmlFor="action-gesture">ジェスチャー</label>
            <div className="gesture-select-row">
              {selectedGestureData && (
                <div className="gesture-preview-small">
                  <GestureCanvas
                    points={selectedGestureData.points}
                    width={50}
                    height={50}
                    strokeWidth={2}
                  />
                </div>
              )}
              <select
                id="action-gesture"
                value={gesture}
                onChange={(e) => setGesture(e.target.value)}
              >
                <option value="">選択してください</option>
                {availableGestures.map((g) => (
                  <option key={g.name} value={g.name}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div className="section-divider" />

        <div className="form-group">
          <h3 className="editor-title">アクション</h3>
          <label htmlFor="action-type">アクションタイプ</label>
          <select
            id="action-type"
            value={actionType}
            onChange={(e) => setActionType(e.target.value as "keystroke" | "command" | "url" | "window_operation")}
          >
            <option value="keystroke">キーストローク</option>
            <option value="command">コマンド実行</option>
            <option value="url">URLを開く</option>
            <option value="window_operation">ウィンドウ操作</option>
          </select>
        </div>

        {actionType === "keystroke" && (
          <>
            <div className="form-group">
              <label>修飾キー</label>
              <div className="modifier-buttons">
                {modifierOptions.map((mod) => (
                  <button
                    key={mod}
                    type="button"
                    className={`modifier-btn ${modifiers.includes(mod) ? "active" : ""}`}
                    onClick={() => toggleModifier(mod)}
                  >
                    {mod}
                  </button>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="action-key">キー</label>
              <select
                id="action-key"
                value={keystroke}
                onChange={(e) => setKeystroke(e.target.value)}
              >
                <option value="">選択してください</option>
                {keyOptions.map((key) => (
                  <option key={key} value={key}>
                    {key}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}

        {actionType === "command" && (
          <div className="form-group">
            <label htmlFor="action-command">コマンド</label>
            <input
              id="action-command"
              type="text"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder="実行するコマンドまたはパス"
            />
          </div>
        )}

        {actionType === "url" && (
          <div className="form-group">
            <label htmlFor="action-url">URL</label>
            <input
              id="action-url"
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
            />
          </div>
        )}

        {actionType === "window_operation" && (
          <div className="form-group">
            <label htmlFor="action-operation">操作</label>
            <select
              id="action-operation"
              value={operation}
              onChange={(e) => setOperation(e.target.value as "minimize" | "maximize" | "close")}
            >
              <option value="minimize">最小化</option>
              <option value="maximize">最大化</option>
              <option value="close">閉じる</option>
            </select>
          </div>
        )}

        <div className="section-divider" />

        <div className="form-group">
          <label htmlFor="ignore-exe">無視するEXE（1行に1つ）</label>
          <textarea
            id="ignore-exe"
            value={ignoreExe}
            onChange={(e) => setIgnoreExe(e.target.value)}
            placeholder="notepad.exe&#10;explorer.exe"
            rows={3}
          />
        </div>

        {error && <p className="form-error">{error}</p>}

        {isNew && (
          <div className="editor-actions">
            <Button variant="primary" onClick={validateAndSave}>
              保存
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
