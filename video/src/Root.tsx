import React from "react";
import { Composition } from "remotion";
import { ChapterVideo } from "./compositions/ChapterVideo";
import { computeTotalFrames, Storyboard, Durations } from "./compositions/timing";
import { WIDTH, HEIGHT, FPS } from "./theme";

import storyboardAws01 from "./content/aws-01.storyboard.json";
import durationsAws01 from "./content/aws-01.durations.json";
import storyboardAws02 from "./content/aws-02.storyboard.json";
import durationsAws02 from "./content/aws-02.durations.json";
import storyboardAws03 from "./content/aws-03.storyboard.json";
import durationsAws03 from "./content/aws-03.durations.json";
import storyboardAws04 from "./content/aws-04.storyboard.json";
import durationsAws04 from "./content/aws-04.durations.json";
import storyboardAws05 from "./content/aws-05.storyboard.json";
import durationsAws05 from "./content/aws-05.durations.json";
import storyboardAws06 from "./content/aws-06.storyboard.json";
import durationsAws06 from "./content/aws-06.durations.json";
import storyboardAws07 from "./content/aws-07.storyboard.json";
import durationsAws07 from "./content/aws-07.durations.json";
import storyboardAws08 from "./content/aws-08.storyboard.json";
import durationsAws08 from "./content/aws-08.durations.json";
import storyboardAws09 from "./content/aws-09.storyboard.json";
import durationsAws09 from "./content/aws-09.durations.json";
import storyboardAws10 from "./content/aws-10.storyboard.json";
import durationsAws10 from "./content/aws-10.durations.json";
import storyboardAws11 from "./content/aws-11.storyboard.json";
import durationsAws11 from "./content/aws-11.durations.json";
import storyboardAws12 from "./content/aws-12.storyboard.json";
import durationsAws12 from "./content/aws-12.durations.json";
import storyboardAws13 from "./content/aws-13.storyboard.json";
import durationsAws13 from "./content/aws-13.durations.json";

const CHAPTERS: { id: string; storyboard: Storyboard; durations: Durations }[] = [
  { id: "aws-01", storyboard: storyboardAws01 as unknown as Storyboard, durations: durationsAws01 as Durations },
  { id: "aws-02", storyboard: storyboardAws02 as unknown as Storyboard, durations: durationsAws02 as Durations },
  { id: "aws-03", storyboard: storyboardAws03 as unknown as Storyboard, durations: durationsAws03 as Durations },
  { id: "aws-04", storyboard: storyboardAws04 as unknown as Storyboard, durations: durationsAws04 as Durations },
  { id: "aws-05", storyboard: storyboardAws05 as unknown as Storyboard, durations: durationsAws05 as Durations },
  { id: "aws-06", storyboard: storyboardAws06 as unknown as Storyboard, durations: durationsAws06 as Durations },
  { id: "aws-07", storyboard: storyboardAws07 as unknown as Storyboard, durations: durationsAws07 as Durations },
  { id: "aws-08", storyboard: storyboardAws08 as unknown as Storyboard, durations: durationsAws08 as Durations },
  { id: "aws-09", storyboard: storyboardAws09 as unknown as Storyboard, durations: durationsAws09 as Durations },
  { id: "aws-10", storyboard: storyboardAws10 as unknown as Storyboard, durations: durationsAws10 as Durations },
  { id: "aws-11", storyboard: storyboardAws11 as unknown as Storyboard, durations: durationsAws11 as Durations },
  { id: "aws-12", storyboard: storyboardAws12 as unknown as Storyboard, durations: durationsAws12 as Durations },
  { id: "aws-13", storyboard: storyboardAws13 as unknown as Storyboard, durations: durationsAws13 as Durations },
];

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {CHAPTERS.map(({ id, storyboard, durations }) => (
        <Composition
          key={id}
          id={id}
          component={ChapterVideo as unknown as React.ComponentType<Record<string, unknown>>}
          width={WIDTH}
          height={HEIGHT}
          fps={FPS}
          durationInFrames={computeTotalFrames(storyboard, durations)}
          defaultProps={{ storyboard, durations, chapterId: id }}
        />
      ))}
    </>
  );
};
