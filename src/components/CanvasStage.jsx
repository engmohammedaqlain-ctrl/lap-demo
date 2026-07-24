/**
 * CanvasStage.jsx
 * غلاف React لـ p5.js بوضع "instance mode" — نفس منطق ورسم sketch.js الأصلي
 * حرفياً، لكن كل دوال/ثوابت p5 مسبوقة بـ p. بدل الاعتماد على النطاق العام.
 *
 * حالة المحاكاة اللحظية (العمق/السرعة/الإزاحة لكل جسم، الفقاعات) تُعدَّل هنا
 * مباشرة على stateRef.current كل إطار بلا المرور عبر actions/React state —
 * إعادة عرض DOM بمعدل ٦٠ إطار/ثانية غير مجدية لأن هذه القيم تُرسم على
 * الكانفس فقط. التغييرات الهيكلية (تبديل مادة/شكل، حذف جسم عبر السحب خارج
 * البركة، تحديد جسم فعّال) تمر عبر actions لتزامن لوحات HUD.
 */
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import p5 from "p5";
import { MATERIALS, LIQUIDS, MAX_BODIES, dampingFromViscosity } from "../data/simulationData.js";
import {
  cubeFullVolume,
  sphereFullVolume,
  cubeSubmergedVolume,
  sphereSubmergedVolume,
  calcWeight,
  calcBuoyantForce,
  stepSimulation,
} from "../physics/physics.js";
import { drawArrow, forceToArrowLength } from "../physics/forces.js";
import { SoundEngine } from "../audio/soundEngine.js";
import { activeBodyOf, CUBE_SIZE_RANGE } from "../simulation/useSimulation.js";

const REFERENCE_DIM_M = 0.55;

