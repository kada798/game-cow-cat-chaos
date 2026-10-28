const sharp = require(process.env.SHARP_MODULE || 'sharp');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const manifest = {
  version: 1,
  style: 'charcoal-and-colored-pencil',
  coordinates: 'pixels from the top-left of each exported canvas',
  catCanvas: { width: 512, height: 512, anchor: [256, 448], headWidth: 112 },
  assets: {},
  layerGroups: {},
  sources: ['cats-rest.png', 'cats-actions.png', 'furniture.png', 'dad.png', 'room.png'].map(name => `source/${name}`)
};

// Separate connected alpha silhouettes, not equal cells: generated tails can cross grid lines.
async function silhouettes(name, count, columns) {
  const { data, info } = await sharp(path.join(root, 'source', name)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const labels = new Int32Array(width * height);
  const queue = new Int32Array(width * height);
  const components = [];
  for (let start = 0; start < labels.length; start++) {
    if (labels[start] || data[start * 4 + 3] < 12) continue;
    const id = components.length + 1;
    let head = 0, tail = 1, minX = width, minY = height, maxX = 0, maxY = 0, sumX = 0, sumY = 0;
    queue[0] = start;
    labels[start] = id;
    while (head < tail) {
      const p = queue[head++], x = p % width, y = Math.floor(p / width);
      minX = Math.min(minX, x); minY = Math.min(minY, y);
      maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
      sumX += x; sumY += y;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        const n = ny * width + nx;
        if (!labels[n] && data[n * 4 + 3] >= 12) { labels[n] = id; queue[tail++] = n; }
      }
    }
    components.push({ id, count: tail, minX, minY, maxX, maxY, cx: sumX / tail, cy: sumY / tail });
  }
  const selected = components.sort((a, b) => b.count - a.count).slice(0, count);
  assert.equal(selected.length, count);
  assert(selected.every(c => c.count > 4000), `${name}: missing silhouette`);
  selected.sort((a, b) => {
    const rowA = columns === count ? 0 : Math.floor(a.cy / (height / 2));
    const rowB = columns === count ? 0 : Math.floor(b.cy / (height / 2));
    return rowA - rowB || a.cx - b.cx;
  });
  const owners = new Map(selected.map((c, index) => [c.id, index]));
  const results = selected.map(c => {
    const left = Math.max(0, c.minX - 12), top = Math.max(0, c.minY - 12);
    const w = Math.min(width, c.maxX + 13) - left, h = Math.min(height, c.maxY + 13) - top;
    return { ...c, left, top, width: w, height: h, data: Buffer.alloc(w * h * 4) };
  });
  for (let p = 0; p < labels.length; p++) {
    if (!data[p * 4 + 3]) continue;
    const x = p % width, y = Math.floor(p / width);
    let owner = owners.get(labels[p]);
    if (owner === undefined) {
      let distance = Infinity;
      selected.forEach((c, index) => {
        const dx = Math.max(c.minX - x, 0, x - c.maxX), dy = Math.max(c.minY - y, 0, y - c.maxY);
        const d = dx * dx + dy * dy + ((x - c.cx) ** 2 + (y - c.cy) ** 2) * 0.00001;
        if (d < distance) { distance = d; owner = index; }
      });
      if (distance > 144) continue;
    }
    const out = results[owner], ox = x - out.left, oy = y - out.top;
    if (ox >= 0 && oy >= 0 && ox < out.width && oy < out.height) data.copy(out.data, (oy * out.width + ox) * 4, p * 4, p * 4 + 4);
  }
  console.log(name, JSON.stringify(results.map(({ minX, minY, maxX, maxY, count }) => ({ minX, minY, maxX, maxY, count }))));
  return results;
}

async function rawImage(buffer) {
  return sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
}

