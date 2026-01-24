import { GestureCanvas } from "../common/GestureCanvas";
import type { GestureTemplate } from "../../types";
import "./GestureList.css";

interface GestureListProps {
  gestures: GestureTemplate[];
  selectedGesture: string | null;
  onSelect: (name: string) => void;
}

export function GestureList({ gestures, selectedGesture, onSelect }: GestureListProps) {
  if (gestures.length === 0) {
    return (
      <div className="gesture-list-empty">
        <p>登録されたジェスチャーはありません</p>
        <p className="hint">「追加」ボタンをクリックして新しいジェスチャーを作成してください</p>
      </div>
    );
  }

  return (
    <div className="gesture-list">
      {gestures.map((gesture) => (
        <div
          key={gesture.name}
          className={`gesture-item ${selectedGesture === gesture.name ? "selected" : ""}`}
          onClick={() => onSelect(gesture.name)}
        >
          <GestureCanvas
            points={gesture.points}
            width={80}
            height={80}
            strokeWidth={2}
          />
          <span className="gesture-name">{gesture.name}</span>
        </div>
      ))}
    </div>
  );
}
