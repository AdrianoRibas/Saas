import { Composition } from 'remotion';
import { MyComposition } from './Composition';
import React from 'react';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="HelloWorld"
        component={MyComposition}
        durationInFrames={150}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          title: 'Hello Adaptador Docs SaaS',
        }}
      />
    </>
  );
};
