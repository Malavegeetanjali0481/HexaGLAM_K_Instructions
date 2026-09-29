/* ============================================================
   HexaGLAM_K - Smart Hexapod Robot
   Interactive System Scripts & Three.js 3D Kinematics Engine
   Developed for IIITDM Kurnool Robotics Engineering Project
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  initStickyHeader();
  initMobileMenu();
  initThreeJsHexapod();
  initLegKinematicsCanvas();
  initTripodGaitSimulator();
  initCameraControls();
  initSensorCharts();
  initRobotControlPad();
  initLightboxGallery();
  initScrollAnimations();
});

/* ============================================================
   1. STICKY HEADER & SCROLLSPY
   ============================================================ */
function initStickyHeader() {
  const header = document.getElementById('siteHeader');
  const navLinks = document.querySelectorAll('.nav-link');
  const sections = document.querySelectorAll('section[id], header[id]');

  window.addEventListener('scroll', () => {
    if (window.scrollY > 40) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }

    // Scrollspy active link detection
    let current = '';
    const scrollPos = window.scrollY + 140;

    sections.forEach(section => {
      const sectionTop = section.offsetTop;
      const sectionHeight = section.offsetHeight;
      if (scrollPos >= sectionTop && scrollPos < sectionTop + sectionHeight) {
        current = section.getAttribute('id');
      }
    });

    navLinks.forEach(link => {
      link.classList.remove('active');
      const href = link.getAttribute('href');
      if (href === `#${current}` || (current === 'hero' && href === '#top') || (current === 'top' && href === '#top')) {
        link.classList.add('active');
      }
    });
  });
}

function initMobileMenu() {
  const hamburgerBtn = document.getElementById('hamburgerBtn');
  const navMenu = document.getElementById('navMenu');
  const navLinks = document.querySelectorAll('.nav-link');

  if (hamburgerBtn && navMenu) {
    hamburgerBtn.addEventListener('click', () => {
      navMenu.classList.toggle('active');
    });

    navLinks.forEach(link => {
      link.addEventListener('click', () => {
        navMenu.classList.remove('active');
      });
    });
  }
}

/* ============================================================
   2. THREE.JS 3D HEXAPOD KINEMATICS ENGINE
   ============================================================ */
let hexapodScene, hexapodCamera, hexapodRenderer, hexapodControls;
let robotMasterGroup, legHierarchy = [];
let animMode = 'walk'; // 'walk', 'stand', 'wave', 'turn'
let animTime = 0;
let isWireframe = false;
let hudPins = [];

function initThreeJsHexapod() {
  const container = document.getElementById('threeCanvasContainer');
  const loadingElem = document.getElementById('threeLoading');
  if (!container) return;

  const width = container.clientWidth;
  const height = container.clientHeight;

  // Scene setup
  hexapodScene = new THREE.Scene();
  hexapodScene.background = new THREE.Color(0xF8F3E8);

  // Soft grid helper on ground
  const gridHelper = new THREE.GridHelper(30, 24, 0x174EA6, 0xDCEBFF);
  gridHelper.position.y = -2.8;
  gridHelper.material.opacity = 0.45;
  gridHelper.material.transparent = true;
  hexapodScene.add(gridHelper);

  // Camera setup
  hexapodCamera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
  const defaultCamPos = { x: 8.5, y: 7.0, z: 9.5 };
  hexapodCamera.position.set(defaultCamPos.x, defaultCamPos.y, defaultCamPos.z);

  // Renderer setup
  hexapodRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  hexapodRenderer.setSize(width, height);
  hexapodRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  hexapodRenderer.shadowMap.enabled = true;
  hexapodRenderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(hexapodRenderer.domElement);

  // OrbitControls
  if (typeof THREE.OrbitControls !== 'undefined') {
    hexapodControls = new THREE.OrbitControls(hexapodCamera, hexapodRenderer.domElement);
    hexapodControls.enableDamping = true;
    hexapodControls.dampingFactor = 0.06;
    hexapodControls.maxPolarAngle = Math.PI / 2 - 0.04;
    hexapodControls.minDistance = 4;
    hexapodControls.maxDistance = 22;
    hexapodControls.target.set(0, 0, 0);
  }

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.95);
  hexapodScene.add(ambientLight);

  const keyLight = new THREE.DirectionalLight(0xffffff, 1.1);
  keyLight.position.set(12, 18, 14);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.width = 1024;
  keyLight.shadow.mapSize.height = 1024;
  keyLight.shadow.bias = -0.001;
  hexapodScene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0xDCEBFF, 0.6);
  fillLight.position.set(-10, 10, -10);
  hexapodScene.add(fillLight);

  const orangeAccentLight = new THREE.PointLight(0xF59E0B, 1.2, 10);
  orangeAccentLight.position.set(0, -0.5, 0);
  hexapodScene.add(orangeAccentLight);

  // Attempt to load GLB model if available, otherwise build procedural high-detail HexaGLAM_K
  let glbLoaded = false;
  if (typeof THREE.GLTFLoader !== 'undefined') {
    const loader = new THREE.GLTFLoader();
    loader.load('assets/hexapod.glb', (gltf) => {
      robotMasterGroup = gltf.scene;
      robotMasterGroup.position.set(0, 0, 0);
      robotMasterGroup.scale.set(1, 1, 1);
      hexapodScene.add(robotMasterGroup);
      glbLoaded = true;
      if (loadingElem) loadingElem.style.display = 'none';
    }, undefined, () => {
      // Fallback: build high-fidelity procedural model matching HexaGLAM_K
      buildProceduralHexaGLAM();
      if (loadingElem) loadingElem.style.display = 'none';
    });
  } else {
    buildProceduralHexaGLAM();
    if (loadingElem) loadingElem.style.display = 'none';
  }

  // Setup HUD tracking
  setupHudTracking();

  // Toolbar button listeners
  setupToolbarButtons(defaultCamPos);

  // Handle Resize
  window.addEventListener('resize', onThreeResize);

  // Animation Loop
  animateThree();
}

