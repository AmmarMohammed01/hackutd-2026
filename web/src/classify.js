export const LETTERS = ["A", "B", "C", "D", "F", "I", "L", "V", "W", "Y"];
export const MIN_SCORE = 0.62;
export const MIN_MARGIN = 0.12;

function clamp01(value) {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function geo(values) {
  let product = 1;
  for (const value of values) product *= value;
  return product ** (1 / values.length);
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y, (a.z || 0) - (b.z || 0));
}

export function orient(landmarks) {
  const wrist = landmarks[0];
  const shifted = landmarks.map((point) => ({
    x: point.x - wrist.x,
    y: point.y - wrist.y,
    z: (point.z || 0) - (wrist.z || 0),
  }));
  const middleMcp = shifted[9];
  const palm = Math.hypot(middleMcp.x, middleMcp.y, middleMcp.z) || 1e-6;
  const scaled = shifted.map((point) => ({
    x: point.x / palm,
    y: point.y / palm,
    z: point.z / palm,
  }));
  const angle = Math.atan2(scaled[9].y, scaled[9].x);
  const rotation = -Math.PI / 2 - angle;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  return scaled.map((point) => ({
    x: point.x * cos - point.y * sin,
    y: point.x * sin + point.y * cos,
    z: point.z,
  }));
}

function rising(lift) {
  return clamp01((lift - 0.2) / 0.4);
}

function folded(lift) {
  return clamp01((0.05 - lift) / 0.35);
}

function thumbOut(side) {
  return clamp01((side - 0.45) / 0.5);
}

function thumbIn(side) {
  return clamp01((0.4 - side) / 0.35);
}

function pinched(gap) {
  return clamp01((0.25 - gap) / 0.25);
}

function opened(gap) {
  return clamp01((gap - 0.3) / 0.4);
}

function midCurl(lift) {
  return clamp01(1 - Math.abs(lift - 0.1) / 0.22);
}

export function scoreLandmarks(landmarks) {
  if (!landmarks || landmarks.length < 21) {
    return { scores: {}, ranked: [], pose: null };
  }
  const lm = orient(landmarks);
  const lift = (tip, pip) => lm[pip].y - lm[tip].y;
  const pose = {
    index: lift(8, 6),
    middle: lift(12, 10),
    ring: lift(16, 14),
    pinky: lift(20, 18),
    thumbSide: Math.abs(lm[4].x),
    pinch: distance(lm[4], lm[8]),
    spreadIM: distance(lm[8], lm[12]),
    spreadIR: distance(lm[8], lm[16]),
  };
  const up = {
    index: rising(pose.index),
    middle: rising(pose.middle),
    ring: rising(pose.ring),
    pinky: rising(pose.pinky),
  };
  const down = {
    index: folded(pose.index),
    middle: folded(pose.middle),
    ring: folded(pose.ring),
    pinky: folded(pose.pinky),
  };
  const side = thumbOut(pose.thumbSide);
  const tucked = thumbIn(pose.thumbSide);
  const closeEnough = 0.55 + 0.45 * clamp01((0.28 - pose.spreadIM) / 0.2);
  const wideEnough = 0.45 + 0.55 * clamp01((pose.spreadIR - 0.28) / 0.28);

  const scores = {
    A: geo([down.index, down.middle, down.ring, down.pinky, side]),
    B: geo([up.index, up.middle, up.ring, up.pinky, tucked, closeEnough]),
    C: geo([
      midCurl(pose.index),
      midCurl(pose.middle),
      midCurl(pose.ring),
      midCurl(pose.pinky),
      opened(pose.pinch),
    ]),
    D: geo([up.index, down.middle, down.ring, down.pinky, tucked]),
    F: geo([down.index, up.middle, up.ring, up.pinky, pinched(pose.pinch)]),
    I: geo([down.index, down.middle, down.ring, up.pinky, tucked]),
    L: geo([up.index, down.middle, down.ring, down.pinky, side]),
    V: geo([up.index, up.middle, down.ring, down.pinky, tucked, clamp01((pose.spreadIM - 0.32) / 0.25)]),
    W: geo([up.index, up.middle, up.ring, down.pinky, tucked, wideEnough]),
    Y: geo([down.index, down.middle, down.ring, up.pinky, side]),
  };
  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  return { scores, ranked, pose };
}

export function classifyLandmarks(landmarks) {
  if (!landmarks || landmarks.length < 21) {
    return { label: "unknown", reason: "no-hand", confidence: 0, margin: 0, second: null };
  }
  const { ranked } = scoreLandmarks(landmarks);
  if (!ranked.length) {
    return { label: "unknown", reason: "unclear", confidence: 0, margin: 0, second: null };
  }
  const [best, bestScore] = ranked[0];
  const second = ranked[1] ? ranked[1][0] : null;
  const secondScore = ranked[1] ? ranked[1][1] : 0;
  const margin = bestScore - secondScore;
  if (bestScore < MIN_SCORE || margin < MIN_MARGIN) {
    return {
      label: "unknown",
      reason: "unclear",
      confidence: bestScore,
      margin,
      second: best,
    };
  }
  return { label: best, reason: "letter", confidence: bestScore, margin, second };
}
