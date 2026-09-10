/**
 * ThemedImage - render the correct artwork for the active theme.
 *
 * WHY IT IS CSS-DRIVEN, NOT JS-DRIVEN
 *   Both variants are emitted and CSS hides one (see tokens.generated.css). That means the
 *   right logo is on screen on the FIRST paint, before hydration, in a server-rendered page,
 *   and with JavaScript disabled. A JS-swapped logo flashes the wrong mark on every cold load -
 *   which is precisely the moment a brand is being judged.
 *
 * ACCESSIBILITY
 *   BOTH variants carry the alt text. The hidden variant is `display: none`, which already
 *   removes it from the accessibility tree, so nothing is announced twice - while hard-coding
 *   the alt onto only the light variant would leave the dark theme's visible logo with no
 *   accessible name at all, in exactly the theme nobody tested with a screen reader.
 *
 * The `id` must exist in design/tokens.json assets.items, which is what
 * scripts/check-theme-assets.mjs verifies has a real file per theme.
 */
import React from 'react';
import { themedAssets } from './tokens.generated';

type AssetId = keyof typeof themedAssets;

export function ThemedImage({
  id,
  alt,
  className,
  width,
  height,
  priority = false,
}: {
  id: AssetId;
  /** Required. Pass "" ONLY when the image is decorative and the meaning is carried by adjacent text. */
  alt: string;
  className?: string;
  width?: number;
  height?: number;
  priority?: boolean;
}) {
  const asset = themedAssets[id];
  if (!asset) throw new Error(`Unknown themed asset "${id}". Declare it in design/tokens.json.`);

  const common = {
    className,
    width,
    height,
    loading: priority ? ('eager' as const) : ('lazy' as const),
    decoding: 'async' as const,
  };

  return (
    <>
      {/* Two plain <img> tags rather than next/image, deliberately: the theme swap is done by a
          CSS rule on data-asset-theme, with no JavaScript and therefore no flash of the wrong
          artwork before hydration. next/image would render one element and need a client hook to
          choose between them, which is the flash this component exists to avoid. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img {...common} data-asset-theme="light" src={asset.light} alt={alt} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img {...common} data-asset-theme="dark" src={asset.dark} alt={alt} />
    </>
  );
}