function buildProceduralHexaGLAM() {
  robotMasterGroup = new THREE.Group();
  legHierarchy = [];

  // Materials matching the actual HexaGLAM_K
  const chassisMat = new THREE.MeshStandardMaterial({
    color: 0x1A1D20,
    metalness: 0.35,
    roughness: 0.55,
  });

  const orangeRimMat = new THREE.MeshStandardMaterial({
    color: 0xF59E0B,
    metalness: 0.2,
    roughness: 0.3,
    emissive: 0xF59E0B,
    emissiveIntensity: 0.25
  });

  const legCarbonMat = new THREE.MeshStandardMaterial({
    color: 0x111315,
    metalness: 0.4,
    roughness: 0.6,
  });

  const servoMetalMat = new THREE.MeshStandardMaterial({
    color: 0x2C3038,
    metalness: 0.7,
    roughness: 0.3,
  });

  const silverScrewMat = new THREE.MeshStandardMaterial({
    color: 0xE2E8F0,
    metalness: 0.9,
    roughness: 0.1,
  });

  const lensGlassMat = new THREE.MeshPhysicalMaterial({
    color: 0x102030,
    metalness: 0.1,
    roughness: 0.05,
    transmission: 0.8,
    thickness: 0.5,
  });

  // 1. Central Hexagonal Body Chassis
  const hexBodyShape = new THREE.Shape();
  const hexRadius = 1.6;
  for (let i = 0; i < 6; i++) {
    const angle = (i * 60 - 30) * Math.PI / 180;
    const x = hexRadius * Math.cos(angle);
    const y = hexRadius * Math.sin(angle);
    if (i === 0) hexBodyShape.moveTo(x, y);
    else hexBodyShape.lineTo(x, y);
  }
  hexBodyShape.closePath();

  const extrudeSettings = { depth: 0.9, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: 0.08, bevelThickness: 0.08 };
  const hexBodyGeo = new THREE.ExtrudeGeometry(hexBodyShape, extrudeSettings);
  const hexBodyMesh = new THREE.Mesh(hexBodyGeo, chassisMat);
  hexBodyMesh.rotation.x = Math.PI / 2;
  hexBodyMesh.position.y = 0.45;
  hexBodyMesh.castShadow = true;
  hexBodyMesh.receiveShadow = true;
  robotMasterGroup.add(hexBodyMesh);

  // Orange Chassis Rim Accent Line (as visible in real robot)
  const rimGeo = new THREE.CylinderGeometry(1.68, 1.68, 0.08, 6);
  const rimMesh = new THREE.Mesh(rimGeo, orangeRimMat);
  rimMesh.position.y = 0.0;
  rimMesh.rotation.y = Math.PI / 6;
  robotMasterGroup.add(rimMesh);

  // Top Electronics Hex Cover with Ventilation Slots
  const topCoverGeo = new THREE.CylinderGeometry(1.4, 1.55, 0.5, 6);
  const topCoverMesh = new THREE.Mesh(topCoverGeo, chassisMat);
  topCoverMesh.position.y = 0.72;
  topCoverMesh.rotation.y = Math.PI / 6;
  topCoverMesh.castShadow = true;
  robotMasterGroup.add(topCoverMesh);

  // ESP32-CAM Forward Mount
  const camHousingGeo = new THREE.BoxGeometry(0.55, 0.4, 0.35);
  const camHousing = new THREE.Mesh(camHousingGeo, chassisMat);
  camHousing.position.set(0, 0.42, 1.65);
  robotMasterGroup.add(camHousing);

  const camLensGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.1, 16);
  const camLens = new THREE.Mesh(camLensGeo, lensGlassMat);
  camLens.rotation.x = Math.PI / 2;
  camLens.position.set(0, 0.42, 1.83);
  robotMasterGroup.add(camLens);

  // Internal ESP32 & PCB Details inside chassis
  const pcbGeo = new THREE.BoxGeometry(1.2, 0.06, 0.9);
  const pcbMat = new THREE.MeshStandardMaterial({ color: 0x15803D, roughness: 0.4 });
  const pcbMesh = new THREE.Mesh(pcbGeo, pcbMat);
  pcbMesh.position.set(0, 0.15, 0);
  robotMasterGroup.add(pcbMesh);

  // 2. Build 6 Articulated Legs (3 DOF per leg: Coxa, Femur, Tibia)
  const legAngles = [
    { id: 'FL', angle: 45, xSign: -1, zSign: 1, group: 'A' },   // Front-Left (Group A)
    { id: 'ML', angle: 90, xSign: -1, zSign: 0, group: 'B' },   // Middle-Left (Group B)
    { id: 'RL', angle: 135, xSign: -1, zSign: -1, group: 'A' }, // Rear-Left (Group A)
    { id: 'FR', angle: -45, xSign: 1, zSign: 1, group: 'B' },   // Front-Right (Group B)
    { id: 'MR', angle: -90, xSign: 1, zSign: 0, group: 'A' },   // Middle-Right (Group A)
    { id: 'RR', angle: -135, xSign: 1, zSign: -1, group: 'B' }  // Rear-Right (Group B)
  ];

  legAngles.forEach((info, idx) => {
    const legBaseGroup = new THREE.Group();
    const rad = info.angle * Math.PI / 180;
    const spawnDist = 1.45;
    legBaseGroup.position.set(Math.sin(rad) * spawnDist, 0, Math.cos(rad) * spawnDist);
    legBaseGroup.rotation.y = rad;

    // Joint 1: COXA (Hip Yaw Joint)
    const coxaGroup = new THREE.Group();
    const coxaServo = createServoMesh(servoMetalMat, silverScrewMat);
    coxaGroup.add(coxaServo);

    const coxaBracketGeo = new THREE.BoxGeometry(0.35, 0.4, 0.6);
    const coxaBracket = new THREE.Mesh(coxaBracketGeo, legCarbonMat);
    coxaBracket.position.set(0, 0, 0.35);
    coxaBracket.castShadow = true;
    coxaGroup.add(coxaBracket);

    legBaseGroup.add(coxaGroup);

    // Joint 2: FEMUR (Thigh Pitch Joint)
    const femurGroup = new THREE.Group();
    femurGroup.position.set(0, 0, 0.65);

    const femurServo = createServoMesh(servoMetalMat, silverScrewMat);
    femurServo.rotation.z = Math.PI / 2;
    femurGroup.add(femurServo);

    // Curved Femur Leg Bracket (matching real HexaGLAM_K curved carbon legs)
    const femurBoneGeo = new THREE.BoxGeometry(0.24, 0.38, 1.4);
    const femurBone = new THREE.Mesh(femurBoneGeo, legCarbonMat);
    femurBone.position.set(0, 0.25, 0.7);
    femurBone.rotation.x = -0.35;
    femurBone.castShadow = true;
    femurGroup.add(femurBone);

    coxaGroup.add(femurGroup);

    // Joint 3: TIBIA (Knee & Curved Foot Joint)
    const tibiaGroup = new THREE.Group();
    tibiaGroup.position.set(0, 0.55, 1.35);

    const tibiaServo = createServoMesh(servoMetalMat, silverScrewMat);
    tibiaServo.rotation.z = Math.PI / 2;
    tibiaGroup.add(tibiaServo);

    // High Curved Tibia Blade reaching ground
    const tibiaCurveGeo = new THREE.BoxGeometry(0.18, 0.3, 2.2);
    const tibiaCurve = new THREE.Mesh(tibiaCurveGeo, legCarbonMat);
    tibiaCurve.position.set(0, -0.85, 0.7);
    tibiaCurve.rotation.x = 0.95;
    tibiaCurve.castShadow = true;
    tibiaGroup.add(tibiaCurve);

    // Rubber Grip Foot Tip
    const footTipGeo = new THREE.SphereGeometry(0.12, 12, 12);
    const footTipMat = new THREE.MeshStandardMaterial({ color: 0x0A0A0A, roughness: 0.9 });
    const footTip = new THREE.Mesh(footTipGeo, footTipMat);
    footTip.position.set(0, -1.85, 1.45);
    tibiaGroup.add(footTip);

    femurGroup.add(tibiaGroup);

    robotMasterGroup.add(legBaseGroup);

    legHierarchy.push({
      id: info.id,
      group: info.group,
      baseGroup: legBaseGroup,
      coxaGroup: coxaGroup,
      femurGroup: femurGroup,
      tibiaGroup: tibiaGroup,
      defaultAngle: rad,
      index: idx
    });
  });

  robotMasterGroup.position.y = 1.8;
  hexapodScene.add(robotMasterGroup);
}