async function place(object, width, height, scale, sourceAnchor, anchor) {
  const w = Math.round(object.width * scale), h = Math.round(object.height * scale);
  const x = Math.round(anchor[0] + (object.left - sourceAnchor[0]) * scale);
  const y = Math.round(anchor[1] + (object.top - sourceAnchor[1]) * scale);
  assert(x >= 0 && y >= 0 && x + w <= width && y + h <= height, `Clipped placement: ${JSON.stringify({ x, y, w, h, width, height })}`);
  const sprite = await sharp(object.data, { raw: { width: object.width, height: object.height, channels: 4 } }).resize(w, h).png().toBuffer();
  const png = await sharp({ create: { width, height, channels: 4, background: '#00000000' } }).composite([{ input: sprite, left: x, top: y }]).png().toBuffer();
  return { png, map: (px, py) => [Math.round(x + (px - object.left) * w / object.width), Math.round(y + (py - object.top) * h / object.height)], inverse: (px, py) => [object.left + (px - x) * object.width / w, object.top + (py - y) * object.height / h] };
}

async function emit(id, file, png, extra = {}) {
  const destination = path.join(root, file);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(destination, png);
  const { data, info } = await rawImage(png);
  let left = info.width, top = info.height, right = 0, bottom = 0, visible = 0, clear = 0;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    const a = data[(y * info.width + x) * 4 + 3];
    if (!a) clear++;
    if (a > 12) { left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y); visible++; }
  }
  assert(visible > 100, `${id}: blank export`);
  if (!extra.opaque) assert(clear > info.width * info.height * 0.05, `${id}: missing transparency`);
  manifest.assets[id] = { file, width: info.width, height: info.height, bounds: [left, top, right + 1, bottom + 1], ...extra };
}

