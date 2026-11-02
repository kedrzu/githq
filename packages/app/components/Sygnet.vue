<!-- githq's sygnet, the short mark "/hq" in a dark rounded square (brandbook "Brand / Sygnet" in `githq.pen`): Geist 700, violet on the slash. The landing page's final call to action and the top of the sidebar's rail; a caller sizes it with `--sygnet-size` (the glyphs and the corners follow), and the glyphs alone with `--sygnet-glyph-size` where the design rounds them otherwise. -->
<template>
  <span
    :class="css.sygnet"
    role="img"
    aria-label="githq"
    ><span :class="css.sygnet_slash">/</span>hq</span
  >
</template>

<style lang="scss" module="css">
// The design's proportions: 10px glyphs and 5px corners in 22px, 28px and 14px in 64px.
.sygnet {
  --size: var(--sygnet-size, 22px);

  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--size);
  height: var(--size);
  font-family: $font-family-brand;
  font-size: var(--sygnet-glyph-size, calc(var(--size) * 0.44));
  font-weight: 700;
  line-height: 1;
  color: $color-fg;
  letter-spacing: -0.045em;
  white-space: nowrap;
  background: $color-bg;
  border: 1px solid $color-border-2;
  border-radius: calc(var(--size) * 0.22);
}

.sygnet_slash {
  color: $color-accent;
}
</style>
