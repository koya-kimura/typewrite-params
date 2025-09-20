/**
 * nanokontrol2 MIDIコントローラーを管理するクラス
 * MidiManagerクラスを継承し、nanokontrol2の特定の機能を実装します。
 */
class NanoKontrol2Manager extends MidiManager {
    constructor() {
        super();
        // フェーダーとノブの値を0-1の範囲で保持
        this.faderValues_ = new Array(8).fill(0);
        this.knobValues_ = new Array(8).fill(0);
        // S, M, R ボタンの押下状態（ワンショット）とトグル状態を管理
        this.buttonState_ = new Array(8).fill(null).map(() => ({
            'S': false, 'M': false, 'R': false
        }));
        this.buttonToggleState_ = new Array(8).fill(null).map(() => ({
            'S': false, 'M': false, 'R': false
        }));
        // トランスポートボタン（左側）の押下状態（ワンショット）とトグル状態を管理
        this.transportButtonState_ = {
            'MARKER_LEFT': false, 'MARKER_RIGHT': false,
            'CYCLE': false, 'TRACK_LEFT': false, 'TRACK_RIGHT': false,
            'SET': false,
            'STOP': false, 'PLAY': false, 'REC': false,
            'forward': false, 'rewind': false,
        };
        this.transportButtonToggleState_ = {
            'MARKER_LEFT': false, 'MARKER_RIGHT': false,
            'CYCLE': false, 'TRACK_LEFT': false, 'TRACK_RIGHT': false,
            'SET': false,
            'STOP': false, 'PLAY': false, 'REC': false,
            'forward': false, 'rewind': false,
        };
        // ボタンに割り当てられたMIDI CC番号のマッピング（カスタマイズ設定）
        this.buttonCCMap_ = {
            'S': [32, 33, 34, 35, 36, 37, 38, 39],
            'M': [48, 49, 50, 51, 52, 53, 54, 55],
            'R': [64, 65, 66, 67, 68, 69, 70, 71],
        };
        this.transportCCMap_ = {
            'MARKER_LEFT': 61, 'MARKER_RIGHT': 62,
            'CYCLE': 46, 'TRACK_LEFT': 58, 'TRACK_RIGHT': 59, 'SET': 60,
            'STOP': 42, 'PLAY': 41, 'REC': 45, 'forward': 44, 'rewind': 43,
        };
    }

    /**
     * MIDIメッセージ受信ハンドラをオーバーライド
     * nanokontrol2が送信するControl Changeメッセージを処理します。
     * @param {MIDIMessageEvent} message - 受信したMIDIメッセージ
     */
    onMIDIMessage(message) {
        const [status, data1, data2] = message.data;
        const messageType = status & 0xF0;

        // nanokontrol2の設定がControl Changeメッセージを送信する前提
        if (messageType === 0xB0) {
            this.handleControlChange(data1, data2);
        }
    }

    /**
     * Control Changeメッセージを処理し、値を更新
     * @param {number} ccNumber - MIDI CC番号
     * @param {number} value - 値 (0-127)
     */
    handleControlChange(ccNumber, value) {
        // フェーダー (CC 0-7)
        if (ccNumber >= 0 && ccNumber <= 7) {
            this.faderValues_[ccNumber] = value / 127;
        }
        // ノブ (CC 16-23)
        else if (ccNumber >= 16 && ccNumber <= 23) {
            this.knobValues_[ccNumber - 16] = value / 127;
        }
        // ボタン（CCメッセージで制御される場合）
        else {
            this.handleButton(ccNumber, value);
        }
    }

    /**
     * ボタンの状態を処理
     * @param {number} ccNumber - MIDI CC番号
     * @param {number} value - 値 (0-127)
     */
    handleButton(ccNumber, value) {
        // S, M, Rボタンを検索し、状態を更新
        for (let i = 0; i < 8; i++) {
            for (const type of ['S', 'M', 'R']) {
                if (ccNumber === this.buttonCCMap_[type][i]) {
                    this.buttonState_[i][type] = value > 0;
                    if (value > 0) { // 押された瞬間のみトグル
                        this.buttonToggleState_[i][type] = !this.buttonToggleState_[i][type];
                    }
                    return;
                }
            }
        }
        // トランスポートボタンを検索し、状態を更新
        for (const key in this.transportCCMap_) {
            if (ccNumber === this.transportCCMap_[key]) {
                this.transportButtonState_[key] = value > 0;
                if (value > 0) { // 押された瞬間のみトグル
                    this.transportButtonToggleState_[key] = !this.transportButtonToggleState_[key];
                }
                return;
            }
        }
    }
}