function createServoMesh(metalMat, screwMat) {
  const group = new THREE.Group();
  const boxGeo = new THREE.BoxGeometry(0.42, 0.52, 0.42);
  const box = new THREE.Mesh(boxGeo, metalMat);
  box.castShadow = true;
  group.add(box);

  const hornGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.08, 16);
  const horn = new THREE.Mesh(hornGeo, screwMat);
  horn.position.y = 0.28;
  group.add(horn);

  return group;
}

function setupToolbarButtons(defaultCamPos) {
  const btnWalk = document.getElementById('btn3dWalk');
  const btnStand = document.getElementById('btn3dStand');
  const btnWave = document.getElementById('btn3dWave');
  const btnWireframe = document.getElementById('btn3dWireframe');
  const btnReset = document.getElementById('btnResetView');

  const modeButtons = [btnWalk, btnStand, btnWave];

  function setActiveToolBtn(btn) {
    modeButtons.forEach(b => b && b.classList.remove('active'));
    if (btn) btn.classList.add('active');
  }

  if (btnWalk) {
    btnWalk.addEventListener('click', () => {
      animMode = 'walk';
      setActiveToolBtn(btnWalk);
    });
  }

  if (btnStand) {
    btnStand.addEventListener('click', () => {
      animMode = 'stand';
      setActiveToolBtn(btnStand);
    });
  }

  if (btnWave) {
    btnWave.addEventListener('click', () => {
      animMode = 'wave';
      setActiveToolBtn(btnWave);
    });
  }

  if (btnWireframe) {
    btnWireframe.addEventListener('click', () => {
      isWireframe = !isWireframe;
      btnWireframe.classList.toggle('active', isWireframe);
      if (robotMasterGroup) {
        robotMasterGroup.traverse(child => {
          if (child.isMesh && child.material) {
            child.material.wireframe = isWireframe;
          }
        });
      }
    });
  }

  if (btnReset) {
    btnReset.addEventListener('click', () => {
      if (hexapodCamera && hexapodControls) {
        hexapodCamera.position.set(defaultCamPos.x, defaultCamPos.y, defaultCamPos.z);
        hexapodControls.target.set(0, 0, 0);
        hexapodControls.update();
      }
    });
  }
}

