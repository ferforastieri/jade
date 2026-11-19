import * as THREE from 'three';

const COLORS = {
  ink: '#27394c',
  plum: '#786780',
  rose: '#d78e8c',
  blush: '#f1c6b6',
  cream: '#f4ead8',
  sage: '#a8b7a1',
  leaf: '#688879',
  gold: '#d9ad73',
  sky: '#e8d9dc',
};

const OBJECT_LABELS = {
  flower: 'flor',
  candle: 'vela',
  book: 'livro',
  lantern: 'lanterna',
  bench: 'banco',
};

function material(color, roughness = 0.82, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness, ...extra });
}

function box(width, height, depth, color, x, y, z, parent, options = {}) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    material(color, options.roughness ?? 0.82, options.material ?? {}),
  );
  mesh.position.set(x, y, z);
  if (options.rotationY) mesh.rotation.y = options.rotationY;
  if (options.castShadow !== false) mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function makeSign(title) {
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 300;
  const context = canvas.getContext('2d');
  context.fillStyle = '#efe3d1';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = '#b99171';
  context.lineWidth = 10;
  context.strokeRect(14, 14, canvas.width - 28, canvas.height - 28);
  context.textAlign = 'center';
  context.fillStyle = '#283b4d';
  context.font = '500 54px Georgia, serif';
  context.fillText('um lugar de luz', canvas.width / 2, 112);
  context.fillStyle = '#8c706c';
  context.font = 'italic 34px Georgia, serif';
  context.fillText(title.slice(0, 28), canvas.width / 2, 188);
  context.fillStyle = '#bf936a';
  context.beginPath();
  context.arc(canvas.width / 2, 236, 8, 0, Math.PI * 2);
  context.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(2.75, 1.08),
    new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }),
  );
  sign.position.set(0.2, 2.7, -4.78);
  return sign;
}

function createFlower(parent, x, z, scale = 1, color = COLORS.rose) {
  const group = new THREE.Group();
  group.position.set(x, 0.12, z);
  group.scale.setScalar(scale);
  group.userData.kind = 'flower';
  group.userData.phase = Math.abs(x * 2.17 + z * 1.31);
  parent.add(group);

  const pot = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.12, 0.26, 8),
    material('#b97f69'),
  );
  pot.position.y = 0.13;
  pot.castShadow = true;
  group.add(pot);
  const soil = new THREE.Mesh(new THREE.CylinderGeometry(0.155, 0.155, 0.025, 8), material('#645342'));
  soil.position.y = 0.27;
  group.add(soil);

  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.034, 0.62, 6), material(COLORS.leaf));
  stem.position.y = 0.58;
  group.add(stem);
  const leaves = [];
  for (const side of [-1, 1]) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), material('#78967a'));
    leaf.scale.set(1, 0.34, 0.58);
    leaf.position.set(side * 0.095, 0.49 + side * 0.09, 0);
    leaf.rotation.z = side * -0.42;
    leaf.userData.restRotationZ = leaf.rotation.z;
    leaf.userData.side = side;
    leaves.push(leaf);
    group.add(leaf);
  }

  const flowerHead = new THREE.Group();
  flowerHead.position.y = 0.93;
  group.add(flowerHead);
  const petalMaterial = material(color, 0.62, { emissive: color, emissiveIntensity: 0.05 });
  const petalGeometry = new THREE.SphereGeometry(0.13, 10, 8);
  const petals = [];
  for (let index = 0; index < 8; index += 1) {
    const angle = (index / 8) * Math.PI * 2;
    const petal = new THREE.Mesh(petalGeometry, petalMaterial);
    petal.scale.set(1.32, 0.62, 0.82);
    petal.position.set(Math.cos(angle) * 0.16, 0, Math.sin(angle) * 0.16);
    petal.rotation.y = -angle;
    petal.castShadow = true;
    petals.push(petal);
    flowerHead.add(petal);
  }
  const heart = new THREE.Mesh(new THREE.SphereGeometry(0.095, 10, 8), material(COLORS.gold));
  heart.position.y = 0.012;
  flowerHead.add(heart);
  group.userData.flowerHead = flowerHead;
  group.userData.petals = petals;
  group.userData.leaves = leaves;
  return group;
}

function createCandle(parent, x, z, scale = 1) {
  const group = new THREE.Group();
  group.position.set(x, 0.12, z);
  group.scale.setScalar(scale);
  parent.add(group);
  const wax = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.48, 10), material('#f4e6d0'));
  wax.position.y = 0.25;
  wax.castShadow = true;
  group.add(wax);
  const wick = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.08, 5), material('#493d36'));
  wick.position.y = 0.51;
  group.add(wick);
  const flame = new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 8, 7),
    new THREE.MeshBasicMaterial({ color: '#ffc978' }),
  );
  flame.scale.set(0.64, 1.55, 0.64);
  flame.position.set(0, 0.62, 0);
  group.add(flame);
  const glow = new THREE.PointLight('#ffc978', 0.62, 2.3, 2);
  glow.position.set(0, 0.67, 0);
  group.add(glow);
  group.userData.flame = flame;
  group.userData.glow = glow;
  return group;
}

