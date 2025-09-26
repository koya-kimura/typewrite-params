// グローバル変数
let font;
let poems;
let nanoKontrol2Manager;
let textAnimator;

const API_BASE_URL = (typeof window !== 'undefined' && window.__TYPEWRITE_PARAMS_API_BASE__) || 'http://localhost:3000';
const SESSION_STORAGE_KEY = (typeof window !== 'undefined' && window.__TYPEWRITE_PARAMS_SESSION_KEY__) || 'flowVol8Session';
const PARAMETER_VERSION = 3;
const PARAMETER_PROFILE = 'nanokontrol2-v1';

const LOGIN_MODAL_BACKDROP_ID = 'typewrite-login-backdrop';
const LOGIN_MODAL_FORM_ID = 'typewrite-login-form';
const LOGIN_MODAL_CLASS_PREFIX = 'typewrite-login';

let currentSession = null;
let loginModalElements = null;
let isLoginStorageListenerAttached = false;

let isParameterSubmissionInFlight = false;

function resolveSessionTokens() {
    if (typeof window === 'undefined') {
        return null;
    }

    const candidates = [];

    if (window.__TYPEWRITE_PARAMS_SESSION__) {
        candidates.push(window.__TYPEWRITE_PARAMS_SESSION__);
    }

    const storages = [window.localStorage, window.sessionStorage];
    for (const storage of storages) {
        if (!storage) continue;
        try {
            const raw = storage.getItem(SESSION_STORAGE_KEY);
            if (!raw) continue;
            try {
                candidates.push(JSON.parse(raw));
            } catch (error) {
                console.error('[typewrite-params] セッション情報のJSON解析に失敗しました:', error);
            }
        } catch (error) {
            console.warn('[typewrite-params] ストレージへアクセスできませんでした:', error);
        }
    }

    if (candidates.length === 0) {
        currentSession = null;
        return null;
    }

    const resolved = candidates.find(candidate => candidate && (candidate.token || candidate.bearerToken)) || candidates[0];
    setCurrentSession(resolved, { persist: false });
    return currentSession;
}

async function submitParameters(params, metadata = {}) {
    const session = currentSession || resolveSessionTokens();
    const token = session?.token ?? session?.bearerToken ?? session?.authToken ?? null;
    const csrf = session?.csrf ?? session?.csrfToken ?? session?.csrf_token ?? null;
    const baseUrl = (session?.baseUrl ?? API_BASE_URL).replace(/\/$/, '');

    if (!token || !csrf) {
        console.warn('[typewrite-params] パラメーター送信をスキップしました: 認証トークンまたはCSRFトークンが見つかりません。');
        showLoginModal();
        return;
    }

    const headers = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        'x-csrf-token': csrf,
    };

    const payloadData = { ...params, ...metadata };
    if (!payloadData.submittedAt) {
        payloadData.submittedAt = new Date().toISOString();
    }

    const body = {
        parameters: {
            version: session?.parameterVersion ?? PARAMETER_VERSION,
            profile: session?.parameterProfile ?? PARAMETER_PROFILE,
            data: payloadData,
        },
    };

    const endpoint = `${baseUrl}/api/art`;

    const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
    });

    const responseText = await response.text();
    let responseJson = null;
    if (responseText) {
        try {
            responseJson = JSON.parse(responseText);
        } catch (error) {
            console.warn('[typewrite-params] レスポンスのJSON解析に失敗しました:', error, responseText);
        }
    }

    if (!response.ok) {
        const message = responseJson?.message || response.statusText;
        throw new Error(`パラメーター送信に失敗しました: ${message}`);
    }

    console.info('[typewrite-params] パラメーター送信に成功しました:', responseJson);
    return responseJson;
}

function triggerParameterSubmission(params, metadata = {}) {
    if (isParameterSubmissionInFlight) {
        console.warn('[typewrite-params] パラメーター送信は既に実行中のためスキップしました。');
        return;
    }

    isParameterSubmissionInFlight = true;
    submitParameters(params, metadata)
        .catch(error => {
            console.error('[typewrite-params] パラメーター送信時にエラーが発生しました:', error);
        })
        .finally(() => {
            isParameterSubmissionInFlight = false;
        });
}