function setupHudTracking() {
  hudPins = [
    { elem: document.getElementById('hudEsp32'), pos: new THREE.Vector3(0, 2.2, 0) },
    { elem: document.getElementById('hudCam'), pos: new THREE.Vector3(0, 2.2, 1.8) },
    { elem: document.getElementById('hudServos'), pos: new THREE.Vector3(-1.8, 1.8, 0.9) },
    { elem: document.getElementById('hudPca'), pos: new THREE.Vector3(1.4, 2.0, -0.6) },
    { elem: document.getElementById('hudSensors'), pos: new THREE.Vector3(0, 1.6, -1.5) }
  ];
}

function updateHudOverlayPositions() {
  if (!hexapodCamera || !hexapodRenderer) return;
  const canvas = hexapodRenderer.domElement;
  const widthHalf = canvas.clientWidth / 2;
  const heightHalf = canvas.clientHeight / 2;

  hudPins.forEach(item => {
    if (!item.elem) return;
    const tempVec = item.pos.clone();
    tempVec.project(hexapodCamera);

    // Check if behind camera
    if (tempVec.z > 1) {
      item.elem.style.display = 'none';
      return;
    }

    item.elem.style.display = 'block';
    const x = (tempVec.x * widthHalf) + widthHalf;
    const y = -(tempVec.y * heightHalf) + heightHalf;
    item.elem.style.left = `${x}px`;
    item.elem.style.top = `${y}px`;
  });
}

function animateThree() {
  requestAnimationFrame(animateThree);

  animTime += 0.035;

  if (robotMasterGroup && legHierarchy.length === 6) {
    if (animMode === 'walk') {
      // Coordinated Alternating Tripod Walking Kinematics
      const strideFreq = 2.4;
      const t = animTime * strideFreq;

      legHierarchy.forEach(leg => {
        const isGroupA = leg.group === 'A';
        const phase = isGroupA ? t : t + Math.PI;

        const lift = Math.max(0, Math.sin(phase)); // 0 when grounded, >0 when lifted
        const sweep = Math.cos(phase);             // Forward / backward sweep

        leg.coxaGroup.rotation.y = sweep * 0.28;
        leg.femurGroup.rotation.x = -0.3 + lift * 0.55;
        leg.tibiaGroup.rotation.x = 0.25 - lift * 0.45;
      });

      // Subtle chassis bounce & roll
      robotMasterGroup.position.y = 1.8 + Math.abs(Math.sin(t * 2)) * 0.08;
      robotMasterGroup.rotation.z = Math.sin(t) * 0.02;

    } else if (animMode === 'stand') {
      // Neutral Stand Posture
      legHierarchy.forEach(leg => {
        leg.coxaGroup.rotation.y = THREE.MathUtils.lerp(leg.coxaGroup.rotation.y, 0, 0.1);
        leg.femurGroup.rotation.x = THREE.MathUtils.lerp(leg.femurGroup.rotation.x, -0.15, 0.1);
        leg.tibiaGroup.rotation.x = THREE.MathUtils.lerp(leg.tibiaGroup.rotation.x, 0.1, 0.1);
      });
      robotMasterGroup.position.y = THREE.MathUtils.lerp(robotMasterGroup.position.y, 1.8, 0.1);
      robotMasterGroup.rotation.z = THREE.MathUtils.lerp(robotMasterGroup.rotation.z, 0, 0.1);

    } else if (animMode === 'wave') {
      // Dance wave animation across all legs
      legHierarchy.forEach((leg, i) => {
        const wavePhase = animTime * 3.5 + (i * 1.05);
        leg.coxaGroup.rotation.y = Math.sin(wavePhase) * 0.35;
        leg.femurGroup.rotation.x = -0.2 + Math.cos(wavePhase) * 0.6;
        leg.tibiaGroup.rotation.x = 0.1 - Math.sin(wavePhase) * 0.5;
      });
      robotMasterGroup.position.y = 1.8 + Math.sin(animTime * 4) * 0.15;
    } else if (animMode === 'turn') {
      // Turn left / right kinematics
      const t = animTime * 2.5;
      legHierarchy.forEach((leg, i) => {
        const isGroupA = leg.group === 'A';
        const phase = isGroupA ? t : t + Math.PI;
        const lift = Math.max(0, Math.sin(phase));
        const sweep = Math.cos(phase) * (leg.baseGroup.position.x > 0 ? 0.35 : -0.35);
        leg.coxaGroup.rotation.y = sweep;
        leg.femurGroup.rotation.x = -0.3 + lift * 0.55;
      });
      robotMasterGroup.rotation.y += 0.01;
    }
  }

  if (hexapodControls) {
    hexapodControls.update();
  }

  updateHudOverlayPositions();

  if (hexapodRenderer && hexapodScene && hexapodCamera) {
    hexapodRenderer.render(hexapodScene, hexapodCamera);
  }
}

function onThreeResize() {
  const container = document.getElementById('threeCanvasContainer');
  if (!container || !hexapodRenderer || !hexapodCamera) return;
  const width = container.clientWidth;
  const height = container.clientHeight;
  hexapodCamera.aspect = width / height;
  hexapodCamera.updateProjectionMatrix();
  hexapodRenderer.setSize(width, height);
}

/* ============================================================
   3. 2D LEG KINEMATICS CANVAS SIMULATOR
   ============================================================ */