function createBook(parent, x, z, scale = 1) {
  const group = new THREE.Group();
  group.position.set(x, 0.12, z);
  group.scale.setScalar(scale);
  parent.add(group);
  box(0.46, 0.09, 0.34, '#768e84', 0, 0.07, 0, group);
  box(0.4, 0.09, 0.34, '#d59b76', 0.025, 0.16, -0.01, group, { rotationY: -0.08 });
  box(0.35, 0.018, 0.3, '#f0e4d0', 0.025, 0.213, -0.01, group, { rotationY: -0.08 });
  return group;
}

function createLantern(parent, x, z, scale = 1) {
  const group = new THREE.Group();
  group.position.set(x, 0.12, z);
  group.scale.setScalar(scale);
  parent.add(group);
  const metal = material('#88765d', 0.48, { metalness: 0.24 });
  const glass = new THREE.MeshStandardMaterial({
    color: '#ffe1ad',
    roughness: 0.25,
    transparent: true,
    opacity: 0.58,
    emissive: '#df9b52',
    emissiveIntensity: 0.3,
  });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.2, 0.12, 8), metal);
  base.position.y = 0.08;
  group.add(base);
  const panes = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.42, 0.34), glass);
  panes.position.y = 0.35;
  group.add(panes);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.2, 8), metal);
  roof.position.y = 0.66;
  group.add(roof);
  const loop = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.025, 6, 12), metal);
  loop.position.y = 0.82;
  group.add(loop);
  const light = new THREE.PointLight('#ffd695', 0.75, 2.8, 2);
  light.position.y = 0.38;
  group.add(light);
  group.userData.glow = light;
  return group;
}

function createBench(parent, x, z, scale = 1) {
  const group = new THREE.Group();
  group.position.set(x, 0.12, z);
  group.scale.setScalar(scale);
  parent.add(group);
  const wood = material('#9d745c');
  box(1.05, 0.13, 0.42, '#bd9271', 0, 0.58, 0, group);
  box(1.04, 0.52, 0.12, '#a77962', 0, 0.96, -0.18, group);
  for (const dx of [-0.38, 0.38]) {
    box(0.1, 0.55, 0.1, wood, dx, 0.31, -0.13, group);
    box(0.1, 0.55, 0.1, wood, dx, 0.31, 0.13, group);
  }
  return group;
}

const BUILDERS = {
  flower: createFlower,
  candle: createCandle,
  book: createBook,
  lantern: createLantern,
  bench: createBench,
};

function createPottedFern(parent, x, z, size = 1) {
  const group = new THREE.Group();
  group.position.set(x, 0.12, z);
  group.scale.setScalar(size);
  group.userData.kind = 'fern';
  group.userData.phase = Math.abs(x * 1.23 + z * 0.87);
  parent.add(group);
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.2, 0.42, 9), material('#a87969'));
  pot.position.y = 0.21;
  pot.castShadow = true;
  group.add(pot);
  const fronds = [];
  for (let index = 0; index < 9; index += 1) {
    const angle = (index / 9) * Math.PI * 2;
    const frond = new THREE.Group();
    frond.position.set(Math.cos(angle) * 0.2, 0.36, Math.sin(angle) * 0.2);
    frond.rotation.z = -Math.cos(angle) * 0.58;
    frond.rotation.x = Math.sin(angle) * 0.58;
    frond.userData.baseRotationX = frond.rotation.x;
    frond.userData.baseRotationZ = frond.rotation.z;
    frond.userData.phase = index * 0.7;
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.86, 5), material(index % 2 ? '#718e78' : '#819b7e'));
    leaf.position.y = 0.43;
    leaf.castShadow = true;
    frond.add(leaf);
    fronds.push(frond);
    group.add(frond);
  }
  group.userData.fronds = fronds;
  return group;
}

