// グローバル変数
let font;
let nanoKontrol2Manager;
let textAnimator;

// 表示するテキストデータ
const phrases = [
    "静かな夜に、星々がゆっくりと瞬き始める。",
    "遠い森のざわめきが、そっと風に乗って届く。",
    "過去の記憶が、光の粒となって空に舞い上がる。",
    "未知への旅が、小さな一歩から始まるのだ。",
    "私たちは、見えない絆で深く結ばれている。",
    "この世界のすべては、絶えず変化し続けている。",
    "未来は、私たちの手によって描かれる一つの物語。",
];

/**
 * テキストアニメーションを描画するクラス
 */
class TextAnimator {
    constructor(phrases, font) {
        this.phrases = phrases;
        this.font = font;
        this.maxPhraseLength = Math.max(...phrases.map(s => s.length));
        this.backgroundColor = 255;
        this.foregroundColor = 0;
        this.animationTime = 0;
    }

    /**
     * 現在のパラメータを取得するメソッド
     * @returns {object} パラメータのオブジェクト
     */
    getParams(midiController) {
        return {
            overallScale: midiController.faderValues_[0],
            rowsRatio: midiController.faderValues_[1],
            randomOffsetScale: midiController.faderValues_[2],
            sinWaveScale: midiController.faderValues_[3],
            angleScale: midiController.faderValues_[4],
            animationSpeed: midiController.faderValues_[5],
            randomSeedValue: midiController.faderValues_[6],
            showBackgroundBox: midiController.buttonToggleState_[0]['M'],
            colorInverted: midiController.buttonToggleState_[0]['R']
        };
    }

    /**
     * MIDIコントローラーのデータに基づいてアニメーションを描画する
     * @param {NanoKontrol2Manager} midiController - コントローラーのインスタンス
     */
    draw(midiController) {
        const params = this.getParams(midiController);

        // ボタンのワンショットアクション
        if (midiController.transportButtonState_['STOP']) {
            this.animationTime = 0;
        }

        this.animationTime += map(params.animationSpeed, 0, 1, 0, 0.2);

        const bgColor = params.colorInverted ? this.foregroundColor : this.backgroundColor;
        const fgColor = params.colorInverted ? this.backgroundColor : this.foregroundColor;
        background(bgColor);

        const noiseSeedValue = noise(params.randomSeedValue * 70415) * 57920;
        randomSeed(noiseSeedValue);

        const charSize = width / this.maxPhraseLength;
        const numRows = floor(map(params.rowsRatio, 0, 1, 1, this.phrases.length));
        const rowHeight = height / numRows;
        let displayCount = 0;

        push();
        translate(width / 2, height / 2);
        for (let i = 0; i < numRows; i++) {
            const charArray = [...this.phrases[i]];
            for (let j = 0; j < charArray.length; j++) {
                const charX = j * charSize + charSize / 2 - width / 2;
                const charY = i * rowHeight + rowHeight / 2 - height / 2;
                const randomOffsetX = random(-width / 2, width / 2);
                const randomOffsetY = random(-height / 2, height / 2);

                const sinWaveY = sin((frameCount * 0.02 + map(charX, -width / 2, width / 2, -PI, PI))) * charSize * params.sinWaveScale;
                const finalX = charX * params.overallScale + randomOffsetX * params.randomOffsetScale;
                const finalY = charY * params.overallScale + sinWaveY + randomOffsetY * params.randomOffsetScale;

                const textSizeVal = charSize * 0.7;
                const angle = random(TAU) * params.angleScale;

                if (displayCount < this.animationTime) {
                    push();
                    translate(finalX, finalY);
                    rotate(angle);
                    textSize(textSizeVal);
                    textAlign(CENTER, CENTER);

                    if (params.showBackgroundBox) {
                        fill(fgColor);
                        rectMode(CENTER);
                        rect(0, 0, textSizeVal, textSizeVal);
                        fill(bgColor);
                    } else {
                        fill(fgColor);
                    }

                    noStroke();
                    text(charArray[j], 0, 0);
                    pop();
                }
                displayCount++;
            }
        }
        pop();
    }
}

// p5.jsのライフサイクル関数
function preload() {
    font = loadFont("asset/M-NijimiMincho.otf");
}

function setup() {
    createCanvas(windowWidth, windowHeight);
    textFont(font);

    nanoKontrol2Manager = new NanoKontrol2Manager();
    nanoKontrol2Manager.initializeMIDIDevices();

    textAnimator = new TextAnimator(phrases, font);
}

function draw() {
    // MIDI接続が成功しているかどうかをチェック
    if (nanoKontrol2Manager.midiSuccess_) {
        // 成功している場合は通常のアニメーションを描画
        textAnimator.draw(nanoKontrol2Manager);
    } else {
        // 失敗している場合は背景を赤にする
        background(255, 0, 0); // 赤色
        fill(255);
        textAlign(CENTER, CENTER);
        textSize(24);
        text("nanokontrol2 not connected. Please connect and reload.", width / 2, height / 2);
    }
}

function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
}