function initLegKinematicsCanvas() {
  const canvas = document.getElementById('legCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const sliderCoxa = document.getElementById('sliderCoxa');
  const sliderFemur = document.getElementById('sliderFemur');
  const sliderTibia = document.getElementById('sliderTibia');
  const valCoxa = document.getElementById('valCoxa');
  const valFemur = document.getElementById('valFemur');
  const valTibia = document.getElementById('valTibia');
  const btnReset = document.getElementById('btnResetLegSliders');

  function renderLeg() {
    const coxaAngle = parseFloat(sliderCoxa.value);
    const femurAngle = parseFloat(sliderFemur.value);
    const tibiaAngle = parseFloat(sliderTibia.value);

    valCoxa.textContent = `${coxaAngle}°`;
    valFemur.textContent = `${femurAngle}°`;
    valTibia.textContent = `${tibiaAngle}°`;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Coordinate system origin at chassis mount point
    const originX = 80;
    const originY = 120;

    // Draw Chassis Base Section
    ctx.fillStyle = '#172033';
    ctx.fillRect(20, originY - 35, 60, 70);
    ctx.fillStyle = '#F59E0B';
    ctx.fillRect(75, originY - 35, 5, 70);

    // Ground Line
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(20, 230);
    ctx.lineTo(420, 230);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#94A3B8';
    ctx.font = '11px JetBrains Mono';
    ctx.fillText('GROUND LEVEL (Z = 0)', 300, 222);

    // Kinematic forward projection
    // Coxa segment length = 45px
    const coxaLen = 45;
    const coxaRad = (coxaAngle * Math.PI) / 180;
    const joint1X = originX + coxaLen * Math.cos(coxaRad * 0.4);
    const joint1Y = originY - coxaLen * Math.sin(coxaRad * 0.4);

    // Femur segment length = 95px
    const femurLen = 95;
    const femurRad = (-femurAngle * Math.PI) / 180;
    const joint2X = joint1X + femurLen * Math.cos(femurRad);
    const joint2Y = joint1Y + femurLen * Math.sin(femurRad);

    // Tibia segment length = 125px
    const tibiaLen = 125;
    const totalTibiaRad = femurRad + ((-tibiaAngle - 60) * Math.PI) / 180;
    const footX = joint2X + tibiaLen * Math.cos(totalTibiaRad);
    const footY = joint2Y + tibiaLen * Math.sin(totalTibiaRad);

    // 1. Draw Coxa Link
    ctx.strokeStyle = '#174EA6';
    ctx.lineWidth = 12;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(originX, originY);
    ctx.lineTo(joint1X, joint1Y);
    ctx.stroke();

    // 2. Draw Femur Link
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(joint1X, joint1Y);
    ctx.lineTo(joint2X, joint2Y);
    ctx.stroke();

    // 3. Draw Tibia Curved Blade Link
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(joint2X, joint2Y);
    ctx.quadraticCurveTo(joint2X + 30, (joint2Y + footY) / 2, footX, footY);
    ctx.stroke();

    // Joint Pins
    function drawJointPin(x, y, label, color = '#F59E0B') {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#172033';
      ctx.font = 'bold 11px Outfit';
      ctx.fillText(label, x - 15, y - 12);
    }

    drawJointPin(originX, originY, 'COXA (Hip)', '#174EA6');
    drawJointPin(joint1X, joint1Y, 'FEMUR (Thigh)', '#F59E0B');
    drawJointPin(joint2X, joint2Y, 'TIBIA (Knee)', '#38A169');

    // Foot Contact Tip
    ctx.fillStyle = '#DC2626';
    ctx.beginPath();
    ctx.arc(footX, footY, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#172033';
    ctx.font = 'bold 10px JetBrains Mono';
    ctx.fillText(`FOOT (${Math.round(footX)}, ${Math.round(footY)})`, footX - 25, footY + 16);
  }

  [sliderCoxa, sliderFemur, sliderTibia].forEach(s => s.addEventListener('input', renderLeg));

  if (btnReset) {
    btnReset.addEventListener('click', () => {
      sliderCoxa.value = 0;
      sliderFemur.value = 25;
      sliderTibia.value = -40;
      renderLeg();
    });
  }

  renderLeg();
}

/* ============================================================
   4. 2D TRIPOD GAIT SIMULATOR CANVAS
   ============================================================ */
function initTripodGaitSimulator() {
  const canvas = document.getElementById('gaitCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const btnToggle = document.getElementById('btnToggleGaitSim');
  const playIcon = document.getElementById('gaitPlayIcon');
  const playText = document.getElementById('gaitPlayText');
  const speedSlider = document.getElementById('gaitSpeedSlider');
  const phaseBadge = document.getElementById('gaitPhaseBadge');
  const statusGroupA = document.getElementById('statusGroupA');
  const statusGroupB = document.getElementById('statusGroupB');

  let simRunning = true;
  let gaitTime = 0;

  const phaseSteps = [
    document.getElementById('phaseStep1'),
    document.getElementById('phaseStep2'),
    document.getElementById('phaseStep3'),
    document.getElementById('phaseStep4')
  ];

  function drawGaitSim() {
    if (simRunning) {
      const speed = parseFloat(speedSlider.value) || 1.0;
      gaitTime += 0.03 * speed;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    // Phase cycle computation
    const cycle = gaitTime % (Math.PI * 2);
    const isGroupASwing = cycle < Math.PI;

    // Update status elements
    if (phaseBadge) {
      phaseBadge.textContent = isGroupASwing
        ? 'Group A: LIFT + MOVE | Group B: SUPPORTS'
        : 'Group B: LIFT + MOVE | Group A: SUPPORTS';
    }

    if (statusGroupA) {
      statusGroupA.innerHTML = isGroupASwing
        ? 'Status: <strong class="text-orange">LIFT + MOVE (Swinging)</strong>'
        : 'Status: <strong class="text-green">SUPPORTS (Grounded)</strong>';
    }

    if (statusGroupB) {
      statusGroupB.innerHTML = isGroupASwing
        ? 'Status: <strong class="text-green">SUPPORTS (Grounded)</strong>'
        : 'Status: <strong class="text-orange">LIFT + MOVE (Swinging)</strong>';
    }

    // Phase sequence bar indicator
    const stepIdx = Math.floor((cycle / (Math.PI * 2)) * 4);
    phaseSteps.forEach((st, idx) => {
      if (st) st.classList.toggle('active', idx === stepIdx);
    });

    // Heading Arrow (Forward Direction)
    ctx.strokeStyle = '#174EA6';
    ctx.lineWidth = 2.5;
    ctx.fillStyle = '#174EA6';
    ctx.beginPath();
    ctx.moveTo(centerX, centerY - 65);
    ctx.lineTo(centerX, centerY - 110);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(centerX, centerY - 120);
    ctx.lineTo(centerX - 8, centerY - 105);
    ctx.lineTo(centerX + 8, centerY - 105);
    ctx.closePath();
    ctx.fill();

    ctx.font = 'bold 10px JetBrains Mono';
    ctx.fillText('FORWARD HEADING', centerX - 48, centerY - 126);

    // Draw Support Triangle Polygons
    if (isGroupASwing) {
      // Group B is grounded: draw Group B Support Polygon (FR, ML, RR)
      ctx.fillStyle = 'rgba(56, 161, 105, 0.15)';
      ctx.strokeStyle = '#38A169';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(centerX + 110, centerY - 55); // FR
      ctx.lineTo(centerX - 120, centerY);      // ML
      ctx.lineTo(centerX + 110, centerY + 55); // RR
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.setLineDash([]);
    } else {
      // Group A is grounded: draw Group A Support Polygon (FL, MR, RL)
      ctx.fillStyle = 'rgba(23, 78, 166, 0.15)';
      ctx.strokeStyle = '#174EA6';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(centerX - 110, centerY - 55); // FL
      ctx.lineTo(centerX + 120, centerY);      // MR
      ctx.lineTo(centerX - 110, centerY + 55); // RL
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw Hexagonal Robot Body in center
    ctx.fillStyle = '#172033';
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (i * 60 - 30) * Math.PI / 180;
      const hx = centerX + 42 * Math.cos(angle);
      const hy = centerY + 42 * Math.sin(angle);
      if (i === 0) ctx.moveTo(hx, hy);
      else ctx.lineTo(hx, hy);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 11px Outfit';
    ctx.textAlign = 'center';
    ctx.fillText('HEXA', centerX, centerY - 4);
    ctx.font = '8px JetBrains Mono';
    ctx.fillStyle = '#93C5FD';
    ctx.fillText('ESP32 MCU', centerX, centerY + 8);

    // 6 Legs Position & State
    const legData = [
      { id: 'FL', group: 'A', bx: -36, by: -21, fx: -110, fy: -55 },
      { id: 'ML', group: 'B', bx: -42, by: 0,   fx: -120, fy: 0 },
      { id: 'RL', group: 'A', bx: -36, by: 21,  fx: -110, fy: 55 },
      { id: 'FR', group: 'B', bx: 36,  by: -21, fx: 110,  fy: -55 },
      { id: 'MR', group: 'A', bx: 42,  by: 0,   fx: 120,  fy: 0 },
      { id: 'RR', group: 'B', bx: 36,  by: 21,  fx: 110,  fy: 55 }
    ];

    legData.forEach(leg => {
      const isLegSwing = (leg.group === 'A' && isGroupASwing) || (leg.group === 'B' && !isGroupASwing);
      const swingOffset = isLegSwing ? Math.sin(cycle * 2) * 12 : 0;

      const footCurrX = centerX + leg.fx;
      const footCurrY = centerY + leg.fy - swingOffset;

      // Leg line
      ctx.strokeStyle = isLegSwing ? '#F59E0B' : '#174EA6';
      ctx.lineWidth = isLegSwing ? 4 : 5;
      ctx.beginPath();
      ctx.moveTo(centerX + leg.bx, centerY + leg.by);
      ctx.lineTo(footCurrX, footCurrY);
      ctx.stroke();

      // Foot Pad
      ctx.fillStyle = isLegSwing ? '#F59E0B' : '#38A169';
      ctx.beginPath();
      ctx.arc(footCurrX, footCurrY, isLegSwing ? 9 : 7, 0, Math.PI * 2);
      ctx.fill();

      // Label
      ctx.fillStyle = '#172033';
      ctx.font = 'bold 10px JetBrains Mono';
      ctx.fillText(
        `${leg.id} [${leg.group}]`,
        footCurrX + (leg.fx > 0 ? 24 : -24),
        footCurrY + 4
      );
    });

    requestAnimationFrame(drawGaitSim);
  }

  if (btnToggle) {
    btnToggle.addEventListener('click', () => {
      simRunning = !simRunning;
      if (simRunning) {
        playIcon.className = 'fa-solid fa-pause';
        playText.textContent = 'Pause Gait';
      } else {
        playIcon.className = 'fa-solid fa-play';
        playText.textContent = 'Resume Gait';
      }
    });
  }

  drawGaitSim();
}

/* ============================================================
   5. HEXAPOD CAM LIVE VIEWFINDER & CONTROLS
   ============================================================ */
function initCameraControls() {
  const btnCamOn = document.getElementById('btnCamOn');
  const btnCamOff = document.getElementById('btnCamOff');
  const offlineOverlay = document.getElementById('camOfflineOverlay');
  const liveIndicator = document.getElementById('camLiveIndicator');
  const statusText = document.getElementById('camStatusText');
  const viewfinderImg = document.getElementById('viewfinderImg');
  const btnZoom1x = document.getElementById('btnZoom1x');
  const btnZoom2x = document.getElementById('btnZoom2x');
  const hudZoom = document.getElementById('hudZoomLevel');
  const hudTimestamp = document.getElementById('hudTimestamp');

  // Update HUD live clock
  if (hudTimestamp) {
    setInterval(() => {
      const now = new Date();
      hudTimestamp.textContent = now.toTimeString().split(' ')[0] + ' UTC';
    }, 1000);
  }

  if (btnCamOn && btnCamOff && offlineOverlay) {
    btnCamOn.addEventListener('click', () => {
      btnCamOn.classList.add('active');
      btnCamOff.classList.remove('active');
      offlineOverlay.classList.remove('active');
      if (liveIndicator) liveIndicator.style.background = 'var(--color-green-light)';
      if (statusText) statusText.textContent = 'Camera is ON';
    });

    btnCamOff.addEventListener('click', () => {
      btnCamOff.classList.add('active');
      btnCamOn.classList.remove('active');
      offlineOverlay.classList.add('active');
      if (liveIndicator) liveIndicator.style.background = 'var(--color-orange-light)';
      if (statusText) statusText.textContent = 'Camera is OFF';
    });
  }

  if (btnZoom1x && btnZoom2x && viewfinderImg) {
    btnZoom1x.addEventListener('click', () => {
      btnZoom1x.classList.add('active');
      btnZoom2x.classList.remove('active');
      viewfinderImg.style.transform = 'scale(1.0)';
      if (hudZoom) hudZoom.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i> 1.0× ZOOM';
    });

    btnZoom2x.addEventListener('click', () => {
      btnZoom2x.classList.add('active');
      btnZoom1x.classList.remove('active');
      viewfinderImg.style.transform = 'scale(1.6)';
      if (hudZoom) hudZoom.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i> 2.0× DIGITAL';
    });
  }
}

/* ============================================================
   6. SENSOR TELEMETRY CHARTS (CHART.JS)
   ============================================================ */
function initSensorCharts() {
  if (typeof Chart === 'undefined') return;

  const timeLabels = ['11:30:16', '11:30:30', '11:31:02', '11:31:48', '11:32:12', '11:32:58', '11:36:40', '11:37:06'];

  const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { font: { size: 9, family: 'JetBrains Mono' }, maxTicksLimit: 4 }
      },
      y: {
        grid: { color: 'rgba(23, 32, 51, 0.05)' },
        ticks: { font: { size: 9, family: 'JetBrains Mono' } }
      }
    },
    elements: {
      point: { radius: 3, hoverRadius: 5 }
    }
  };

  // 1. Temperature Chart
  const ctxTemp = document.getElementById('chartTemp');
  let chartTemp;
  if (ctxTemp) {
    chartTemp = new Chart(ctxTemp, {
      type: 'line',
      data: {
        labels: [...timeLabels],
        datasets: [{
          data: [26.2, 26.3, 26.5, 26.1, 26.4, 26.3, 26.4, 26.5],
          borderColor: '#174EA6',
          backgroundColor: 'rgba(23, 78, 166, 0.08)',
          fill: true,
          tension: 0.3
        }]
      },
      options: commonOptions
    });
  }

  // 2. Humidity Chart
  const ctxHum = document.getElementById('chartHumidity');
  let chartHum;
  if (ctxHum) {
    chartHum = new Chart(ctxHum, {
      type: 'line',
      data: {
        labels: [...timeLabels],
        datasets: [{
          data: [58.0, 58.2, 58.1, 57.9, 58.3, 58.2, 58.4, 58.2],
          borderColor: '#0284C7',
          backgroundColor: 'rgba(2, 132, 199, 0.08)',
          fill: true,
          tension: 0.3
        }]
      },
      options: commonOptions
    });
  }

  // 3. Rain Sensor Chart
  const ctxRain = document.getElementById('chartRain');
  let chartRain;
  if (ctxRain) {
    chartRain = new Chart(ctxRain, {
      type: 'line',
      data: {
        labels: [...timeLabels],
        datasets: [{
          data: [2350, 2340, 2360, 2330, 2340, 2355, 2340, 2345],
          borderColor: '#38A169',
          backgroundColor: 'rgba(56, 161, 105, 0.08)',
          fill: true,
          tension: 0.2
        }]
      },
      options: commonOptions
    });
  }

  // 4. Soil Moisture Chart
  const ctxSoil = document.getElementById('chartSoil');
  let chartSoil;
  if (ctxSoil) {
    chartSoil = new Chart(ctxSoil, {
      type: 'line',
      data: {
        labels: [...timeLabels],
        datasets: [{
          data: [3890, 3910, 3880, 3900, 3895, 3890, 3905, 3890],
          borderColor: '#D97706',
          backgroundColor: 'rgba(217, 119, 6, 0.08)',
          fill: true,
          tension: 0.3
        }]
      },
      options: commonOptions
    });
  }

  // Simulate Trigger Updates / Live Telemetry Stream
  const btnTrigger = document.getElementById('btnSimulateTrigger');
  const tempGauge = document.getElementById('telemetryTemp');
  const humGauge = document.getElementById('telemetryHumidity');
  const rainGauge = document.getElementById('telemetryRain');
  const soilGauge = document.getElementById('telemetrySoil');

  function updateTelemetryData() {
    const newTemp = (25.8 + Math.random() * 1.2).toFixed(1);
    const newHum = (57.5 + Math.random() * 1.5).toFixed(1);
    const newRain = Math.round(2320 + Math.random() * 50);
    const newSoil = Math.round(3870 + Math.random() * 40);

    if (tempGauge) tempGauge.textContent = newTemp;
    if (humGauge) humGauge.textContent = newHum;
    if (rainGauge) rainGauge.textContent = newRain.toLocaleString();
    if (soilGauge) soilGauge.textContent = newSoil.toLocaleString();

    if (chartTemp) {
      chartTemp.data.datasets[0].data.shift();
      chartTemp.data.datasets[0].data.push(parseFloat(newTemp));
      chartTemp.update('none');
    }

    if (chartHum) {
      chartHum.data.datasets[0].data.shift();
      chartHum.data.datasets[0].data.push(parseFloat(newHum));
      chartHum.update('none');
    }

    if (chartRain) {
      chartRain.data.datasets[0].data.shift();
      chartRain.data.datasets[0].data.push(newRain);
      chartRain.update('none');
    }

    if (chartSoil) {
      chartSoil.data.datasets[0].data.shift();
      chartSoil.data.datasets[0].data.push(newSoil);
      chartSoil.update('none');
    }
  }

  if (btnTrigger) {
    btnTrigger.addEventListener('click', updateTelemetryData);
  }

  // Periodic subtle live tick every 4.5s
  setInterval(updateTelemetryData, 4500);
}

/* ============================================================
   7. ROBOT CONTROL CONSOLE
   ============================================================ */
function initRobotControlPad() {
  const modeButtons = document.querySelectorAll('.keypad-btn');
  const activeLabel = document.getElementById('activeModeLabel');
  const logStream = document.getElementById('ctrlLogStream');

  modeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      modeButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const mode = btn.getAttribute('data-mode');
      if (activeLabel) activeLabel.textContent = mode.toUpperCase();

      // Trigger 3D Robot kinematic response
      if (mode === 'stand') animMode = 'stand';
      else if (mode === 'walk') animMode = 'walk';
      else if (mode === 'dance') animMode = 'wave';
      else if (mode === 'left' || mode === 'right') animMode = 'turn';
      else if (mode === 'halt') animMode = 'stand';

      // Append Log Command
      if (logStream) {
        const timeStr = new Date().toTimeString().split(' ')[0];
        const logLine = document.createElement('div');
        logLine.textContent = `[${timeStr}] CMD Sent: ${mode.toUpperCase()} -> ESP32 Ack [OK]`;
        if (mode === 'halt') logLine.style.color = '#F87171';
        logStream.appendChild(logLine);
        logStream.scrollTop = logStream.scrollHeight;
      }
    });
  });
}

