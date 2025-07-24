// --- ゲームの初期設定 ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const gameWidth = 400; // HTMLのCSSと合わせる
const gameHeight = 700; // HTMLのCSSと合わせる
canvas.width = gameWidth;
canvas.height = gameHeight;

const judgmentLineY = gameHeight - 50; // 判定ラインのY座標（CSSと合わせる）
const noteSpeed = 300; // ノーツの落下速度 (pixel/second)

const laneCount = 5; // レーン数
const laneWidth = gameWidth / laneCount; // 各レーンの幅

let audioContext; // Web Audio API のコンテキスト
let audioBuffer;  // 読み込んだ音楽データ
let audioSource;  // 音楽再生用のノード

let chartData = null; // 譜面データ
let notes = [];       // 現在画面に表示されているノーツのリスト
let currentNoteIndex = 0; // 次に生成すべきノーツのインデックス

let startTime = 0; // 音楽再生開始時の時刻 (performance.now() の値)
let currentScore = 0;
let currentCombo = 0;

const scoreElement = document.getElementById('score');
const comboElement = document.getElementById('combo');

// --- 音楽ファイルの読み込み (Web Audio API) ---
async function loadAudio(url) {
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        console.log("音楽ファイルが読み込まれました。");
        return true;
    } catch (error) {
        console.error("音楽ファイルの読み込みまたはデコードに失敗しました:", error);
        return false;
    }
}

