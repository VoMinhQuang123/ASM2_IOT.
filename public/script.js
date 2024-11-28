let model;
const socket = new WebSocket('ws://localhost:8000/web');

socket.onopen = () => {
    console.log("WebSocket connection established.");
};
socket.onerror = (error) => {
    console.error("WebSocket error:", error);
};
socket.onclose = () => {
    console.log("WebSocket connection closed.");
};
socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    const distance = data.distance;
    console.log("Distance received", distance);
    document.getElementById('distance-display').textContent = `Khoảng cách nhận được: ${distance} cm`;

    if (distance === '1' || distance === '2' || distance === '3' || distance === '4' || distance === '5' ) {
        checkModelAndStartDetection();s
    }
};

async function loadModel() {
    model = await cocoSsd.load();
    console.log("Mô hình COCO SSD đã được tải");
}

function checkModelAndStartDetection() {
    if (model) {
        startShapeAndColorDetection();
    } else {
        console.log("Chờ mô hình tải xong...");
        const interval = setInterval(() => {
            if (model) {
                clearInterval(interval); 
                startShapeAndColorDetection(); 
            }
        }, 100); 
    }
}

function isAlmostSquare(bbox) {
    const width = bbox[2];
    const height = bbox[3];
    const aspectRatio = width / height;
    return aspectRatio >= 0.8 && aspectRatio <= 1.2; 
}


function getColorName(r, g, b) {
    
    const hsl = rgbToHsl(r, g, b);
    const h = hsl[0];
    const s = hsl[1];
    const l = hsl[2];

    if (s < 0.3 && l > 0.8) return 'white'; 
    if (s < 0.3 && l < 0.3) return 'black';
    if (h >= 0 && h <= 20) return 'red';  
    if (h > 20 && h <= 40) return 'orange'; 
    if (h > 40 && h <= 80) return 'yellow';
    if (h > 80 && h <= 170) return 'green';  
    if (h > 170 && h <= 250) return 'blue';  
    return 'other';  
}

function rgbToHsl(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const diff = max - min;
    let h = 0, s = 0, l = (max + min) / 2;

    if (diff !== 0) {
        s = diff / (1 - Math.abs(2 * l - 1));

        if (max === r) {
            h = (g - b) / diff;
        } else if (max === g) {
            h = (b - r) / diff + 2;
        } else {
            h = (r - g) / diff + 4;
        }

        h = (h * 60 + 360) % 360;
    }

    return [h, s, l];
}

function analyzeColorInSquare(img, bbox) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = bbox[2];  
    canvas.height = bbox[3]; 

    ctx.drawImage(img, bbox[0], bbox[1], bbox[2], bbox[3], 0, 0, bbox[2], bbox[3]);
    const pixels = ctx.getImageData(0, 0, bbox[2], bbox[3]);
    const data = pixels.data;

    let r = 0, g = 0, b = 0;
    let total = data.length / 4;

    for (let i = 0; i < total; i++) {
        r += data[i * 4]; 
        g += data[i * 4 + 1]; 
        b += data[i * 4 + 2]; 
    }
    r = Math.floor(r / total);
    g = Math.floor(g / total);
    b = Math.floor(b / total);
    return getColorName(r, g, b);
}
async function sendResultToESP(result) {
    const espURL = 'http://192.168.0.124/result';

    const response = await fetch(espURL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(result),
        mode: 'no-cors' 
    });

    console.log("Kết quả phản hồi từ ESP8266:", response);
}

async function startShapeAndColorDetection() {
    console.log("Bắt đầu nhận diện hình vuông và màu sắc");

    if (!model) {
        console.error("Mô hình chưa được tải.");
        return; 
    }

    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const webcam = document.getElementById('webcam');
    const detectionTimeout = 5000; 
    let startTime = Date.now(); 

    let squareDetected = false;
    let colorDetected = '';

    while (Date.now() - startTime < detectionTimeout) {
        ctx.drawImage(webcam, 0, 0, canvas.width, canvas.height);
        const predictions = await model.detect(webcam);
        predictions.forEach(prediction => {
            if (isAlmostSquare(prediction.bbox)) {
                squareDetected = true;
                colorDetected = analyzeColorInSquare(webcam, prediction.bbox);
            }
        });

        if (squareDetected) {
            break; 
        }
    }
    const result = {
        squareDetected: squareDetected,
        colorDetected: colorDetected
    };
    if (squareDetected) {
        console.log("Hình vuông đã được phát hiện.");
        document.getElementById('shape-display').textContent = "Hình vuông phát hiện!";
        sendResultToESP(result);
        if (colorDetected !== 'other') {
            document.getElementById('color-display').textContent = `Màu sắc phát hiện: ${colorDetected}`;
        } else {
            document.getElementById('color-display').textContent = "Màu sắc: Other";
        }
    } else {
        console.log("Không phát hiện hình vuông trong 5 giây.");
        document.getElementById('shape-display').textContent = "Hình vuông: Không phát hiện trong 5 giây.";
    }
}

// Bắt đầu camera và tải mô hình cùng lúc
async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        const webcam = document.getElementById('webcam');
        webcam.srcObject = stream;
        webcam.onloadedmetadata = () => {
            console.log("Webcam started.");
        };
    } catch (err) {
        console.error("Lỗi khi truy cập webcam:", err);
        document.getElementById('distance-display').textContent = "Không thể truy cập webcam. Vui lòng kiểm tra thiết bị!";
    }

    // Tải mô hình khi bắt đầu camera
    loadModel();
}

window.onload = () => {
    startCamera();
};