function createBunny(parent, x, z, size = 0.64) {
  const bunny = new THREE.Group();
  bunny.position.set(x, 0.12, z);
  bunny.scale.setScalar(size);
  bunny.userData.kind = 'bunny';
  const phase = Math.abs(x * 1.7 + z * 1.13);
  parent.add(bunny);

  const fur = material('#f4eee4', 0.92);
  const warmFur = material('#e9dfd2', 0.95);
  const innerEar = material('#d99491', 0.78);
  const dark = material('#38424a', 0.4);
  const blush = material('#e7b3a8', 0.78);
  const bellMaterial = material('#d6ad76', 0.42, { metalness: 0.18 });

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.43, 20),
    new THREE.MeshBasicMaterial({ color: '#84796c', transparent: true, opacity: 0.17, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.015;
  shadow.userData.kind = 'bunny-shadow';
  bunny.add(shadow);

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.34, 14, 12), fur);
  body.scale.set(0.94, 0.82, 1.16);
  body.position.set(0, 0.43, -0.04);
  body.castShadow = true;
  bunny.add(body);

  const chest = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), warmFur);
  chest.scale.set(0.75, 0.8, 0.56);
  chest.position.set(0, 0.49, 0.2);
  bunny.add(chest);

  const tail = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), fur);
  tail.position.set(0, 0.46, -0.4);
  tail.castShadow = true;
  bunny.add(tail);

  const head = new THREE.Group();
  head.position.set(0, 0.88, 0.12);
  bunny.add(head);
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.29, 14, 12), fur);
  face.scale.set(1, 0.95, 0.88);
  face.castShadow = true;
  head.add(face);

  const ears = [];
  for (const side of [-1, 1]) {
    const ear = new THREE.Group();
    ear.position.set(side * 0.14, 0.19, -0.015);
    ear.rotation.z = -side * 0.17;
    ear.userData.restRotationZ = ear.rotation.z;
    const outer = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), fur);
    outer.scale.set(0.7, 1.75, 0.5);
    outer.position.y = 0.17;
    outer.castShadow = true;
    ear.add(outer);
    const inner = new THREE.Mesh(new THREE.SphereGeometry(0.061, 9, 7), innerEar);
    inner.scale.set(0.56, 1.38, 0.24);
    inner.position.set(0, 0.17, 0.037);
    ear.add(inner);
    ears.push(ear);
    head.add(ear);
  }

  const eyes = [];
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.033, 8, 6), dark);
    eye.scale.set(0.78, 1, 0.55);
    eye.position.set(side * 0.105, 0.055, 0.252);
    head.add(eye);
    const highlight = new THREE.Mesh(new THREE.SphereGeometry(0.009, 6, 5), material('#fffaf0', 0.3));
    highlight.position.set(side * 0.105 - 0.007, 0.067, 0.267);
    head.add(highlight);
    eyes.push(eye);

    const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.064, 8, 6), blush);
    cheek.scale.set(1.25, 0.54, 0.38);
    cheek.position.set(side * 0.17, -0.07, 0.22);
    head.add(cheek);
    const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.092, 9, 7), warmFur);
    muzzle.scale.set(0.86, 0.67, 0.56);
    muzzle.position.set(side * 0.052, -0.12, 0.237);
    head.add(muzzle);
  }

  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.036, 8, 6), innerEar);
  nose.scale.set(1.1, 0.76, 0.62);
  nose.position.set(0, -0.085, 0.286);
  head.add(nose);
  const mouth = new THREE.Mesh(new THREE.SphereGeometry(0.022, 7, 5), dark);
  mouth.scale.set(0.7, 0.42, 0.42);
  mouth.position.set(0, -0.16, 0.269);
  head.add(mouth);

  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.026, 6, 14), material('#d9b58b'));
  collar.position.set(0, 0.65, 0.12);
  collar.rotation.x = Math.PI / 2;
  bunny.add(collar);
  const bell = new THREE.Mesh(new THREE.SphereGeometry(0.047, 8, 7), bellMaterial);
  bell.position.set(0, 0.64, 0.3);
  bunny.add(bell);

  for (const side of [-1, 1]) {
    const paw = new THREE.Mesh(new THREE.SphereGeometry(0.13, 9, 7), warmFur);
    paw.scale.set(1.08, 0.48, 1.18);
    paw.position.set(side * 0.16, 0.18, 0.23);
    bunny.add(paw);
  }

  bunny.userData.animation = { head, ears, eyes, phase, pettedUntil: 0 };
  return bunny;
}

function createFloatingPetals(scene) {
  const colors = ['#e9b8b4', '#f0d5c8', '#c9b6c7', '#d8bd8a', '#db9ca1', '#ead1c2', '#c5c8a5'];
  const geometry = new THREE.SphereGeometry(0.055, 8, 6);
  return colors.map((color, index) => {
    const petal = new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.52, depthWrite: false }),
    );
    petal.scale.set(0.7, 0.24, 1.35);
    const phase = index * 0.137;
    const baseX = -3.8 + ((index * 1.71) % 7.6);
    const baseZ = -3.8 + ((index * 2.39) % 7.6);
    petal.position.set(baseX, 0.65 + (index % 4) * 0.57, baseZ);
    petal.userData = { baseX, baseZ, phase };
    scene.add(petal);
    return petal;
  });
}