function setCurrentSession(session, { persist = true } = {}) {
    if (session) {
        session = {
            parameterVersion: PARAMETER_VERSION,
            parameterProfile: PARAMETER_PROFILE,
            baseUrl: API_BASE_URL,
            ...session,
        };
        if (!session.baseUrl) {
            session.baseUrl = API_BASE_URL;
        }
        session.baseUrl = session.baseUrl.replace(/\/$/, '');
    }

    currentSession = session || null;

    if (typeof window !== 'undefined') {
        if (session) {
            window.__TYPEWRITE_PARAMS_SESSION__ = session;
        } else {
            delete window.__TYPEWRITE_PARAMS_SESSION__;
        }

        const storages = [window.localStorage, window.sessionStorage];
        for (const storage of storages) {
            if (!storage) continue;
            try {
                if (session && persist) {
                    storage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
                } else if (!session) {
                    storage.removeItem(SESSION_STORAGE_KEY);
                }
            } catch (error) {
                console.warn('[typewrite-params] セッション情報の永続化に失敗しました:', error);
            }
        }
    }

    updateLoginModalVisibility();
}

function ensureLoginModalElements() {
    if (loginModalElements || typeof document === 'undefined') {
        return loginModalElements;
    }

    injectLoginModalStyles();

    let backdrop = document.getElementById(LOGIN_MODAL_BACKDROP_ID);
    if (!backdrop) {
        backdrop = document.createElement('div');
        backdrop.id = LOGIN_MODAL_BACKDROP_ID;
        backdrop.className = `${LOGIN_MODAL_CLASS_PREFIX}__backdrop`;
        backdrop.style.display = 'none';
        document.body.appendChild(backdrop);
    }

    const modal = document.createElement('div');
    modal.className = `${LOGIN_MODAL_CLASS_PREFIX}__modal`;

    const title = document.createElement('h2');
    title.textContent = 'ログインが必要です';
    modal.appendChild(title);

    const description = document.createElement('p');
    description.textContent = 'Flow Vol8 backend へログインし、パラメーターを保存できる状態にしてください。';
    modal.appendChild(description);

    const form = document.createElement('form');
    form.id = LOGIN_MODAL_FORM_ID;
    form.className = `${LOGIN_MODAL_CLASS_PREFIX}__form`;

    const baseUrlLabel = document.createElement('label');
    baseUrlLabel.className = `${LOGIN_MODAL_CLASS_PREFIX}__label`;
    baseUrlLabel.textContent = 'APIベースURL';
    const baseUrlInput = document.createElement('input');
    baseUrlInput.type = 'url';
    baseUrlInput.required = true;
    baseUrlInput.name = 'baseUrl';
    baseUrlInput.placeholder = 'http://localhost:3000';
    baseUrlInput.value = (typeof window !== 'undefined' && (currentSession?.baseUrl || window.__TYPEWRITE_PARAMS_API_BASE__)) || API_BASE_URL;
    baseUrlInput.className = `${LOGIN_MODAL_CLASS_PREFIX}__input`;
    baseUrlLabel.appendChild(baseUrlInput);
    form.appendChild(baseUrlLabel);

    const userIdLabel = document.createElement('label');
    userIdLabel.className = `${LOGIN_MODAL_CLASS_PREFIX}__label`;
    userIdLabel.textContent = 'ユーザーID';
    const userIdInput = document.createElement('input');
    userIdInput.type = 'text';
    userIdInput.name = 'userId';
    userIdInput.required = true;
    userIdInput.autocomplete = 'username';
    userIdInput.className = `${LOGIN_MODAL_CLASS_PREFIX}__input`;
    userIdLabel.appendChild(userIdInput);
    form.appendChild(userIdLabel);

    const passwordLabel = document.createElement('label');
    passwordLabel.className = `${LOGIN_MODAL_CLASS_PREFIX}__label`;
    passwordLabel.textContent = 'パスワード';
    const passwordInput = document.createElement('input');
    passwordInput.type = 'password';
    passwordInput.name = 'password';
    passwordInput.required = true;
    passwordInput.autocomplete = 'current-password';
    passwordInput.className = `${LOGIN_MODAL_CLASS_PREFIX}__input`;
    passwordLabel.appendChild(passwordInput);
    form.appendChild(passwordLabel);

    const errorMessage = document.createElement('div');
    errorMessage.className = `${LOGIN_MODAL_CLASS_PREFIX}__error`;
    form.appendChild(errorMessage);

    const submitButton = document.createElement('button');
    submitButton.type = 'submit';
    submitButton.textContent = 'ログイン';
    submitButton.className = `${LOGIN_MODAL_CLASS_PREFIX}__submit`;
    form.appendChild(submitButton);

    modal.appendChild(form);
    backdrop.appendChild(modal);

    form.addEventListener('submit', event => {
        event.preventDefault();
        handleLoginSubmit({ baseUrlInput, userIdInput, passwordInput, errorMessage, submitButton });
    });

    loginModalElements = {
        backdrop,
        modal,
        form,
        baseUrlInput,
        userIdInput,
        passwordInput,
        errorMessage,
        submitButton,
    };

    return loginModalElements;
}

