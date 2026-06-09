/**
 * generateQuoteCard.js  — ES module (type: "module")
 * npm install @napi-rs/canvas
 */

// Dynamic import handles both @napi-rs/canvas and canvas fallback
let createCanvas;
try {
  const mod = await import('@napi-rs/canvas');
  createCanvas = mod.createCanvas;
} catch {
  const mod = await import('canvas');
  createCanvas = mod.createCanvas;
}

const CAT_COLOR = {
  motivation:'#F59E0B', mindset:'#818CF8',   discipline:'#34D399',
  success:   '#A78BFA', resilience:'#FB923C', persistence:'#38BDF8',
  belief:    '#C084FC', action:'#86EFAC',     growth:'#2DD4BF',
  determination:'#F87171', inspiration:'#7DD3FC',
  gospel:    '#FCD34D', afrobeat:'#10B981',   rnb:'#EC4899',
  hiphop:    '#8B5CF6', pop:'#06B6D4',        soul:'#F97316',
};

const CAT_LABEL = {
  motivation:'🔥 Motivation', mindset:'🧠 Mindset',    discipline:'⚡ Discipline',
  success:   '🏆 Success',   resilience:'💪 Resilience', persistence:'🎯 Persistence',
  belief:    '🌟 Belief',    action:'⚡ Action',          growth:'🌱 Growth',
  determination:'🔑 Determination', inspiration:'✨ Inspiration',
  gospel:    '🙏 Gospel',    afrobeat:'🎵 Afrobeat',     rnb:'💿 R&B',
  hiphop:    '🎤 Hip-Hop',   pop:'🎶 Pop',               soul:'🎸 Soul',
};

const hexRgb = (hex) => {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
};

const wrapText = (ctx, text, maxWidth) => {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
};

export const generateQuoteCard = async ({ text, author, category }) => {
  const W = 1200, H = 630;
  const canvas = createCanvas(W, H);
  const ctx    = canvas.getContext('2d');

  const accent  = CAT_COLOR[category?.toLowerCase()] ?? '#818CF8';
  const [r,g,b] = hexRgb(accent);
  const label   = CAT_LABEL[category?.toLowerCase()] ?? category ?? '';

  // Background
  ctx.fillStyle = '#141924';
  ctx.fillRect(0, 0, W, H);

  // Radial ambient glow
  const glow = ctx.createRadialGradient(W*0.15, H*0.25, 0, W*0.15, H*0.25, W*0.5);
  glow.addColorStop(0, `rgba(${r},${g},${b},0.12)`);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Top accent strip
  const strip = ctx.createLinearGradient(0, 0, W, 0);
  strip.addColorStop(0,    `rgba(${r},${g},${b},0.60)`);
  strip.addColorStop(0.55, `rgba(${r},${g},${b},0.13)`);
  strip.addColorStop(1,    'rgba(0,0,0,0)');
  ctx.fillStyle = strip;
  ctx.fillRect(0, 0, W, 3);

  // Category pill
  const pillFont = 'bold 22px sans-serif';
  ctx.font = pillFont;
  const pillW = ctx.measureText(label).width + 34;
  const pillH = 38, pillX = 60, pillY = 46, pillR = 19;
  ctx.beginPath();
  ctx.roundRect(pillX, pillY, pillW, pillH, pillR);
  ctx.fillStyle = `rgba(${r},${g},${b},0.14)`;
  ctx.fill();
  ctx.font         = pillFont;
  ctx.fillStyle    = accent;
  ctx.textBaseline = 'middle';
  ctx.fillText(label, pillX + 17, pillY + pillH / 2);

  // Decorative quote mark
  ctx.font         = 'bold 160px serif';
  ctx.fillStyle    = `rgba(${r},${g},${b},0.09)`;
  ctx.textBaseline = 'top';
  ctx.fillText('"', 52, 108);

  // Quote text
  const maxW   = W - 140;
  let   textY  = 210;
  let   fontSz = 46;

  ctx.font         = `500 ${fontSz}px sans-serif`;
  ctx.fillStyle    = 'rgba(232,234,240,0.88)';
  ctx.textBaseline = 'top';

  let lines = wrapText(ctx, text, maxW);

  if (lines.length > 6) {
    fontSz = 36;
    ctx.font = `500 ${fontSz}px sans-serif`;
    lines    = wrapText(ctx, text, maxW);
    textY    = 185;
  }

  const lineH = fontSz * 1.45;
  lines.forEach((line, i) => ctx.fillText(line, 70, textY + i * lineH));

  // Author line
  const authorY = textY + lines.length * lineH + 40;
  ctx.fillStyle  = accent;
  ctx.fillRect(70, authorY, 3, 30);
  ctx.font         = 'bold 26px sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText(`— ${author}`, 86, authorY + 15);

  // Bottom divider
  const divY = H - 58;
  const divG = ctx.createLinearGradient(0, 0, W, 0);
  divG.addColorStop(0,   'rgba(255,255,255,0)');
  divG.addColorStop(0.3, 'rgba(255,255,255,0.07)');
  divG.addColorStop(1,   'rgba(255,255,255,0)');
  ctx.fillStyle = divG;
  ctx.fillRect(60, divY, W - 120, 1);

  // Brand watermark
  ctx.font         = '400 20px sans-serif';
  ctx.fillStyle    = 'rgba(255,255,255,0.18)';
  ctx.textBaseline = 'middle';
  ctx.textAlign    = 'right';
  ctx.fillText('damuchi.app', W - 60, divY + 28);

  return canvas.toBuffer('image/png');
};