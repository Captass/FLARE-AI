"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, OrbitControls, Text } from "@react-three/drei";
import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";

interface AutomationDeskSceneProps {
  reducedMotion?: boolean;
}

type KeyItem = {
  label: string;
  value: string;
  width?: number;
};

const KEY_ROWS: KeyItem[][] = [
  "AZERTYUIOP".split("").map((letter) => ({ label: letter, value: letter.toLowerCase() })),
  "QSDFGHJKLM".split("").map((letter) => ({ label: letter, value: letter.toLowerCase() })),
  "WXCVBN".split("").map((letter) => ({ label: letter, value: letter.toLowerCase() })),
  [
    { label: "ESPACE", value: " ", width: 0.62 },
    { label: "EFFACER", value: "BACKSPACE", width: 0.52 },
    { label: "ENTREE", value: "ENTER", width: 0.5 },
  ],
];

const PHYSICAL_KEY_MAP: Record<string, KeyItem> = KEY_ROWS.flat().reduce<Record<string, KeyItem>>((map, item) => {
  map[item.label] = item;
  if (item.value.length === 1) map[item.value.toUpperCase()] = item;
  return map;
}, {});

function ScreenLine({ x, y, width, opacity = 0.42, color = "#dbeafe" }: { x: number; y: number; width: number; opacity?: number; color?: string }) {
  return (
    <mesh position={[x, y, 0.018]}>
      <boxGeometry args={[width, 0.018, 0.01]} />
      <meshBasicMaterial color={color} transparent opacity={opacity} />
    </mesh>
  );
}

function ScreenDashboard({ typedText, reducedMotion }: { typedText: string; reducedMotion: boolean }) {
  const automationRef = useRef<THREE.Group>(null);
  const cursorRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!reducedMotion && automationRef.current) {
      automationRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.9) * 0.012;
    }
    if (!reducedMotion && cursorRef.current) {
      const material = cursorRef.current.material as THREE.MeshBasicMaterial;
      material.opacity = 0.25 + (Math.sin(state.clock.elapsedTime * 5.2) + 1) * 0.32;
    }
  });

  return (
    <group position={[0, 0.26, 0.088]}>
      <mesh position={[0, 0, -0.002]}>
        <boxGeometry args={[2.16, 1.03, 0.012]} />
        <meshBasicMaterial color="#0b1526" />
      </mesh>

      <Text position={[-0.98, 0.43, 0.02]} fontSize={0.066} anchorX="left" anchorY="middle" color="#f8fafc">
        FLARE AI
      </Text>
      <Text position={[0.88, 0.43, 0.02]} fontSize={0.052} anchorX="right" anchorY="middle" color="#fb923c">
        AUTO
      </Text>

      <group position={[-0.57, 0.06, 0.006]}>
        <mesh position={[0, 0, -0.002]}>
          <boxGeometry args={[0.96, 0.66, 0.012]} />
          <meshBasicMaterial color="#0f1724" transparent opacity={0.92} />
        </mesh>
        <Text position={[-0.4, 0.22, 0.02]} fontSize={0.043} anchorX="left" anchorY="middle" color="#94a3b8">
          message client
        </Text>
        <ScreenLine x={-0.12} y={0.1} width={0.54} />
        <ScreenLine x={-0.08} y={0.0} width={0.64} opacity={0.32} />
        <Text position={[-0.4, -0.19, 0.02]} fontSize={0.043} anchorX="left" anchorY="middle" color="#fb923c">
          reponse IA prete
        </Text>
        <ScreenLine x={-0.1} y={-0.3} width={0.58} opacity={0.36} color="#fb923c" />
      </group>

      <group ref={automationRef} position={[0.58, 0.06, 0.008]}>
        <mesh position={[0, 0, -0.002]}>
          <boxGeometry args={[0.86, 0.66, 0.012]} />
          <meshBasicMaterial color="#101418" transparent opacity={0.94} />
        </mesh>
        {[
          { x: -0.27, y: 0.14, color: "#f8fafc" },
          { x: 0, y: 0.02, color: "#fb923c" },
          { x: 0.28, y: -0.12, color: "#f8fafc" },
        ].map((node, index) => (
          <group key={index} position={[node.x, node.y, 0.012]}>
            <mesh>
              <boxGeometry args={[index === 1 ? 0.1 : 0.072, index === 1 ? 0.1 : 0.072, 0.01]} />
              <meshBasicMaterial color={node.color} transparent opacity={index === 1 ? 0.88 : 0.56} />
            </mesh>
            {index < 2 ? (
              <mesh position={[0.14, -0.065, 0]} rotation={[0, 0, -0.42]}>
                <boxGeometry args={[0.24, 0.012, 0.008]} />
                <meshBasicMaterial color="#fb923c" transparent opacity={0.42} />
              </mesh>
            ) : null}
          </group>
        ))}
        <Text position={[-0.33, -0.31, 0.02]} fontSize={0.04} anchorX="left" anchorY="middle" color="#94a3b8">
          valide FLARE
        </Text>
      </group>

      <mesh position={[0, -0.41, 0.01]}>
        <boxGeometry args={[2.02, 0.17, 0.012]} />
        <meshBasicMaterial color="#05070b" transparent opacity={0.92} />
      </mesh>
      <Text position={[-0.94, -0.41, 0.024]} fontSize={0.052} anchorX="left" anchorY="middle" color="#f8fafc">
        {`> ${typedText || "cliquez le clavier"}`}
      </Text>
      <mesh ref={cursorRef} position={[0.94, -0.41, 0.024]}>
        <boxGeometry args={[0.024, 0.082, 0.01]} />
        <meshBasicMaterial color="#fb923c" transparent opacity={0.8} />
      </mesh>
    </group>
  );
}

