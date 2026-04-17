import React from "react";
import { Composition } from "remotion";
import { HelloWorld, helloWorldCompSchema } from "./HelloWorld";
import { InstaReel, InstaReelDefaultProps } from "./InstaReel";
import { QuoteReel, QuoteReelDefaultProps } from "./QuoteReel";
import { PodcastClip, PodcastClipDefaultProps } from "./PodcastClip";
import { SaaSPromo, SaaSPromoDefaultProps } from "./SaaSPromo";
import { KenBurnsVideo, KenBurnsVideoDefaultProps } from "./KenBurnsVideo";
import { PromoVideo, PromoVideoDefaultProps } from "./PromoVideo";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="HelloWorld"
        component={HelloWorld}
        durationInFrames={800}
        fps={30}
        width={1920}
        height={1080}
        schema={helloWorldCompSchema}
        defaultProps={{
          titleText: "Render Server Template",
          titleColor: "#000000",
          logoColor1: "#91EAE4",
          logoColor2: "#86A8E7",
        }}
      />

      <Composition
        id="InstaReel"
        component={InstaReel}
        width={1080}
        height={1920}
        fps={30}
        durationInFrames={210}
        defaultProps={InstaReelDefaultProps}
      />

      {/* Citation virale — 1080×1920 vertical, 10s */}
      <Composition
        id="QuoteReel"
        component={QuoteReel}
        width={1080}
        height={1920}
        fps={30}
        durationInFrames={300}
        defaultProps={QuoteReelDefaultProps}
      />

      {/* Podcast clip — 1080×1920 vertical, 8s */}
      <Composition
        id="PodcastClip"
        component={PodcastClip}
        width={1080}
        height={1920}
        fps={30}
        durationInFrames={240}
        defaultProps={PodcastClipDefaultProps}
      />

      {/* SaaS promo — 1920×1080 horizontal, 8s */}
      <Composition
        id="SaaSPromo"
        component={SaaSPromo}
        width={1920}
        height={1080}
        fps={30}
        durationInFrames={240}
        defaultProps={SaaSPromoDefaultProps}
      />

      {/* Ken Burns video — pipeline IA FLUX + Remotion */}
      <Composition
        id="KenBurnsVideo"
        component={KenBurnsVideo}
        width={1920}
        height={1080}
        fps={30}
        durationInFrames={315}
        defaultProps={KenBurnsVideoDefaultProps}
      />

      {/* PromoVideo landscape — 1920×1080 */}
      <Composition
        id="PromoVideo"
        component={PromoVideo}
        width={1920}
        height={1080}
        fps={30}
        durationInFrames={320}
        defaultProps={PromoVideoDefaultProps}
      />

      {/* PromoVideo reel — 1080×1920 vertical */}
      <Composition
        id="PromoVideoReel"
        component={PromoVideo}
        width={1080}
        height={1920}
        fps={30}
        durationInFrames={320}
        defaultProps={PromoVideoDefaultProps}
      />

      {/* PromoVideo square — 1080×1080 */}
      <Composition
        id="PromoVideoSquare"
        component={PromoVideo}
        width={1080}
        height={1080}
        fps={30}
        durationInFrames={320}
        defaultProps={PromoVideoDefaultProps}
      />
    </>
  );
};
