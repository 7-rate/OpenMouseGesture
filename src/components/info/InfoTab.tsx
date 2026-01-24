/**
 * 情報表示タブ
 *
 * 概要:
 *   ソフトウェアの基本情報（アイコン、名称、バージョン、GitHub URL、免責事項）を表示する。
 * 入力:
 *   なし（内部でTauriコマンドを呼び出し、バージョンとアイコンを取得）。
 * 出力:
 *   なし（Reactコンポーネントのレンダリング結果としてUIを表示）。
 * 具体例:
 *   画面に「OpenMouseGesture」および Cargo.toml の version を表示し、
 *   リンク「https://github.com/7-rate/OpenMouseGesture/」をクリックでブラウザが開く。
 */

import { useEffect, useState } from 'react';
import { getVersion, getIconBytes } from '../../api/commands';
import './InfoTab.css';

export function InfoTab() {
  const [version, setVersion] = useState<string>('');
  const [iconUrl, setIconUrl] = useState<string>('');

  useEffect(() => {
    const load = async () => {
      try {
        const [ver, bytes] = await Promise.all([getVersion(), getIconBytes()]);
        setVersion(ver);
        const blob = new Blob([new Uint8Array(bytes)], { type: 'image/png' });
        const url = URL.createObjectURL(blob);
        setIconUrl(url);
      } catch (error) {
        console.error('Failed to load app info:', error);
        setVersion('Unknown');
      }
    };
    load();
    return () => {
      if (iconUrl) URL.revokeObjectURL(iconUrl);
    };
  }, []);

  return (
    <div className="info-tab">
      <div className="info-content">
        <div className="info-header">
          <img src={iconUrl} alt="OpenMouseGesture Icon" className="info-icon" />
          <h1 className="info-title">OpenMouseGesture</h1>
        </div>
        
        <div className="info-section">
          <div className="info-item">
            <span className="info-label">バージョン:</span>
            <span className="info-value">{version}</span>
          </div>
          
          <div className="info-item">
            <span className="info-label">GitHub:</span>
            <a 
              href="https://github.com/7-rate/OpenMouseGesture/" 
              className="info-link"
              target="_blank"
              rel="noopener noreferrer"
            >
              https://github.com/7-rate/OpenMouseGesture/
            </a>
          </div>
        </div>

        <div className="info-section">
          <h2 className="info-subtitle">免責事項</h2>
          <div className="info-disclaimer">
            <p>商用・非商用を問わず無償で利用できますが、ソースコードの著作権は各箇所を記述した人が留保しています。</p>
            <p>このソフトウェアは無保証です。</p>
          </div>
        </div>
      </div>
    </div>
  );
}
