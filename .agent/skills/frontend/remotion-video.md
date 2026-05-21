---
name: programmatic-video-remotion
description: Padrões para geração de vídeo programático com Remotion (React), focado em performance e renderização server-side.
---

# 🎬 Programmatic Video (Remotion)

> **Princípio do Lead Engineer:** "Vídeo é pesado. Não tente renderizar 4K no cliente do usuário. Use a nuvem para o trabalho pesado e o cliente apenas para preview."

## 1. Core Principles

- **Frame-Perfect:** Animações devem ser baseadas no `frame` atual, nunca em `setTimeout` ou `Date.now()`.
- **Stateless:** Uma composição deve ser pura. Dado o mesmo `inputProps` e `frame`, o pixel gerado deve ser idêntico.
- **Server-Side Rendering:** Para SaaS, a renderização final (export MP4) deve ocorrer em um worker (Lambda/Cloud Run), não no browser do usuário.

## 2. Implementation Patterns (Do This)

### A. Composition Structure

Separe a lógica de vídeo da UI do Next.js. Remotion tem seu próprio ciclo de vida.

```tsx
// src/remotion/Root.tsx
import { Composition } from "remotion";
import { MyVideo } from "./MyVideo";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="PromoVideo"
        component={MyVideo}
        durationInFrames={300} // 10s @ 30fps
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          title: "Texto Default",
          color: "#0000FF",
        }}
      />
    </>
  );
};
```

### B. Animation (Interpolate)

Use `interpolate` e `spring` para movimentos fluidos. Nunca CSS transitions.

```tsx
import { useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";

export const MyVideo = ({ title }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const opacity = interpolate(frame, [0, 30], [0, 1], {
    extrapolateRight: "clamp",
  });

  const scale = spring({
    frame,
    fps,
    config: { damping: 200 },
  });

  return (
    <div style={{ opacity, transform: `scale(${scale})` }}>
      <h1>{title}</h1>
    </div>
  );
};
```

### C. Server-Side Rendering (Next.js API Route)

Use `@remotion/bundler` e `@remotion/renderer` para gerar vídeo no backend.

**Atenção:** Isso exige Binários do FFmpeg/Chrome. Em Vercel Serverless é complexo. Recomendado usar **Remotion Lambda**.

```typescript
// app/api/render/route.ts
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import path from "path";

export async function POST(req: Request) {
  const { props } = await req.json();

  // 1. Bundle (Build da Composição)
  const bundleLocation = await bundle({
    entryPoint: path.resolve("./src/remotion/index.ts"),
  });

  // 2. Select Composition
  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: "PromoVideo",
    inputProps: props,
  });

  // 3. Render (Isso consome MUITA RAM/CPU)
  await renderMedia({
    composition,
    serveUrl: bundleLocation,
    codec: "h264",
    outputLocation: `/tmp/out.mp4`,
    inputProps: props,
  });

  // Upload to S3/Storage...
}
```

## 3. Anti-Patterns (Don't Do This)

- ❌ **`useEffect`:** Remotion re-renderiza frames loucamente. Efeitos colaterais quebram a consistência.
- ❌ **API Calls no Render:** Nunca faça `fetch()` dentro do componente de vídeo. Passe os dados via `inputProps`.
- ❌ **Assets Gigantes:** Vídeos 4K como assets travam o bundle. Use links externos (S3) com `<Video src="..." />`.

## 4. Integração no SaaS

1. **Frontend:** Mostra `<Player>` (preview em baixa resolução).
2. **Backend:** Recebe JSON, chama Remotion Lambda/Renderer, devolve URL do MP4 gerado.
