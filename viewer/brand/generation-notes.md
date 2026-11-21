---
type: log
status: 끝남
created: 2026-11-22
title: SiloRoot 로고 생성 기록
---

## 고른 것 (2026-11-22, 본인 결정)

- 글자 로고(방향 2): `siloroot-wordmark.png`. 네이비 #2F4156 글자, i의 점만 틸 #567C8D. 투명 바탕.
- 아이콘: 글자 로고의 앞 두 글자 `Si`를 베이지 #F5EFEB 둥근 사각형에 얹은 것(`siloroot-icon-512.png`, `-64.png`). SiloLink의 파란 S 심볼, "정보(i)" 아이콘과 헷갈리지 않게 골랐다. 둥근 사각형은 의존성 없는 Node 스크립트로 그리고, 글자는 글자 로고에서 잘라 ffmpeg로 얹었다.
- 순백(#FFFFFF)은 쓰지 않는다.
- 이전 시안(초록 육각형, 기하학 A, B, C, 폴더 뿌리)은 쓰지 않는다.

## Codex 생성 기록 (원문)

# SiloRoot generation notes

Date 2026-11-22 (Asia/Seoul)

Tool OpenAI built-in ImageGen (`image_gen.imagegen`).

`ref-silolink.png` was supplied as a reference for weight and tone in the first two generations. The generated folder and wordmark then served as references for the horizontal lockup, favicon and comparison draft.

The exports share the generated folder and lettering. I adjusted the root's weight and spread to preserve the fork at 16 px and opened the spacing between the final three letters. The horizontal lockup uses the folder and an all-navy wordmark. The favicon uses the first uppercase S from the wordmark on a rounded beige tile. I assembled the comparison sheet from the final marks with the exact Korean titles and actual 32 × 32 and 16 × 16 pixel samples. The exported PNGs use only the specified palette.

## Exact ImageGen prompts

### Direction 1 symbol

```text
Use case: logo-brand. Create a single production logo symbol for a brand named SiloRoot, on a square true transparent canvas for PNG export. The concept is a folder that grows a root. Use the attached SiloLink image for visual weight and calm geometric tone only. Draw a completely new shape, with no S shape or shared motif. Draw one unmistakable, solid navy #2F4156 file-folder silhouette with a flat front, slightly rounded corners, and one broad upper-left folder tab with a rounded shoulder. Place one thick teal #567C8D stem emerging directly down from the bottom midpoint, then splitting once into two short, gently angled roots with blunt rounded tips. Use constant medium-heavy root weight so both branches read at 16 by 16 pixels. The folder should dominate, the root should be short, and the full mark should be visibly centered with around 10 percent padding around the square canvas. Draw only this mark, without text, badges, decorative marks or secondary objects. Use only the two specified solid colors and actual transparent pixels. No white, no background, no outline, no shadow, gradient, texture, highlights or extra geometry.
```

### Direction 2 wordmark

```text
Use case: logo-brand. Create a single production-ready horizontal wordmark on genuine transparent pixels. Exact text: SiloRoot, spelled S-i-l-o-R-o-o-t, with capitals S and R only. Use a clean, bold geometric sans with the confident weight and simple proportions of the attached SiloLink reference, which is only for weight and tone. Design a proprietary-feeling but carefully legible wordmark, with round o counters, a circular i dot, and balanced optical kerning. Set every part in solid navy #2F4156 except the small circular dot on the i, which is solid teal #567C8D. One line of lettering only, centered with generous horizontal breathing space. No separate symbol, ligatures, slogan, captions, white, other colors, gradients, shadows, texture, outline, container or background. Preserve real transparent alpha.
```

### Direction 1 horizontal lockup

```text
Use case: logo-brand. Compose a single clean horizontal SiloRoot lockup for transparent PNG export. Input image 1 is the approved folder-and-root symbol. Keep its exact silhouette, tab, short two-pronged root and proportions, without redrawing the junction. Input image 2 gives the exact desired lettering and weight. Set its text verbatim as SiloRoot (S-i-l-o-R-o-o-t), converting the i dot to the same navy as all other lettering. Place the symbol to the left of the wordmark with a generous, visually balanced gap, optically centered on the lettering line. The symbol should be around 1.25 times the cap height. Use flat, solid navy #2F4156 for the folder and entire wordmark, and solid teal #567C8D for the root. Surround the centered lockup with true transparent pixels. No white, shadows, gradient, noise, extra text, secondary shapes, lines or badge.
```

### Direction 2 favicon

```text
Use case: logo-brand. Create the SiloRoot favicon on a square true transparent PNG canvas. The input wordmark is the type reference. Take exactly its first uppercase S as the single centered letter and preserve that S shape and bold geometric weight. Use navy #2F4156 for the S, filling about 61 percent of the square height. Place it on a single solid warm beige #F5EFEB square with softly rounded corners and approximately a 4 percent clear exterior margin. The actual pixels outside the tile must be transparent. This must read crisply at 16 by 16 pixels. Use only the two specified colors. No other letters, accents, borders, white, texture, gradients, shadows, outlines, mockups or extra text.
```

### Comparison sheet

```text
Use case: logo-brand. Design a flat brand comparison sheet with a solid warm beige #F5EFEB background and two equal side-by-side columns. Use the input images as the SiloRoot folder-and-root symbol and the SiloRoot wordmark. The left title must read exactly “1 폴더에서 자라는 뿌리”. The right title must read exactly “2 글자 로고”. Under the left title show the symbol followed by the word SiloRoot in navy, large and horizontal. Under the right title show the standalone SiloRoot wordmark large. In the next aligned row show the folder symbol at medium size on the left, and a medium beige rounded-square tile with the wordmark's navy uppercase S on the right. For both columns place a 32 px and a 16 px version nearby, at their actual pixel sizes, individually labeled “32 px” and “16 px”. Below, a full-width solid navy #2F4156 strip holds the same rows with the logos in beige, the S favicon on its beige tile with a navy S. Use only navy #2F4156, teal #567C8D, sky blue #C8D9E6 and beige #F5EFEB. Use sky blue sparingly for hairline separators. Use a calm baseline grid, good optical spacing, generous outer margins, and crisp geometric letterforms. No pure white, shadows, gradients, texture, frames, extraneous headers or captions. Preserve the two directions' input shapes and exact Korean spelling.
```