function useKeyClickSound() {
  const audioContextRef = useRef<AudioContext | null>(null);

  return useCallback(() => {
    if (typeof window === "undefined") return;

    const AudioContextCtor =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

    if (!AudioContextCtor) return;

    const audioContext = audioContextRef.current ?? new AudioContextCtor();
    audioContextRef.current = audioContext;

    if (audioContext.state === "suspended") {
      audioContext.resume().catch(() => undefined);
    }

    const now = audioContext.currentTime;
    const duration = 0.045;
    const sampleCount = Math.max(1, Math.floor(audioContext.sampleRate * duration));
    const buffer = audioContext.createBuffer(1, sampleCount, audioContext.sampleRate);
    const channel = buffer.getChannelData(0);

    for (let index = 0; index < sampleCount; index += 1) {
      const envelope = 1 - index / sampleCount;
      channel[index] = (Math.random() * 2 - 1) * envelope;
    }

    const noise = audioContext.createBufferSource();
    noise.buffer = buffer;

    const filter = audioContext.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(2600, now);
    filter.Q.setValueAtTime(7.5, now);

    const clickGain = audioContext.createGain();
    clickGain.gain.setValueAtTime(0.0001, now);
    clickGain.gain.exponentialRampToValueAtTime(0.085, now + 0.004);
    clickGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    const transient = audioContext.createOscillator();
    const transientGain = audioContext.createGain();
    transient.type = "square";
    transient.frequency.setValueAtTime(1550, now);
    transient.frequency.exponentialRampToValueAtTime(780, now + 0.026);
    transientGain.gain.setValueAtTime(0.0001, now);
    transientGain.gain.exponentialRampToValueAtTime(0.025, now + 0.002);
    transientGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.028);

    noise.connect(filter);
    filter.connect(clickGain);
    clickGain.connect(audioContext.destination);
    transient.connect(transientGain);
    transientGain.connect(audioContext.destination);

    noise.start(now);
    noise.stop(now + duration);
    transient.start(now);
    transient.stop(now + 0.03);
  }, []);
}

function InteractiveKey({
  item,
  x,
  z,
  isPressed,
  onPress,
}: {
  item: KeyItem;
  x: number;
  z: number;
  isPressed: boolean;
  onPress: (item: KeyItem) => void;
}) {
  const width = item.width ?? 0.17;
  const keyRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (!keyRef.current) return;
    keyRef.current.position.y = THREE.MathUtils.damp(keyRef.current.position.y, isPressed ? 0.185 : 0.22, 18, delta);
  });

  return (
    <group
      ref={keyRef}
      position={[x, 0.22, z]}
      onPointerDown={(event) => {
        event.stopPropagation();
        onPress(item);
      }}
      onPointerOver={() => {
        if (typeof document !== "undefined") document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        if (typeof document !== "undefined") document.body.style.cursor = "";
      }}
    >
      <mesh position={[0, 0.012, 0]} renderOrder={10}>
        <boxGeometry args={[width + 0.045, 0.09, 0.175]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[width, 0.055, 0.14]} />
        <meshStandardMaterial
          color={isPressed ? "#fb923c" : "#151a22"}
          roughness={0.54}
          metalness={0.12}
          emissive={isPressed ? "#5a2108" : "#000000"}
          emissiveIntensity={isPressed ? 0.35 : 0}
        />
      </mesh>
      <Text
        position={[0, 0.031, 0.004]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={item.label.length > 1 ? 0.035 : 0.052}
        anchorX="center"
        anchorY="middle"
        color={isPressed ? "#111827" : "#dbeafe"}
      >
        {item.label}
      </Text>
    </group>
  );
}

