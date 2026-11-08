import assert from "node:assert/strict";
import test from "node:test";
import { LETTERS, classifyLandmarks, scoreLandmarks } from "./classify.js";

function point(x, y, z = 0) {
  return { x, y, z };
}

function finger(mcpX, extension) {
  const mcp = point(mcpX, -1);
  if (extension > 0.75) {
    return [mcp, point(mcpX, -1.45), point(mcpX, -1.8), point(mcpX, -2.15)];
  }
  if (extension > 0.4) {
    return [mcp, point(mcpX, -1.25), point(mcpX + 0.02, -1.4), point(mcpX + 0.08, -1.35)];
  }
  return [mcp, point(mcpX, -1.25), point(mcpX, -1.05), point(mcpX, -0.85)];
}

function thumb(style, indexTip) {
  const cmc = point(-0.35, -0.25);
  const mcp = point(-0.55, -0.45);
  if (style === "out") return [cmc, mcp, point(-0.95, -0.35), point(-1.25, -0.15)];
  if (style === "across") return [cmc, mcp, point(-0.2, -0.75), point(0.2, -0.9)];
  if (style === "tuck") return [cmc, mcp, point(-0.2, -0.55), point(-0.05, -0.7)];
  if (style === "pinch") {
    return [cmc, mcp, point(indexTip.x + 0.02, indexTip.y + 0.02), { ...indexTip }];
  }
  return [cmc, mcp, point(-0.85, -0.7), point(-0.7, -1.05)];
}

function build(spec) {
  const landmarks = Array(21);
  landmarks[0] = point(0, 0);
  const xs = spec.xs || [-0.28, -0.08, 0.12, 0.32];
  const bases = [5, 9, 13, 17];
  spec.exts.forEach((extension, index) => {
    finger(xs[index], extension).forEach((joint, jointIndex) => {
      landmarks[bases[index] + jointIndex] = joint;
    });
  });
  thumb(spec.thumb, landmarks[8]).forEach((joint, index) => {
    landmarks[index + 1] = joint;
  });
  return landmarks;
}

const POSES = {
  A: { exts: [0, 0, 0, 0], thumb: "out" },
  B: { exts: [1, 1, 1, 1], thumb: "across", xs: [-0.18, -0.06, 0.06, 0.18] },
  C: { exts: [0.5, 0.5, 0.5, 0.5], thumb: "c" },
  D: { exts: [1, 0, 0, 0], thumb: "across" },
  F: { exts: [0, 1, 1, 1], thumb: "pinch" },
  I: { exts: [0, 0, 0, 1], thumb: "tuck" },
  L: { exts: [1, 0, 0, 0], thumb: "out" },
  V: { exts: [1, 1, 0, 0], thumb: "tuck", xs: [-0.42, 0.16, 0.28, 0.4] },
  W: { exts: [1, 1, 1, 0], thumb: "tuck", xs: [-0.4, -0.08, 0.24, 0.4] },
  Y: { exts: [0, 0, 0, 1], thumb: "out" },
};

function describe(landmarks) {
  const { ranked } = scoreLandmarks(landmarks);
  return ranked
    .slice(0, 3)
    .map(([letter, score]) => `${letter}:${score.toFixed(2)}`)
    .join(" ");
}

for (const letter of LETTERS) {
  test(`classifies a clear ${letter}`, () => {
    const landmarks = build(POSES[letter]);
    const result = classifyLandmarks(landmarks);
    assert.equal(
      result.label,
      letter,
      `saw ${result.label} (${result.reason}) from ${describe(landmarks)}`,
    );
  });
}

test("an open palm is not a letter", () => {
  const landmarks = build({
    exts: [1, 1, 1, 1],
    thumb: "out",
    xs: [-0.42, -0.14, 0.14, 0.42],
  });
  const result = classifyLandmarks(landmarks);
  assert.equal(result.label, "unknown", describe(landmarks));
});

test("a closed fist with the thumb tucked is not A", () => {
  const landmarks = build({ exts: [0, 0, 0, 0], thumb: "tuck" });
  const result = classifyLandmarks(landmarks);
  assert.equal(result.label, "unknown", describe(landmarks));
});

test("rotation, translation, and mirror do not change L", () => {
  const radians = 0.7;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const moved = build(POSES.L).map((joint) => {
    const x = joint.x;
    const y = joint.y;
    return { x: -(x * cos - y * sin) + 3, y: x * sin + y * cos - 2, z: 0.01 };
  });
  assert.equal(classifyLandmarks(moved).label, "L", describe(moved));
});

test("missing landmarks are not a letter", () => {
  assert.equal(classifyLandmarks(null).reason, "no-hand");
  assert.equal(classifyLandmarks([]).label, "unknown");
});