function createRoom(scene, title) {
  const room = new THREE.Group();
  scene.add(room);

  const foundation = new THREE.Mesh(new THREE.BoxGeometry(10.36, 0.34, 10.36), material('#a78975'));
  foundation.position.y = -0.11;
  foundation.receiveShadow = true;
  foundation.castShadow = true;
  room.add(foundation);

  const floorColors = ['#eee1cf', '#e4d7c6', '#e9dbd0', '#f0e7da'];
  for (let x = -5; x < 5; x += 1) {
    for (let z = -5; z < 5; z += 1) {
      const tile = new THREE.Mesh(
        new THREE.BoxGeometry(0.97, 0.045, 0.97),
        material(floorColors[(x + z + 30) % floorColors.length]),
      );
      tile.position.set(x + 0.5, 0.08, z + 0.5);
      tile.receiveShadow = true;
      room.add(tile);
    }
  }

  box(10.25, 4.05, 0.34, '#d1c1bc', 0, 2.1, -5.12, room);
  box(0.34, 4.05, 10.25, '#c9bdc1', -5.12, 2.1, 0, room);
  box(10.28, 0.2, 0.42, '#b89179', 0, 0.3, -4.98, room);
  box(0.42, 0.2, 10.28, '#b89179', -4.98, 0.3, 0, room);

  // Warm timber at the top of each wall gives the room a toy-house silhouette.
  box(10.48, 0.2, 0.48, '#ad8874', 0, 4.08, -5.05, room);
  box(0.48, 0.2, 10.48, '#ad8874', -5.05, 4.08, 0, room);

  // The small framed opening in the back wall.
  box(2.25, 1.7, 0.16, '#9d7a75', -2.8, 2.55, -4.9, room);
  box(1.9, 1.38, 0.12, '#e5c6bb', -2.8, 2.56, -4.79, room);
  box(0.09, 1.35, 0.04, '#b78c74', -2.8, 2.56, -4.71, room);
  box(1.88, 0.09, 0.04, '#b78c74', -2.8, 2.56, -4.7, room);
  box(2.52, 0.13, 0.36, '#9d7a75', -2.8, 1.68, -4.77, room);

  // A simple doorway to the outside, framed with soft light.
  box(1.55, 2.65, 0.22, '#b58b72', 2.9, 1.45, -4.88, room);
  box(1.23, 2.4, 0.12, '#ebd2c3', 2.9, 1.48, -4.73, room);
  box(0.09, 2.15, 0.05, '#c69e7b', 2.9, 1.44, -4.64, room);
  const doorwayLight = new THREE.Mesh(
    new THREE.PlaneGeometry(1.12, 2.08),
    new THREE.MeshBasicMaterial({ color: '#ffe6b8', transparent: true, opacity: 0.4, side: THREE.DoubleSide }),
  );
  doorwayLight.position.set(2.9, 1.45, -4.62);
  room.add(doorwayLight);

  room.add(makeSign(title || 'memórias que florescem'));
  createPottedFern(room, -3.55, -3.15, 0.95);
  createPottedFern(room, 3.75, -3.1, 0.75);
  createFlower(room, -3.35, 3.15, 0.82, '#d58f91');
  createFlower(room, 3.4, 2.65, 0.68, '#d8b574');
  createFlower(room, -1.45, 3.86, 0.56, '#bd91b7');
  createFlower(room, 1.15, -2.72, 0.54, '#dfa48e');
  const bunny = createBunny(room, 2.35, 3.62, 0.62);
  createLantern(room, 0.1, -3.85, 0.72);
  createBench(room, -2.9, 0.5, 0.72);

  const wallLight = new THREE.PointLight('#ffe0c2', 1.2, 7, 1.8);
  wallLight.position.set(0, 3.1, -3.8);
  room.add(wallLight);
  const sideLight = new THREE.PointLight('#e4c5dd', 0.65, 8, 1.7);
  sideLight.position.set(-3.7, 2.5, 1.4);
  room.add(sideLight);
  return { room, bunny };
}

function makeLabel(text, color = '#ffffff') {
  const canvas = document.createElement('canvas');
  canvas.width = 384;
  canvas.height = 112;
  const context = canvas.getContext('2d');
  context.fillStyle = 'rgba(39, 57, 76, .82)';
  context.beginPath();
  context.roundRect(8, 8, 368, 96, 46);
  context.fill();
  context.fillStyle = color;
  context.font = '600 40px system-ui, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text.slice(0, 18), 192, 57);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
  sprite.scale.set(1.45, 0.42, 1);
  sprite.position.y = 1.86;
  return sprite;
}