function InteractiveKeyboard({ setTypedText }: { setTypedText: React.Dispatch<React.SetStateAction<string>> }) {
  const [pressedKey, setPressedKey] = useState<string | null>(null);
  const playKeyClick = useKeyClickSound();

  const handlePress = useCallback(
    (item: KeyItem) => {
      playKeyClick();
      setPressedKey(item.label);
      window.setTimeout(() => setPressedKey(null), 120);

      setTypedText((current) => {
        if (item.value === "BACKSPACE") return current.slice(0, -1);
        if (item.value === "ENTER") return current.trim() ? "automatisation lancee" : "automatisez";
        return `${current}${item.value}`.slice(-28);
      });
    },
    [playKeyClick, setTypedText],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable='true']")) return;

      const normalizedKey =
        event.key === " "
          ? "ESPACE"
          : event.key === "Backspace"
            ? "EFFACER"
            : event.key === "Enter"
              ? "ENTREE"
              : event.key.length === 1
                ? event.key.toUpperCase()
                : "";

      const item = PHYSICAL_KEY_MAP[normalizedKey];
      if (!item) return;

      event.preventDefault();
      handlePress(item);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handlePress]);

  return (
    <group position={[0.08, 0.01, 0.58]}>
      <mesh position={[0, 0.18, 0.08]} castShadow receiveShadow>
        <boxGeometry args={[2.35, 0.08, 0.78]} />
        <meshStandardMaterial color="#0d1118" roughness={0.58} metalness={0.2} />
      </mesh>
      {KEY_ROWS.map((row, rowIndex) => {
        const rowWidth = row.reduce((total, key) => total + (key.width ?? 0.17) + 0.035, -0.035);
        let cursor = -rowWidth / 2;
        return row.map((item) => {
          const width = item.width ?? 0.17;
          const x = cursor + width / 2 + (rowIndex === 1 ? 0.04 : rowIndex === 2 ? 0.18 : 0);
          const z = -0.2 + rowIndex * 0.18;
          cursor += width + 0.035;
          return (
            <InteractiveKey
              key={`${rowIndex}-${item.label}`}
              item={item}
              x={x}
              z={z}
              isPressed={pressedKey === item.label}
              onPress={handlePress}
            />
          );
        });
      })}
    </group>
  );
}

