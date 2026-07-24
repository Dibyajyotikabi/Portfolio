import { useEffect, useRef, useState } from 'react';

const PATH_POINTS = [
  [
    [-1.7, -0.82, 0.08],
    [-1.08, -0.28, 0.32],
    [-0.5, 0.5, 0.04],
    [0.18, 0.08, 0.46],
    [0.9, -0.42, 0.16],
    [1.68, 0.34, 0.02],
  ],
  [
    [-1.52, 0.68, -0.18],
    [-0.84, 0.24, 0.18],
    [-0.14, 0.72, -0.04],
    [0.56, 0.28, 0.3],
    [1.5, 0.84, -0.12],
  ],
  [
    [-1.28, -0.12, -0.38],
    [-0.5, -0.72, -0.08],
    [0.24, -0.38, 0.22],
    [0.94, 0.04, -0.14],
    [1.58, -0.5, -0.3],
  ],
];

export default function HeroAmbientField() {
  const fieldRef = useRef(null);
  const canvasRef = useRef(null);
  const pointerRef = useRef({ x: 0, y: 0 });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 821px)');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let disposed = false;
    let sceneCleanup = () => {};
    let generation = 0;

    const reconcile = async () => {
      generation += 1;
      const currentGeneration = generation;
      sceneCleanup();
      sceneCleanup = () => {};
      setReady(false);

      if (!desktop.matches) return;

      try {
        const THREE = await import('three');
        if (disposed || currentGeneration !== generation || !desktop.matches) return;

        const field = fieldRef.current;
        const canvas = canvasRef.current;
        const hero = field?.closest('.hero-band');
        if (!field || !canvas || !hero) return;

        const renderer = new THREE.WebGLRenderer({
          canvas,
          alpha: true,
          antialias: true,
          powerPreference: 'high-performance',
        });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
        renderer.outputColorSpace = THREE.SRGBColorSpace;

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 20);
        camera.position.set(0, 0, 5.6);

        const root = new THREE.Group();
        root.position.set(1.2, 0.05, 0);
        scene.add(root);

        const curves = PATH_POINTS.map(
          (points) =>
            new THREE.CatmullRomCurve3(
              points.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
            ),
        );
        const lineMaterials = [
          new THREE.LineBasicMaterial({
            color: 0xe36b49,
            transparent: true,
            opacity: 0.7,
          }),
          new THREE.LineBasicMaterial({
            color: 0x83939a,
            transparent: true,
            opacity: 0.34,
          }),
          new THREE.LineBasicMaterial({
            color: 0x83939a,
            transparent: true,
            opacity: 0.24,
          }),
        ];

        curves.forEach((curve, index) => {
          const line = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(curve.getPoints(120)),
            lineMaterials[index],
          );
          root.add(line);
        });

        const nodeMaterial = new THREE.MeshBasicMaterial({
          color: 0x9aa9ae,
          transparent: true,
          opacity: 0.72,
        });
        const accentNodeMaterial = new THREE.MeshBasicMaterial({
          color: 0xe36b49,
          transparent: true,
          opacity: 0.95,
        });
        const nodeGeometry = new THREE.SphereGeometry(0.035, 14, 14);
        const stationaryNodes = [];

        curves.forEach((curve, curveIndex) => {
          [0.12, 0.34, 0.58, 0.84].forEach((progress, nodeIndex) => {
            const node = new THREE.Mesh(
              nodeGeometry,
              curveIndex === 0 && nodeIndex % 2 === 0
                ? accentNodeMaterial
                : nodeMaterial,
            );
            node.position.copy(curve.getPoint(progress));
            node.userData.phase = curveIndex * 1.7 + nodeIndex * 0.8;
            stationaryNodes.push(node);
            root.add(node);
          });
        });

        const pulseGeometry = new THREE.SphereGeometry(0.055, 16, 16);
        const pulseMaterials = [
          new THREE.MeshBasicMaterial({ color: 0xf58a68 }),
          new THREE.MeshBasicMaterial({ color: 0xb9c6ca }),
          new THREE.MeshBasicMaterial({ color: 0x82969d }),
        ];
        const pulses = curves.flatMap((_, curveIndex) =>
          [0, 0.5].map((offset) => {
            const pulse = new THREE.Mesh(pulseGeometry, pulseMaterials[curveIndex]);
            pulse.userData = { curveIndex, offset };
            root.add(pulse);
            return pulse;
          }),
        );

        const fieldPositions = [];
        for (let row = 0; row < 9; row += 1) {
          for (let column = 0; column < 12; column += 1) {
            if ((row * 5 + column * 3) % 4 !== 0) continue;
            fieldPositions.push(
              -1.9 + column * 0.34,
              -1.32 + row * 0.34,
              -0.72 + ((row + column) % 3) * 0.04,
            );
          }
        }
        const pointGeometry = new THREE.BufferGeometry();
        pointGeometry.setAttribute(
          'position',
          new THREE.Float32BufferAttribute(fieldPositions, 3),
        );
        const pointMaterial = new THREE.PointsMaterial({
          color: 0x87979c,
          size: 0.018,
          transparent: true,
          opacity: 0.34,
          sizeAttenuation: true,
        });
        root.add(new THREE.Points(pointGeometry, pointMaterial));

        const resize = () => {
          const width = Math.max(field.clientWidth, 1);
          const height = Math.max(field.clientHeight, 1);
          renderer.setSize(width, height, false);
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
        };
        window.addEventListener('resize', resize, { passive: true });
        resize();

        const handlePointerMove = (event) => {
          if (event.pointerType === 'touch') return;
          const bounds = hero.getBoundingClientRect();
          pointerRef.current = {
            x: ((event.clientX - bounds.left) / bounds.width - 0.5) * 2,
            y: ((event.clientY - bounds.top) / bounds.height - 0.5) * 2,
          };
        };
        const resetPointer = () => {
          pointerRef.current = { x: 0, y: 0 };
        };
        hero.addEventListener('pointermove', handlePointerMove, { passive: true });
        hero.addEventListener('pointerleave', resetPointer);

        let visible = true;
        let elapsed = 0;
        let frame = 0;
        let previousTime = performance.now();
        const render = (time) => {
          frame = window.requestAnimationFrame(render);
          const delta = Math.min((time - previousTime) / 1000, 0.04);
          previousTime = time;
          const animate = !reducedMotion.matches && visible && !document.hidden;
          if (animate) elapsed += delta;

          const pointer = reducedMotion.matches ? { x: 0, y: 0 } : pointerRef.current;
          root.rotation.y += (pointer.x * 0.12 - root.rotation.y) * 0.045;
          root.rotation.x += (-pointer.y * 0.08 - root.rotation.x) * 0.045;
          root.position.x += (1.2 + pointer.x * 0.12 - root.position.x) * 0.04;
          root.position.y += (0.05 - pointer.y * 0.08 - root.position.y) * 0.04;

          pulses.forEach((pulse) => {
            const { curveIndex, offset } = pulse.userData;
            const progress =
              ((elapsed * (0.055 + curveIndex * 0.012) + offset) % 1 + 1) % 1;
            pulse.position.copy(curves[curveIndex].getPoint(progress));
          });
          stationaryNodes.forEach((node) => {
            const scale = animate
              ? 0.88 + Math.sin(elapsed * 1.8 + node.userData.phase) * 0.18
              : 1;
            node.scale.setScalar(scale);
          });

          renderer.render(scene, camera);
        };

        const intersectionObserver = new IntersectionObserver(
          ([entry]) => {
            visible = entry.isIntersecting;
          },
          { threshold: 0.05 },
        );
        intersectionObserver.observe(hero);

        const applyTheme = () => {
          const dark = document.documentElement.dataset.theme === 'dark';
          lineMaterials[0].color.set(dark ? 0xf18a68 : 0xd95d3d);
          lineMaterials[1].color.set(dark ? 0xa3b2b7 : 0x687b82);
          lineMaterials[2].color.set(dark ? 0x788b92 : 0x77878c);
          accentNodeMaterial.color.set(dark ? 0xf18a68 : 0xd95d3d);
          nodeMaterial.color.set(dark ? 0xa8b6ba : 0x65787e);
          pointMaterial.color.set(dark ? 0x73868c : 0x718187);
        };
        const themeObserver = new MutationObserver(applyTheme);
        themeObserver.observe(document.documentElement, {
          attributes: true,
          attributeFilter: ['data-theme'],
        });
        applyTheme();

        frame = window.requestAnimationFrame(render);
        setReady(true);

        sceneCleanup = () => {
          window.cancelAnimationFrame(frame);
          window.removeEventListener('resize', resize);
          hero.removeEventListener('pointermove', handlePointerMove);
          hero.removeEventListener('pointerleave', resetPointer);
          intersectionObserver.disconnect();
          themeObserver.disconnect();
          scene.traverse((object) => {
            if (object.geometry) object.geometry.dispose();
            if (Array.isArray(object.material)) {
              object.material.forEach((material) => material.dispose());
            } else if (object.material) {
              object.material.dispose();
            }
          });
          renderer.dispose();
        };
      } catch (error) {
        console.warn('Ambient hero field unavailable; using the static fallback.', error);
      }
    };

    desktop.addEventListener('change', reconcile);
    reconcile();

    return () => {
      disposed = true;
      generation += 1;
      desktop.removeEventListener('change', reconcile);
      sceneCleanup();
    };
  }, []);

  return (
    <div
      className={`hero-ambient-field${ready ? ' is-ready' : ''}`}
      aria-hidden="true"
      ref={fieldRef}
    >
      <canvas ref={canvasRef} />
      <svg className="hero-ambient-fallback" viewBox="0 0 520 320" preserveAspectRatio="xMidYMid meet">
        <path d="M34 244C116 230 125 92 217 126S333 272 478 74" />
        <path d="M74 98C157 63 207 171 284 103S395 73 488 128" />
        <path d="M98 207C186 274 241 180 318 213S409 253 492 196" />
        <circle cx="125" cy="187" r="4" />
        <circle cx="217" cy="126" r="4" />
        <circle cx="333" cy="210" r="4" />
        <circle cx="395" cy="88" r="4" />
      </svg>
    </div>
  );
}