function injectLoginModalStyles() {
    if (typeof document === 'undefined') {
        return;
    }

    const styleId = `${LOGIN_MODAL_CLASS_PREFIX}__style`;
    if (document.getElementById(styleId)) {
        return;
    }

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
        .${LOGIN_MODAL_CLASS_PREFIX}__backdrop {
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.75);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
        }

        .${LOGIN_MODAL_CLASS_PREFIX}__modal {
            background: #111;
            color: #f5f5f5;
            padding: 32px;
            border-radius: 16px;
            width: min(420px, 85vw);
            font-family: 'Helvetica Neue', Arial, sans-serif;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.45);
        }

        .${LOGIN_MODAL_CLASS_PREFIX}__modal h2 {
            margin: 0 0 12px;
            font-size: 1.5rem;
            text-align: center;
        }

        .${LOGIN_MODAL_CLASS_PREFIX}__modal p {
            margin: 0 0 20px;
            font-size: 0.95rem;
            line-height: 1.5;
            color: #d0d0d0;
            text-align: center;
        }

        .${LOGIN_MODAL_CLASS_PREFIX}__form {
            display: flex;
            flex-direction: column;
            gap: 14px;
        }

        .${LOGIN_MODAL_CLASS_PREFIX}__label {
            display: flex;
            flex-direction: column;
            font-size: 0.85rem;
            gap: 6px;
            color: #cfd2ff;
        }

        .${LOGIN_MODAL_CLASS_PREFIX}__input {
            padding: 10px 12px;
            font-size: 1rem;
            border-radius: 8px;
            border: 1px solid rgba(255, 255, 255, 0.25);
            background: rgba(20, 20, 30, 0.95);
            color: #f5f5f5;
        }

        .${LOGIN_MODAL_CLASS_PREFIX}__input:focus {
            outline: none;
            border-color: #8c9eff;
            box-shadow: 0 0 0 2px rgba(140, 158, 255, 0.25);
        }

        .${LOGIN_MODAL_CLASS_PREFIX}__submit {
            padding: 12px;
            margin-top: 8px;
            font-size: 1rem;
            font-weight: bold;
            border-radius: 8px;
            border: none;
            cursor: pointer;
            background: linear-gradient(135deg, #6c63ff, #8c54ff);
            color: #fff;
            transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        .${LOGIN_MODAL_CLASS_PREFIX}__submit:hover {
            transform: translateY(-1px);
            box-shadow: 0 8px 20px rgba(108, 99, 255, 0.4);
        }

        .${LOGIN_MODAL_CLASS_PREFIX}__submit:disabled {
            opacity: 0.6;
            cursor: not-allowed;
            transform: none;
            box-shadow: none;
        }

        .${LOGIN_MODAL_CLASS_PREFIX}__error {
            min-height: 1.25rem;
            font-size: 0.88rem;
            color: #ff8a80;
            text-align: center;
        }
    `;

    document.head.appendChild(style);
}

async function handleLoginSubmit(elements) {
    const { baseUrlInput, userIdInput, passwordInput, errorMessage, submitButton } = elements;

    const baseUrl = (baseUrlInput.value || '').trim() || API_BASE_URL;
    const userId = (userIdInput.value || '').trim();
    const password = passwordInput.value || '';

    if (!userId || !password) {
        displayLoginError(errorMessage, 'ユーザーIDとパスワードを入力してください。');
        return;
    }

    setLoginFormLoading(true, elements);
    displayLoginError(errorMessage, '');

    try {
        const session = await performLogin(baseUrl, userId, password);
        setCurrentSession(session);
        setLoginFormLoading(false, elements);
        passwordInput.value = '';
        hideLoginModal();
    } catch (error) {
        console.error('[typewrite-params] ログインに失敗しました:', error);
        displayLoginError(errorMessage, error.message || 'ログインに失敗しました。');
        setLoginFormLoading(false, elements);
    }
}

function setLoginFormLoading(isLoading, elements) {
    const { baseUrlInput, userIdInput, passwordInput, submitButton } = elements;
    [baseUrlInput, userIdInput, passwordInput, submitButton].forEach(el => {
        el.disabled = isLoading;
    });
    submitButton.textContent = isLoading ? 'ログイン中…' : 'ログイン';
}

function displayLoginError(element, message) {
    if (!element) return;
    element.textContent = message || '';
}

async function performLogin(baseUrlInput, userId, password) {
    const normalizedBaseUrl = (baseUrlInput || API_BASE_URL).trim().replace(/\/$/, '') || API_BASE_URL;
    const endpoint = `${normalizedBaseUrl}/api/login`;

    let response;
    try {
        response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            body: JSON.stringify({ id: userId, password }),
        });
    } catch (error) {
        throw new Error('サーバーへ接続できませんでした。ネットワーク状態を確認してください。');
    }

    let json;
    try {
        json = await response.json();
    } catch (error) {
        throw new Error('サーバーから有効なレスポンスを受信できませんでした。');
    }

    if (!response.ok || json?.success === false) {
        throw new Error(json?.message || '認証に失敗しました。');
    }

    const session = {
        ...json,
        baseUrl: normalizedBaseUrl,
        parameterVersion: json?.parameters?.version ?? PARAMETER_VERSION,
        parameterProfile: json?.parameters?.profile ?? PARAMETER_PROFILE,
    };

    return session;
}

function updateLoginModalVisibility() {
    const elements = ensureLoginModalElements();
    if (!elements) {
        return;
    }

    const hasSession = !!(currentSession && (currentSession.token || currentSession.bearerToken) && (currentSession.csrf || currentSession.csrfToken || currentSession.csrf_token));

    if (hasSession) {
        hideLoginModal();
    } else {
        showLoginModal();
    }
}

function showLoginModal() {
    const elements = ensureLoginModalElements();
    if (!elements) return;

    elements.backdrop.style.display = 'flex';
    if (typeof document !== 'undefined') {
        document.body.style.overflow = 'hidden';
    }

    displayLoginError(elements.errorMessage, '');
    if (elements.baseUrlInput) {
        elements.baseUrlInput.value = (currentSession?.baseUrl || API_BASE_URL).replace(/\/$/, '');
    }
    if (elements.userIdInput && !elements.userIdInput.value) {
        elements.userIdInput.focus();
    } else if (elements.passwordInput) {
        elements.passwordInput.focus();
    }
}

function hideLoginModal() {
    if (!loginModalElements) return;
    loginModalElements.backdrop.style.display = 'none';
    if (typeof document !== 'undefined') {
        document.body.style.overflow = '';
    }
}

function attachLoginSessionListeners() {
    if (typeof window === 'undefined' || isLoginStorageListenerAttached) {
        return;
    }

    window.addEventListener('storage', event => {
        if (event.key && event.key !== SESSION_STORAGE_KEY) {
            return;
        }
        resolveSessionTokens();
        updateLoginModalVisibility();
    });

    window.addEventListener('focus', () => {
        resolveSessionTokens();
        updateLoginModalVisibility();
    });

    isLoginStorageListenerAttached = true;
}

function initializeLoginUI() {
    ensureLoginModalElements();
    if (!currentSession) {
        resolveSessionTokens();
    }
    attachLoginSessionListeners();
    updateLoginModalVisibility();
}

if (typeof window !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeLoginUI);
    } else {
        initializeLoginUI();
    }
}

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
        this.WAITING_DURATION = 120; // 文字表示後の待機時間 (フレーム数)
        this.g = 0.5; // 落下時の重力加速度
        this.RESTART_DELAY = 120; // 落下後のリスタート待機時間 (フレーム数)

        // リスタート待機フェーズの開始フレーム
        this.turnStartTime = 0;

        this.preLeftState = false;
        this.preRightState = false;

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
                poemIndex: this.poemIndex,
                showBackgroundBox: midiController.transportButtonToggleState_['MARKER_LEFT'],
                colorInverted: midiController.transportButtonToggleState_['MARKER_RIGHT'],
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
                poemIndex: this.poemIndex,
                showBackgroundBox: false,
                colorInverted: false
            };
        }
    }

    /**
     * アニメーションをリセットし、最初の状態に戻す
     */
    resetAnimation() {
        const N = Object.keys(this.poems).length;
        if (this.poemIndex < 0) this.poemIndex += N;
        this.poemIndex = this.poemIndex % N;
        
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

    indexChange(){
        const preIndex = this.poemIndex;
        if(nanoKontrol2Manager.midiSuccess_ && (this.preLeftState !== nanoKontrol2Manager.transportButtonState_['TRACK_LEFT'] || this.preRightState !== nanoKontrol2Manager.transportButtonState_['TRACK_RIGHT'])){
            this.poemIndex += nanoKontrol2Manager.transportButtonState_['TRACK_RIGHT'] ? 1 : 0;
            this.poemIndex -= nanoKontrol2Manager.transportButtonState_['TRACK_LEFT'] ? 1 : 0;
        }
        this.preLeftState = nanoKontrol2Manager.transportButtonState_['TRACK_LEFT'];
        this.preRightState = nanoKontrol2Manager.transportButtonState_['TRACK_RIGHT'];
        return this.poemIndex !== preIndex;
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
        // PLAYボタンが押されたらアニメーションをリセット
        if (midiController.midiSuccess_ && (midiController.transportButtonState_['PLAY'] || this.indexChange())) {
            this.resetAnimation();
        }
        // 1分くらいでリセットかけとく
        if(frameCount % 3600 == 0){
            this.poemIndex += 1;
            this.resetAnimation();
        }

        const params = this.getParams(midiController);

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

let isSaveBtnPressing = false

function draw() {
    // MIDI接続が成功しているかどうかをチェック
    if (nanoKontrol2Manager.midiSuccess_) {
        // 成功している場合は通常のアニメーションを描画
        textAnimator.draw(nanoKontrol2Manager);

        const currentRecBtnState = nanoKontrol2Manager.transportButtonState_['REC']

        if (!isSaveBtnPressing && currentRecBtnState){
            const currentParams = textAnimator.getParams(nanoKontrol2Manager);

            // 以下にパラメーター送信処理を記述
            const metadata = {
                poemTitle: textAnimator.title,
                poemAuthor: textAnimator.author,
            };
            triggerParameterSubmission(currentParams, metadata);

            isSaveBtnPressing = true
        } else if (!currentRecBtnState){
            isSaveBtnPressing = false
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