function createAvatar(name, identity = 'visitor') {
  const avatar = new THREE.Group();
  const identityHash = [...String(identity)].reduce((hash, character) => (hash * 31 + character.charCodeAt(0)) >>> 0, 7);
  const color = new THREE.Color().setHSL((identityHash % 360) / 360, 0.4, 0.62);
  const outfit = material(color.getStyle(), 0.88);
  const trim = material(color.clone().offsetHSL(0, -0.08, -0.14).getStyle(), 0.88);
  const skin = material('#e2ad8e', 0.92);
  const hairMaterial = material(['#594944', '#493c39', '#806858', '#494954'][identityHash % 4], 0.96);
  const dark = material('#38424a', 0.4);
  const body = new THREE.Group();
  const baseBodyY = 0.68;
  body.position.y = baseBodyY;
  avatar.add(body);

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.35, 4, 9), outfit);
  torso.castShadow = true;
  body.add(torso);
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.035, 6, 14), material('#e9bd84'));
  collar.position.y = 0.29;
  collar.rotation.x = Math.PI / 2;
  body.add(collar);

  const head = new THREE.Group();
  head.position.set(0, 0.47, 0.025);
  body.add(head);
  const headShape = new THREE.Mesh(new THREE.SphereGeometry(0.235, 14, 12), skin);
  headShape.castShadow = true;
  head.add(headShape);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 9, 0, Math.PI * 2, 0, Math.PI * 0.55), hairMaterial);
  hair.position.y = 0.035;
  hair.castShadow = true;
  head.add(hair);
  const fringe = new THREE.Mesh(new THREE.SphereGeometry(0.105, 9, 7), hairMaterial);
  fringe.scale.set(1.15, 0.68, 0.7);
  fringe.position.set(0, 0.115, 0.18);
  head.add(fringe);

  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), dark);
    eye.scale.set(0.82, 1.1, 0.6);
    eye.position.set(side * 0.082, 0.005, 0.221);
    head.add(eye);
    const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.047, 8, 6), material('#d99791', 0.9));
    cheek.scale.set(1.2, 0.5, 0.36);
    cheek.position.set(side * 0.145, -0.065, 0.19);
    head.add(cheek);
    const lock = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), hairMaterial);
    lock.scale.set(0.75, 1.45, 0.75);
    lock.position.set(side * 0.19, 0.005, 0.005);
    head.add(lock);
  }
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.027, 8, 6), material('#b86e76', 0.7));
  nose.scale.set(1, 0.75, 0.6);
  nose.position.set(0, -0.055, 0.231);
  head.add(nose);

  const arms = [];
  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(side * 0.25, 0.22, 0);
    arm.rotation.z = side * -0.12;
    arm.userData.side = side;
    arm.userData.restRotationZ = arm.rotation.z;
    const upperArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.19, 3, 7), outfit);
    upperArm.position.y = -0.12;
    upperArm.castShadow = true;
    arm.add(upperArm);
    const forearm = new THREE.Group();
    forearm.position.y = -0.22;
    arm.add(forearm);
    const sleeve = new THREE.Mesh(new THREE.CapsuleGeometry(0.066, 0.15, 3, 7), trim);
    sleeve.position.y = -0.09;
    sleeve.castShadow = true;
    forearm.add(sleeve);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.066, 8, 7), skin);
    hand.position.y = -0.19;
    forearm.add(hand);
    arms.push(arm);
    body.add(arm);
  }

  const legs = [];
  for (const side of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(side * 0.12, 0.4, 0);
    const trouser = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.17, 3, 7), trim);
    trouser.position.y = -0.14;
    trouser.castShadow = true;
    leg.add(trouser);
    const shoe = new THREE.Mesh(new THREE.SphereGeometry(0.1, 9, 7), material('#62554f', 0.72));
    shoe.scale.set(0.92, 0.56, 1.35);
    shoe.position.set(0, -0.34, 0.055);
    leg.add(shoe);
    legs.push(leg);
    avatar.add(leg);
  }

  avatar.add(makeLabel(name || 'visitante'));
  avatar.position.set(0, 0.12, 3.65);
  avatar.userData.animation = { body, head, arms, legs, baseBodyY, phase: (identityHash % 23) * 0.12 };
  return avatar;
}

function buildPlacedObject(data, parent) {
  const builder = BUILDERS[data.kind];
  if (!builder) return null;
  const object = builder(parent, Number(data.x), Number(data.z), 0.82);
  object.userData.objectId = data.id;
  object.userData.kind = data.kind;
  return object;
}

function animateFlower(flower, time, index, motionScale) {
  const phase = Number(flower.userData.phase || 0) + index * 0.73;
  const breeze = Math.sin(time * 1.2 + phase) * motionScale;
  flower.rotation.z = breeze * 0.022;
  const head = flower.userData.flowerHead;
  if (head) {
    head.rotation.z = Math.sin(time * 1.45 + phase) * 0.075 * motionScale;
    head.rotation.x = Math.cos(time * 1.1 + phase) * 0.035 * motionScale;
    head.scale.setScalar(1 + (0.018 + Math.sin(time * 1.7 + phase) * 0.012) * motionScale);
  }
  (flower.userData.leaves || []).forEach((leaf, leafIndex) => {
    leaf.rotation.z = leaf.userData.restRotationZ + Math.sin(time * 1.55 + phase + leafIndex) * 0.09 * motionScale;
  });
  (flower.userData.petals || []).forEach((petal, petalIndex) => {
    petal.rotation.x = Math.sin(time * 1.3 + phase + petalIndex * 0.6) * 0.025 * motionScale;
  });
}

function animateAvatar(avatar, time, walking, motionScale = 1) {
  const animation = avatar.userData.animation;
  if (!animation) return;
  const { body, head, arms, legs, baseBodyY, phase } = animation;
  const gait = time * 8.8 + phase;
  const step = Math.sin(gait);
  body.position.y = baseBodyY + (walking ? Math.abs(Math.sin(gait * 2)) * 0.022 : Math.sin(time * 1.4 + phase) * 0.008) * motionScale;
  body.rotation.z = (walking ? step * 0.035 : Math.sin(time * 0.8 + phase) * 0.012) * motionScale;
  body.rotation.x = (walking ? -0.055 : Math.sin(time * 0.6 + phase) * 0.008) * motionScale;
  head.rotation.z = (walking ? -step * 0.035 : Math.sin(time * 0.75 + phase) * 0.022) * motionScale;
  head.rotation.x = (walking ? 0.025 : Math.sin(time * 1.1 + phase) * 0.01) * motionScale;
  arms.forEach((arm, index) => {
    const swing = Math.sin(gait + (index ? Math.PI : 0));
    arm.rotation.x = (walking ? swing * 0.62 : Math.sin(time * 1.2 + phase + index) * 0.025) * motionScale;
    arm.rotation.z = arm.userData.restRotationZ + (walking ? Math.cos(gait + index * Math.PI) * 0.035 : 0) * motionScale;
  });
  legs.forEach((leg, index) => {
    leg.rotation.x = (walking ? Math.sin(gait + (index ? Math.PI : 0)) * 0.58 : Math.sin(time * 0.9 + phase + index) * 0.012) * motionScale;
  });
}

