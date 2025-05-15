document.addEventListener('DOMContentLoaded', () => {
    // 要素の取得
    const encoder = document.getElementById('encoder');
    const encoderDisc = encoder.querySelector('.encoder-disc');
    const controlKnob = document.getElementById('control-knob');
    const sensorA = document.getElementById('sensor-a');
    const sensorB = document.getElementById('sensor-b');
    const signalAWave = document.getElementById('signal-a-wave');
    const signalBWave = document.getElementById('signal-b-wave');
    const signalAValue = document.getElementById('signal-a-value');
    const signalBValue = document.getElementById('signal-b-value');
    const directionValue = document.getElementById('direction-value');
    const counterValue = document.getElementById('counter-value');
    const rotationValue = document.getElementById('rotation-value');
    const lastEdgeValue = document.getElementById('last-edge-value');

    // エンコーダのセグメント
    const segments = Array.from(document.querySelectorAll('.segments .segment'));
    
    // 変数の初期化
    let currentRotation = 22.5; // 初期回転角度を22.5度に設定
    let prevA = null;
    let prevB = null;
    let prevState = 0; // 前回の状態
    let counter = 0;
    let rotationCounter = 0; // 回転数カウンター
    let pulsesPerRotation = 16; // 1回転あたりのパルス数
    let pulseCount = 0; // 累積パルス数
    let errorCount = 0;
    let lastDirection = '停止';
    let lastEdgeType = '-';
    let isDragging = false;
    let startAngle = 0;
    let lastDelta = 0;
    
    // エンコーダテーブル（参考プログラムに基づく）
    // pqrs: p=前回のA相, q=前回のB相, r=今回のA相, s=今回のB相
    const EncoderIndexTable = [
        0, -1, 1, 0,   // 00 -> 00, 00 -> 01, 00 -> 10, 00 -> 11
        1, 0, 0, -1,   // 01 -> 00, 01 -> 01, 01 -> 10, 01 -> 11
        -1, 0, 0, 1,   // 10 -> 00, 10 -> 01, 10 -> 10, 10 -> 11
        0, 1, -1, 0    // 11 -> 00, 11 -> 01, 11 -> 10, 11 -> 11
    ];
    
    const EncoderErrorIndexTable = [
        0, 0, 0, 1,    // 00 -> 00, 00 -> 01, 00 -> 10, 00 -> 11
        0, 0, 1, 0,    // 01 -> 00, 01 -> 01, 01 -> 10, 01 -> 11
        0, 1, 0, 0,    // 10 -> 00, 10 -> 01, 10 -> 10, 10 -> 11
        1, 0, 0, 0     // 11 -> 00, 11 -> 01, 11 -> 10, 11 -> 11
    ];

    // ドラッグイベントのセットアップ
    controlKnob.addEventListener('mousedown', startDrag);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', endDrag);
    controlKnob.addEventListener('touchstart', startDragTouch);
    document.addEventListener('touchmove', dragTouch);
    document.addEventListener('touchend', endDrag);

    // 初期状態の更新
    updateRotation(22.5); // 初期回転角度を22.5度に設定

    // ドラッグ開始 (マウス)
    function startDrag(e) {
        e.preventDefault();
        isDragging = true;
        const rect = controlKnob.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        startAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX);
    }

    // ドラッグ開始 (タッチ)
    function startDragTouch(e) {
        e.preventDefault();
        isDragging = true;
        const rect = controlKnob.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const touch = e.touches[0];
        startAngle = Math.atan2(touch.clientY - centerY, touch.clientX - centerX);
    }

    // ドラッグ中 (マウス)
    function drag(e) {
        if (!isDragging) return;
        e.preventDefault();
        
        const rect = controlKnob.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        const angle = Math.atan2(e.clientY - centerY, e.clientX - centerX);
        const rotation = angle - startAngle;
        
        // 回転角度を更新
        const newRotation = currentRotation + rotation * 180 / Math.PI;
        lastDelta = newRotation - currentRotation;
        updateRotation(newRotation);
        
        startAngle = angle;
        currentRotation = newRotation;
    }

    // ドラッグ中 (タッチ)
    function dragTouch(e) {
        if (!isDragging) return;
        e.preventDefault();
        
        const rect = controlKnob.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        const touch = e.touches[0];
        const angle = Math.atan2(touch.clientY - centerY, touch.clientX - centerX);
        const rotation = angle - startAngle;
        
        // 回転角度を更新
        const newRotation = currentRotation + rotation * 180 / Math.PI;
        lastDelta = newRotation - currentRotation;
        updateRotation(newRotation);
        
        startAngle = angle;
        currentRotation = newRotation;
    }

    // ドラッグ終了
    function endDrag() {
        isDragging = false;
    }

    // 回転角度に基づいて更新
    function updateRotation(degrees) {
        // エンコーダディスクとコントロールノブを回転
        encoderDisc.style.transform = `rotate(${degrees}deg)`;
        controlKnob.style.transform = `rotate(${degrees}deg)`;

        // 現在のセグメント位置を計算（0-359度の範囲）
        const normalizedDegrees = ((degrees % 360) + 360) % 360;
        
        // セグメント状態を取得（立ち上がり間隔を2倍に遅くするため、22.5度ごとに変化）
        const segmentIndex = Math.floor(normalizedDegrees / 22.5) % 16;
        
        // 現在のセグメントを取得
        const currentSegment = segments[segmentIndex];
        
        // センサー信号の状態を取得（data属性から）
        const isAOn = currentSegment.getAttribute('data-a') === '1';
        const isBOn = currentSegment.getAttribute('data-b') === '1';
        
        // センサーの見た目を更新
        sensorA.classList.toggle('active', isAOn);
        sensorB.classList.toggle('active', isBOn);
        
        // 信号波形と値を更新
        signalAWave.classList.toggle('active', isAOn);
        signalBWave.classList.toggle('active', isBOn);
        signalAValue.textContent = isAOn ? 'ON' : 'OFF';
        signalBValue.textContent = isBOn ? 'ON' : 'OFF';
        
        // A相B相の値を2進数に変換（0-3）
        const currentState = (isAOn ? 2 : 0) + (isBOn ? 1 : 0);
        
        // 回転方向とカウンタの更新（参考プログラムのロジックに基づく）
        if (prevA !== null && prevB !== null) {
            // 前回の状態と今回の状態を組み合わせてテーブルのインデックスを計算
            const index = ((prevState << 2) + currentState) & 0xf;
            
            // カウンタとエラーカウントを更新
            const indexValue = EncoderIndexTable[index];
            const errorValue = EncoderErrorIndexTable[index];
            
            if (indexValue !== 0) {
                // カウンタが変化した場合、エッジ情報を更新
                counter += indexValue;
                
                // パルスカウントを更新（符号に応じて加算または減算）
                if (indexValue > 0) {
                    // 時計回りの場合は加算
                    pulseCount += 1;
                    if (pulseCount >= pulsesPerRotation) {
                        rotationCounter += 1;
                        pulseCount -= pulsesPerRotation;
                    }
                } else {
                    // 反時計回りの場合は減算
                    pulseCount -= 1;
                    if (pulseCount < 0) {
                        rotationCounter -= 1;
                        pulseCount += pulsesPerRotation;
                    }
                }
                
                // 回転方向を設定
                lastDirection = indexValue > 0 ? '時計回り' : '反時計回り';
                
                // エッジタイプを判定
                if (isAOn !== prevA) {
                    lastEdgeType = isAOn ? 'A相立ち上がり' : 'A相立ち下がり';
                } else if (isBOn !== prevB) {
                    lastEdgeType = isBOn ? 'B相立ち上がり' : 'B相立ち下がり';
                }
            }
            
            if (errorValue > 0) {
                errorCount += errorValue;
                console.log('エンコーダエラー発生', index, errorCount);
            }
        }
        
        // 前の状態を保存
        prevA = isAOn;
        prevB = isBOn;
        prevState = currentState;
        
        // 表示を更新
        counterValue.textContent = counter;
        // 回転数を小数点付きで表示
        const decimalRotation = rotationCounter + (pulseCount / pulsesPerRotation);
        rotationValue.textContent = decimalRotation.toFixed(2); // 小数点以下2桁まで表示
        directionValue.textContent = lastDirection;
        lastEdgeValue.textContent = lastEdgeType;
    }
}); 