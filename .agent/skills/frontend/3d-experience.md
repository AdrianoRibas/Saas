---
name: 3d-web-experience
description: Diretrizes para experiências 3D (Three.js/R3F) com foco em performance e acessibilidade.
---

# 🧊 3D Web Experience

> **Princípio do Lead Engineer:** "3D na web deve ser como tempero: essencial para o prato certo, mas desastroso se exagerado. Se não for acessível, é apenas ruído."

## 1. Core Principles

- **Purpose-Driven:** Use 3D para explicar (visualização espacial) ou encantar (marca premium), nunca apenas "porque sim".
- **Performance First:** WebGL pode travar celulares baratos. Use `drei/PerformanceMonitor` para degradar qualidade automaticamente.
- **Acessibilidade Obrigatória:** Todo Canvas 3D deve ter um fallback HTML semântico ou descrição ARIA para leitores de tela.

## 2. Implementation Patterns (Do This)

### A. React Three Fiber (R3F) Standard

Para Apps React (nosso caso Next.js), R3F é o padrão. `Vanilla Three.js` é muito verboso para manutenção.

```tsx
"use client";
import { Canvas } from "@react-three/fiber";
import { Environment, OrbitControls } from "@react-three/drei";
import { Suspense } from "react";

export default function HeroScene() {
  return (
    <div
      className="h-[500px] w-full relative"
      role="img"
      aria-label="Modelo 3D interativo do produto"
    >
      {/* Fallback para leitores de tela ou JS desativado */}
      <div className="sr-only">Descrição detalhada do que o modelo mostra.</div>

      <Canvas dpr={[1, 2]}>
        <Suspense fallback={null}>
          <Model />
          <Environment preset="city" />
          <OrbitControls enableZoom={false} />
        </Suspense>
      </Canvas>
    </div>
  );
}
```

### B. Spline para "Wows" Rápidos

Para assets puramente visuais (landing pages), Spline é mais rápido que modelar em Blender + codar R3F.

```tsx
import Spline from "@splinetool/react-spline";

export function InteractiveBlob() {
  return (
    <Suspense fallback={<div className="bg-gray-200 animate-pulse" />}>
      <Spline scene="https://prod.spline.design/..." />
    </Suspense>
  );
}
```

### C. Carregamento Otimizado (Draco & WebP)

Nunca carregue `.gltf` bruto ou `.obj`. Use `.glb` comprimido com Draco.

```bash
npx gltfjsx model.glb --transform --types
# Isso gera um componente React otimizado e typesafe
```

## 3. Anti-Patterns (Don't Do This)

- ❌ **Bloquear a Thread Principal:** Carregar texturas 4K síncronas.
- ❌ **Sem Loading State:** O usuário vê uma tela branca enquanto o WebGL inicia.
- ❌ **Inacessível:** Canvas sem `aria-label` ou texto alternativo. Para um cego, o site está vazio.
- ❌ **Scroll Hijacking:** O scroll da página gira o modelo 3D e o usuário fica preso ("Scroll Trap"). Use `pointer-events-none` ou controles explícitos.

## 4. Decision Tree

- **Quero um ícone 3D animado:** -> Use Vídeo/Lottie (mais leve).
- **Quero um configurador de produto:** -> Use R3F + Zustand.
- **Quero um background abstrato legal:** -> Use Shaders (glsl) ou Spline.
