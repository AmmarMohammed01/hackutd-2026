import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
import { classifyLandmarks } from "./classify.js";

const CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [0, 9], [9, 10], [10, 11], [11, 12],
  [0, 13], [13, 14], [14, 15], [15, 16],
  [0, 17], [17, 18], [18, 19], [19, 20],
  [5, 9], [9, 13], [13, 17],
];

async function createLandmarker() {
  const fileset = await FilesetResolver.forVisionTasks("/wasm");
  let lastError = null;
  for (const delegate of ["GPU", "CPU"]) {
    try {
      return await HandLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath: "/models/hand_landmarker.task",
          delegate,
        },
        runningMode: "VIDEO",
        numHands: 1,
      });
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("Hand tracking failed to start");
}

function drawHand(canvas, video, landmarks) {
  if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
    canvas.width = video.videoWidth || canvas.clientWidth;
    canvas.height = video.videoHeight || canvas.clientHeight;
  }
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!landmarks) return;
  const x = (index) => landmarks[index].x * canvas.width;
  const y = (index) => landmarks[index].y * canvas.height;
  ctx.lineWidth = Math.max(3, canvas.width / 140);
  ctx.lineCap = "round";
  ctx.strokeStyle = "rgba(255, 248, 230, 0.92)";
  ctx.beginPath();
  for (const [start, end] of CONNECTIONS) {
    ctx.moveTo(x(start), y(start));
    ctx.lineTo(x(end), y(end));
  }
  ctx.stroke();
  ctx.fillStyle = "#e8a317";
  for (let index = 0; index < landmarks.length; index += 1) {
    ctx.beginPath();
    ctx.arc(x(index), y(index), Math.max(3, canvas.width / 160), 0, Math.PI * 2);
    ctx.fill();
  }
}

export async function startCamera({ video, canvas, onPose }) {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "user", width: { ideal: 960 }, height: { ideal: 720 } },
    audio: false,
  });
  video.srcObject = stream;
  await video.play();
  const landmarker = await createLandmarker();
  let lastVideoTime = -1;
  let stopped = false;

  function frame() {
    if (stopped) return;
    if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
      lastVideoTime = video.currentTime;
      const result = landmarker.detectForVideo(video, performance.now());
      const image = result.landmarks?.[0] || null;
      drawHand(canvas, video, image);
      // Image landmarks use y-down, which is the coordinate system the
      // letter rules were tuned on. World landmarks flip that axis.
      const pose = classifyLandmarks(image);
      onPose(pose);
    }
    requestAnimationFrame(frame);
  }

  frame();
  return () => {
    stopped = true;
    landmarker.close?.();
    stream.getTracks().forEach((track) => track.stop());
  };
}
