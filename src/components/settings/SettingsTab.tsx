import { useState, useEffect, useRef, useCallback } from "react";
import { useStore } from "../../store/useStore";
import * as api from "../../api/commands";
import type { Config } from "../../types";
import "./SettingsTab.css";

export function SettingsTab() {
  const { config, setConfig, pushHistory } = useStore();

  const [trajectory, setTrajectory] = useState(config.trajectory);
  const [ignoreExe, setIgnoreExe] = useState(config.ignore_exe.join("\n"));
  const [error, setError] = useState<string | null>(null);
  const skipSyncRef = useRef(false);

  useEffect(() => {
    if (skipSyncRef.current) {
      skipSyncRef.current = false;
      return;
    }
    setTrajectory(config.trajectory);
    setIgnoreExe(config.ignore_exe.join("\n"));
  }, [config]);

  const sanitizeIgnoreExe = (value: string) =>
    value
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);

  const hasConfigChanged = (next: Config, prev: Config) => {
    if (next.trajectory !== prev.trajectory) {
      return true;
    }
    if (next.ignore_exe.length !== prev.ignore_exe.length) {
      return true;
    }
    return next.ignore_exe.some((exe, idx) => exe !== prev.ignore_exe[idx]);
  };

  const persistConfig = useCallback(
    async (partial: Partial<Config>) => {
      const previousConfig = config;
      const nextConfig = { ...previousConfig, ...partial };

      if (!hasConfigChanged(nextConfig, previousConfig)) {
        return;
      }

      setError(null);

      skipSyncRef.current = true;
      setConfig(nextConfig);

      try {
        await api.saveConfig(nextConfig);
        pushHistory({
          type: "config",
          action: "update",
          data: nextConfig,
          previousData: previousConfig,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "保存に失敗しました");
        skipSyncRef.current = false;
        setConfig(previousConfig);
        setTrajectory(previousConfig.trajectory);
        setIgnoreExe(previousConfig.ignore_exe.join("\n"));
      }
    },
    [config, pushHistory, setConfig]
  );

  const handleTrajectoryChange = (checked: boolean) => {
    setTrajectory(checked);
    void persistConfig({ trajectory: checked });
  };

  const handleIgnoreExeChange = (value: string) => {
    setIgnoreExe(value);
    void persistConfig({ ignore_exe: sanitizeIgnoreExe(value) });
  };

  return (
    <div className="settings-tab">
      <div className="settings-content">
        <h2 className="settings-title">グローバル設定</h2>

        <div className="settings-section">
          <h3 className="section-title">表示設定</h3>

          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={trajectory}
              onChange={(e) => handleTrajectoryChange(e.target.checked)}
            />
            <span>軌跡を表示する</span>
          </label>
        </div>

        <div className="settings-section">
          <h3 className="section-title">グローバル無視EXE</h3>
          <p className="section-desc">
            以下のアプリケーションではジェスチャーを無効にします（1行に1つ）
          </p>
          <textarea
            value={ignoreExe}
            onChange={(e) => handleIgnoreExeChange(e.target.value)}
            placeholder="notepad.exe&#10;explorer.exe"
            rows={6}
          />
        </div>

        {error && <p className="settings-error">{error}</p>}
      </div>
    </div>
  );
}
