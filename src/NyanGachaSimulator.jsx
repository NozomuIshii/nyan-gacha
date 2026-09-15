import React, { useState, useEffect, useRef, useCallback } from "react";

/* ============================================================
 *  にゃん国志 ガチャシミュレーター
 *  ------------------------------------------------------------
 *  画像を使う場合はここだけ書き換えてください。
 *    USE_IMAGES : true にすると実画像を読み込みます
 *    IMG_BASE   : キャラ画像を置いたディレクトリ（末尾スラッシュ必須）
 *    HERO_IMG   : ファーストビュー背景（見本_ガチャ画面.png）
 *  画像の読み込みに失敗した場合は自動でダミー絵にフォールバックします。
 * ============================================================ */
const USE_IMAGES = true;
const IMG_BASE_RAW = "./images/";
const IMG_BASE = IMG_BASE_RAW;
const IMG_EXT = ".webp";
const HERO_IMG = IMG_BASE_RAW + "hero.webp";
const BTN_FRAME = IMG_BASE_RAW + "btn_frame.webp";
const LOGO_IMG = IMG_BASE_RAW + "logo.webp";
const SEAL_NORMAL = IMG_BASE_RAW + "seal_normal.webp";
const SEAL_GOLD = IMG_BASE_RAW + "seal_gold.webp";
const CARD_BACK = IMG_BASE_RAW + "card_back.webp";

/* ---------- キャラクターマスタ ---------- */
/* [ 表示用ID（レア度_勢力_名前）, 実ファイル名（拡張子なし） ] */
const FILES = [
  ["SSR_魏_曹操", "ssr_gi_sousou"],
  ["R_魏_夏侯惇", "r_gi_kakouton"],
  ["R_魏_曹操", "r_gi_sousou"],
  ["R_魏_甄姫", "r_gi_shinki"],
  ["SR_魏_王元姫", "sr_gi_ougenki"],
  ["SSR_呉_太史慈", "ssr_go_taishiji"],
  ["R_呉_周瑜", "r_go_shuyu"],
  ["R_呉_小喬", "r_go_shoukyou"],
  ["R_呉_大喬", "r_go_daikyou"],
  ["SR_呉_孫権", "sr_go_sonken"],
  ["SSR_蜀_関羽", "ssr_shoku_kanu"],
  ["R_蜀_甘夫人", "r_shoku_kanfujin"],
  ["R_蜀_関羽", "r_shoku_kanu"],
  ["R_蜀_孔明", "r_shoku_koumei"],
  ["R_蜀_張飛", "r_shoku_chouhi"],
  ["SR_蜀_劉備", "sr_shoku_ryuubi"],
  ["SR_群雄_貂蝉", "sr_gunyu_chousen"],
  ["SSR_群雄_呂布", "ssr_gunyu_ryofu"],
  ["R_群雄_張梁", "r_gunyu_chouryou"],
  ["R_群雄_張角", "r_gunyu_choukaku"],
  ["R_群雄_董卓", "r_gunyu_toutaku"],
  ["R_群雄_呂氏", "r_gunyu_ryoshi"],
  ["R_群雄_呂布", "r_gunyu_ryofu"],
  ["SR_群雄_呂氏", "sr_gunyu_ryoshi"],
];

const CHARACTERS = FILES.map(([id, slug]) => {
  const [rarity, faction, name] = id.split("_");
  return { id, file: slug + IMG_EXT, card: slug + "_card" + IMG_EXT, rarity, faction, name };
});

const BY_RARITY = {
  R: CHARACTERS.filter((c) => c.rarity === "R"),
  SR: CHARACTERS.filter((c) => c.rarity === "SR"),
  SSR: CHARACTERS.filter((c) => c.rarity === "SSR"),
};

const FACTIONS = {
  魏: { ink: "#2f4d94", glow: "#7f9fe0", img: IMG_BASE_RAW + "mark_gi.webp" },
  呉: { ink: "#9e2730", glow: "#e08a86", img: IMG_BASE_RAW + "mark_go.webp" },
  蜀: { ink: "#2b6d4c", glow: "#7fc79f", img: IMG_BASE_RAW + "mark_shoku.webp" },
  群雄: { ink: "#6b5f52", glow: "#d8c8ac", img: IMG_BASE_RAW + "mark_gunyu.webp" },
};

const RARITIES = {
  R: { stars: 3, label: "R", ink: "#8fa8c4", img: IMG_BASE_RAW + "rarity_r.webp" },
  SR: { stars: 4, label: "SR", ink: "#d9b45a", img: IMG_BASE_RAW + "rarity_sr.webp" },
  SSR: { stars: 5, label: "SSR", ink: "#f2d98a", img: IMG_BASE_RAW + "rarity_ssr.webp" },
};

const ORDER = ["SSR", "SR", "R"];

/* ---------- 抽選 ---------- */
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function rollRarity(rates) {
  const r = Math.random() * 100;
  if (r < rates.SSR) return "SSR";
  if (r < rates.SSR + rates.SR) return "SR";
  return "R";
}

/* ============================================================
 *  ルート
 * ============================================================ */
