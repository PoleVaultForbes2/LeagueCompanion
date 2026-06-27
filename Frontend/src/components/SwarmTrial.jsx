// Runs the canvas-based Swarm trial demo used from the mission travel flow.
import { useEffect, useRef, useState } from "react";

const TOTAL_MINIONS = 100;
const MINIONS_PER_CORNER_PER_WAVE = 5;
const MINIONS_PER_CORNER = 25;
const WAVE_INTERVAL_MS = 10000;
const BASIC_COOLDOWN_MS = 3000;
const ITEM_COOLDOWN_MS = 20000;

const AATROX_SPRITE = "/assets/champion%20spries/aatorxSprite.png";
const MINION_SPRITE = "/assets/champion%20spries/minionSprite.png";
const GOREDRINKER_ICON = "/assets/items/goredrinker.png";
const ARENA_BACKGROUND = "/assets/scenes/shurmia1.png";

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function distanceBetween(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function angleDifference(a, b) {
  return Math.atan2(Math.sin(a - b), Math.cos(a - b));
}

function loadImage(src) {
  const image = new Image();
  image.src = src;
  return image;
}

function drawCenteredImage(ctx, image, x, y, width, height, shouldFlip = false) {
  if (!image?.complete || image.naturalWidth === 0) {
    return false;
  }

  ctx.save();
  ctx.translate(x, y);

  if (shouldFlip) {
    ctx.scale(-1, 1);
  }

  ctx.drawImage(image, -width / 2, -height / 2, width, height);
  ctx.restore();
  return true;
}

function drawCooldownArc(ctx, x, y, radius, ratio, color) {
  ctx.beginPath();
  ctx.arc(x, y, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ratio);
  ctx.strokeStyle = color;
  ctx.lineWidth = 5;
  ctx.stroke();
}

export default function SwarmTrial({ mission, onExit }) {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const gameRef = useRef(null);
  const phaseRef = useRef("playing");
  const [phase, setPhase] = useState("playing");
  const [snapshot, setSnapshot] = useState({
    basicCooldown: 0,
    hp: 320,
    itemCooldown: 0,
    killed: 0,
    spawned: 0,
  });

  function setGamePhase(nextPhase) {
    phaseRef.current = nextPhase;
    setPhase(nextPhase);
  }

  useEffect(() => {
    if (!mission) {
      return undefined;
    }

    const canvas = canvasRef.current;

    if (!canvas) {
      return undefined;
    }

    const ctx = canvas.getContext("2d");
    const images = {
      background: loadImage(ARENA_BACKGROUND),
      champion: loadImage(AATROX_SPRITE),
      minion: loadImage(MINION_SPRITE),
    };
    const keys = new Set();

    let nextMinionId = 1;
    let snapshotTimer = 0;

    const game = {
      dimensions: { width: 960, height: 540, dpr: 1 },
      effects: [],
      keys,
      lastFrameAt: performance.now(),
      lastWaveAt: performance.now() - WAVE_INTERVAL_MS,
      minions: [],
      perCornerSpawned: [0, 0, 0, 0],
      player: {
        x: 480,
        y: 270,
        radius: 28,
        hp: 320,
        maxHp: 320,
        speed: 260,
        facing: 0,
      },
      pointer: { x: 480, y: 270 },
      spawned: 0,
      killed: 0,
      lastBasicAt: -BASIC_COOLDOWN_MS,
      lastItemAt: -ITEM_COOLDOWN_MS,
    };

    gameRef.current = game;
    setGamePhase("playing");

    function resizeCanvas() {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const width = Math.max(640, rect.width || 960);
      const height = Math.max(420, rect.height || 540);

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      game.dimensions = { width, height, dpr };
      game.player.x = clamp(game.player.x, 40, width - 40);
      game.player.y = clamp(game.player.y, 40, height - 40);
    }

    function getPointerPosition(event) {
      const rect = canvas.getBoundingClientRect();

      return {
        x: clamp(event.clientX - rect.left, 0, game.dimensions.width),
        y: clamp(event.clientY - rect.top, 0, game.dimensions.height),
      };
    }

    function spawnWave(now) {
      if (game.spawned >= TOTAL_MINIONS) {
        return;
      }

      const { width, height } = game.dimensions;
      const corners = [
        { x: 34, y: 34 },
        { x: width - 34, y: 34 },
        { x: 34, y: height - 34 },
        { x: width - 34, y: height - 34 },
      ];

      corners.forEach((corner, cornerIndex) => {
        for (
          let index = 0;
          index < MINIONS_PER_CORNER_PER_WAVE &&
          game.perCornerSpawned[cornerIndex] < MINIONS_PER_CORNER &&
          game.spawned < TOTAL_MINIONS;
          index += 1
        ) {
          const offset = 20 + index * 12;
          const jitterX = corner.x < width / 2 ? offset : -offset;
          const jitterY = corner.y < height / 2 ? offset : -offset;

          game.minions.push({
            id: nextMinionId,
            x: corner.x + jitterX + (Math.random() - 0.5) * 16,
            y: corner.y + jitterY + (Math.random() - 0.5) * 16,
            hp: 42,
            maxHp: 42,
            radius: 17,
            speed: 72 + Math.random() * 18,
          });

          nextMinionId += 1;
          game.perCornerSpawned[cornerIndex] += 1;
          game.spawned += 1;
        }
      });

      game.lastWaveAt = now;
      game.effects.push({
        type: "wave",
        age: 0,
        duration: 700,
      });
    }

    function damageMinion(minion, amount) {
      const damage = Math.min(minion.hp, amount);
      minion.hp -= amount;
      return damage;
    }

    function removeDeadMinions() {
      const living = [];

      game.minions.forEach((minion) => {
        if (minion.hp <= 0) {
          game.killed += 1;
          game.effects.push({
            type: "hit",
            x: minion.x,
            y: minion.y,
            age: 0,
            duration: 360,
          });
        } else {
          living.push(minion);
        }
      });

      game.minions = living;
    }

    function performBasicAttack(now) {
      if (now - game.lastBasicAt < BASIC_COOLDOWN_MS) {
        return;
      }

      const player = game.player;
      const attackAngle = Math.atan2(
        game.pointer.y - player.y,
        game.pointer.x - player.x,
      );
      const range = 142;
      const halfArc = Math.PI / 3.2;

      game.lastBasicAt = now;
      player.facing = attackAngle;

      game.minions.forEach((minion) => {
        const angleToMinion = Math.atan2(minion.y - player.y, minion.x - player.x);
        const distance = distanceBetween(player, minion);

        if (
          distance <= range &&
          Math.abs(angleDifference(angleToMinion, attackAngle)) <= halfArc
        ) {
          damageMinion(minion, 56);
        }
      });

      game.effects.push({
        type: "slash",
        x: player.x,
        y: player.y,
        angle: attackAngle,
        age: 0,
        duration: 260,
      });
      removeDeadMinions();
    }

    function performGoredrinker(now) {
      if (now - game.lastItemAt < ITEM_COOLDOWN_MS) {
        return;
      }

      const player = game.player;
      const radius = 138;
      let totalDamage = 0;

      game.lastItemAt = now;

      game.minions.forEach((minion) => {
        if (distanceBetween(player, minion) <= radius + minion.radius) {
          totalDamage += damageMinion(minion, 64);
        }
      });

      if (totalDamage > 0) {
        player.hp = clamp(player.hp + totalDamage, 0, player.maxHp);
      }

      game.effects.push({
        type: "goredrinker",
        x: player.x,
        y: player.y,
        heal: totalDamage,
        age: 0,
        duration: 520,
      });
      removeDeadMinions();
    }

    function handlePointerMove(event) {
      game.pointer = getPointerPosition(event);
    }

    function handlePointerDown(event) {
      if (event.button !== 0 || phaseRef.current !== "playing") {
        return;
      }

      event.preventDefault();
      canvas.focus();
      game.pointer = getPointerPosition(event);

      if (event.shiftKey) {
        performGoredrinker(performance.now());
      } else {
        performBasicAttack(performance.now());
      }
    }

    function handleKeyDown(event) {
      const key = event.key.toLowerCase();

      if (["w", "a", "s", "d", "shift", "escape"].includes(key)) {
        event.preventDefault();
      }

      if (key === "escape") {
        setGamePhase(phaseRef.current === "paused" ? "playing" : "paused");
        return;
      }

      keys.add(key);
    }

    function handleKeyUp(event) {
      keys.delete(event.key.toLowerCase());
    }

    function update(now, deltaSeconds) {
      if (phaseRef.current !== "playing") {
        return;
      }

      const player = game.player;
      const moveX = (keys.has("d") ? 1 : 0) - (keys.has("a") ? 1 : 0);
      const moveY = (keys.has("s") ? 1 : 0) - (keys.has("w") ? 1 : 0);
      const moveLength = Math.hypot(moveX, moveY) || 1;

      if (moveX !== 0 || moveY !== 0) {
        player.x += (moveX / moveLength) * player.speed * deltaSeconds;
        player.y += (moveY / moveLength) * player.speed * deltaSeconds;
        player.facing = Math.atan2(moveY, moveX);
      }

      player.x = clamp(player.x, player.radius, game.dimensions.width - player.radius);
      player.y = clamp(player.y, player.radius, game.dimensions.height - player.radius);

      if (
        game.spawned < TOTAL_MINIONS &&
        now - game.lastWaveAt >= WAVE_INTERVAL_MS
      ) {
        spawnWave(now);
      }

      game.minions.forEach((minion) => {
        const distance = distanceBetween(minion, player);
        const dx = player.x - minion.x;
        const dy = player.y - minion.y;

        if (distance > minion.radius + player.radius + 2) {
          minion.x += (dx / distance) * minion.speed * deltaSeconds;
          minion.y += (dy / distance) * minion.speed * deltaSeconds;
        } else {
          player.hp -= 4.2 * deltaSeconds;
        }
      });

      game.effects = game.effects
        .map((effect) => ({ ...effect, age: effect.age + deltaSeconds * 1000 }))
        .filter((effect) => effect.age < effect.duration);

      if (player.hp <= 0) {
        player.hp = 0;
        setGamePhase("defeat");
      } else if (game.killed >= TOTAL_MINIONS) {
        setGamePhase("complete");
      }
    }

    function drawBackground() {
      const { width, height } = game.dimensions;

      if (images.background.complete && images.background.naturalWidth > 0) {
        const scale = Math.max(
          width / images.background.naturalWidth,
          height / images.background.naturalHeight,
        );
        const drawWidth = images.background.naturalWidth * scale;
        const drawHeight = images.background.naturalHeight * scale;

        ctx.drawImage(
          images.background,
          (width - drawWidth) / 2,
          (height - drawHeight) / 2,
          drawWidth,
          drawHeight,
        );
      } else {
        ctx.fillStyle = "#111827";
        ctx.fillRect(0, 0, width, height);
      }

      ctx.fillStyle = "rgba(2, 6, 23, 0.54)";
      ctx.fillRect(0, 0, width, height);

      const portals = [
        [34, 34],
        [width - 34, 34],
        [34, height - 34],
        [width - 34, height - 34],
      ];

      portals.forEach(([x, y]) => {
        const gradient = ctx.createRadialGradient(x, y, 6, x, y, 60);
        gradient.addColorStop(0, "rgba(248, 113, 113, 0.65)");
        gradient.addColorStop(1, "rgba(248, 113, 113, 0)");
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, 60, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    function drawEffects() {
      game.effects.forEach((effect) => {
        const progress = clamp(effect.age / effect.duration, 0, 1);

        if (effect.type === "slash") {
          ctx.save();
          ctx.translate(effect.x, effect.y);
          ctx.rotate(effect.angle);
          ctx.globalAlpha = 1 - progress;
          ctx.fillStyle = "rgba(248, 113, 113, 0.36)";
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.arc(0, 0, 150, -Math.PI / 3.2, Math.PI / 3.2);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = "rgba(254, 202, 202, 0.9)";
          ctx.lineWidth = 4;
          ctx.stroke();
          ctx.restore();
        }

        if (effect.type === "goredrinker") {
          ctx.save();
          ctx.globalAlpha = 1 - progress;
          ctx.strokeStyle = "rgba(190, 18, 60, 0.95)";
          ctx.lineWidth = 10;
          ctx.beginPath();
          ctx.arc(effect.x, effect.y, 60 + progress * 90, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = "rgba(244, 63, 94, 0.16)";
          ctx.beginPath();
          ctx.arc(effect.x, effect.y, 138, 0, Math.PI * 2);
          ctx.fill();

          if (effect.heal > 0) {
            ctx.fillStyle = "rgba(187, 247, 208, 0.9)";
            ctx.font = "700 18px system-ui";
            ctx.fillText(
              `+${Math.round(effect.heal)}`,
              effect.x - 18,
              effect.y - 78 - progress * 22,
            );
          }

          ctx.restore();
        }

        if (effect.type === "hit") {
          ctx.save();
          ctx.globalAlpha = 1 - progress;
          ctx.fillStyle = "rgba(251, 191, 36, 0.7)";
          ctx.beginPath();
          ctx.arc(effect.x, effect.y, 9 + progress * 20, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      });
    }

    function drawMinions() {
      game.minions.forEach((minion) => {
        const drewImage = drawCenteredImage(
          ctx,
          images.minion,
          minion.x,
          minion.y,
          42,
          42,
          minion.x > game.player.x,
        );

        if (!drewImage) {
          ctx.fillStyle = "#9f1239";
          ctx.beginPath();
          ctx.arc(minion.x, minion.y, minion.radius, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
        ctx.fillRect(minion.x - 17, minion.y - 29, 34, 4);
        ctx.fillStyle = "#f97316";
        ctx.fillRect(
          minion.x - 17,
          minion.y - 29,
          34 * clamp(minion.hp / minion.maxHp, 0, 1),
          4,
        );
      });
    }

    function drawPlayer(now) {
      const player = game.player;
      const basicRatio = clamp((now - game.lastBasicAt) / BASIC_COOLDOWN_MS, 0, 1);
      const itemRatio = clamp((now - game.lastItemAt) / ITEM_COOLDOWN_MS, 0, 1);
      const drewImage = drawCenteredImage(
        ctx,
        images.champion,
        player.x,
        player.y,
        78,
        78,
        Math.cos(player.facing) < 0,
      );

      if (!drewImage) {
        ctx.fillStyle = "#991b1b";
        ctx.beginPath();
        ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.save();
      ctx.translate(player.x, player.y);
      ctx.rotate(player.facing);
      ctx.strokeStyle = "rgba(226, 232, 240, 0.7)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(22, 0);
      ctx.lineTo(50, 0);
      ctx.stroke();
      ctx.restore();

      drawCooldownArc(ctx, player.x - 28, player.y + 42, 10, basicRatio, "#67e8f9");
      drawCooldownArc(ctx, player.x + 28, player.y + 42, 10, itemRatio, "#fb7185");
    }

    function draw(now) {
      const { width, height, dpr } = game.dimensions;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      drawBackground();
      drawEffects();
      drawMinions();
      drawPlayer(now);

      if (phaseRef.current === "paused") {
        ctx.fillStyle = "rgba(2, 6, 23, 0.42)";
        ctx.fillRect(0, 0, width, height);
      }
    }

    function frame(now) {
      const deltaSeconds = Math.min((now - game.lastFrameAt) / 1000, 0.05);
      game.lastFrameAt = now;

      update(now, deltaSeconds);
      draw(now);

      if (now - snapshotTimer > 120) {
        snapshotTimer = now;
        setSnapshot({
          basicCooldown: Math.max(0, BASIC_COOLDOWN_MS - (now - game.lastBasicAt)),
          hp: Math.round(game.player.hp),
          itemCooldown: Math.max(0, ITEM_COOLDOWN_MS - (now - game.lastItemAt)),
          killed: game.killed,
          spawned: game.spawned,
        });
      }

      animationRef.current = window.requestAnimationFrame(frame);
    }

    resizeCanvas();
    canvas.focus();
    window.addEventListener("resize", resizeCanvas);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    canvas.addEventListener("pointermove", handlePointerMove);
    canvas.addEventListener("pointerdown", handlePointerDown);
    animationRef.current = window.requestAnimationFrame(frame);

    return () => {
      window.cancelAnimationFrame(animationRef.current);
      window.removeEventListener("resize", resizeCanvas);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      canvas.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("pointerdown", handlePointerDown);
      gameRef.current = null;
    };
  }, [mission]);

  if (!mission) {
    return null;
  }

  const hpPercent = clamp((snapshot.hp / 320) * 100, 0, 100);
  const basicSeconds = Math.ceil(snapshot.basicCooldown / 1000);
  const itemSeconds = Math.ceil(snapshot.itemCooldown / 1000);
  const isPaused = phase === "paused";
  const isComplete = phase === "complete";
  const isDefeat = phase === "defeat";

  return (
    <div className="fixed inset-0 z-[70] bg-slate-950 text-slate-100">
      <canvas
        aria-label="Swarm trial arena"
        className="h-full min-h-screen w-full cursor-crosshair outline-none"
        ref={canvasRef}
        tabIndex={0}
      />

      <div className="pointer-events-none absolute left-4 right-4 top-4 flex flex-col gap-3 sm:left-6 sm:right-6 sm:flex-row sm:items-start sm:justify-between">
        <section className="pointer-events-auto rounded border border-cyan-300/25 bg-slate-950/85 p-3 shadow-xl shadow-slate-950">
          <p className="text-xs font-black uppercase tracking-widest text-cyan-200">
            Swarm Trial
          </p>
          <p className="mt-1 text-xl font-black text-slate-50">
            Aatrox + Goredrinker
          </p>
          <div className="mt-3 h-3 w-56 overflow-hidden rounded bg-slate-800">
            <div
              className="h-full rounded bg-emerald-300 transition-[width]"
              style={{ width: `${hpPercent}%` }}
            />
          </div>
          <p className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-400">
            HP {snapshot.hp} / 320
          </p>
        </section>

        <section className="pointer-events-auto grid gap-2 rounded border border-slate-700 bg-slate-950/85 p-3 text-right shadow-xl shadow-slate-950 sm:min-w-52">
          <p className="text-xs font-black uppercase tracking-widest text-slate-400">
            Minions
          </p>
          <p className="text-2xl font-black text-slate-50">
            {snapshot.killed} / {TOTAL_MINIONS}
          </p>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Spawned {snapshot.spawned} / {TOTAL_MINIONS}
          </p>
        </section>
      </div>

      <div className="pointer-events-none absolute bottom-4 left-4 flex gap-3 sm:bottom-6 sm:left-6">
        <div className="rounded border border-cyan-300/25 bg-slate-950/85 p-3 shadow-xl shadow-slate-950">
          <p className="text-xs font-black uppercase tracking-widest text-cyan-200">
            Slash
          </p>
          <p className="mt-1 text-lg font-black text-slate-50">
            {basicSeconds > 0 ? `${basicSeconds}s` : "Ready"}
          </p>
        </div>
        <div className="flex items-center gap-3 rounded border border-rose-300/25 bg-slate-950/85 p-3 shadow-xl shadow-slate-950">
          <img alt="" className="h-10 w-10 object-contain" src={GOREDRINKER_ICON} />
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-rose-200">
              Goredrinker
            </p>
            <p className="mt-1 text-lg font-black text-slate-50">
              {itemSeconds > 0 ? `${itemSeconds}s` : "Ready"}
            </p>
          </div>
        </div>
      </div>

      {isPaused && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/70 px-4 backdrop-blur-sm">
          <section className="w-full max-w-sm rounded-lg border border-cyan-300/35 bg-slate-950 p-5 text-center shadow-2xl shadow-cyan-950/40">
            <h2 className="text-3xl font-black tracking-normal text-slate-50">
              Paused
            </h2>
            <div className="mt-6 grid gap-3">
              <button
                className="h-12 rounded bg-cyan-300 px-5 text-sm font-black uppercase tracking-wide text-slate-950 transition hover:bg-cyan-200"
                onClick={() => setGamePhase("playing")}
                type="button"
              >
                Resume
              </button>
              <button
                className="h-12 rounded border border-slate-700 bg-slate-900 px-5 text-sm font-black uppercase tracking-wide text-slate-300 transition hover:border-rose-300/60 hover:text-rose-200"
                onClick={onExit}
                type="button"
              >
                Exit to Home
              </button>
            </div>
          </section>
        </div>
      )}

      {(isComplete || isDefeat) && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/75 px-4 backdrop-blur-sm">
          <section className="w-full max-w-xl rounded-lg border border-amber-300/35 bg-slate-950 p-5 shadow-2xl shadow-amber-950/40 sm:p-6">
            <p className="text-xs font-black uppercase tracking-widest text-amber-200">
              {isComplete ? "Mission Finished" : "Trial Failed"}
            </p>
            <h2 className="mt-2 text-3xl font-black tracking-normal text-slate-50">
              {isComplete ? "Rewards Acquired" : "Recovered From The Sands"}
            </h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded border border-emerald-300/25 bg-emerald-500/10 p-4">
                <p className="text-xs font-bold uppercase tracking-widest text-emerald-200">
                  Minions Defeated
                </p>
                <p className="mt-2 text-3xl font-black text-emerald-100">
                  {snapshot.killed}
                </p>
              </div>
              <div className="rounded border border-amber-300/25 bg-amber-500/10 p-4">
                <p className="text-xs font-bold uppercase tracking-widest text-amber-200">
                  Demo Reward
                </p>
                <p className="mt-2 text-lg font-black text-amber-100">
                  +100 Swarm Trial Score
                </p>
              </div>
            </div>
            <button
              className="mt-6 h-12 w-full rounded bg-amber-400 px-5 text-sm font-black uppercase tracking-wide text-slate-950 transition hover:bg-amber-300"
              onClick={onExit}
              type="button"
            >
              Go Back Home
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
