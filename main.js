// グローバル変数
let font;
let poems;
let nanoKontrol2Manager;
let textAnimator;

/**
 * テキストアニメーションを描画・管理するクラス
 * タイプライター、待機、落下、リスタートの各フェーズを状態管理します。
 */
class TextAnimator {
    constructor(font, poems) {
        this.poems = poems;
        this.poemIndex = 0;
        this.poem = poems[this.poemIndex]["phrases"];
        this.author = poems[this.poemIndex]["author"];
        this.title = poems[this.poemIndex]["title"];

        this.font = font;
        this.maxPhraseLength = Math.max(...this.poem.map(s => s.length));
        this.backgroundColor = 255;
        this.foregroundColor = 0;

        // アニメーションの状態を管理する変数
        this.animationPhase = 'PHASE_TYPING'; // 現在のアニメーションフェーズ
        this.animationTime = 0; // タイプライターの進行度
        this.waitingStartTime = 0; // 待機フェーズの開始フレーム
        this.characters = []; // 個々の文字の状態を管理する配列
        this.restartStartTime = 0; // リスタート待機フェーズの開始フレーム

        // アニメーションのパラメータ
        this.WAITING_DURATION = 180; // 文字表示後の待機時間 (フレーム数)
        this.g = 0.5; // 落下時の重力加速度
        this.RESTART_DELAY = 120; // 落下後のリスタート待機時間 (フレーム数)

        // リスタート待機フェーズの開始フレーム
        this.turnStartTime = 0;

        // コンストラクタで文字の初期状態を一度だけ設定
        this.setupCharacters();
    }

    /**
     * MIDIコントローラーの状態から描画パラメータを抽出
     * @returns {object} 現在の描画パラメータ
     */
    getParams(midiController) {
        if (midiController.midiSuccess_) {
            // MIDIが接続されている場合は、コントローラーの値を使用
            return {
                overallScale: midiController.faderValues_[0],
                rowsRatio: midiController.faderValues_[1],
                randomOffsetScale: midiController.faderValues_[2],
                sinWaveScale: midiController.faderValues_[3],
                angleScale: midiController.faderValues_[4],
                textScale: midiController.faderValues_[5],
                animationSpeed: midiController.faderValues_[6],
                randomSeedValue: midiController.faderValues_[7],
                showBackgroundBox: midiController.transportButtonToggleState_['MARKER_LEFT'],
                colorInverted: midiController.transportButtonToggleState_['MARKER_RIGHT']
            };
        } else {
            // 接続されていない場合はデフォルト値を使用
            return {
                overallScale: 0.5,
                rowsRatio: 0.5,
                randomOffsetScale: 0,
                sinWaveScale: 0,
                angleScale: 0,
                animationSpeed: 0.5,
                randomSeedValue: 0.5,
                showBackgroundBox: false,
                colorInverted: false
            };
        }
    }

    /**
     * アニメーションをリセットし、最初の状態に戻す
     */
    resetAnimation() {
        this.poemIndex = (this.poemIndex + 1) % Object.keys(this.poems).length;
        this.poem = this.poems[this.poemIndex]["phrases"];
        this.maxPhraseLength = Math.max(...this.poem.map(s => s.length));
        this.author = this.poems[this.poemIndex]["author"];
        this.title = this.poems[this.poemIndex]["title"];

        this.characters = [];
        this.setupCharacters();
        this.animationPhase = 'PHASE_TYPING';
        this.animationTime = 0;
        this.waitingStartTime = 0;
        this.restartStartTime = 0;
        // キャラクターの状態をリセット
        this.characters.forEach(char => {
            char.visible = false;
            char.vy = 0;
        });

        this.turnStartTime = frameCount;
    }

