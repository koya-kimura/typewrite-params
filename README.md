## README: typewrite params

### 概要

このプロジェクトは、**p5.js**と**Web MIDI API**を使用して、KORGの**nanokontrol2**コントローラーでリアルタイムに制御できるテキストアニメーション作品です。コードは、MIDIデバイスの管理、nanokontrol2に特化した入力処理、そして実際の描画ロジックをクラスベースで分離し、クリーンで拡張性の高い設計になっています。

### 特徴

  * **モジュール化された設計**: コードは3つの主要なファイル（`midiManager.js`, `nanokontrol2Manager.js`, `main.js`）に分割されています。
      * `midiManager.js`: MIDIデバイスとの接続を処理する汎用的な基底クラス。
      * `nanokontrol2Manager.js`: `MidiManager`を継承し、nanokontrol2のフェーダー、ノブ、ボタンからの入力を読み取り、状態を管理するクラス。
      * `main.js`: p5.jsの描画ループを管理し、`nanokontrol2Manager`から受け取った値を使ってテキストアニメーションを描画するメインスケッチ。
  * **ハードウェア連携**: nanokontrol2の物理的なコントロール（フェーダー、ノブ、ボタン）と、画面上のアニメーションパラメータが直接リンクしています。
  * **エラーハンドリング**: nanokontrol2が接続されていない場合、プログラムはエラーで停止することなく、画面に警告メッセージと赤い背景を表示します。

### 使い方

#### 必要なもの

  * Web MIDI APIをサポートするブラウザ（Google Chromeなど）
  * KORG nanokontrol2 MIDIコントローラー

#### セットアップ

1.  nanokontrol2をPCに接続します。
2.  プロジェクトのHTMLファイルを開きます。
      * p5.jsとWebMidi.jsのライブラリを`script`タグで読み込んでください。
      * `midiManager.js`, `nanokontrol2Manager.js`, `main.js`の3つのJavaScriptファイルを適切な順番で読み込みます。

#### 操作方法

nanokontrol2を操作することで、画面上のテキストアニメーションが変化します。

  * **フェーダー 1**: `overallScale` (文字の密集度)
  * **フェーダー 2**: `rowsRatio` (行数)
  * **ノブ 1**: `randomOffsetScale` (ランダムな位置のずれ)
  * **ノブ 2**: `sinWaveScale` (正弦波による縦の動き)
  * **ノブ 3**: `angleScale` (文字の回転角度)
  * **フェーダー 3**: `animationSpeed` (アニメーション速度)
  * **ノブ 4**: `randomSeedValue` (ランダムシード)
  * **M1 ボタン**: `showBackgroundBox` (文字背景の表示/非表示を切り替え)
  * **R1 ボタン**: `colorInverted` (背景色と文字色を反転)
  * **STOP ボタン**: `animationTime` (アニメーションをリセット)

### コード構造

```
.
├── index.html
├── main.js
├── midiManager.js
├── nanoKontrol2Manager.js
└── M-NijimiMincho.otf (フォントファイル)
```

### ライセンス

このプロジェクトは、MITライセンスのもとで公開されています。自由にフォーク、改変、再利用してください。