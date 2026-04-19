"use client";

/**
 * SplineScene — Wrapper client-only pour @splinetool/react-spline.
 * Importé dynamiquement (ssr:false) depuis LandingPage pour éviter
 * les problèmes d'exports package lors du pre-rendering SSG.
 */
import Spline from "@splinetool/react-spline";

interface SplineSceneProps {
  scene: string;
  onLoad?: (app: unknown) => void;
  className?: string;
  style?: React.CSSProperties;
}

export default function SplineScene({ scene, onLoad, className, style }: SplineSceneProps) {
  return (
    <Spline
      scene={scene}
      onLoad={onLoad as any}
      className={className}
      style={style}
    />
  );
}