/* ============================================================
   8. LIGHTBOX IMAGE GALLERY
   ============================================================ */
function initLightboxGallery() {
  const modal = document.getElementById('lightboxModal');
  const lightboxImg = document.getElementById('lightboxImg');
  const lightboxCaption = document.getElementById('lightboxCaption');
  const btnClose = document.getElementById('lightboxClose');
  const btnPrev = document.getElementById('lightboxPrev');
  const btnNext = document.getElementById('lightboxNext');
  const backdrop = document.getElementById('lightboxBackdrop');

  const galleryItems = document.querySelectorAll('.gallery-item');
  const zoomableImages = document.querySelectorAll('.zoomable-img');

  let currentIdx = 0;
  const galleryList = [];

  galleryItems.forEach((item, idx) => {
    galleryList.push({
      src: item.getAttribute('data-src'),
      caption: item.getAttribute('data-caption') || ''
    });

    item.addEventListener('click', () => {
      openLightbox(idx);
    });
  });

  // Allow clicking on any standalone project image to inspect
  zoomableImages.forEach(img => {
    img.style.cursor = 'zoom-in';
    img.addEventListener('click', () => {
      if (modal && lightboxImg) {
        lightboxImg.src = img.src;
        if (lightboxCaption) lightboxCaption.textContent = img.alt || 'HexaGLAM_K Project Visual';
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
      }
    });
  });

  function openLightbox(idx) {
    if (!modal || !lightboxImg || galleryList.length === 0) return;
    currentIdx = idx;
    lightboxImg.src = galleryList[currentIdx].src;
    if (lightboxCaption) lightboxCaption.textContent = galleryList[currentIdx].caption;
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    if (modal) {
      modal.classList.remove('active');
      document.body.style.overflow = '';
    }
  }

  function showPrev() {
    currentIdx = (currentIdx - 1 + galleryList.length) % galleryList.length;
    openLightbox(currentIdx);
  }

  function showNext() {
    currentIdx = (currentIdx + 1) % galleryList.length;
    openLightbox(currentIdx);
  }

  if (btnClose) btnClose.addEventListener('click', closeLightbox);
  if (backdrop) backdrop.addEventListener('click', closeLightbox);
  if (btnPrev) btnPrev.addEventListener('click', (e) => { e.stopPropagation(); showPrev(); });
  if (btnNext) btnNext.addEventListener('click', (e) => { e.stopPropagation(); showNext(); });

  window.addEventListener('keydown', (e) => {
    if (!modal || !modal.classList.contains('active')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') showPrev();
    if (e.key === 'ArrowRight') showNext();
  });
}

/* ============================================================
   9. SCROLL REVEAL ANIMATIONS
   ============================================================ */
function initScrollAnimations() {
  const cards = document.querySelectorAll('.white-card, .stat-card, .view-card, .sensor-card, .step-card, .app-card, .hw-card');

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08 });

  cards.forEach(card => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(20px)';
    card.style.transition = 'opacity 0.5s ease-out, transform 0.5s ease-out';
    observer.observe(card);
  });
}