function animateBunny(bunny, time, motionScale = 1) {
  const animation = bunny?.userData.animation;
  if (!animation) return;
  const { head, ears, eyes, phase } = animation;
  const petting = time < animation.pettedUntil;
  let hop = 0;
  if (motionScale > 0 && petting) {
    const elapsed = 1.8 - (animation.pettedUntil - time);
    hop = Math.pow(Math.max(0, Math.sin(elapsed * Math.PI * 3)), 5);
  } else if (motionScale > 0) {
    const beat = (time + phase) % 4.8;
    if (beat < 0.46) hop = Math.sin((beat / 0.46) * Math.PI) * 0.72;
  }
  bunny.position.y = 0.12 + hop * 0.2;
  head.rotation.z = (Math.sin(time * 0.65 + phase) * 0.035 + (petting ? Math.sin(time * 8) * 0.04 : 0)) * motionScale;
  ears.forEach((ear, index) => {
    ear.rotation.z = ear.userData.restRotationZ + (Math.sin(time * 2.3 + phase + index * 1.2) * 0.045 + hop * (index ? -0.14 : 0.14)) * motionScale;
  });
  const blinkWave = motionScale ? Math.sin(time * 1.35 + phase * 1.7) : 0;
  const blink = Math.max(0, (blinkWave - 0.985) / 0.015);
  eyes.forEach((eye) => { eye.scale.y = 1 - blink * 0.86; });
}

