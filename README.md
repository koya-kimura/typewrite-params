## README: nanokontrol2-text-animator

### 概要

このプロジェクトは、**p5.js**と**Web MIDI API**を使用して、KORGの**nanokontrol2**コントローラーでリアルタイムに制御できるインタラクティブなテキストアニメーション作品です。コードは、MIDIデバイスの管理、nanokontrol2に特化した入力処理、そして実際の描画ロジックをクラスベースで分離し、クリーンで拡張性の高い設計になっています。

### 特徴

  * **モジュール化された設計**: プロジェクトのコードは、以下の3つの主要なファイルに分割されています。
      * `midiManager.js`: MIDIデバイスとの接続を処理する汎用的な基底クラスです。
      * `nanokontrol2Manager.js`: `MidiManager`を継承し、nanokontrol2のフェーダー、ノブ、ボタンからの入力を読み取り、状態を管理するクラスです。
      * `main.js`: p5.jsの描画ループを管理し、`nanokontrol2Manager`から受け取った値を使ってテキストアニメーションを描画するメインスケッチです。
  * **ハードウェア連携**: nanokontrol2の物理的なコントロール（フェーダー、ノブ、ボタン）と、画面上のアニメーションパラメータが直接リンクしています。
  * **アニメーションサイクル**: テキストがタイプライターのように表示され、一定時間後に物理的な落下アニメーションで消滅し、その後自動的に次のサイクルが始まるように設計されています。
  * **エラーハンドリング**: nanokontrol2が接続されていない場合、プログラムはエラーで停止することなく、画面に警告メッセージと赤い背景を表示します。
  * **全画面表示**: **Spaceキー**を押すことで、全画面表示のON/OFFを切り替えられます。

### 使い方

#### 必要なもの

  * Web MIDI APIをサポートするブラウザ（Google Chromeなど）
  * KORG nanokontrol2 MIDIコントローラー
  * `M-NijimiMincho.otf` フォントファイル（同梱されている必要があります）

#### セットアップ

1.  nanokontrol2をPCに接続します。
2.  プロジェクトのHTMLファイルに、以下のライブラリとスクリプトを読み込みます。
      * `p5.js` および `WebMidi.js` ライブラリ
      * `midiManager.js`, `nanokontrol2Manager.js`, `main.js`の3つのJavaScriptファイル

#### 操作方法

nanokontrol2を操作することで、画面上のテキストアニメーションがリアルタイムに変化します。

  * **フェーダー 1**: `overallScale` (文字の密集度)
  * **フェーダー 2**: `rowsRatio` (表示する行数)
  * **フェーダー 3**: `randomOffsetScale` (文字位置のランダムなずれ)
  * **フェーダー 4**: `sinWaveScale` (正弦波による文字の動き)
  * **フェーダー 5**: `angleScale` (文字の初期回転角度)
  * **フェーダー 6**: `textScale` (文字のサイズ)
  * **フェーダー 7**: `animationSpeed` (タイプライターアニメーションの速度)
  * **フェーダー 8**: `randomSeedValue` (ランダムノイズのシード値)
  * **`MARKER LEFT` ボタン**: `showBackgroundBox` (文字背景の表示/非表示を切り替え)
  * **`MARKER RIGHT` ボタン**: `colorInverted` (背景色と文字色を反転)
  * **`PLAY` ボタン**: `animationTime` (アニメーションをリセットし、最初から再生)
  * **`Space` キー**: 全画面表示を切り替え

### コード構造

```
.
├── index.html            // メインのHTMLファイル
├── main.js               // p5.jsのメインスケッチ
├── midiManager.js        // MIDIデバイス管理の基底クラス
├── nanoKontrol2Manager.js // nanokontrol2特化の管理クラス
└── asset/                // フォントなどのアセットフォルダ
    └── M-NijimiMincho.otf // フォントファイル
```