function AutomationOffice({ reducedMotion = false }: AutomationDeskSceneProps) {
  const rigRef = useRef<THREE.Group>(null);
  const screenGlowRef = useRef<THREE.PointLight>(null);
  const [typedText, setTypedText] = useState("automatisez");

  useFrame((state, delta) => {
    if (!rigRef.current) return;
    if (!reducedMotion) {
      rigRef.current.rotation.y = THREE.MathUtils.lerp(rigRef.current.rotation.y, -0.18 + state.pointer.x * 0.08, 0.045);
      rigRef.current.rotation.x = THREE.MathUtils.lerp(rigRef.current.rotation.x, 0.03 - state.pointer.y * 0.035, 0.045);
    }
    if (screenGlowRef.current) {
      screenGlowRef.current.intensity = reducedMotion ? 1.6 : 1.45 + Math.sin(state.clock.elapsedTime * 1.6) * 0.18;
    }
    if (!reducedMotion) {
      rigRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.42) * 0.025;
    } else {
      rigRef.current.position.y = THREE.MathUtils.damp(rigRef.current.position.y, 0, 4, delta);
    }
  });

  return (
    <group ref={rigRef} position={[0.55, -0.46, 0]} rotation={[0.03, -0.18, 0]}>
      <group position={[0, 0, 0]}>
        <mesh position={[0, 0, 0]} receiveShadow>
          <boxGeometry args={[5.6, 0.18, 2.2]} />
          <meshStandardMaterial color="#211812" roughness={0.58} metalness={0.08} />
        </mesh>
        <mesh position={[0, 0.105, -0.02]} receiveShadow>
          <boxGeometry args={[5.5, 0.018, 2.08]} />
          <meshStandardMaterial color="#3a2619" roughness={0.62} metalness={0.02} />
        </mesh>
      </group>

      <group position={[0.1, 0.78, -0.55]} rotation={[-0.05, 0, 0]}>
        <mesh position={[0, -0.34, 0]} castShadow>
          <boxGeometry args={[0.16, 0.72, 0.14]} />
          <meshStandardMaterial color="#171b24" roughness={0.42} metalness={0.38} />
        </mesh>
        <mesh position={[0, -0.74, 0.1]} castShadow receiveShadow>
          <boxGeometry args={[1.05, 0.1, 0.52]} />
          <meshStandardMaterial color="#141820" roughness={0.48} metalness={0.36} />
        </mesh>
        <mesh position={[0, 0.26, 0]} castShadow receiveShadow>
          <boxGeometry args={[2.55, 1.42, 0.11]} />
          <meshStandardMaterial color="#0a101a" roughness={0.34} metalness={0.28} />
        </mesh>
        <mesh position={[0, 0.26, 0.064]}>
          <boxGeometry args={[2.32, 1.19, 0.018]} />
          <meshBasicMaterial color="#0d2035" />
        </mesh>
        <pointLight ref={screenGlowRef} position={[0, 0.25, 0.18]} color="#ff8a2a" intensity={2.15} distance={4.8} />

        <ScreenDashboard typedText={typedText} reducedMotion={reducedMotion} />

        <mesh position={[0.85, -0.5, 0.09]}>
          <boxGeometry args={[0.18, 0.06, 0.018]} />
          <meshBasicMaterial color="#fb923c" />
        </mesh>
      </group>

      <group position={[-1.52, 0.28, 0.36]} rotation={[-0.34, -0.12, -0.02]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.64, 1.12, 0.07]} />
          <meshStandardMaterial color="#07090e" roughness={0.36} metalness={0.42} />
        </mesh>
        <mesh position={[0, 0, 0.041]}>
          <boxGeometry args={[0.54, 0.94, 0.012]} />
          <meshBasicMaterial color="#101827" />
        </mesh>
        <mesh position={[0, 0.22, 0.056]}>
          <boxGeometry args={[0.34, 0.026, 0.012]} />
          <meshBasicMaterial color="#f8fafc" transparent opacity={0.6} />
        </mesh>
        <mesh position={[0, 0.13, 0.056]}>
          <boxGeometry args={[0.24, 0.02, 0.012]} />
          <meshBasicMaterial color="#60a5fa" transparent opacity={0.58} />
        </mesh>
        <mesh position={[0, -0.08, 0.058]}>
          <boxGeometry args={[0.38, 0.09, 0.012]} />
          <meshBasicMaterial color="#f97316" />
        </mesh>
        <mesh position={[0, -0.26, 0.058]}>
          <boxGeometry args={[0.26, 0.05, 0.012]} />
          <meshBasicMaterial color="#22c55e" />
        </mesh>
      </group>

      <InteractiveKeyboard setTypedText={setTypedText} />
    </group>
  );
}

export default function AutomationDeskScene({ reducedMotion = false }: AutomationDeskSceneProps) {
  return (
    <div className="h-full w-full">
      <Canvas
        shadows
        dpr={[1, 1.5]}
        camera={{ position: [0.8, 1.45, 4.25], fov: 39, near: 0.1, far: 40 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      >
        <color attach="background" args={["#05070b"]} />
        <fog attach="fog" args={["#05070b", 4.2, 10]} />
        <ambientLight intensity={0.52} />
        <directionalLight position={[-2.5, 4.5, 3]} intensity={1.15} color="#dbeafe" castShadow shadow-mapSize={[1024, 1024]} />
        <spotLight position={[2.4, 3.6, 2.8]} angle={0.45} penumbra={0.6} intensity={2.95} color="#fb923c" castShadow />
        <pointLight position={[-2.1, 1.1, 1.4]} intensity={1.35} color="#60a5fa" distance={5.4} />
        <AutomationOffice reducedMotion={reducedMotion} />
        <ContactShadows position={[0, -0.58, 0]} opacity={0.38} scale={7} blur={2.2} far={3.5} />
        <OrbitControls
          enabled={!reducedMotion}
          enablePan={false}
          enableZoom={false}
          enableDamping
          dampingFactor={0.08}
          rotateSpeed={0.32}
          minAzimuthAngle={-0.42}
          maxAzimuthAngle={0.38}
          minPolarAngle={1.12}
          maxPolarAngle={1.5}
          target={[0.65, 0.3, -0.32]}
        />
      </Canvas>
    </div>
  );
}