    /**
     * 全ての文字の基本情報を設定（プログラム実行中に一度だけ実行）
     */
    setupCharacters() {
        let characterIndex = 0;
        for (let i = 0; i < this.poem.length; i++) {
            const charArray = [...this.poem[i]];
            for (let j = 0; j < charArray.length; j++) {
                this.characters.push({
                    char: charArray[j], // 文字自体
                    rowIndex: i, // 元の行番号
                    colIndex: j, // 元の列番号
                    vx: 0, // x方向の速度（今回は未使用）
                    vy: 0, // y方向の速度
                    angle: random(TAU), // 初期回転角度
                    angularVelocity: random(-0.1, 0.1), // 落下時の回転速度
                    visible: false, // 初期状態は非表示
                    index: characterIndex, // タイプライターの表示順
                    // draw()ループでリアルタイムに更新されるプロパティ
                    currentX: 0,
                    currentY: 0,
                    currentAngle: 0,
                    textSize: 0
                });
                characterIndex++;
            }
        }
    }

    /**
     * メインの描画ループ
     * @param {NanoKontrol2Manager} midiController - コントローラーのインスタンス
     */
    draw(midiController) {
        const params = this.getParams(midiController);

        // PLAYボタンが押されたらアニメーションをリセット
        if (midiController.midiSuccess_ && midiController.transportButtonState_['PLAY']) {
            this.resetAnimation();
        }

        // 背景とフォアグラウンドカラーを決定
        const bgColor = params.colorInverted ? this.foregroundColor : this.backgroundColor;
        const fgColor = params.colorInverted ? this.backgroundColor : this.foregroundColor;
        background(bgColor);

        // ランダムシードを設定してノイズを決定
        const noiseSeedValue = noise(params.randomSeedValue * 70415) * 57920;
        randomSeed(noiseSeedValue);

        // リアルタイムパラメータに基づいて行数と高さを計算
        const numRows = floor(map(params.rowsRatio, 0, 1, this.poem.length, 1));
        const rowHeight = height / numRows;
        const charSize = width / this.maxPhraseLength;

        push();
        translate(width / 2, height / 2); // 座標系を中央に移動

        // 各文字の描画と物理計算
        for (let i = 0; i < this.characters.length; i++) {
            const char = this.characters[i];

            // リアルタイムに位置とサイズを計算
            const charX = char.colIndex * charSize + charSize / 2 - width / 2;
            const charY = char.rowIndex * rowHeight + rowHeight / 2 - height / 2;
            const randomOffsetX = random(-width / 2, width / 2);
            const randomOffsetY = random(-height / 2, height / 2);
            const sinWaveY = sin((frameCount * 0.02 + map(charX, -width / 2, width / 2, -PI, PI))) * (width / this.maxPhraseLength) * params.sinWaveScale;

            const finalX = charX * map(params.overallScale, 0, 1, 1, 0) + randomOffsetX * params.randomOffsetScale;
            const finalY = charY * map(params.overallScale, 0, 1, 1, 0) + sinWaveY + randomOffsetY * params.randomOffsetScale;
            const angle = random(TAU) * params.angleScale;
            char.textSize = charSize * map(params.textScale, 0, 1, 0.6, 2.0);

            // アニメーションフェーズに応じた位置・角度の更新
            if (this.animationPhase === 'PHASE_TYPING' || this.animationPhase === 'PHASE_WAITING') {
                char.currentX = finalX;
                char.currentY = finalY;
                char.currentAngle = angle;
            } else if (this.animationPhase === 'PHASE_FALLING') {
                char.vy += this.g;
                char.currentY += char.vy;
                char.currentAngle += char.angularVelocity;
            } else if (this.animationPhase === 'PHASE_RESTARTING') {
                // リスタート待機中は位置・角度の更新を停止
            }

            // タイプライターフェーズでの表示
            if (this.animationPhase === 'PHASE_TYPING' && char.index < this.animationTime) {
                char.visible = true;
            } else if (this.animationPhase === 'PHASE_WAITING' || this.animationPhase === 'PHASE_FALLING' || this.animationPhase === 'PHASE_RESTARTING') {
                char.visible = true;
            }

            // 文字が可視の場合のみ描画
            if (char.visible) {
                push();
                translate(char.currentX, char.currentY);
                rotate(char.currentAngle);
                textSize(char.textSize);
                textAlign(CENTER, CENTER);

                if (params.showBackgroundBox) {
                    fill(fgColor);
                    rectMode(CENTER);
                    rect(0, 0, char.textSize, char.textSize);
                    fill(bgColor);
                } else {
                    fill(fgColor);
                }

                noStroke();
                text(char.char, 0, 0);
                pop();
            }
        }
        pop();

        // 画面下部にタイトルと著者名を表示
        const alpha = map(min(frameCount - this.turnStartTime, 200), 0, 200, 0, 255);
        push();
        textAlign(RIGHT, BOTTOM);
        textSize(min(width, height) * 0.03);
        fill(130, alpha);
        text(`${this.title} - ${this.author}`, width - 20, height - 20);
        pop();

        // アニメーションの状態遷移ロジック
        if (this.animationPhase === 'PHASE_TYPING') {
            this.animationTime += map(params.animationSpeed, 0, 1, 0.1, 0.5) + map(noise(frameCount * 0.01), 0, 1, -0.05, 0.05);
            if (this.animationTime >= this.characters.length) {
                this.animationPhase = 'PHASE_WAITING';
                this.waitingStartTime = frameCount;
            }
        } else if (this.animationPhase === 'PHASE_WAITING') {
            if (frameCount - this.waitingStartTime > this.WAITING_DURATION) {
                this.animationPhase = 'PHASE_FALLING';
            }
        } else if (this.animationPhase === 'PHASE_FALLING') {
            // 全ての文字が画面外に落ちたら次のフェーズへ
            if (this.characters.every(char => char.currentY > height)) {
                this.animationPhase = 'PHASE_RESTARTING';
                this.restartStartTime = frameCount;
            }
        } else if (this.animationPhase === 'PHASE_RESTARTING') {
            // リスタート待機時間が経過したらアニメーションをリセット
            if (frameCount - this.restartStartTime > this.RESTART_DELAY) {
                this.resetAnimation();
            }
        }
    }
}

