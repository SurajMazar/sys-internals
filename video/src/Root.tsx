import React from "react";
import { Composition } from "remotion";
import { ChapterVideo } from "./compositions/ChapterVideo";
import { computeTotalFrames, Storyboard, Durations } from "./compositions/timing";
import { WIDTH, HEIGHT, FPS } from "./theme";

import storyboardAws01 from "./content/aws-01.storyboard.json";
import durationsAws01 from "./content/aws-01.durations.json";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="aws-01"
        component={ChapterVideo as unknown as React.ComponentType<Record<string, unknown>>}
        width={WIDTH}
        height={HEIGHT}
        fps={FPS}
        durationInFrames={computeTotalFrames(storyboardAws01 as unknown as Storyboard, durationsAws01 as Durations)}
        defaultProps={{
          storyboard: storyboardAws01 as unknown as Storyboard,
          durations: durationsAws01 as Durations,
          chapterId: "aws-01",
        }}
      />
    </>
  );
};