// --- 譜面データの読み込み ---
async function loadChart(difficulty) {
    try {
        const response = await fetch(`/api/chart/${difficulty}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        chartData = await response.json();
        console.log("譜面データが読み込まれました。", chartData);
        // ノーツデータを時間順にソート（念のため）
        chartData.notes.sort((a, b) => a.time - b.time);
        return true;
    } catch (error) {
        console.error("譜面データの読み込みに失敗しました:", error);
        return false;
    }
}

// --- ゲーム開始 ---
async function startGame() {
    // 音楽と譜面を読み込む
    const audioLoaded = await loadAudio('/audio/11.ogg'); // your_song.mp3 を適切なファイル名に
    const chartLoaded = await loadChart('normal'); // 'normal' 難易度を読み込む

    if (!audioLoaded || !chartLoaded) {
        console.error("ゲーム開始に必要なリソースの読み込みに失敗しました。");
        return;
    }

    // 音楽を再生
    audioSource = audioContext.createBufferSource();
    audioSource.buffer = audioBuffer;
    audioSource.connect(audioContext.destination);

    // `audioContext.currentTime` は Web Audio API のオーディオクロック。非常に正確。
    startTime = audioContext.currentTime; 
    audioSource.start(0); // 0秒から再生開始

    // ゲームループ開始
    requestAnimationFrame(gameLoop);
    console.log("ゲーム開始！");
}

// --- ゲームループ ---
function gameLoop() {
    // 現在のゲーム時間 (音楽再生開始からの経過時間)
    const currentTime = audioContext.currentTime - startTime;

    // 画面クリア
    ctx.clearRect(0, 0, gameWidth, gameHeight);

    // 新しいノーツの生成
    while (currentNoteIndex < chartData.notes.length) {
        const note = chartData.notes[currentNoteIndex];
        // ノーツが表示されるべき時間（判定ラインに到達する時間 - 画面上から判定ラインまでの距離 / ノーツ速度）
        const displayTime = note.time - (judgmentLineY / noteSpeed);

        if (currentTime >= displayTime) {
            notes.push({
                ...note,
                y: 0, // 画面上部からスタート
                active: true, // アクティブなノーツ
                hit: false,   // ヒット済みか
                durationProgress: 0 // ロングノーツ用
            });
            currentNoteIndex++;
        } else {
            break; // まだ表示すべきノーツはない
        }
    }

    // ノーツの更新と描画
    for (let i = notes.length - 1; i >= 0; i--) {
        const note = notes[i];

        if (!note.active) continue; // ヒット済みなどで非アクティブならスキップ

        // Y座標の更新 (時間ベースで動かす)
        const expectedY = judgmentLineY + (note.time - currentTime) * noteSpeed;
        note.y = expectedY; // この計算式だと、note.time でちょうど judgmentLineY に来る

        // ノーツを描画
        drawNote(note);

        // 判定ラインを過ぎてしまったノーツの処理 (MISS)
        if (note.y > judgmentLineY + 20 && !note.hit) { // 判定ラインを少し通り過ぎたらミス
            console.log(`Missed note at time ${note.time}`);
            note.active = false; // 非アクティブにする
            currentCombo = 0;
            updateUI();
        }
    }

    // 画面外に出たノーツを削除（パフォーマンスのため）
    notes = notes.filter(note => note.active && note.y < gameHeight + 50); // 画面外に完全に消えたら削除

    // ゲーム終了判定（すべてのノーツを処理し終え、かつ画面にアクティブなノーツがない）
    if (currentNoteIndex === chartData.notes.length && notes.length === 0 && currentTime > audioBuffer.duration) {
        console.log("ゲーム終了！");
        // ここにゲーム終了時の処理（結果表示など）を追加
        return; // ループを停止
    }

    // 次のフレームをリクエスト
    requestAnimationFrame(gameLoop);
}

// --- ノーツの描画 ---
function drawNote(note) {
    const x = note.lane * laneWidth - (laneWidth / 2); // レーンの中心X座標
    const noteSize = 40; // ノーツのサイズ

    ctx.fillStyle = 'blue'; // デフォルトの色

    if (note.type === 'long') {
        const startY = note.y;
        const endY = judgmentLineY + (note.time + note.duration - currentTime) * noteSpeed;
        ctx.fillStyle = 'green';
        ctx.fillRect(x - noteSize/2, endY, noteSize, startY - endY); // ロングノーツの描画
    } else if (note.type === 'flick') {
        ctx.fillStyle = 'orange';
        ctx.beginPath();
        ctx.arc(x, note.y, noteSize / 2, 0, Math.PI * 2);
        ctx.fill();
        // フリック方向を示す矢印などを描画することも可能
    } else { // tap ノーツ
        ctx.fillStyle = 'red';
        ctx.beginPath();
        ctx.arc(x, note.y, noteSize / 2, 0, Math.PI * 2);
        ctx.fill();
    }
}

// --- キー入力による判定 ---
document.addEventListener('keydown', (e) => {
    // どのキーがどのレーンに対応するかを定義
    const keyToLane = { 'd': 1, 'f': 2, 'g': 3, 'h': 4, 'j': 5 }; // 例: DFGHLキー
    const lane = keyToLane[e.key.toLowerCase()];

    if (lane) {
        // 判定ラインに近いアクティブなノーツを探す
        const hitNote = notes.find(note => 
            note.active && 
            note.lane === lane && 
            Math.abs(note.y - judgmentLineY) < 50 // 判定範囲を広めに
        );

        if (hitNote) {
            const hitTime = audioContext.currentTime - startTime;
            const timingDiff = Math.abs(hitNote.time - hitTime); // ノーツの本来の時間とヒット時間の差

            // 判定ロジック (適当な例)
            let judgment = "";
            let scoreAdd = 0;

            if (timingDiff < 0.05) { // 50ms以内
                judgment = "Perfect!";
                scoreAdd = 100;
                currentCombo++;
            } else if (timingDiff < 0.15) { // 150ms以内
                judgment = "Great!";
                scoreAdd = 50;
                currentCombo++;
            } else {
                judgment = "Good!";
                scoreAdd = 20;
                currentCombo++;
            }
            
            console.log(`${judgment} - Note Time: ${hitNote.time.toFixed(3)}, Hit Time: ${hitTime.toFixed(3)}, Diff: ${timingDiff.toFixed(3)}`);
            
            currentScore += scoreAdd;
            hitNote.active = false; // ノーツを非アクティブにする
            hitNote.hit = true; // ヒットしたことを記録
            updateUI();
        } else {
            // ノーツがない場所を叩いた場合はコンボが途切れる
            currentCombo = 0;
            updateUI();
        }
    }
});

// --- UIの更新 ---
function updateUI() {
    scoreElement.textContent = `Score: ${currentScore}`;
    comboElement.textContent = `Combo: ${currentCombo}`;
}

// --- ゲーム開始のトリガー ---
// ページがロードされたらゲームを開始
window.onload = startGame;
