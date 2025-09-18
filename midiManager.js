/**
 * MIDIデバイスの管理を行う汎用的な基底クラス
 * MIDIアクセス、入出力の初期化、メッセージの基本的な処理を担当します。
 */
class MidiManager {
    /**
     * コンストラクタ
     * @property {MIDIOutput|null} midiOutput_ - MIDI出力デバイスのインスタンス
     * @property {boolean} midiSuccess_ - MIDI接続の成功状態
     */
    constructor() {
        this.midiOutput_ = null;
        this.midiSuccess_ = false;
        this.midiInput_ = null;
    }

    /**
     * MIDIデバイスの初期化を行うメソッド
     * Web MIDI APIを使用してMIDIアクセスをリクエストします。
     */
    initializeMIDIDevices() {
        if (navigator.requestMIDIAccess) {
            navigator.requestMIDIAccess().then(
                this.onMIDISuccess.bind(this),
                this.onMIDIFailure.bind(this)
            );
        } else {
            console.warn("Web MIDI API is not supported in this browser.");
            this.midiSuccess_ = false;
        }
    }

    /**
     * MIDI接続成功時のコールバック
     * @param {MIDIAccess} midiAccess - MIDIAccessインターフェースのインスタンス
     */
    onMIDISuccess(midiAccess) {
        const inputs = Array.from(midiAccess.inputs.values());
        const outputs = Array.from(midiAccess.outputs.values());

        // 入力デバイスが見つからない場合、接続失敗と見なす
        if (inputs.length === 0) {
            this.onMIDIFailure("No MIDI input devices found.");
            return;
        }

        this.midiInput_ = inputs[0]; // 最初の入力ポートを使用
        this.midiOutput_ = outputs.length > 0 ? outputs[0] : null;

        console.log("MIDI device ready!");
        console.log("Input:", this.midiInput_ ? this.midiInput_.name : "Not found");
        console.log("Output:", this.midiOutput_ ? this.midiOutput_.name : "Not found");

        // MIDIメッセージ受信時のハンドラを設定
        this.midiInput_.onmidimessage = this.onMIDIMessage.bind(this);
        this.midiSuccess_ = true;
    }

    /**
     * MIDI接続失敗時のコールバック
     * @param {string} msg - エラーメッセージ
     */
    onMIDIFailure(msg) {
        console.log("MIDI access failed. - " + msg);
        this.midiSuccess_ = false;
    }

    /**
     * MIDIメッセージ受信時のハンドラ
     * 継承したクラスでオーバーライドすることを前提とします。
     * @param {MIDIMessageEvent} event - MIDIメッセージイベント
     */
    onMIDIMessage(event) {
        // デフォルトでは何もしません
    }
}