// p5.jsのライフサイクル関数
function preload() {
    font = loadFont("asset/M-NijimiMincho.otf");
    poems = loadJSON("asset/poems.json");
}

function setup() {
    createCanvas(windowWidth, windowHeight);
    textFont(font);
    noCursor();

    nanoKontrol2Manager = new NanoKontrol2Manager();
    nanoKontrol2Manager.initializeMIDIDevices();

    textAnimator = new TextAnimator(font, poems);
    textAnimator.resetAnimation();
}

let wasRecPressed = false

function draw() {
    // MIDI接続が成功しているかどうかをチェック
    if (nanoKontrol2Manager.midiSuccess_) {
        // 成功している場合は通常のアニメーションを描画
        textAnimator.draw(nanoKontrol2Manager);

        const isRecPressedThisFrame = nanoKontrol2Manager.transportButtonState_["REC"]
        if (isRecPressedThisFrame && !wasRecPressed){
            const currentParams = textAnimator.getParams(nanoKontrol2Manager)

            // post art parameters here
            ;(async () => {
                const session = window.Auth && window.Auth.getSession && window.Auth.getSession();
                if (!session || !session.user || !session.user.id) {
                    console.warn('Not logged in. Please sign in from the overlay before posting.');
                    return;
                }

                const body = {
                    user_id: session.user.id,
                    name: `preset-${new Date().toISOString().replace(/[:.]/g, '-')}`,
                    // Send as versioned wrapper for forward compatibility; backend unwraps to store
                    parameters: { version: 1, data: currentParams }
                    // thumbnail_base64: optionally attach a canvas snapshot using Auth.toBase64FromCanvas
                };

                try {
                    const res = await window.Auth.postArt(body);
                    console.log('Posted art parameters:', res);
                } catch (e) {
                    console.error('Failed to post art parameters:', e);
                }
            })();


            wasRecPressed = true
        } else if ( !isRecPressedThisFrame ){
            wasRecPressed = false
        }
    } else {
        // 失敗している場合は背景を赤にして警告を表示
        background(255, 0, 0);
        fill(255);
        textAlign(CENTER, CENTER);
        textSize(24);
        text("nanokontrol2 not connected. Please connect and reload.", width / 2, height / 2);
    }
}

function keyPressed() {
    if (keyCode === 32) {
        let fs = fullscreen();
        fullscreen(!fs);
    }
}

function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
}