export default function NyanGachaSimulator() {
  /* 設定 */
  const [ssrRate, setSsrRate] = useState(3);
  const [srRate, setSrRate] = useState(12);
  const [guarantee, setGuarantee] = useState(true);
  const [pityOn, setPityOn] = useState(true);
  const [pityMax, setPityMax] = useState(100);

  const rRate = Math.round((100 - ssrRate - srRate) * 10) / 10;
  const rateError = ssrRate + srRate > 100;
  const rates = { SSR: ssrRate, SR: srRate, R: rRate };

  /* 統計 */
  const [stats, setStats] = useState({
    total: 0,
    R: 0,
    SR: 0,
    SSR: 0,
    pity: 0,
    sinceSSR: 0,
    maxMiss: 0,
  });

  /* 進行 */
  const [phase, setPhase] = useState("idle"); // idle | summon | reveal | result
  const [results, setResults] = useState([]);
  const [index, setIndex] = useState(0);
  const [stage, setStage] = useState("flip"); // flip | shake | heavy | cutin | show
  const resultRef = useRef(null);

  /* ------- ガチャ実行 ------- */
  const draw = useCallback(
    (count) => {
      if (rateError) return;

      let pity = stats.pity;
      let sinceSSR = stats.sinceSSR;
      let maxMiss = stats.maxMiss;
      const out = [];

      for (let i = 0; i < count; i++) {
        pity += 1;
        sinceSSR += 1;
        let rarity;
        let badge = null;

        if (pityOn && pity >= pityMax) {
          rarity = "SSR";
          badge = "天井";
        } else {
          rarity = rollRarity(rates);
        }

        if (rarity === "SSR") {
          maxMiss = Math.max(maxMiss, sinceSSR - 1);
          pity = 0;
          sinceSSR = 0;
        }
        out.push({ rarity, badge });
      }

      /* 10連保証：SR以上が1枚も無ければ最後の1枚をSRに差し替え */
      if (count === 10 && guarantee && !out.some((c) => c.rarity !== "R")) {
        out[9] = { rarity: "SR", badge: "保証" };
      }

      out.forEach((c, i) => {
        c.char = pick(BY_RARITY[c.rarity]);
        c.key = Date.now() + "-" + i;
      });

      maxMiss = Math.max(maxMiss, sinceSSR);

      setStats((s) => ({
        total: s.total + count,
        R: s.R + out.filter((c) => c.rarity === "R").length,
        SR: s.SR + out.filter((c) => c.rarity === "SR").length,
        SSR: s.SSR + out.filter((c) => c.rarity === "SSR").length,
        pity,
        sinceSSR,
        maxMiss,
      }));

      setResults(out);
      setIndex(0);
      setStage("flip");
      setPhase("summon");
    },
    [rates, rateError, guarantee, pityOn, pityMax, stats]
  );

  /* ------- 演出中は背面をスクロールさせない ------- */
  useEffect(() => {
    const lock = phase === "summon" || phase === "reveal";
    document.body.style.overflow = lock ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [phase]);

  /* ------- 画像の先読み ------- */
  useEffect(() => {
    if (!USE_IMAGES) return;
    const urls = CHARACTERS.flatMap((c) => [IMG_BASE + c.file, IMG_BASE + c.card]).concat([
      SEAL_NORMAL, SEAL_GOLD, CARD_BACK,
      RARITIES.R.img, RARITIES.SR.img, RARITIES.SSR.img,
      FACTIONS["魏"].img, FACTIONS["呉"].img, FACTIONS["蜀"].img, FACTIONS["群雄"].img,
    ]);
    urls.forEach((u) => {
      const img = new window.Image();
      img.src = u;
    });
  }, []);

  /* ------- 召喚演出 → 1枚目へ ------- */
  useEffect(() => {
    if (phase !== "summon") return;
    const t = setTimeout(() => setPhase("reveal"), 1500);
    return () => clearTimeout(t);
  }, [phase]);

  /* ------- 1枚ごとの進行 ------- */
  const current = results[index];

  useEffect(() => {
    if (phase !== "reveal" || !current) return;
    let t;

    if (stage === "flip") {
      /* カードをめくろうとする。R は素通し、SR/SSR は揺れて止まる */
      t = setTimeout(() => {
        setStage(current.rarity === "R" ? "show" : "shake");
      }, 420);
    } else if (stage === "cutin") {
      t = setTimeout(() => setStage("show"), 1800);
    } else if (stage === "show") {
      const wait =
        current.rarity === "SSR" ? 2800 : current.rarity === "SR" ? 2200 : 1300;
      t = setTimeout(() => {
        if (index + 1 < results.length) {
          setIndex(index + 1);
          setStage("flip");
        } else {
          setPhase("result");
        }
      }, wait);
    }
    return () => clearTimeout(t);
  }, [phase, stage, index, current, results.length]);

  /* ------- タップ ------- */
  const handleTap = () => {
    if (phase !== "reveal" || !current) return;
    if (stage === "shake") {
      /* 金の玉璽（＝激しい揺れ）が出るのは SSR のときだけ */
      setStage(current.rarity === "SSR" ? "heavy" : "show");
    } else if (stage === "heavy") {
      setStage("cutin");
    }
  };

  const skip = () => setPhase("result");

  /* 結果までスクロール */
  useEffect(() => {
    if (phase === "result" && resultRef.current) {
      resultRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [phase]);

  const resetStats = () =>
    setStats({ total: 0, R: 0, SR: 0, SSR: 0, pity: 0, sinceSSR: 0, maxMiss: 0 });

  const busy = phase === "summon" || phase === "reveal";

  return (
    <div className="nyan">
      <style>{CSS}</style>

      <Hero
        onSingle={() => draw(1)}
        onTen={() => draw(10)}
        disabled={busy || rateError}
      />

      <main className="body">
        <Panel title="排出設定">
          <Settings
            ssrRate={ssrRate}
            srRate={srRate}
            rRate={rRate}
            setSsrRate={setSsrRate}
            setSrRate={setSrRate}
            guarantee={guarantee}
            setGuarantee={setGuarantee}
            pityOn={pityOn}
            setPityOn={setPityOn}
            pityMax={pityMax}
            setPityMax={setPityMax}
            error={rateError}
          />
        </Panel>

        <div className="draw-row">
          <button className="btn single" onClick={() => draw(1)} disabled={busy || rateError}>
            <span className="btn-jp">単発</span>
            <span className="btn-sub">1回</span>
          </button>
          <button className="btn ten" onClick={() => draw(10)} disabled={busy || rateError}>
            <span className="btn-jp">十連召喚</span>
            <span className="btn-sub">
              {guarantee ? "SR以上1枚確定" : "保証なし"}
            </span>
          </button>
        </div>
        {rateError && (
          <p className="err">SSRとSRの合計が100%を超えています。Rが0%以上になるよう下げてください。</p>
        )}

        <div ref={resultRef} />
        {phase === "result" && <ResultGrid results={results} />}

        <Panel title="統計">
          <Stats stats={stats} rates={rates} pityOn={pityOn} pityMax={pityMax} onReset={resetStats} />
        </Panel>
      </main>

      {(phase === "summon" || phase === "reveal") && (
        <Overlay
          phase={phase}
          card={current}
          stage={stage}
          index={index}
          total={results.length}
          onTap={handleTap}
          onSkip={skip}
        />
      )}
    </div>
  );
}

/* ============================================================
 *  ファーストビュー
 * ============================================================ */
function Hero({ onSingle, onTen, disabled }) {
  const [heroErr, setHeroErr] = useState(false);

  return (
    <header className="hero">
      <div className="hero-frame">
        {heroErr ? (
          <div className="hero-fallback">
            <span className="fb-title">にゃん国志</span>
            <span className="fb-copy">天下の英傑を招け！</span>
          </div>
        ) : (
          <>
            <img className="hero-photo" src={HERO_IMG} alt="にゃん国志 召喚の間" onError={() => setHeroErr(true)} />
            <img className="hero-logo" src={LOGO_IMG} alt="にゃん国志" />
          </>
        )}

      </div>

      <div className="hero-actions">
        <button className="gbtn" onClick={onSingle} disabled={disabled}>
          <span className="gbtn-label">ガチャを引く</span>
        </button>
        <button className="gbtn" onClick={onTen} disabled={disabled}>
          <span className="gbtn-label">十連召喚</span>
        </button>
      </div>
    </header>
  );
}

/* ============================================================
 *  設定
 * ============================================================ */
function Settings(props) {
  const {
    ssrRate, srRate, rRate, setSsrRate, setSrRate,
    guarantee, setGuarantee, pityOn, setPityOn, pityMax, setPityMax, error,
  } = props;

  const num = (v, min, max) => {
    const n = Number(v);
    if (Number.isNaN(n)) return min;
    return Math.min(max, Math.max(min, n));
  };

  return (
    <div className="settings">
      <div className="rate-grid">
        <label className="rate ssr">
          <span className="rate-name">SSR</span>
          <input
            type="number" min="0" max="100" step="0.1" value={ssrRate}
            onChange={(e) => setSsrRate(num(e.target.value, 0, 100))}
          />
          <span className="pct">%</span>
        </label>
        <label className="rate sr">
          <span className="rate-name">SR</span>
          <input
            type="number" min="0" max="100" step="0.1" value={srRate}
            onChange={(e) => setSrRate(num(e.target.value, 0, 100))}
          />
          <span className="pct">%</span>
        </label>
        <div className={"rate r auto" + (error ? " bad" : "")}>
          <span className="rate-name">R</span>
          <span className="auto-val">{rRate.toFixed(1)}</span>
          <span className="pct">%</span>
        </div>
      </div>

      <button
        className="ghost"
        onClick={() => { setSsrRate(3); setSrRate(12); }}
      >
        既定値に戻す（3 / 12 / 85）
      </button>

      <div className="opt-row">
        <Toggle checked={guarantee} onChange={setGuarantee} label="十連のSR以上1枚確定" />
      </div>

      <div className="opt-row">
        <Toggle checked={pityOn} onChange={setPityOn} label="天井でSSR確定" />
        <label className={"pity-input" + (pityOn ? "" : " off")}>
          <input
            type="number" min="1" max="1000" value={pityMax} disabled={!pityOn}
            onChange={(e) => setPityMax(num(e.target.value, 1, 1000))}
          />
          <span>回</span>
        </label>
      </div>
    </div>
  );
}

function Toggle({ checked, onChange, label }) {
  return (
    <button
      className={"toggle" + (checked ? " on" : "")}
      onClick={() => onChange(!checked)}
      role="switch"
      aria-checked={checked}
    >
      <span className="knob" />
      <span className="toggle-label">{label}</span>
    </button>
  );
}

/* ============================================================
 *  統計
 * ============================================================ */
function Stats({ stats, rates, pityOn, pityMax, onReset }) {
  const pct = (n) => (stats.total ? ((n / stats.total) * 100).toFixed(2) + "%" : "—");
  return (
    <div className="stats">
      <div className="stat-total">
        <span className="big">{stats.total}</span>
        <span className="unit">回</span>
      </div>
      <div className="stat-rows">
        {ORDER.map((r) => (
          <div key={r} className={"stat-row " + r}>
            <span className="s-label">{r}</span>
            <span className="s-count">{stats[r]}</span>
            <span className="s-meas">{pct(stats[r])}</span>
            <span className="s-theory">理論 {rates[r].toFixed(1)}%</span>
          </div>
        ))}
      </div>
      <div className="stat-mini">
        <div>
          <span>天井まで</span>
          <strong>{pityOn ? Math.max(0, pityMax - stats.pity) + " 回" : "—"}</strong>
        </div>
        <div>
          <span>直近SSR以降</span>
          <strong>{stats.sinceSSR} 回</strong>
        </div>
        <div>
          <span>最長ハズレ連続</span>
          <strong>{stats.maxMiss} 回</strong>
        </div>
      </div>
      <button className="ghost" onClick={onReset}>統計をリセット</button>
    </div>
  );
}

/* ============================================================
 *  結果グリッド
 * ============================================================ */
function ResultGrid({ results }) {
  return (
    <section className="result">
      <h2 className="sec-title">召喚結果</h2>
      <div className={"grid" + (results.length === 1 ? " one" : "")}>
        {results.map((c, i) => (
          <div
            className={"slot " + c.rarity}
            key={c.key}
            style={{ animationDelay: i * 70 + "ms" }}
          >
            <CardArt char={c.char} />
            <img className="slot-mark" src={FACTIONS[c.char.faction].img} alt={c.char.faction} />
            <div className="slot-label">
              <span className="slot-stars">{"★".repeat(RARITIES[c.rarity].stars)}</span>
              <span className="slot-name">{c.char.name}</span>
            </div>
            {c.badge && <span className="slot-badge">{c.badge}</span>}
          </div>
        ))}
      </div>
    </section>
  );
}

/* ============================================================
 *  演出オーバーレイ
 * ============================================================ */
function Overlay({ phase, card, stage, index, total, onTap, onSkip }) {
  const shakeClass =
    stage === "shake" ? " sh-light" : stage === "heavy" ? " sh-heavy" : "";
  const rar = card ? card.rarity : "R";
  const waiting = stage === "shake" || stage === "heavy";

  return (
    <div className="overlay" onClick={onTap}>
      <div className={"stage" + shakeClass}>
        {phase === "summon" && (
          <div className="summon">
            <div className="burst" />
            <div className="rings">
              <span /><span /><span />
            </div>
            <p className="summon-text">召喚</p>
          </div>
        )}

        {phase === "reveal" && card && (
          <>
            {stage === "flip" && (
              <div className="flipcard">
                <CardBack />
              </div>
            )}

            {waiting && (
              <div className={"waiting " + (stage === "heavy" ? "hot" : "cool")}>
                <img
                  className="seal-orb"
                  src={stage === "heavy" ? SEAL_GOLD : SEAL_NORMAL}
                  alt=""
                />
                <p className="tap-hint">{stage === "heavy" ? "…！？" : "画面をタップ"}</p>
              </div>
            )}

            {stage === "cutin" && (
              <div className="cutin">
                <div className="cutin-rays" />
                <p className="cutin-text">SSR 確定</p>
              </div>
            )}

            {stage === "show" && (
              <div className={"showcase r-" + rar}>
                <div className="aura" />
                {rar === "SSR" && <div className="rays" />}
                <div className="show-art">
                  <Art char={card.char} big />
                </div>
                <div className="show-info">
                  <img className={"rar-logo " + rar} src={RARITIES[rar].img} alt={rar} />
                  <div className="name-plate">
                    <img className="fmark" src={FACTIONS[card.char.faction].img} alt={card.char.faction} />
                    <span className="show-name">{card.char.name}</span>
                    <span className="stars">
                      {"★".repeat(RARITIES[rar].stars)}
                    </span>
                  </div>
                  {card.badge && <span className="show-badge">{card.badge}</span>}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {phase === "reveal" && (
        <div className="hud" onClick={(e) => e.stopPropagation()}>
          <span className="counter">{index + 1} / {total}</span>
          <button className="skip" onClick={onSkip}>スキップ</button>
        </div>
      )}
    </div>
  );
}

/* ============================================================
 *  アート（画像 or ダミー）
 * ============================================================ */
function Art({ char, big }) {
  const [err, setErr] = useState(!USE_IMAGES);
  if (!err) {
    return (
      <img
        className={"char-img" + (big ? " big" : "")}
        src={IMG_BASE + encodeURIComponent(char.file)}
        alt={char.name}
        onError={() => setErr(true)}
      />
    );
  }
  return <CatSVG faction={char.faction} rarity={char.rarity} />;
}

function CardArt({ char }) {
  const [err, setErr] = useState(!USE_IMAGES);
  if (!err) {
    return (
      <img
        className="slot-card"
        src={IMG_BASE + char.card}
        alt={char.name}
        onError={() => setErr(true)}
      />
    );
  }
  return (
    <div className="slot-card fallback">
      <CatSVG faction={char.faction} rarity={char.rarity} />
    </div>
  );
}

function CardBack() {
  return <img className="cardback" src={CARD_BACK} alt="" />;
}

/* ダミーの猫将軍。実画像が入るまでの代役 */
function CatSVG({ faction, rarity, stone }) {
  const f = FACTIONS[faction] || FACTIONS["群雄"];
  const fur = stone ? "#9a9187" : "#e7ded0";
  const shade = stone ? "#7d756c" : "#c9bda9";
  const gold = stone ? "#a89c86" : "#d8b158";
  const r = RARITIES[rarity] || RARITIES.R;

  return (
    <svg viewBox="0 0 300 420" className="cat">
      <defs>
        <linearGradient id={"cloak" + faction + rarity} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={f.ink} />
          <stop offset="100%" stopColor="#1b1410" />
        </linearGradient>
      </defs>

      <path
        d="M150 196 C86 206 52 286 46 420 L254 420 C248 286 214 206 150 196 Z"
        fill={"url(#cloak" + faction + rarity + ")"}
      />
      <path d="M150 240 L150 420" stroke={gold} strokeWidth="2" opacity="0.55" />
      <path d="M64 272 q86 -46 172 0 l-12 40 q-74 -36 -148 0 Z" fill={gold} opacity="0.9" />
      <path d="M96 300 q54 -22 108 0" stroke="#1b1410" strokeWidth="3" fill="none" opacity="0.35" />

      <ellipse cx="150" cy="152" rx="74" ry="68" fill={fur} />
      <path d="M92 112 L76 50 L130 94 Z" fill={fur} />
      <path d="M208 112 L224 50 L170 94 Z" fill={fur} />
      <path d="M98 108 L88 70 L122 96 Z" fill={shade} />
      <path d="M202 108 L212 70 L178 96 Z" fill={shade} />

      <ellipse cx="124" cy="152" rx="11" ry="14" fill={f.ink} />
      <ellipse cx="176" cy="152" rx="11" ry="14" fill={f.ink} />
      <ellipse cx="121" cy="147" rx="3.4" ry="4" fill="#fff" opacity="0.85" />
      <ellipse cx="173" cy="147" rx="3.4" ry="4" fill="#fff" opacity="0.85" />
      <path d="M150 180 l-9 -9 h18 Z" fill={shade} />
      <path d="M150 180 q-12 14 -24 6 M150 180 q12 14 24 6" stroke={shade} strokeWidth="2.5" fill="none" />
      <g stroke={shade} strokeWidth="1.6" opacity="0.7">
        <path d="M78 168 L34 158" /><path d="M78 178 L36 182" />
        <path d="M222 168 L266 158" /><path d="M222 178 L264 182" />
      </g>

      {r.stars >= 4 && (
        <g fill={gold}>
          <path d="M104 84 q46 -30 92 0 l-8 -26 q-38 -20 -76 0 Z" />
          <circle cx="150" cy="62" r="8" fill={f.glow} />
        </g>
      )}
      {r.stars === 5 && (
        <g fill={gold} opacity="0.95">
          <path d="M150 30 l9 18 20 3 -14 14 3 20 -18 -9 -18 9 3 -20 -14 -14 20 -3 Z" />
        </g>
      )}
    </svg>
  );
}

function Panel({ title, children }) {
  return (
    <section className="panel">
      <h2 className="sec-title">{title}</h2>
      {children}
    </section>
  );
}

/* ============================================================
 *  スタイル
 * ============================================================ */
const CSS = `
.nyan{
  --ink:#140c09;
  --ink-2:#221512;
  --crimson:#8e1b1b;
  --crimson-lt:#c0322b;
  --gold:#d8b158;
  --gold-lt:#f4e0a4;
  --jade:#3f8f6e;
  --paper:#efe4cc;
  --mincho:"Yu Mincho","YuMincho","Hiragino Mincho ProN","MS PMincho",serif;
  --gothic:"Hiragino Kaku Gothic ProN","Yu Gothic","Meiryo",sans-serif;
  background:var(--ink);
  color:var(--paper);
  font-family:var(--gothic);
  min-height:100%;
  overflow-x:hidden;
}
.nyan *{box-sizing:border-box}
.nyan button:focus-visible,.nyan input:focus-visible{outline:2px solid var(--gold-lt);outline-offset:3px}

/* ---------- HERO ---------- */
.hero{position:relative;width:100%;background:#0d0705;border-bottom:3px solid var(--gold)}
.hero-frame{
  position:relative;width:100%;
  aspect-ratio:1672/941;max-height:90vh;overflow:hidden;
}
.hero-photo{width:100%;height:100%;object-fit:cover;object-position:50% 0;display:block}
.hero-logo{
  position:absolute;top:3.5%;left:3.5%;z-index:2;
  width:min(25%,330px);height:auto;
  filter:drop-shadow(0 4px 14px rgba(0,0,0,.65));
  pointer-events:none;
}
.hero-fallback{
  width:100%;height:100%;display:flex;flex-direction:column;
  align-items:center;justify-content:center;gap:14px;
  background:radial-gradient(ellipse 60% 50% at 50% 42%,rgba(255,214,120,.35),transparent 70%),
             linear-gradient(180deg,#2b1a12,#4a2116 45%,#170d09);
  font-family:var(--mincho);
}
.fb-title{font-size:clamp(24px,4vw,44px);color:var(--paper);letter-spacing:.08em}
.fb-copy{font-size:clamp(28px,6vw,64px);color:var(--gold-lt);text-shadow:0 0 18px rgba(255,190,80,.6)}

/* 「天下の英傑を招け！」の下に置くボタン */
.hero-actions{
  position:absolute;left:50%;bottom:5%;transform:translateX(-50%);
  width:70%;max-width:860px;
  display:flex;gap:3%;
}
.gbtn{
  flex:1 1 0;min-width:0;aspect-ratio:760/238;
  border:0;padding:0;background:transparent;cursor:pointer;
  background-image:url(${BTN_FRAME});
  background-size:100% 100%;background-repeat:no-repeat;
  display:grid;place-items:center;
  filter:drop-shadow(0 6px 16px rgba(0,0,0,.55));
  transition:transform .15s ease,filter .2s ease;
}
.gbtn:hover:not(:disabled){transform:translateY(-3px);filter:drop-shadow(0 0 18px rgba(255,206,110,.7))}
.gbtn:active:not(:disabled){transform:translateY(0) scale(.985)}
.gbtn:disabled{opacity:.5;cursor:default}
.gbtn-label{
  font-family:var(--mincho);font-weight:700;
  font-size:clamp(11px,1.9vw,30px);letter-spacing:.1em;
  color:var(--gold-lt);
  text-shadow:0 2px 4px rgba(90,10,10,.9),0 0 12px rgba(255,190,80,.5);
  position:relative;top:4.7%;
  white-space:nowrap;
}

/* ---------- BODY ---------- */
.body{max-width:960px;margin:0 auto;padding:40px 18px 80px;display:flex;flex-direction:column;gap:34px}
.panel{
  background:linear-gradient(180deg,rgba(45,27,20,.9),rgba(26,15,11,.9));
  border:1px solid rgba(216,177,88,.35);border-radius:4px;padding:22px;
}
.sec-title{
  margin:0 0 18px;font-family:var(--mincho);font-weight:700;
  font-size:20px;letter-spacing:.14em;color:var(--gold-lt);
  border-left:4px solid var(--crimson-lt);padding-left:12px;
}

.settings{display:flex;flex-direction:column;gap:18px}
.rate-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.rate{
  display:flex;align-items:center;gap:8px;padding:12px 14px;
  background:rgba(0,0,0,.35);border:1px solid rgba(216,177,88,.25);border-radius:3px;
}
.rate-name{font-family:var(--mincho);font-size:15px;letter-spacing:.08em;min-width:34px}
.rate.ssr .rate-name{color:#f2d98a}
.rate.sr .rate-name{color:#d9b45a}
.rate.r .rate-name{color:#8fa8c4}
.rate input{
  flex:1;width:100%;min-width:0;background:transparent;border:0;border-bottom:1px solid rgba(216,177,88,.4);
  color:var(--paper);font-family:var(--mincho);font-size:20px;text-align:right;padding:2px 4px;
}
.auto-val{flex:1;text-align:right;font-family:var(--mincho);font-size:20px;color:rgba(239,228,204,.75)}
.rate.bad{border-color:#e05a4a}
.rate.bad .auto-val{color:#ff8a76}
.pct{font-size:12px;color:rgba(239,228,204,.6)}

.ghost{
  align-self:flex-start;background:transparent;color:rgba(239,228,204,.8);
  border:1px solid rgba(216,177,88,.4);border-radius:3px;
  padding:8px 16px;font-size:13px;cursor:pointer;transition:background .15s;
}
.ghost:hover{background:rgba(216,177,88,.12)}

.opt-row{display:flex;align-items:center;gap:14px;flex-wrap:wrap}
.toggle{
  display:flex;align-items:center;gap:10px;background:none;border:0;padding:0;
  cursor:pointer;color:var(--paper);font-size:14px;font-family:var(--gothic);
}
.toggle .knob{
  width:46px;height:24px;border-radius:12px;background:rgba(255,255,255,.16);
  border:1px solid rgba(216,177,88,.4);position:relative;transition:background .2s;flex:none;
}
.toggle .knob::after{
  content:"";position:absolute;top:2px;left:2px;width:18px;height:18px;border-radius:50%;
  background:rgba(239,228,204,.7);transition:transform .2s,background .2s;
}
.toggle.on .knob{background:rgba(192,50,43,.75)}
.toggle.on .knob::after{transform:translateX(22px);background:var(--gold-lt)}
.pity-input{display:flex;align-items:center;gap:6px;font-size:13px;color:rgba(239,228,204,.75)}
.pity-input input{
  width:74px;background:rgba(0,0,0,.35);border:1px solid rgba(216,177,88,.3);
  color:var(--paper);font-family:var(--mincho);font-size:17px;text-align:right;padding:5px 8px;border-radius:3px;
}
.pity-input.off{opacity:.4}

/* ---------- 引くボタン ---------- */
.draw-row{display:grid;grid-template-columns:1fr 1.6fr;gap:14px}
.btn{
  display:flex;flex-direction:column;align-items:center;gap:3px;
  padding:18px 10px;cursor:pointer;border-radius:4px;
  border:2px solid var(--gold);color:var(--gold-lt);font-family:var(--mincho);
  background:linear-gradient(180deg,#3a2118,#1d100c);
  transition:transform .15s,box-shadow .2s;
}
.btn:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 6px 20px rgba(216,177,88,.25)}
.btn:disabled{opacity:.4;cursor:default}
.btn.ten{background:linear-gradient(180deg,#a52222,#5e1210);box-shadow:0 0 22px rgba(192,50,43,.3)}
.btn-jp{font-size:22px;letter-spacing:.14em;font-weight:700}
.btn-sub{font-size:11px;font-family:var(--gothic);color:rgba(239,228,204,.7);letter-spacing:.04em}
.err{margin:0;color:#ff8a76;font-size:13px}

/* ---------- 結果グリッド ---------- */
.result{display:flex;flex-direction:column;gap:16px}
.grid{display:grid;grid-template-columns:repeat(5,1fr);gap:10px}
.grid.one{grid-template-columns:minmax(0,190px);justify-content:center}
.slot{
  position:relative;aspect-ratio:520/690;
  animation:flipIn .5s cubic-bezier(.2,.7,.3,1) backwards;
}
@keyframes flipIn{
  from{transform:scaleX(.1);opacity:0}
  to{transform:scaleX(1);opacity:1}
}
.slot-card{display:block;width:100%;height:100%;object-fit:contain}
.slot-card.fallback{display:grid;place-items:center;background:linear-gradient(180deg,#2c1a13,#150c09);
  border:2px solid rgba(216,177,88,.4);border-radius:4px;overflow:hidden}
.slot-card.fallback .cat{width:100%;height:100%}

/* SSR はカードの周囲が光る */
.slot.SR .slot-card{filter:drop-shadow(0 0 6px rgba(190,120,255,.55))}
.slot.SSR .slot-card{animation:ssrGlow 1.9s ease-in-out infinite}
@keyframes ssrGlow{
  0%,100%{filter:drop-shadow(0 0 6px rgba(255,205,90,.85)) drop-shadow(0 0 16px rgba(255,150,40,.5))}
  50%{filter:drop-shadow(0 0 14px rgba(255,225,140,1)) drop-shadow(0 0 38px rgba(255,160,45,.85))}
}

/* 軍マーク（カード右上） */
.slot-mark{position:absolute;top:6%;right:6%;width:19%;height:auto;
  filter:drop-shadow(0 2px 5px rgba(0,0,0,.75))}

/* 下部の帯に星と名前 */
.slot-label{
  position:absolute;left:8%;right:8%;bottom:4.2%;
  display:flex;flex-direction:column;align-items:center;gap:1px;
  text-align:center;pointer-events:none;
}
.slot-stars{
  color:#ffd561;line-height:1;letter-spacing:.04em;
  font-size:clamp(8px,1.35vw,15px);
  text-shadow:0 1px 2px rgba(0,0,0,.9),0 0 6px rgba(255,180,60,.8);
}
.slot-name{
  font-family:var(--mincho);font-weight:700;
  font-size:clamp(10px,1.7vw,19px);letter-spacing:.04em;
  color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;
  text-shadow:0 2px 4px rgba(0,0,0,.95),0 0 8px rgba(0,0,0,.8);
}
.slot-badge{
  position:absolute;top:6%;left:6%;font-size:10px;padding:2px 6px;border-radius:2px;
  background:var(--crimson-lt);color:#fff;font-family:var(--mincho);font-weight:700;letter-spacing:.06em;
  box-shadow:0 2px 6px rgba(0,0,0,.6);
}

/* ---------- 統計 ---------- */
.stats{display:flex;flex-direction:column;gap:16px}
.stat-total{display:flex;align-items:baseline;gap:6px;font-family:var(--mincho)}
.stat-total .big{font-size:44px;color:var(--gold-lt);line-height:1}
.stat-total .unit{font-size:15px;color:rgba(239,228,204,.65)}
.stat-rows{display:flex;flex-direction:column;gap:8px}
.stat-row{
  display:grid;grid-template-columns:52px 1fr 84px 92px;align-items:center;gap:8px;
  padding:9px 12px;background:rgba(0,0,0,.3);border-left:3px solid rgba(216,177,88,.35);
}
.stat-row.SSR{border-left-color:#f2d98a}
.stat-row.SR{border-left-color:#d9b45a}
.stat-row.R{border-left-color:#8fa8c4}
.s-label{font-family:var(--mincho);font-size:15px;font-weight:700}
.stat-row.SSR .s-label{color:#f2d98a}
.stat-row.SR .s-label{color:#d9b45a}
.stat-row.R .s-label{color:#8fa8c4}
.s-count{font-family:var(--mincho);font-size:19px}
.s-meas{text-align:right;font-family:var(--mincho);font-size:16px;color:var(--paper)}
.s-theory{text-align:right;font-size:11px;color:rgba(239,228,204,.5)}
.stat-mini{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.stat-mini div{display:flex;flex-direction:column;gap:3px;padding:10px;background:rgba(0,0,0,.25)}
.stat-mini span{font-size:11px;color:rgba(239,228,204,.55)}
.stat-mini strong{font-family:var(--mincho);font-size:18px;font-weight:400;color:var(--gold-lt)}

/* ---------- オーバーレイ ---------- */
.overlay{
  position:fixed;inset:0;z-index:50;background:#070403;
  display:grid;place-items:center;overflow:hidden;cursor:pointer;
  animation:fadeIn .3s ease;
}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
.stage{position:relative;width:100%;height:100%;display:grid;place-items:center}
.stage.sh-light{animation:shakeL .42s ease-in-out infinite}
.stage.sh-heavy{animation:shakeH .11s linear infinite}
@keyframes shakeL{
  0%,100%{transform:translate(0,0) rotate(0)}
  25%{transform:translate(-5px,3px) rotate(-.4deg)}
  75%{transform:translate(5px,-3px) rotate(.4deg)}
}
@keyframes shakeH{
  0%{transform:translate(-14px,9px) rotate(-1.3deg) scale(1.02)}
  25%{transform:translate(13px,-11px) rotate(1.1deg) scale(1.03)}
  50%{transform:translate(-11px,-8px) rotate(.9deg) scale(1.02)}
  75%{transform:translate(15px,10px) rotate(-1deg) scale(1.03)}
  100%{transform:translate(-14px,9px) rotate(-1.3deg) scale(1.02)}
}

.summon{display:grid;place-items:center;position:relative}
.burst{
  position:absolute;width:40vmax;height:40vmax;border-radius:50%;
  background:radial-gradient(circle,rgba(255,226,150,.95),rgba(255,150,40,.35) 40%,transparent 70%);
  animation:burst 1.5s cubic-bezier(.15,.7,.3,1) forwards;
}
@keyframes burst{0%{transform:scale(.05);opacity:0}30%{opacity:1}100%{transform:scale(1.6);opacity:0}}
.rings span{
  position:absolute;top:50%;left:50%;width:14vmax;height:14vmax;margin:-7vmax 0 0 -7vmax;
  border:2px solid rgba(255,214,120,.8);border-radius:50%;
  animation:ring 1.5s ease-out forwards;
}
.rings span:nth-child(2){animation-delay:.25s}
.rings span:nth-child(3){animation-delay:.5s}
@keyframes ring{0%{transform:scale(.2);opacity:1}100%{transform:scale(3.4);opacity:0}}
.summon-text{
  position:relative;font-family:var(--mincho);font-weight:700;font-size:clamp(40px,9vw,96px);
  color:var(--gold-lt);letter-spacing:.4em;text-indent:.4em;
  text-shadow:0 0 30px rgba(255,190,80,.9);
  animation:summonText 1.5s ease-out forwards;
}
@keyframes summonText{0%{opacity:0;transform:scale(1.6)}40%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(.94)}}

.flipcard{animation:cardPop .42s ease-out}
.cardback{
  display:block;width:auto;height:clamp(190px,42vh,360px);
  filter:drop-shadow(0 0 26px rgba(216,177,88,.65));
}
@keyframes cardPop{0%{transform:rotateY(-90deg) scale(.8);opacity:0}100%{transform:rotateY(0) scale(1);opacity:1}}

.waiting{display:grid;place-items:center;gap:26px}
.seal-orb{
  width:clamp(130px,26vh,230px);height:auto;display:block;
  filter:drop-shadow(0 0 26px rgba(255,214,120,.6));
}
.waiting.cool .seal-orb{animation:pulseCool 1.1s ease-in-out infinite}
.waiting.hot .seal-orb{
  filter:drop-shadow(0 0 60px rgba(255,200,70,.95));
  animation:pulseHot .3s ease-in-out infinite;
}
@keyframes pulseCool{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}
@keyframes pulseHot{0%,100%{transform:scale(1.02)}50%{transform:scale(1.14)}}
.tap-hint{
  margin:0;font-family:var(--mincho);font-weight:700;letter-spacing:.3em;text-indent:.3em;
  font-size:clamp(15px,2.4vw,22px);color:var(--gold-lt);animation:blink 1.1s ease-in-out infinite;
}
@keyframes blink{0%,100%{opacity:.35}50%{opacity:1}}

.cutin{position:relative;display:grid;place-items:center;width:100%;height:100%;overflow:hidden}
.cutin-rays{
  position:absolute;width:200vmax;height:200vmax;
  background:repeating-conic-gradient(from 0deg,rgba(255,214,120,.6) 0deg 4deg,transparent 4deg 12deg);
  animation:spin 5s linear infinite;
}
@keyframes spin{to{transform:rotate(360deg)}}
.cutin-text{
  position:relative;font-family:var(--mincho);font-weight:700;
  font-size:clamp(46px,11vw,130px);letter-spacing:.06em;
  color:#fff;
  text-shadow:0 0 24px rgba(255,180,40,1),0 0 60px rgba(255,80,20,.9),0 6px 0 #8e1b1b;
  animation:cutinIn .5s cubic-bezier(.1,.9,.2,1);
}
@keyframes cutinIn{0%{transform:scale(2.4) skewX(-16deg);opacity:0}60%{transform:scale(.94)}100%{transform:scale(1);opacity:1}}

.showcase{
  position:absolute;inset:0;overflow:hidden;
  display:flex;flex-direction:column;align-items:center;justify-content:flex-end;
  gap:clamp(6px,1.6vh,18px);
  padding:clamp(44px,7vh,72px) clamp(10px,3vw,36px) clamp(14px,4vh,48px);
  animation:showIn .45s ease-out;
}
@keyframes showIn{from{opacity:0}to{opacity:1}}
.showcase .aura{position:absolute;width:120vmax;height:120vmax;border-radius:50%;
  left:50%;top:50%;transform:translate(-50%,-50%)}
.showcase.r-R .aura{background:radial-gradient(circle,rgba(140,180,225,.35),transparent 58%)}
.showcase.r-SR .aura{background:radial-gradient(circle,rgba(230,190,110,.5),transparent 60%)}
.showcase.r-SSR .aura{
  background:radial-gradient(circle,rgba(255,235,170,.75),rgba(200,60,40,.35) 42%,transparent 68%);
  animation:auraPulse 2.4s ease-in-out infinite;
}
@keyframes auraPulse{
  0%,100%{transform:translate(-50%,-50%) scale(1)}
  50%{transform:translate(-50%,-50%) scale(1.08)}
}
.showcase .rays{
  position:absolute;left:50%;top:50%;width:200vmax;height:200vmax;opacity:.45;
  background:repeating-conic-gradient(from 0deg,rgba(255,226,150,.5) 0deg 3deg,transparent 3deg 14deg);
  animation:spinC 18s linear infinite;
}
@keyframes spinC{
  from{transform:translate(-50%,-50%) rotate(0)}
  to{transform:translate(-50%,-50%) rotate(360deg)}
}
/* 立ち絵は残りの高さに収める。min-height:0 が無いと縮まずに情報欄を押し出す */
.show-art{
  position:relative;flex:1 1 auto;min-height:0;width:100%;
  display:flex;align-items:center;justify-content:center;
  animation:artRise .6s cubic-bezier(.15,.8,.3,1);
}
@keyframes artRise{from{transform:translateY(40px) scale(.94);opacity:0}to{transform:none;opacity:1}}
.show-art .cat,.show-art .char-img{
  max-height:100%;max-width:min(86vw,620px);height:auto;width:auto;
  object-fit:contain;
  filter:drop-shadow(0 18px 40px rgba(0,0,0,.75));
}
.show-art .cat{aspect-ratio:300/420}
/* 情報欄は縮まない */
.show-info{
  position:relative;flex:0 0 auto;z-index:2;
  align-self:flex-start;margin-left:clamp(4px,4vw,60px);
  display:flex;flex-direction:column;gap:8px;align-items:flex-start;
}
/* 縦の狭い画面ではレア度と名前を横に並べて高さを節約する */
@media (max-height:860px){
  .show-info{flex-direction:row;align-items:flex-end;gap:clamp(10px,2vw,24px)}
  .rar-logo{height:clamp(30px,6.4vh,74px)}
  .fmark{height:clamp(24px,4.4vh,44px)}
}
.rar-logo{
  display:block;width:auto;height:clamp(44px,11vh,120px);
  filter:drop-shadow(0 4px 10px rgba(0,0,0,.7));
}
.rar-logo.SR{filter:drop-shadow(0 4px 10px rgba(0,0,0,.7)) drop-shadow(0 0 18px rgba(190,120,255,.6))}
.rar-logo.SSR{animation:logoGlow 1.6s ease-in-out infinite}
@keyframes logoGlow{
  0%,100%{filter:drop-shadow(0 4px 10px rgba(0,0,0,.7)) drop-shadow(0 0 16px rgba(255,190,60,.7))}
  50%{filter:drop-shadow(0 4px 10px rgba(0,0,0,.7)) drop-shadow(0 0 42px rgba(255,170,40,1))}
}
.fmark{width:auto;height:clamp(30px,5vh,54px);flex:none;
  filter:drop-shadow(0 2px 6px rgba(0,0,0,.6))}
.name-plate{display:flex;align-items:center;gap:10px;flex-wrap:wrap;
  background:rgba(8,4,3,.72);padding:7px 16px;border-left:3px solid var(--gold)}
.show-name{font-family:var(--mincho);font-weight:700;font-size:clamp(22px,3.4vh,44px);letter-spacing:.1em;color:var(--paper)}
.stars{font-weight:700;color:var(--gold-lt);font-size:clamp(13px,1.8vh,20px);letter-spacing:.1em}
.show-badge{
  font-family:var(--mincho);font-weight:700;font-size:13px;letter-spacing:.12em;
  background:var(--crimson-lt);color:#fff;padding:3px 12px;
}

.hud{position:fixed;top:0;left:0;right:0;display:flex;justify-content:space-between;
  align-items:center;padding:14px 18px;z-index:60;cursor:default}
.counter{font-family:var(--mincho);font-weight:700;font-size:16px;color:rgba(239,228,204,.75);letter-spacing:.1em}
.skip{
  background:rgba(8,4,3,.7);color:var(--gold-lt);border:1px solid rgba(216,177,88,.5);
  border-radius:3px;padding:8px 20px;font-family:var(--mincho);font-weight:700;font-size:14px;
  letter-spacing:.12em;cursor:pointer;
}
.skip:hover{background:rgba(216,177,88,.2)}

/* ---------- レスポンシブ ---------- */
@media (max-width:640px){
  /* 縦画面では絵を切らず、ボタンを画像の下に置く */
  .hero-actions{
    position:static;transform:none;
    width:88%;margin:16px auto 20px;
    flex-direction:column;gap:12px;
  }
  .gbtn-label{font-size:clamp(15px,4.8vw,24px)}
  .hero-logo{width:37%;top:1.5%;left:2%}
  .rate-grid{grid-template-columns:1fr}
  .draw-row{grid-template-columns:1fr}
  .grid{gap:6px}
  .grid{gap:5px}
  .slot-label{left:6%;right:6%;bottom:3.6%}
  .slot-stars{font-size:7px}
  .slot-name{font-size:9px}
  .slot-mark{width:22%}
  .stat-row{grid-template-columns:40px 1fr 70px;row-gap:2px}
  .s-theory{grid-column:3;text-align:right}
  .stat-mini{grid-template-columns:1fr}
  .show-info{left:4%;bottom:6%}
}

@media (prefers-reduced-motion:reduce){
  .nyan *{animation-duration:.01ms !important;animation-iteration-count:1 !important;
    transition-duration:.01ms !important}
}
`;
