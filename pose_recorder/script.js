const videoElement = document.getElementById('input_video');
const canvasElement = document.getElementById('output_canvas');
const canvasCtx = canvasElement.getContext('2d');
const landmarkNamesList = document.getElementById('landmark-names-list');
const landmarkXList = document.getElementById('landmark-xlist');
const landmarkYList = document.getElementById('landmark-ylist');
const landmarkZList = document.getElementById('landmark-zlist');
const landmarkVList = document.getElementById('landmark-vlist');
const recordButton = document.getElementById('record-button');
const periodSlider = document.getElementById('rec-period');
const periodValueDisplay = document.getElementById('period-value');

const LANDMARK_NAMES = [
    "nose", "left_eye_inner", "left_eye", "left_eye_outer",
    "right_eye_inner", "right_eye", "right_eye_outer",
    "left_ear", "right_ear", "mouth_left", "mouth_right",
    "left_shoulder", "right_shoulder", "left_elbow", "right_elbow",
    "left_wrist", "right_wrist", "left_pinky", "right_pinky",
    "left_index", "right_index", "left_thumb", "right_thumb",
    "left_hip", "right_hip", "left_knee", "right_knee",
    "left_ankle", "right_ankle", "left_heel", "right_heel",
    "left_foot_index", "right_foot_index"
];

let lastUpdate = 0;
const updateInterval = 500; // Update UI every 500ms
let recording = false;
let landmarkArray = [];
let recordingTimeoutId = null;

// Update slider display value
periodSlider.addEventListener('input', (e) => {
    periodValueDisplay.textContent = `${e.target.value}s`;
});

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function zColor(data) {
    const z = clamp(data.from.z + 0.5, 0, 1);
    return `rgba(0, ${255 * z}, ${255 * (1 - z)}, 1)`;
}

function toggleRecording() {
    if (recording) {
        stopRecording();
    } else {
        startRecording();
    }
}

function startRecording() {
    const duration = parseInt(periodSlider.value);
    recording = true;
    recordButton.textContent = `Recording... (${duration}s)`;
    recordButton.classList.add('recording');
    landmarkArray = []; // Clear previous data

    recordingTimeoutId = setTimeout(() => {
        stopRecording();
    }, duration * 1000);
}

function stopRecording() {
    clearTimeout(recordingTimeoutId);
    recording = false;
    recordButton.textContent = 'Start Recording';
    recordButton.classList.remove('recording');
    exportToCSV();
}

function exportToCSV() {
    if (landmarkArray.length === 0) {
        console.warn("No data to export");
        return;
    }

    let csvContent = "data:text/csv;charset=utf-8,";

    // Header
    LANDMARK_NAMES.forEach(name => {
        csvContent += `${name}_x,${name}_y,${name}_z,${name}_v,`;
    });
    csvContent += "\n";

    // Data
    landmarkArray.forEach((frameLandmarks) => {
        try {
            frameLandmarks.forEach((point) => {
                csvContent += `${point.x.toFixed(4)},${point.y.toFixed(4)},${point.z.toFixed(4)},${point.visibility.toFixed(4)},`;
            });
            csvContent += "\n";
        } catch (error) {
            console.error("Error processing landmark frame:", error);
        }
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `landmarks_${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function onResults(results) {
    if (!results.poseLandmarks) {
        return;
    }

    // Record data if recording is active
    if (recording) {
        landmarkArray.push(results.poseLandmarks);
        // Optional: Update button text with countdown could go here
    }

    // Update UI (throttled)
    const now = Date.now();
    if (now - lastUpdate > updateInterval) {
        lastUpdate = now;
        updateLandmarkTables(results.poseLandmarks);
    }

    drawResults(results);
}

function updateLandmarkTables(landmarks) {
    landmarkNamesList.innerHTML = '';
    landmarkXList.innerHTML = '';
    landmarkYList.innerHTML = '';
    landmarkZList.innerHTML = '';
    landmarkVList.innerHTML = '';

    landmarks.forEach((landmark, index) => {
        const name = LANDMARK_NAMES[index];

        const itemName = document.createElement('li');
        itemName.innerText = name;
        itemName.style.textAlign = 'left';
        landmarkNamesList.appendChild(itemName);

        const itemX = document.createElement('li');
        itemX.innerText = landmark.x.toFixed(2);
        landmarkXList.appendChild(itemX);

        const itemY = document.createElement('li');
        itemY.innerText = landmark.y.toFixed(2);
        landmarkYList.appendChild(itemY);

        const itemZ = document.createElement('li');
        itemZ.innerText = landmark.z.toFixed(2);
        landmarkZList.appendChild(itemZ);

        const itemV = document.createElement('li');
        itemV.innerText = landmark.visibility.toFixed(2);
        landmarkVList.appendChild(itemV);
    });
}

function drawResults(results) {
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    // Draw the video frame
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    // Draw connectors
    drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS, {
        color: (data) => {
            const x0 = canvasElement.width * data.from.x;
            const y0 = canvasElement.height * data.from.y;
            const x1 = canvasElement.width * data.to.x;
            const y1 = canvasElement.height * data.to.y;
            const z0 = clamp(data.from.z + 0.5, 0, 1);
            const z1 = clamp(data.to.z + 0.5, 0, 1);

            const gradient = canvasCtx.createLinearGradient(x0, y0, x1, y1);
            gradient.addColorStop(0, `rgba(0, ${255 * z0}, ${255 * (1 - z0)}, 1)`);
            gradient.addColorStop(1.0, `rgba(0, ${255 * z1}, ${255 * (1 - z1)}, 1)`);
            return gradient;
        }
    });

    // Draw landmarks
    drawLandmarks(canvasCtx, Object.values(POSE_LANDMARKS_LEFT).map(index => results.poseLandmarks[index]),
        { color: zColor, fillColor: '#FF0000', radius: 2 });
    drawLandmarks(canvasCtx, Object.values(POSE_LANDMARKS_RIGHT).map(index => results.poseLandmarks[index]),
        { color: zColor, fillColor: '#00FF00', radius: 2 });
    drawLandmarks(canvasCtx, Object.values(POSE_LANDMARKS_NEUTRAL).map(index => results.poseLandmarks[index]),
        { color: zColor, fillColor: '#AAAAAA', radius: 2 });

    canvasCtx.restore();
}

// Initialize MediaPipe Pose
const pose = new Pose({
    locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
    }
});

pose.setOptions({
    modelComplexity: 1,
    smoothLandmarks: true,
    enableSegmentation: true,
    smoothSegmentation: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
});

pose.onResults(onResults);

// Initialize Camera
const camera = new Camera(videoElement, {
    onFrame: async () => {
        await pose.send({ image: videoElement });
    },
    width: 640,
    height: 480
});

// Start the camera
camera.start();

// Expose function to global scope for the button onclick (though event listener is better, we'll bind it here)
recordButton.onclick = toggleRecording;