export function mountWorld(container, options = {}) {
  const {
    title = 'memórias que florescem',
    objects = [],
    visitorName = 'visitante',
    interactive = true,
    showAvatar = true,
    canEdit = false,
    selectedKind = null,
    onPlace = () => {},
    onRemove = () => {},
    onPlayerMove = () => {},
  } = options;

  if (!container) return {
    setObjects() {}, setEditMode() {}, setRemotePlayers() {}, updateRemotePlayer() {}, setPlayerName() {},
    getPlayerPosition() { return { x: 0, z: 3.65 }; }, removeRemotePlayer() {}, dispose() {},
  };
  container.replaceChildren();
  const motionScale = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 0 : 1;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  } catch {
    container.innerHTML = '<div class="webgl-fallback"><span class="fallback-flower" aria-hidden="true">✿</span><h3>Seu jardim continua aqui</h3><p>Este navegador não conseguiu iniciar o WebGL. Experimente abrir a sala em um navegador atualizado.</p></div>';
    return {
      setObjects() {}, setEditMode() {}, setRemotePlayers() {}, updateRemotePlayer() {}, setPlayerName() {},
      getPlayerPosition() { return { x: 0, z: 3.65 }; }, removeRemotePlayer() {}, dispose() {},
    };
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.65));
  renderer.setSize(container.clientWidth || 640, container.clientHeight || 460, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.className = 'room-canvas';
  renderer.domElement.setAttribute('aria-label', 'Sala tridimensional interativa. Clique ou toque no chão para caminhar e no coelhinho para vê-lo saltar.');
  container.append(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#d8d4e3');
  scene.fog = new THREE.Fog('#d8d4e3', 22, 42);
  const camera = new THREE.OrthographicCamera(-7, 7, 7, -7, 0.1, 100);
  camera.position.set(12.2, 14.4, 16.2);
  camera.lookAt(0, 1.25, 0);

  scene.add(new THREE.HemisphereLight('#fff6e9', '#7b778e', 2.15));
  const sun = new THREE.DirectionalLight('#fff0d8', 2.15);
  sun.position.set(7, 13, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -12;
  sun.shadow.camera.right = 12;
  sun.shadow.camera.top = 12;
  sun.shadow.camera.bottom = -12;
  scene.add(sun);

  const environment = new THREE.Group();
  scene.add(environment);
  const { room, bunny } = createRoom(environment, title);
  const roomFlowers = [];
  const roomFerns = [];
  room.traverse((node) => {
    if (node.userData.kind === 'flower') roomFlowers.push(node);
    if (node.userData.kind === 'fern') roomFerns.push(node);
  });
  const floatingPetals = createFloatingPetals(scene);
  const objectLayer = new THREE.Group();
  scene.add(objectLayer);
  let placedObjects = [];
  let placedFlowers = [];
  const addPlacedObjects = (items) => {
    for (const child of [...objectLayer.children]) {
      objectLayer.remove(child);
      child.traverse((node) => {
        node.geometry?.dispose?.();
        if (Array.isArray(node.material)) node.material.forEach((entry) => entry.dispose?.());
        else node.material?.dispose?.();
      });
    }
    placedObjects = items.map((item) => buildPlacedObject(item, objectLayer)).filter(Boolean);
    placedFlowers = placedObjects.filter((object) => object.userData.kind === 'flower');
  };
  addPlacedObjects(objects);

  const avatar = showAvatar ? createAvatar(visitorName, 'local') : null;
  if (avatar) scene.add(avatar);
  const remoteAvatars = new Map();
  const target = new THREE.Vector3(0, 0.12, 3.65);
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.1);
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let editMode = false;
  let currentKind = selectedKind;
  let frame = 0;
  let disposed = false;
  let lastBroadcastAt = -1;
  const lastBroadcastPosition = new THREE.Vector3(Number.POSITIVE_INFINITY, 0.12, Number.POSITIVE_INFINITY);

  const updateRemotePlayer = (player) => {
    if (!player?.id || !Number.isFinite(Number(player.x)) || !Number.isFinite(Number(player.z))) return;
    let entry = remoteAvatars.get(player.id);
    if (!entry) {
      const group = createAvatar(String(player.name || 'visitante').slice(0, 24), player.id);
      const start = new THREE.Vector3(Number(player.x), 0.12, Number(player.z));
      group.position.copy(start);
      scene.add(group);
      entry = { group, target: start.clone() };
      remoteAvatars.set(player.id, entry);
    }
    entry.target.set(
      THREE.MathUtils.clamp(Number(player.x), -4.2, 4.2),
      0.12,
      THREE.MathUtils.clamp(Number(player.z), -4.2, 4.2),
    );
  };

  const setRemotePlayers = (players = []) => {
    const ids = new Set(players.map((player) => player.id));
    for (const [id, entry] of remoteAvatars) {
      if (ids.has(id)) continue;
      scene.remove(entry.group);
      entry.group.traverse((node) => {
        node.geometry?.dispose?.();
        if (Array.isArray(node.material)) node.material.forEach((item) => item.dispose?.());
        else node.material?.dispose?.();
      });
      remoteAvatars.delete(id);
    }
    players.forEach(updateRemotePlayer);
  };

  const pointerToWorld = (event) => {
    const bounds = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
    pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const point = new THREE.Vector3();
    return raycaster.ray.intersectPlane(plane, point) ? point : null;
  };

  const onPointerDown = (event) => {
    if (!interactive) return;
    const point = pointerToWorld(event);
    if (!point) return;
    if (bunny && raycaster.intersectObject(bunny, true).length) {
      bunny.userData.animation.pettedUntil = clock.elapsedTime + 1.8;
      return;
    }
    const x = THREE.MathUtils.clamp(point.x, -4.25, 4.25);
    const z = THREE.MathUtils.clamp(point.z, -4.25, 4.25);

    if (editMode && canEdit) {
      const hits = raycaster.intersectObjects(placedObjects, true);
      const objectId = hits.map((hit) => {
        let node = hit.object;
        while (node && !node.userData.objectId) node = node.parent;
        return node?.userData.objectId;
      }).find(Boolean);
      if (objectId) {
        onRemove(objectId);
      } else if (currentKind) {
        onPlace({ kind: currentKind, x: Number(x.toFixed(2)), z: Number(z.toFixed(2)) });
      }
      return;
    }

    target.set(x, 0.12, z);
  };

  const pressed = new Set();
  const onKeyDown = (event) => {
    if (!interactive || !avatar || /INPUT|TEXTAREA|SELECT/.test(event.target?.tagName || '')) return;
    const key = event.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(key)) {
      event.preventDefault();
      pressed.add(key);
    }
  };
  const onKeyUp = (event) => pressed.delete(event.key.toLowerCase());

  renderer.domElement.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  const resizeObserver = new ResizeObserver(() => {
    if (disposed) return;
    const width = Math.max(container.clientWidth, 1);
    const height = Math.max(container.clientHeight, 1);
    renderer.setSize(width, height, false);
    const aspect = width / height;
    const frustum = height < 450 ? 6.7 : 6.1;
    camera.left = -frustum * aspect;
    camera.right = frustum * aspect;
    camera.top = frustum;
    camera.bottom = -frustum;
    camera.updateProjectionMatrix();
  });
  resizeObserver.observe(container);

  const clock = new THREE.Clock();
  const animate = () => {
    if (disposed) return;
    frame = requestAnimationFrame(animate);
    const delta = Math.min(clock.getDelta(), 0.05);
    const time = clock.elapsedTime;

    if (avatar && interactive && !editMode) {
      const movement = new THREE.Vector3(
        (pressed.has('d') || pressed.has('arrowright') ? 1 : 0) - (pressed.has('a') || pressed.has('arrowleft') ? 1 : 0),
        0,
        (pressed.has('s') || pressed.has('arrowdown') ? 1 : 0) - (pressed.has('w') || pressed.has('arrowup') ? 1 : 0),
      );
      if (movement.lengthSq() > 0) {
        movement.normalize().multiplyScalar(delta * 3.2);
        target.add(movement);
        target.x = THREE.MathUtils.clamp(target.x, -4.2, 4.2);
        target.z = THREE.MathUtils.clamp(target.z, -4.2, 4.2);
      }
      const distance = avatar.position.distanceTo(target);
      avatar.position.lerp(target, 1 - Math.exp(-delta * 5.2));
      const walking = distance > 0.11;
      avatar.position.y = 0.12 + (walking ? Math.abs(Math.sin(time * 9)) * 0.045 : Math.sin(time * 1.6) * 0.008) * motionScale;
      if (walking) avatar.rotation.y = Math.atan2(target.x - avatar.position.x, target.z - avatar.position.z);
      animateAvatar(avatar, time, walking, motionScale);
      if (time - lastBroadcastAt >= 0.1 && avatar.position.distanceTo(lastBroadcastPosition) >= 0.09) {
        lastBroadcastAt = time;
        lastBroadcastPosition.copy(avatar.position);
        onPlayerMove({ x: Number(avatar.position.x.toFixed(2)), z: Number(avatar.position.z.toFixed(2)) });
      }
    }

    for (const entry of remoteAvatars.values()) {
      const distance = entry.group.position.distanceTo(entry.target);
      entry.group.position.lerp(entry.target, 1 - Math.exp(-delta * 7));
      const walking = distance > 0.12;
      entry.group.position.y = 0.12 + (walking ? Math.abs(Math.sin(time * 9)) * 0.04 : Math.sin(time * 1.6) * 0.008) * motionScale;
      if (walking) {
        entry.group.rotation.y = Math.atan2(
          entry.target.x - entry.group.position.x,
          entry.target.z - entry.group.position.z,
        );
      }
      animateAvatar(entry.group, time, walking, motionScale);
    }

    roomFlowers.forEach((flower, index) => animateFlower(flower, time, index, motionScale));
    placedFlowers.forEach((flower, index) => {
      animateFlower(flower, time, index + roomFlowers.length, motionScale);
    });
    roomFerns.forEach((fern, index) => {
      const phase = Number(fern.userData.phase || 0) + index;
      fern.userData.fronds?.forEach((frond) => {
        const sway = Math.sin(time * 1.15 + phase + frond.userData.phase) * 0.055 * motionScale;
        frond.rotation.x = frond.userData.baseRotationX + sway * 0.5;
        frond.rotation.z = frond.userData.baseRotationZ + sway;
      });
    });
    animateBunny(bunny, time, motionScale);
    floatingPetals.forEach((petal) => {
      const { baseX, baseZ, phase } = petal.userData;
      const drift = time * 0.075 + phase;
      const fall = motionScale ? (drift % 1) : (phase % 1);
      petal.position.set(
        baseX + Math.sin(time * 0.55 + phase) * 0.42 * motionScale,
        3.35 - fall * 2.75,
        baseZ + Math.cos(time * 0.42 + phase) * 0.34 * motionScale,
      );
      petal.rotation.set(Math.sin(time * 0.7 + phase) * 0.28 * motionScale, time * 0.3 + phase, Math.sin(time * 0.9 + phase) * 0.5 * motionScale);
      petal.material.opacity = 0.34 + (0.18 + Math.sin(time * 1.3 + phase) * 0.12) * motionScale;
    });
    placedObjects.forEach((object, index) => {
      const glow = object.userData.glow;
      if (glow) glow.intensity = 0.65 + Math.sin(time * 2.2 + index) * 0.12 * motionScale;
      const flame = object.userData.flame;
      if (flame) {
        flame.scale.y = 1.45 + Math.sin(time * 6 + index) * 0.14 * motionScale;
        flame.rotation.z = Math.sin(time * 7 + index) * 0.09 * motionScale;
      }
    });
    renderer.render(scene, camera);
  };
  animate();

  return {
    setObjects(nextObjects) {
      addPlacedObjects(nextObjects || []);
    },
    setRemotePlayers,
    updateRemotePlayer,
    getPlayerPosition() {
      return avatar ? { x: Number(avatar.position.x.toFixed(2)), z: Number(avatar.position.z.toFixed(2)) } : { x: 0, z: 3.65 };
    },
    removeRemotePlayer(id) {
      const entry = remoteAvatars.get(id);
      if (!entry) return;
      scene.remove(entry.group);
      entry.group.traverse((node) => {
        node.geometry?.dispose?.();
        if (Array.isArray(node.material)) node.material.forEach((item) => item.dispose?.());
        else node.material?.dispose?.();
      });
      remoteAvatars.delete(id);
    },
    setEditMode(value, kind = currentKind) {
      editMode = Boolean(value);
      currentKind = kind;
      container.classList.toggle('is-editing', editMode);
      renderer.domElement.style.cursor = editMode ? (kind ? 'crosshair' : 'pointer') : 'default';
      if (avatar) avatar.visible = !editMode;
    },
    setPlayerName(name) {
      if (!avatar) return;
      const oldLabel = avatar.children.find((child) => child.isSprite);
      if (oldLabel) {
        oldLabel.material.map?.dispose?.();
        oldLabel.material.dispose();
        avatar.remove(oldLabel);
      }
      avatar.add(makeLabel(String(name || 'visitante').slice(0, 18)));
    },
    setSelectedKind(kind) {
      currentKind = kind;
      renderer.domElement.style.cursor = editMode ? (kind ? 'crosshair' : 'pointer') : 'default';
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      scene.traverse((node) => {
        node.geometry?.dispose?.();
        if (Array.isArray(node.material)) node.material.forEach((entry) => entry.dispose?.());
        else node.material?.dispose?.();
      });
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}

export { OBJECT_LABELS };
