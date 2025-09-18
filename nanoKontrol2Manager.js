/**
 * nanokontrol2 MIDIコントローラーを管理するクラス
 * MidiManagerクラスを継承し、nanokontrol2の特定の機能を実装
 */
class NanoKontrol2Manager extends MidiManager {
    constructor() {
        super();

        this.faderValues_ = new Array(8).fill(0);
        this.knobValues_ = new Array(8).fill(0);

        this.buttonState_ = new Array(8).fill(null).map(() => ({
            'S': false, 'M': false, 'R': false
        }));
        this.buttonToggleState_ = new Array(8).fill(null).map(() => ({
            'S': false, 'M': false, 'R': false
        }));

        this.transportButtonState_ = {
            'MARKER_LEFT': false, 'MARKER_RIGHT': false,
            'CYCLE': false, 'TRACK_LEFT': false, 'TRACK_RIGHT': false,
            'STOP': false, 'PLAY': false, 'REC': false
        };
        this.transportButtonToggleState_ = {
            'MARKER_LEFT': false, 'MARKER_RIGHT': false,
            'CYCLE': false, 'TRACK_LEFT': false, 'TRACK_RIGHT': false,
            'STOP': false, 'PLAY': false, 'REC': false
        };

        this.buttonNoteMap_ = {
            'S': [46, 47, 48, 49, 50, 51, 52, 53],
            'M': [32, 33, 34, 35, 36, 37, 38, 39],
            'R': [64, 65, 66, 67, 68, 69, 70, 71]
        };
        this.transportNoteMap_ = {
            'MARKER_LEFT': 60, 'MARKER_RIGHT': 61,
            'CYCLE': 54, 'TRACK_LEFT': 58, 'TRACK_RIGHT': 59,
            'STOP': 43, 'PLAY': 44, 'REC': 45
        };
    }

    /**
     * MIDIメッセージを受信した際の処理
     * @param {MIDIMessageEvent} message - 受信したMIDIメッセージ
     */
    onMIDIMessage(message) {
        const [status, data1, data2] = message.data;
        const messageType = status & 0xF0;

        switch (messageType) {
            case 0x90: // Note On
                this.handleNoteOn(data1);
                break;
            case 0x80: // Note Off
                this.handleNoteOff(data1);
                break;
            case 0xB0: // Control Change
                this.handleControlChange(data1, data2);
                break;
        }
    }

    handleControlChange(ccNumber, value) {
        if (ccNumber >= 0 && ccNumber <= 7) {
            this.faderValues_[ccNumber] = value / 127;
        }
        else if (ccNumber >= 16 && ccNumber <= 23) {
            this.knobValues_[ccNumber - 16] = value / 127;
        }
    }

    handleNoteOn(note) {
        for (let i = 0; i < 8; i++) {
            for (const type of ['S', 'M', 'R']) {
                if (note === this.buttonNoteMap_[type][i]) {
                    this.buttonState_[i][type] = true;
                    this.buttonToggleState_[i][type] = !this.buttonToggleState_[i][type];
                    return;
                }
            }
        }
        for (const key in this.transportNoteMap_) {
            if (note === this.transportNoteMap_[key]) {
                this.transportButtonState_[key] = true;
                this.transportButtonToggleState_[key] = !this.transportButtonToggleState_[key];
                return;
            }
        }
    }

    handleNoteOff(note) {
        for (let i = 0; i < 8; i++) {
            for (const type of ['S', 'M', 'R']) {
                if (note === this.buttonNoteMap_[type][i]) {
                    this.buttonState_[i][type] = false;
                    return;
                }
            }
        }
        for (const key in this.transportNoteMap_) {
            if (note === this.transportNoteMap_[key]) {
                this.transportButtonState_[key] = false;
                return;
            }
        }
    }
}