const CanvasStage = forwardRef(function CanvasStage({ stateRef, actions }, ref) {
  const holderRef = useRef(null);
  const p5InstanceRef = useRef(null);
  const apiRef = useRef(null);

  useImperativeHandle(ref, () => ({
    isPointInPool(clientX, clientY) {
      return apiRef.current ? apiRef.current.isPointInPool(clientX, clientY) : true;
    },
    addBodyFromDrop(materialKey, clientX) {
      if (apiRef.current) apiRef.current.addBodyFromDrop(materialKey, clientX);
    },
    relayout() {
      if (apiRef.current) apiRef.current.relayout();
    },
  }));

  useEffect(() => {
    const sketch = (p) => {
      let bubbles = [];
      let lastFrameTime = 0;
      let groundY, waterLevelY;
      let containerX, containerY, containerW, containerH;
      let poolBounds = { left: 0, top: 0, right: 0, bottom: 0 };

      function getPixelsPerMeter() {
        const poolInnerW = containerW - 24;
        const scale = (poolInnerW * 0.32) / REFERENCE_DIM_M;
        return p.constrain(scale, 70, 230);
      }
      function metersToPixels(m) {
        return m * getPixelsPerMeter();
      }

      function getReservedSpace() {
        const hudBody = document.querySelector(".hud-body");
        const dock = document.getElementById("control-dock");
        const topReserve = hudBody ? hudBody.getBoundingClientRect().bottom + 8 : 118;
        const bottomReserve = dock
          ? Math.max(8, window.innerHeight - dock.getBoundingClientRect().top + 8)
          : 132;
        return { topReserve, bottomReserve };
      }

      function layoutScene() {
        const mobile = p.width < 768;

        if (mobile) {
          const { topReserve, bottomReserve } = getReservedSpace();
          const available = Math.max(120, p.height - topReserve - bottomReserve);
          containerW = p.min(p.width * 0.92, p.width - 14);
          containerH = p.constrain(available * 0.76, 150, 560);
          containerX = (p.width - containerW) / 2;
          containerY = topReserve + (available - containerH) * 0.5;
          groundY = containerY + containerH * 0.18;
        } else {
          groundY = p.height * 0.44;
          containerW = p.min(p.width * 0.52, 620);
          containerH = p.min(p.height * 0.56, 480);
          containerX = (p.width - containerW) / 2;
          containerY = groundY - 28;
        }

        waterLevelY = containerY + containerH * 0.36;

        poolBounds = {
          left: containerX - 16,
          top: containerY - 16,
          right: containerX + containerW + 16,
          bottom: containerY + containerH + 16,
        };

        clampAllBodiesHorizontal();
      }

      /* ===== خلفية فلسطينية ===== */
      function drawLandscape() {
        p.noStroke();

        for (let y = 0; y < groundY; y += 5) {
          const t = y / groundY;
          p.fill(p.lerp(100, 160, t), p.lerp(170, 215, t), p.lerp(220, 245, t));
          p.rect(0, y, p.width, 5);
        }

        p.fill(85, 120, 65, 100);
        p.beginShape();
        p.vertex(0, groundY);
        for (let x = 0; x <= p.width; x += 30) {
          const terr = p.floor(p.sin(x * 0.012) * 3) * 4;
          p.vertex(x, groundY - 25 - p.sin(x * 0.007) * 20 + terr);
        }
        p.vertex(p.width, groundY);
        p.endShape(p.CLOSE);

        p.stroke(70, 100, 55, 60);
        p.strokeWeight(1);
        for (let i = 0; i < 4; i++) {
          const ty = groundY - 8 - i * 7;
          p.line(0, ty, p.width, ty);
        }
        p.noStroke();

        p.fill(58, 105, 48);
        p.rect(0, groundY, p.width, p.height - groundY);

        p.fill(160, 95, 60);
        p.rect(0, groundY + 16, p.width, p.height - groundY - 16);

        p.fill(215, 200, 170);
        p.rect(0, groundY + 10, p.width, 8);

        drawOliveTree(p.width * 0.08, groundY - 2, 0.9);
        drawOliveTree(p.width * 0.18, groundY - 6, 1.1);
        drawOliveTree(p.width * 0.92, groundY - 2, 0.9);
        drawOliveTree(p.width * 0.82, groundY - 6, 1.05);

        drawStoneWall(0, groundY - 2, p.width * 0.07);
        drawStoneWall(p.width * 0.93, groundY - 2, p.width * 0.07);
      }

      function drawStoneWall(x, y, w) {
        p.fill(190, 175, 150);
        p.noStroke();
        p.rect(x, y, w, 14, 2);
        p.fill(175, 160, 135);
        p.rect(x + 3, y + 3, w - 6, 4, 1);
        p.rect(x + 5, y + 9, w - 10, 3, 1);
      }

      function drawOliveTree(x, baseY, treeScale = 1) {
        p.push();
        p.translate(x, baseY);
        p.scale(treeScale);
        p.noStroke();

        p.fill(85, 60, 35);
        p.rect(-4, -50, 8, 50, 2);

        p.fill(45, 80, 38);
        p.ellipse(0, -58, 48, 34);
        p.fill(55, 95, 45);
        p.ellipse(-10, -52, 30, 24);
        p.ellipse(12, -54, 32, 26);

        p.fill(70, 90, 40);
        for (let i = 0; i < 5; i++) {
          p.circle(-8 + i * 5, -56 + (i % 2) * 4, 4);
        }
        p.pop();
      }

      function drawPoolWalls() {
        const innerBottom = containerY + containerH - 5;

        p.noStroke();
        p.fill(130, 85, 50);
        p.rect(containerX - 12, containerY - 8, containerW + 24, containerH + 18, 6);

        p.fill(220, 205, 175);
        p.rect(containerX - 5, containerY, 10, containerH);
        p.rect(containerX + containerW - 5, containerY, 10, containerH);
        p.rect(containerX, innerBottom, containerW, 10);

        p.fill(235, 220, 195);
        p.rect(containerX - 10, containerY - 7, containerW + 20, 12, 5);

        p.stroke(27, 115, 64, 40);
        p.strokeWeight(1);
        for (let i = 0; i < 8; i++) {
          const hx = containerX - 6 + i * ((containerW + 12) / 7);
          p.line(hx, containerY - 5, hx + 8, containerY - 2);
        }
        p.noStroke();
      }

      function drawGrid(alpha, fromY, toY) {
        const sp = metersToPixels(0.1);
        p.stroke(255, 255, 255, alpha);
        p.strokeWeight(1);
        const left = containerX + 5;
        const right = containerX + containerW - 5;
        for (let x = left; x <= right; x += sp) p.line(x, fromY, x, toY);
        for (let y = containerY; y <= containerY + containerH; y += sp) {
          if (y >= fromY && y <= toY) p.line(left, y, right, y);
        }
      }

      function drawLiquid() {
        const liquid = LIQUIDS[stateRef.current.liquidKey];
        p.noStroke();
        const top = waterLevelY;
        const bottom = containerY + containerH - 5;
        const left = containerX + 5;
        const w = containerW - 10;

        for (let y = top; y < bottom; y += 3) {
          const t = (y - top) / (bottom - top);
          p.fill(
            p.lerp(liquid.color[0], liquid.colorDeep[0], t),
            p.lerp(liquid.color[1], liquid.colorDeep[1], t),
            p.lerp(liquid.color[2], liquid.colorDeep[2], t),
            235
          );
          p.rect(left, y, w, 3);
        }
      }

      function drawWaterSurface() {
        const liquid = LIQUIDS[stateRef.current.liquidKey];
        const turb = p.constrain(maxAbsBodyVelocity() * 4, 0, 5);
        p.noFill();
        p.stroke(liquid.colorDeep[0], liquid.colorDeep[1], liquid.colorDeep[2], 200);
        p.strokeWeight(2);
        p.beginShape();
        for (let x = containerX + 5; x <= containerX + containerW - 5; x += 5) {
          p.vertex(x, waterLevelY + p.sin(x * 0.04 + p.frameCount * 0.03) * 1.4 + p.sin(x * 0.08) * turb * 0.3);
        }
        p.endShape();
      }

      function maxAbsBodyVelocity() {
        let m = 0;
        for (const b of stateRef.current.bodies) m = Math.max(m, Math.abs(b.velocity));
        return m;
      }

      function spawnBubbleAt(body) {
        const c = getBodyCenterPx(body);
        const sp = c.sizePx;
        bubbles.push({
          x: c.x + p.random(-sp * 0.3, sp * 0.3),
          y: waterLevelY + metersToPixels(body.depth) * 0.5,
          r: p.random(2, 4),
          vy: p.random(-35, -20),
          life: 1,
        });
        if (stateRef.current.soundEnabled && p.random() < 0.35) SoundEngine.playBubble();
      }

      function updateAndDrawBubbles(dt) {
        p.noStroke();
        for (let i = bubbles.length - 1; i >= 0; i--) {
          const b = bubbles[i];
          b.y += b.vy * dt;
          b.life -= dt * 0.7;
          if (b.life <= 0 || b.y < waterLevelY) {
            bubbles.splice(i, 1);
            continue;
          }
          p.fill(255, 255, 255, 120 * b.life);
          p.circle(b.x, b.y, b.r * 2);
        }
      }

      function getBodyCenterPx(body) {
        const sizePx = metersToPixels(body.shapeSize);
        const cx = containerX + containerW / 2 + body.offsetX;
        const depthPx = metersToPixels(body.depth);

        if (body.shapeType === "cube") {
          return { x: cx, y: waterLevelY - sizePx + depthPx + sizePx / 2, sizePx };
        }
        return { x: cx, y: waterLevelY - sizePx + depthPx, sizePx };
      }

      function drawBodies() {
        const hovered = hoveredBodyIndex();
        const state = stateRef.current;
        state.bodies.forEach((body, i) => {
          const mat = MATERIALS[body.materialKey];
          const { x, y, sizePx } = getBodyCenterPx(body);

          p.push();
          if (i === hovered || (state.isDragging && state.dragIndex === i)) {
            p.drawingContext.shadowColor = "rgba(0,0,0,0.3)";
            p.drawingContext.shadowBlur = 10;
          }
          if (body.shapeType === "cube") {
            drawMaterialCube(x, y, sizePx, mat);
          } else {
            drawMaterialSphere(x, y, sizePx, mat);
          }
          p.pop();

          if (i === state.activeIndex && state.bodies.length > 1) {
            drawActiveRing(x, y, sizePx, body.shapeType);
          }
        });
      }

      function drawActiveRing(x, y, sizePx, shapeType) {
        p.push();
        p.noFill();
        p.stroke(27, 115, 64, 235);
        p.strokeWeight(2.5);
        p.drawingContext.setLineDash([5, 4]);
        if (shapeType === "cube") {
          p.rectMode(p.CENTER);
          p.rect(x, y, sizePx + 12, sizePx + 12, 5);
        } else {
          p.circle(x, y, sizePx * 2 + 12);
        }
        p.drawingContext.setLineDash([]);
        p.pop();
      }

      function drawMaterialCube(x, y, s, mat) {
        p.rectMode(p.CENTER);
        p.fill(mat.color[0], mat.color[1], mat.color[2]);
        p.stroke(255, 255, 255, 100);
        p.strokeWeight(1.2);
        p.rect(x, y, s, s, 3);

        if (mat.pattern === "wood") {
          p.noStroke();
          p.stroke(120, 85, 55, 80);
          p.strokeWeight(0.8);
          for (let i = -2; i <= 2; i++) {
            p.line(x - s * 0.4, y + i * s * 0.12, x + s * 0.4, y + i * s * 0.12);
          }
        } else if (mat.pattern === "stone") {
          p.noStroke();
          p.fill(160, 150, 135, 100);
          p.rect(x - s * 0.15, y - s * 0.1, s * 0.2, s * 0.15, 2);
          p.rect(x + s * 0.05, y + s * 0.08, s * 0.18, s * 0.12, 2);
        }
      }

      function drawMaterialSphere(x, y, r, mat) {
        p.fill(mat.color[0], mat.color[1], mat.color[2]);
        p.stroke(255, 255, 255, 100);
        p.strokeWeight(1.2);
        p.circle(x, y, r * 2);

        p.noStroke();
        p.fill(255, 255, 255, 50);
        p.ellipse(x - r * 0.25, y - r * 0.25, r * 0.5, r * 0.35);
      }

      function drawBodiesLabels() {
        stateRef.current.bodies.forEach((body) => drawBodyLabel(body));
      }

      function drawBodyLabel(body) {
        const mat = MATERIALS[body.materialKey];
        const vol = body.shapeType === "cube" ? cubeFullVolume(body.shapeSize) : sphereFullVolume(body.shapeSize);
        const mass = mat.density * vol;
        const { x, y, sizePx } = getBodyCenterPx(body);

        const label =
          mass < 1
            ? (mass * 1000).toLocaleString("ar-EG", { maximumFractionDigits: 1 }) + " غم"
            : mass.toLocaleString("ar-EG", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " كغ";

        const labelOffset = body.shapeType === "sphere" ? sizePx + 14 : sizePx * 0.55;

        p.push();
        p.textAlign(p.CENTER, p.CENTER);
        p.textSize(10);
        p.textStyle(p.BOLD);
        const tw = p.textWidth(label);
        p.noStroke();
        p.fill(255, 252, 245, 230);
        p.rectMode(p.CENTER);
        p.rect(x, y - labelOffset, tw + 14, 18, 4);
        p.fill(30, 30, 30);
        p.text(label, x, y - labelOffset);
        p.pop();
      }

      function isPointOverBody(body, px, py) {
        const { x, y, sizePx } = getBodyCenterPx(body);
        const hit = body.shapeType === "cube" ? sizePx / 2 : sizePx;
        const pad = p.width < 768 ? 14 : 8;
        return p.dist(px, py, x, y) < hit + pad;
      }

      function hoveredBodyIndex() {
        const bodies = stateRef.current.bodies;
        for (let i = bodies.length - 1; i >= 0; i--) {
          if (isPointOverBody(bodies[i], p.mouseX, p.mouseY)) return i;
        }
        return -1;
      }

      function drawHoverHint() {
        const over = hoveredBodyIndex() >= 0 || stateRef.current.isDragging;
        p.cursor(over ? (stateRef.current.isDragging ? "grabbing" : "grab") : p.ARROW);
      }

      function drawBodiesForces() {
        const state = stateRef.current;
        if (!state.showGravity && !state.showBuoyancy) return;
        const body = activeBodyOf(state);
        if (body) drawBodyForces(body, true);
      }

      function drawBodyForces(body, showLabels) {
        const state = stateRef.current;
        const liquid = LIQUIDS[state.liquidKey];
        const mat = MATERIALS[body.materialKey];
        const vol = body.shapeType === "cube" ? cubeFullVolume(body.shapeSize) : sphereFullVolume(body.shapeSize);
        const clampedDepth = p.max(0, body.depth);
        const subVol =
          body.shapeType === "cube"
            ? cubeSubmergedVolume(clampedDepth, body.shapeSize)
            : sphereSubmergedVolume(clampedDepth, body.shapeSize);

        const weight = calcWeight(mat.density, vol);
        const buoyant = calcBuoyantForce(liquid.density, subVol);
        const { x, y, sizePx } = getBodyCenterPx(body);

        const wLen = forceToArrowLength(weight);
        const bLen = forceToArrowLength(buoyant);
        const off = p.max(14, sizePx * 0.22);
        const arrowFill = [255, 252, 245];
        const arrowOutline = [18, 52, 88];

        if (state.showGravity && wLen >= 4) {
          drawOutlinedArrow(x - off, y, x - off, y + wLen, arrowFill, arrowOutline);
          if (showLabels) drawForceLabel("الوزن", x - off, y + wLen, weight, "down");
        }
        if (state.showBuoyancy && bLen >= 4) {
          drawOutlinedArrow(x + off, y, x + off, y - bLen, arrowFill, arrowOutline);
          if (showLabels) drawForceLabel("الطفو", x + off, y - bLen, buoyant, "up");
        }
      }

      function drawOutlinedArrow(x1, y1, x2, y2, color, outline) {
        drawArrow(p, x1, y1, x2, y2, { color: outline, weight: 6, headSize: 13 });
        drawArrow(p, x1, y1, x2, y2, { color, weight: 3.5, headSize: 10 });
      }

      function drawForceLabel(name, ax, ay, val, dir) {
        const state = stateRef.current;
        p.push();
        p.rectMode(p.CENTER);
        p.textAlign(p.CENTER, p.CENTER);

        const titleSize = p.width < 768 ? 10 : 11;
        const valSize = p.width < 768 ? 8.5 : 9.5;
        const valText = state.showValues
          ? val.toLocaleString("ar-EG", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " N"
          : null;

        p.textSize(titleSize);
        p.textStyle(p.BOLD);
        const nameW = p.textWidth(name);
        p.textSize(valSize);
        p.textStyle(p.NORMAL);
        const valW = valText ? p.textWidth(valText) : 0;

        const padX = 9;
        const lineH = state.showValues ? 13 : 0;
        const boxW = p.max(nameW, valW) + padX * 2;
        const boxH = state.showValues ? 34 : 20;
        const gap = 6;
        const boxY = dir === "down" ? ay + gap + boxH / 2 : ay - gap - boxH / 2;

        p.drawingContext.shadowColor = "rgba(0, 0, 0, 0.22)";
        p.drawingContext.shadowBlur = 5;
        p.drawingContext.shadowOffsetY = 2;

        p.noStroke();
        p.fill(252, 248, 238, 248);
        p.rect(ax, boxY, boxW, boxH, 5);

        p.drawingContext.shadowColor = "transparent";

        p.stroke(18, 52, 88, 90);
        p.strokeWeight(1);
        p.noFill();
        p.rect(ax, boxY, boxW, boxH, 5);

        const accent = dir === "up" ? [27, 115, 64] : [158, 74, 58];
        p.noStroke();
        p.fill(accent[0], accent[1], accent[2]);
        p.rectMode(p.CORNER);
        p.rect(ax - boxW / 2 + 2, boxY - boxH / 2 + 3, 3, boxH - 6, 2);
        p.rectMode(p.CENTER);

        p.noStroke();
        p.fill(15, 77, 42);
        p.textStyle(p.BOLD);
        p.textSize(titleSize);
        const titleY = state.showValues ? boxY - lineH / 2 : boxY;
        p.text(name, ax + 2, titleY);

        if (state.showValues) {
          p.fill(26, 26, 26);
          p.textStyle(p.NORMAL);
          p.textSize(valSize);
          p.text(valText, ax + 2, boxY + lineH / 2);
        }
        p.pop();
      }

      function drawDepthGuide() {
        p.push();
        p.stroke(255, 255, 255, 130);
        p.strokeWeight(1);
        p.drawingContext.setLineDash([4, 4]);
        p.line(containerX + 5, waterLevelY, containerX + containerW - 5, waterLevelY);
        p.drawingContext.setLineDash([]);
        p.pop();
      }

      function horizontalLimit(body) {
        const sp = metersToPixels(body.shapeSize);
        const half = body.shapeType === "cube" ? sp / 2 : sp;
        return Math.max(0, containerW / 2 - half - 8);
      }

      function clampAllBodiesHorizontal() {
        stateRef.current.bodies.forEach((body) => {
          const limit = horizontalLimit(body);
          body.offsetX = p.constrain(body.offsetX, -limit, limit);
        });
      }

      function resolveHorizontalOverlap() {
        const state = stateRef.current;
        for (let a = 0; a < state.bodies.length; a++) {
          for (let b = a + 1; b < state.bodies.length; b++) {
            if (state.isDragging && (state.dragIndex === a || state.dragIndex === b)) continue;
            const A = state.bodies[a],
              B = state.bodies[b];
            const ca = getBodyCenterPx(A),
              cb = getBodyCenterPx(B);
            const ra = A.shapeType === "cube" ? ca.sizePx / 2 : ca.sizePx;
            const rb = B.shapeType === "cube" ? cb.sizePx / 2 : cb.sizePx;
            if (Math.abs(ca.y - cb.y) > ra + rb) continue;
            const dx = cb.x - ca.x;
            const minDx = ra + rb + 4;
            const overlap = minDx - Math.abs(dx);
            if (overlap > 0) {
              const pushPx = (overlap / 2) * (dx >= 0 ? 1 : -1);
              A.offsetX -= pushPx;
              B.offsetX += pushPx;
            }
          }
        }
        clampAllBodiesHorizontal();
      }

      function updatePhysics(dt) {
        const state = stateRef.current;
        const liquid = LIQUIDS[state.liquidKey];
        const ppm = getPixelsPerMeter();
        const floorDepth = (containerY + containerH - 5 - waterLevelY) / ppm;
        const ceiling = -(waterLevelY - containerY - 12) / ppm;
        const damping = dampingFromViscosity(liquid.viscosity);

        state.bodies.forEach((body, i) => {
          if (state.isDragging && state.dragIndex === i) return;

          body.offsetX = p.constrain(body.offsetX, -horizontalLimit(body), horizontalLimit(body));
          body.offsetXVelocity = 0;

          const mat = MATERIALS[body.materialKey];
          const sim = { type: body.shapeType, size: body.shapeSize, density: mat.density };
          const wasMoving = p.abs(body.velocity) > 0.02;

          const result = stepSimulation(sim, liquid.density, body.depth, body.velocity, dt, damping, floorDepth, ceiling);
          body.depth = result.depth;
          body.velocity = result.velocity;

          if (p.abs(body.velocity) > 0.15 && p.random() < 0.12) spawnBubbleAt(body);

          const settled = p.abs(body.velocity) < 0.015;
          if (wasMoving && settled && !body.hasSettledOnce) {
            body.hasSettledOnce = true;
            if (state.soundEnabled) SoundEngine.playSettleChime();
          }
          if (!settled) body.hasSettledOnce = false;
        });

        resolveHorizontalOverlap();
      }

      function clientToCanvas(clientX, clientY) {
        const canvas = holderRef.current ? holderRef.current.querySelector("canvas") : null;
        if (!canvas) return { x: clientX, y: clientY };
        const rect = canvas.getBoundingClientRect();
        return {
          x: (clientX - rect.left) * (p.width / rect.width),
          y: (clientY - rect.top) * (p.height / rect.height),
        };
      }

      p.setup = () => {
        const canvas = p.createCanvas(p.windowWidth, p.windowHeight);
        canvas.parent(holderRef.current);
        p.pixelDensity(Math.min(2, window.devicePixelRatio || 1));
        layoutScene();
        actions.resetAllEquilibrium();
        lastFrameTime = performance.now();

        if (document.fonts && document.fonts.ready) {
          document.fonts.ready.then(() => {
            layoutScene();
            actions.resetAllEquilibrium();
          });
        }
      };

      p.windowResized = () => {
        p.resizeCanvas(p.windowWidth, p.windowHeight);
        layoutScene();
        actions.resetAllEquilibrium();
      };

      p.draw = () => {
        const now = performance.now();
        let dt = (now - lastFrameTime) / 1000;
        dt = p.min(dt, 1 / 30);
        lastFrameTime = now;

        drawLandscape();
        updatePhysics(dt);
        drawPoolWalls();
        const state = stateRef.current;
        if (state.showDepthLines) drawGrid(50, containerY, waterLevelY);
        drawLiquid();
        if (state.showDepthLines) drawGrid(22, waterLevelY, containerY + containerH);
        updateAndDrawBubbles(dt);
        drawWaterSurface();
        drawBodies();
        drawBodiesLabels();
        drawBodiesForces();
        if (state.showDepthLines) drawDepthGuide();
        drawHoverHint();
      };

      p.mousePressed = () => {
        const i = hoveredBodyIndex();
        if (i < 0) return;
        const state = stateRef.current;
        state.isDragging = true;
        state.dragIndex = i;
        actions.setActiveIndex(i);
        const { x, y } = getBodyCenterPx(state.bodies[i]);
        state.dragOffsetX = p.mouseX - x;
        state.dragOffsetY = p.mouseY - y;
        state.bodies[i].offsetXVelocity = 0;
        state.bodies[i].velocity = 0;
        if (state.soundEnabled) SoundEngine.playClick();
      };

      p.mouseDragged = () => {
        const state = stateRef.current;
        if (!state.isDragging || state.dragIndex < 0) return;
        const body = state.bodies[state.dragIndex];
        const sp = metersToPixels(body.shapeSize);
        const baseY = waterLevelY - sp;
        const maxD = body.shapeType === "cube" ? sp : sp * 2;

        const depthPx = p.constrain(p.mouseY - state.dragOffsetY - baseY, -sp * 0.4, maxD + sp * 0.2);
        body.depth = depthPx / getPixelsPerMeter();
        body.velocity = 0;

        const cx = containerX + containerW / 2;
        const limit = horizontalLimit(body);
        body.offsetX = p.constrain(p.mouseX - state.dragOffsetX - cx, -limit, limit);
        body.offsetXVelocity = 0;
      };

      p.mouseReleased = () => {
        const state = stateRef.current;
        if (!state.isDragging || state.dragIndex < 0) {
          state.isDragging = false;
          state.dragIndex = -1;
          return;
        }
        const idx = state.dragIndex;
        const body = state.bodies[idx];

        const outside =
          p.mouseX < poolBounds.left ||
          p.mouseX > poolBounds.right ||
          p.mouseY < poolBounds.top ||
          p.mouseY > poolBounds.bottom;

        state.isDragging = false;
        state.dragIndex = -1;

        if (outside && state.bodies.length > 1) {
          if (state.soundEnabled) SoundEngine.playClick();
          actions.removeBodyAt(idx);
          return;
        }

        if (state.soundEnabled) SoundEngine.playSplash(p.constrain(Math.abs(body.depth) * 1.2, 0.2, 1));
      };

      p.touchStarted = () => {
        if (hoveredBodyIndex() >= 0) {
          p.mousePressed();
          return false;
        }
      };

      p.touchMoved = () => {
        if (stateRef.current.isDragging) {
          p.mouseDragged();
          return false;
        }
      };

      p.touchEnded = () => {
        if (stateRef.current.isDragging) {
          p.mouseReleased();
          return false;
        }
      };

      apiRef.current = {
        isPointInPool(clientX, clientY) {
          const pt = clientToCanvas(clientX, clientY);
          return (
            pt.x >= poolBounds.left && pt.x <= poolBounds.right && pt.y >= poolBounds.top && pt.y <= poolBounds.bottom
          );
        },
        addBodyFromDrop(materialKey, clientX) {
          const state = stateRef.current;
          const ref = activeBodyOf(state);
          const shapeType = ref ? ref.shapeType : "cube";
          const shapeSize = ref ? ref.shapeSize : CUBE_SIZE_RANGE.default;
          const pt = clientToCanvas(clientX, 0);
          const sp = metersToPixels(shapeSize);
          const half = shapeType === "cube" ? sp / 2 : sp;
          const limit = Math.max(0, containerW / 2 - half - 8);
          const offsetX = p.constrain(pt.x - (containerX + containerW / 2), -limit, limit);
          actions.addBody(materialKey, offsetX);
        },
        relayout() {
          layoutScene();
        },
      };
    };

    p5InstanceRef.current = new p5(sketch);

    return () => {
      p5InstanceRef.current?.remove();
      p5InstanceRef.current = null;
      apiRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div id="canvas-holder" ref={holderRef} />;
});

export default CanvasStage;