function polygonContains(x, y, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i], [xj, yj] = points[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

async function splitLayers(id, placed, predicate, anchors) {
  const { data, info } = await rawImage(placed.png);
  const back = Buffer.alloc(data.length), front = Buffer.alloc(data.length);
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    const [sx, sy] = placed.inverse(x, y);
    const target = predicate(sx, sy) ? front : back;
    const p = (y * info.width + x) * 4;
    data.copy(target, p, p, p + 4);
  }
  const encode = buffer => sharp(buffer, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
  const backPng = await encode(back), frontPng = await encode(front);
  await emit(`${id}-back`, `props/${id}-back.png`, backPng, { group: id, z: 10, ...anchors });
  await emit(`${id}-front`, `props/${id}-front.png`, frontPng, { group: id, z: 30, ...anchors });
  await emit(`${id}-complete`, `props/${id}-complete.png`, placed.png, { previewOnly: true, ...anchors });
  const combined = await rawImage(await sharp(backPng).composite([{ input: frontPng }]).png().toBuffer());
  let maxAlphaDifference = 0, maxColorDifference = 0;
  for (let p = 0; p < data.length; p += 4) {
    maxAlphaDifference = Math.max(maxAlphaDifference, Math.abs(data[p + 3] - combined.data[p + 3]));
    if (data[p + 3] > 20) for (let c = 0; c < 3; c++) maxColorDifference = Math.max(maxColorDifference, Math.abs(data[p + c] - combined.data[p + c]));
  }
  assert(maxAlphaDifference <= 1 && maxColorDifference <= 2, `${id}: layers do not reconstruct the original`);
  manifest.layerGroups[id] = { layers: [`${id}-back`, `${id}-front`], preview: `${id}-complete`, actorZ: 20, registration: 'identical canvas and anchor; do not trim layers individually', maxAlphaDifference, maxColorDifference };
}

async function main() {
  const rest = await silhouettes('cats-rest.png', 6, 3);
  const actions = await silhouettes('cats-actions.png', 6, 3);
  const catSpecs = [
    ['sit', rest[0], 190, 250], ['stand', rest[1], 163, 780],
    ['loaf', rest[2], 184, 1300], ['sleep', rest[3], 210, 230],
    ['stretch', rest[4], 163, 745], ['recline', rest[5], 185, 1270],
    ['crouch', actions[0], 196, 280], ['peek', actions[1], 235, 780],
    ['paw-raised', actions[2], 182, 1320], ['carry-collar', actions[3], 130, 280],
    ['walk', actions[4], 145, 800], ['drape', actions[5], 155, 1235]
  ];
  for (const [name, object, headWidth, supportX] of catSpecs) {
    const placed = await place(object, 512, 512, 112 / headWidth, [supportX, object.maxY + 1], [256, 448]);
    const extra = { anchor: [256, 448], headWidth: 112, sourceHeadWidth: headWidth, source: rest.includes(object) ? 'source/cats-rest.png' : 'source/cats-actions.png', anchorKind: 'ground-contact' };
    if (name === 'drape') { extra.surfaceAnchor = placed.map(1290, 785); extra.anchorKind = 'dangling-paw-baseline'; }
    await emit(`cat-${name}`, `cats/cat-${name}.png`, placed.png, extra);
  }

  const furniture = await silhouettes('furniture.png', 4, 2);
  const fitted = async (object, width, height, padding, floor) => {
    const scale = Math.min((width - padding * 2) / object.width, (floor - padding) / object.height);
    return place(object, width, height, scale, [(object.minX + object.maxX) / 2, object.maxY + 1], [width / 2, floor]);
  };
  const sofa = await fitted(furniture[0], 1024, 640, 48, 576);
  const bedObject = (await silhouettes('cat-bed.png', 1, 1))[0];
  const bed = await fitted(bedObject, 1024, 640, 48, 576);
  await splitLayers('cat-bed', bed, (x, y) => polygonContains(x, y,
    [[20, 510], [200, 615], [615, 690], [690, 762], [1120, 753], [1215, 640], [1430, 565], [1510, 480], [1536, 1024], [0, 1024]]),
    { anchor: [512, 576], mattressAnchor: bed.map(780, 650), source: 'source/cat-bed.png' });
  const bearObject = (await silhouettes('white-teddy.png', 1, 1))[0];
  const bear = await fitted(bearObject, 768, 512, 32, 448);
  await emit('white-teddy', 'props/white-teddy.png', bear.png, {
    anchor: [384, 448], faceAnchor: bear.map(420, 380), source: 'source/white-teddy.png'
  });
  const bearRaw = await rawImage(bear.png);
  const bearPieces = [Buffer.alloc(bearRaw.data.length), Buffer.alloc(bearRaw.data.length)];
  for (let y = 0; y < bearRaw.info.height; y++) for (let x = 0; x < bearRaw.info.width; x++) {
    const [sx, sy] = bear.inverse(x, y);
    const head = ((sx - 430) / 330) ** 2 + ((sy - 350) / 330) ** 2 <= 1;
    const offset = (y * bearRaw.info.width + x) * 4;
    bearRaw.data.copy(bearPieces[head ? 1 : 0], offset, offset, offset + 4);
  }
  for (const [i, id] of ['white-teddy-body', 'white-teddy-head'].entries()) {
    const png = await sharp(bearPieces[i], { raw: { width: 768, height: 512, channels: 4 } }).png().toBuffer();
    await emit(id, 'props/' + id + '.png', png, { group: 'white-teddy', anchor: [384, 448], faceAnchor: bear.map(430, 350), source: 'source/white-teddy.png' });
  }
  manifest.layerGroups['white-teddy'] = { layers: ['white-teddy-body', 'white-teddy-head'], preview: 'white-teddy', registration: 'shared canvas; head compression follows paw pressure' };
  for (const id of ['dad-crouch', 'girl-kneel']) {
    const object = (await silhouettes(id + '.png', 1, 1))[0];
    const pose = await fitted(object, 768, 1024, 32, 960);
    await emit(id, 'characters/' + id + '.png', pose.png, { anchor: [384, 960], anchorKind: 'floor-contact', source: 'source/' + id + '.png' });
  }
  for (const id of ['cat-knead', 'cat-frozen']) {
    const object = (await silhouettes(id + '.png', 1, 1))[0];
    const pose = await place(object, 512, 512, 112 / 400, [780, 1150], [256, 448]);
    const anchors = { anchor: [256, 448], headWidth: 112, sourceHeadWidth: 400, source: 'source/' + id + '.png', anchorKind: 'registered-knead-support' };
    await emit(id, 'cats/' + id + '.png', pose.png, anchors);
    if (id === 'cat-knead') {
      const { data, info } = await rawImage(pose.png);
      const pieces = [Buffer.alloc(data.length), Buffer.alloc(data.length), Buffer.alloc(data.length)];
      for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
        const [sx, sy] = pose.inverse(x, y);
        const owner = polygonContains(sx, sy, [[0,670],[220,650],[320,720],[210,790],[0,820]]) ? 1
          : polygonContains(sx, sy, [[140,825],[300,770],[480,805],[500,860],[340,935],[150,940]]) ? 2 : 0;
        const offset = (y * info.width + x) * 4;
        data.copy(pieces[owner], offset, offset, offset + 4);
      }
      const layers = ['knead-body', 'knead-paw-far', 'knead-paw-near'];
      for (let i = 0; i < layers.length; i++) {
        const png = await sharp(pieces[i], { raw: { width: 512, height: 512, channels: 4 } }).png().toBuffer();
        await emit(layers[i], 'cats/' + layers[i] + '.png', png, { ...anchors, group: id, catPart: true });
      }
      manifest.layerGroups[id] = { layers, preview: id, registration: 'shared 512 canvas and anchor; only paw layers move during kneading' };
    }
  }
  manifest.sources.push(...['cat-bed', 'white-teddy', 'dad-crouch', 'girl-kneel', 'cat-knead', 'cat-frozen'].map(id => 'source/' + id + '.png'));
  const sofaAnchors = { anchor: [512, 576], seatAnchor: sofa.map(440, 320), perchAnchor: sofa.map(440, 128), underGapAnchor: sofa.map(440, 467) };
  await splitLayers('sofa', sofa, (x, y) => y >= 376
    || polygonContains(x, y, [[33, 254], [103, 245], [103, 442], [33, 442]])
    || polygonContains(x, y, [[708, 250], [758, 209], [839, 209], [839, 424], [781, 450], [708, 450]]), sofaAnchors);

  const wardrobe = await fitted(furniture[1], 768, 1024, 48, 928);
  const wardrobeAnchors = { anchor: [384, 928], hingeAnchor: wardrobe.map(1051, 263), shelfAnchor: wardrobe.map(1190, 470) };
  await splitLayers('wardrobe', wardrobe, (x, y) => x <= 1053 && (x < 1040 || y >= 49 && y <= 477), wardrobeAnchors);
  manifest.layerGroups.wardrobe.note = 'Front is the open door; animate about hingeAnchor. Do not mirror the entire group.';

  const television = await fitted(furniture[2], 1024, 768, 48, 704);
  await emit('television', 'props/television.png', television.png, { anchor: [512, 704], screenCenter: television.map(447, 680) });
  const collar = await fitted(furniture[3], 512, 512, 40, 448);
  await emit('fur-collar', 'props/fur-collar.png', collar.png, { anchor: [256, 448], gripAnchor: collar.map(1150, 565) });

  const dads = await silhouettes('dad.png', 2, 2);
  for (let i = 0; i < dads.length; i++) {
    const seat = i === 0 ? [637, 682] : [1384, 684];
    const placed = await place(dads[i], 768, 1024, 0.9, seat, [600, 640]);
    await emit(`dad-${i === 0 ? 'watch' : 'surprised'}`, `characters/dad-${i === 0 ? 'watch' : 'surprised'}.png`, placed.png, { anchor: [600, 640], anchorKind: 'seat-contact', headAnchor: placed.map(i === 0 ? 552 : 1288, 64) });
  }
  const ambush = await silhouettes('ambush.png', 2, 2);
  for (const id of ['dad-bald-watch', 'dad-bald-react']) {
    const png = await sharp(path.join(root, 'source', id + '.png')).resize(768, 1024, { fit: 'fill' }).png().toBuffer();
    await emit(id, 'characters/' + id + '.png', png, {
      anchor: [600, 640], headAnchor: [551, 115], anchorKind: 'seat-contact', source: 'source/' + id + '.png'
    });
    manifest.sources.push('source/' + id + '.png');
  }
  const mouse = (await silhouettes('windup-mouse.png', 1, 1))[0];
  const mousePose = await fitted(mouse, 512, 256, 20, 224);
  await emit('windup-mouse', 'props/windup-mouse.png', mousePose.png, {
    anchor: [365, 224], anchorKind: 'body-ground-contact', source: 'source/windup-mouse.png'
  });
  manifest.sources.push('source/windup-mouse.png');
  const foot = await fitted(ambush[0], 256, 384, 16, 340);
  await emit('sock-foot', 'props/sock-foot.png', foot.png, { anchor: foot.map(280, ambush[0].maxY + 1), anchorKind: 'toe-contact' });
  const pounce = await place(ambush[1], 512, 512, 112 / 266, [1240, ambush[1].maxY + 1], [256, 448]);
  await emit('cat-pounce', 'cats/cat-pounce.png', pounce.png, { anchor: [256, 448], headWidth: 112, anchorKind: 'ground-projection', source: 'source/ambush.png' });
  manifest.sources.push('source/ambush.png');
  const lowCat = await silhouettes('cat-under-sofa.png', 1, 1);
  const lowPose = await place(lowCat[0], 512, 512, 112 / 550, [550, 740], [256, 448]);
  await emit('cat-under-sofa', 'cats/cat-under-sofa.png', lowPose.png, {
    anchor: [256, 448], headWidth: 112, sourceHeadWidth: 550, anchorKind: 'chin-ground-contact', source: 'source/cat-under-sofa.png'
  });
  const girl = await sharp(path.join(root, 'source/girl-watch.png')).resize(768, 1152).png().toBuffer();
  await emit('girl-watch', 'characters/girl-watch.png', girl, {
    anchor: [540, 739], anchorKind: 'seat-contact', footAnchor: [525, 1118], gaze: 'left', source: 'source/girl-watch.png'
  });
  manifest.sources.push('source/cat-under-sofa.png', 'source/girl-watch.png');
  const reader = await sharp(path.join(root, 'source/girl-reading.png')).resize(768, 1152).png().toBuffer();
  await emit('girl-reading', 'characters/girl-reading.png', reader, {
    anchor: [540, 739], anchorKind: 'seat-contact', footAnchor: [533, 1133], bookAnchor: [430, 565], gaze: 'down', source: 'source/girl-reading.png'
  });
  manifest.sources.push('source/girl-reading.png');
  const football = (await silhouettes('soccer-ball.png', 1, 1))[0];
  const footballPose = await place(football, 512, 512, 384 / (football.maxX - football.minX + 1),
    [(football.minX + football.maxX) / 2, (football.minY + football.maxY) / 2], [256, 256]);
  await emit('soccer-ball', 'props/soccer-ball.png', footballPose.png, {
    anchor: [256, 448], center: [256, 256], ballDiameter: 384, source: 'source/soccer-ball.png'
  });
  manifest.sources.push('source/soccer-ball.png');
  const mediaTv = await sharp(path.join(root, 'source/media-tv.png')).resize(768, 1024).png().toBuffer();
  await emit('media-tv', 'props/media-tv.png', mediaTv, {
    anchor: [384, 984], anchorKind: 'floor-contact', source: 'source/media-tv.png'
  });
  manifest.sources.push('source/media-tv.png');
  const sideTvObject = (await silhouettes('media-tv-side.png', 1, 1))[0];
  const sideTv = await fitted(sideTvObject, 512, 1024, 32, 960);
  await emit('media-tv-side', 'props/media-tv-side.png', sideTv.png, {
    anchor: [256, 960], anchorKind: 'floor-contact', screenFaces: 'right', view: 'left-side', source: 'source/media-tv-side.png'
  });
  manifest.sources.push('source/media-tv-side.png');
  const yarnCat = await silhouettes('cat-yarn-play.png', 1, 1);
  const yarnPose = await place(yarnCat[0], 512, 512, 112 / 520, [550, 901], [256, 448]);
  await emit('cat-yarn-play', 'cats/cat-yarn-play.png', yarnPose.png, {
    anchor: [256, 448], anchorKind: 'ground-contact', headWidth: 112, source: 'source/cat-yarn-play.png'
  });
  const tugCat = await silhouettes('cat-yarn-tug.png', 1, 1);
  const tugPose = await place(tugCat[0], 512, 512, 112 / 520, [550, 901], [256, 448]);
  await emit('cat-yarn-tug', 'cats/cat-yarn-tug.png', tugPose.png, {
    anchor: [256, 448], anchorKind: 'registered-to-yarn-play', headWidth: 112, source: 'source/cat-yarn-tug.png'
  });
  const strands = await sharp(path.join(root, 'source/yarn-strands.png')).resize(768, 512).png().toBuffer();
  await emit('yarn-strands', 'props/yarn-strands.png', strands, { source: 'source/yarn-strands.png' });
  manifest.sources.push('source/cat-yarn-tug.png', 'source/yarn-strands.png');
  for (const [id, width, height, extra] of [
    ['yarn-tangle', 768, 512, { anchor: [625, 330], anchorKind: 'ball-ground-contact' }],
    ['feather-bell', 768, 512, { anchor: [45, 475], bellAnchor: [625, 145], anchorKind: 'handle-end' }]
  ]) {
    const png = await sharp(path.join(root, `source/${id}.png`)).resize(width, height).png().toBuffer();
    await emit(id, `props/${id}.png`, png, { ...extra, source: `source/${id}.png` });
  }
  const tidy = await silhouettes('yarn-tidy.png', 1, 1);
  const tidyPose = await fitted(tidy[0], 512, 512, 40, 448);
  await emit('yarn-tidy', 'props/yarn-tidy.png', tidyPose.png, { anchor: [256, 448], anchorKind: 'ball-ground-contact', ballDiameter: 376, source: 'source/yarn-tidy.png' });
  manifest.sources.push('source/cat-yarn-play.png', 'source/yarn-tangle.png', 'source/feather-bell.png', 'source/yarn-tidy.png');
  const background = await sharp(path.join(root, 'source/room.png')).removeAlpha().png().toBuffer();
  await emit('room', 'backgrounds/room.png', background, { opaque: true, fit: 'cover', position: [0.5, 0.5] });
  const webpFile = path.join(root, 'backgrounds/room.webp');
  await sharp(background).webp({ quality: 88 }).toFile(webpFile);
  manifest.assets.room.webp = 'backgrounds/room.webp';
  manifest.compositing = {
    headTap: ['room', 'sofa-back', 'cat-stand', 'sofa-front', 'media-tv-side', 'dad-bald-watch', 'cat-paw-raised', 'windup-mouse'],
    wardrobe: ['room', 'wardrobe-back', 'cat-carry-collar', 'wardrobe-front'],
    ambush: ['room', 'sofa-back', 'cat-under-sofa', 'sofa-front', 'soccer-ball', 'girl-reading'],
    yarn: ['room', 'sofa-complete', 'yarn-strands', 'yarn-tidy', 'cat-yarn-play', 'cat-yarn-tug', 'feather-bell'],
    teddy: ['room', 'dad-crouch', 'girl-kneel', 'cat-bed-back', 'white-teddy-body', 'white-teddy-head', 'knead-body', 'knead-paw-far', 'knead-paw-near', 'cat-bed-front'],
    note: 'Sequences describe back-to-front drawing order; scale cat head to fit the sofa gap before positioning.'
  };
  await fs.writeFile(path.join(root, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  await fs.writeFile(path.join(root, 'manifest.js'), 'window.ART_MANIFEST = ' + JSON.stringify(manifest) + ';\n');
  console.log(JSON.stringify({ assets: Object.keys(manifest.assets).length, catPoses: catSpecs.length + 6, layerGroups: manifest.layerGroups }, null, 2));
}

main().catch(error => { console.error(error); process.exitCode = 1; });
