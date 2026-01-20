---
name: sandbox_feature_creator
description: Helper skill to add new tiles, buildings, or tools to the Sandbox Game.
---

# Sandbox Feature Creator

このスキルは、サンドボックスゲームに新しい要素（タイル、建物、ツール）を追加する際の手順を自動化・ガイドします。

## 変更が必要なファイルと手順

新しい要素（例: "PARK"）を追加する場合、以下の流れでコードを変更してください。

### 1. `js/map.js`: タイル定義の追加

`Map` クラスの `TILES` オブジェクトに新しい定数を追加します。

```javascript
this.TILES = {
  // ...既存のタイル
  PARK: 8, // 新しい番号を割り当て
};
```

### 2. `js/renderer.js`: 色と描画ロジックの追加

`Renderer` クラスを変更します。

1.  `constructor` 内の `this.colors` に新しいタイルの色を追加。
2.  `draw` メソッド内のループ処理（`Render Loop`）に、新しいタイルの描画分岐を追加。
    ```javascript
    } else if (tile === this.map.TILES.PARK) {
        // 専用の描画メソッド、または drawBuilding/drawLand を使用
        this.drawBuilding(drawX, drawY, ts, '#grren', '#darkgreen', 4);
    }
    ```
    ※ 必要であれば `drawBuilding` を拡張するか、新しい描画メソッドを作成する。

### 3. `index.html`: UIボタンの追加

ツールバー（`.toolbar` 内の適切な `.tool-group`）に新しいボタンを追加します。

```html
<button class="tool-btn" data-tool="park" title="公園">
  <span class="icon">🌳</span>
</button>
```

### 4. `js/game.js`: ツールロジックの追加

`applyTool` メソッド内などに、新しいツールID（例: `park`）が選択されたときの動作を追加します。

```javascript
switch (this.activeTool) {
  // ...
  case "park":
    if (currentTile === this.map.TILES.LAND)
      this.map.setTile(x, y, this.map.TILES.PARK);
    break;
}
```

### 5. `js/input.js` / `js/ui.js`

通常は変更不要ですが、特別な操作が必要な場合は確認してください。

### 6. `PATCH_NOTES.md`: 変更履歴の記録

開発の最後に、`PATCH_NOTES.md` に変更内容を追記してください。**内容は日本語で記述してください。**

```markdown
## v[MAJOR].[MINOR].[PATCH] - [YYYY-MM-DD] - [機能名] 追加

- **追加**: [機能名] のタイルとツールを追加。
- **変更**: [変更したファイル名]
```

**バージョン番号のルール (SemVer):**

- **MAJOR**: 大規模な変更や互換性のない変更
- **MINOR**: 新機能の追加（下位互換あり）
- **PATCH**: バグ修正
  現在のバージョンを確認し、適切な番号を上げてください。

## 実行時の注意

- 既存のコードスタイル（インデント、命名規則）に従ってください。
