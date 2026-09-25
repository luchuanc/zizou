# 原创素材记录

角色与山水由内置 image_gen 生成，图标与战斗特效由本项目程序绘制；运行时不依赖外部图片服务。最终采纳的素材：

- `public/assets/kunlun.png`：青绿昆仑山水，1672 × 941。
- `public/assets/heroes.png`：首批 12 位英灵，4 × 3 透明图集。
- `public/assets/heroes-expansion.png`：后羿、共工、祝融、蚩尤、精卫、伏羲、妲己、神农，4 × 2 透明图集。
- `public/assets/heroes-underworld.png`：钟馗、阎罗、孟婆、白无常，2 × 2 透明图集。
- `public/icon.svg`：项目原创的山岳徽记。PNG 安装图标由 `scripts/icons.mjs` 渲染。
- `public/assets/equipment/*.svg`：44 个原创装备图标（8 散件、36 成装），包含刀剑、弓弩、甲衣、鼎、镜、符、印等器物轮廓；由 `scripts/equipment-icons.ts` 绘制。
- `public/assets/equipment-atlas.png`：同一批图标的 512×384 图集，单格 64×64，供棋盘上已穿戴装备显示。重建：`npm run icons:equipment`。
- 战斗特效：`src/effects.ts` 和 `src/scene.ts` 中的 PixiJS 软光精灵、短弹道、命中粒子和程序动画。箭矢、冰棱、火弹、魂火使用不同轮廓；光晕纹理由 Canvas 径向渐变生成并复用，无需外部特效软件。
- 音乐与音效：`src/audio.ts` 用 Web Audio 实时合成五声音阶及战斗反馈，无外部录音。

## 场景最终提示词

Use case: stylized-concept. Create an original premium Chinese mythology game background, wide landscape 16:9. Misty towering jade green mountains of Kunlun above an ocean of cream ivory clouds, tiny ancient Chinese temples with dark curved roofs at the left and right edges, sweeping pine trees and dark rocks at the lower corners, a distant small golden sun. Beautiful detailed hand-painted Chinese ink and mineral-pigment landscape, contemporary high-end Chinese fantasy game concept art, muted celadon, warm parchment, deep teal, touches of gold, soft sunlight. Composition: leave the central 65 percent and lower center softly misty and low detail, since an interactive game board is overlaid there. The mountains provide depth behind it. Atmospheric, majestic, elegant, airy. NO text, NO letters, NO game UI, NO board, NO characters, NO watermarks. Save a usable image asset for the project.

## 首批英灵最终提示词

Use case: stylized-concept. Asset type: a production character sprite atlas for an original Chinese mythology tactical game. Exactly 12 distinct full-body chibi miniature characters, neatly arranged in a strict 4 columns by 3 rows equal-size grid, each cell same size and each figure centered within its cell, no touching other cells. TRANSPARENT BACKGROUND. Every character entirely inside its cell, feet consistent near cell bottom, generous gap. Elegant highly detailed painterly 3D game figurine style, Chinese fantasy, jade teal and ivory with warm gold and vermilion accent. 3/4 isometric front view, expressive heads, proportions 2.5 heads tall. Row1 left to right: young Nezha with two hair buns red ribbons and spear riding tiny fire wheels; Erlang Shen in ivory and blue armor holding long trident with third eye; Sun Wukong golden monkey king in gold armor holding staff; white-haired Chang'e woman in pale jade flowing dress holding crescent moon. Row2 left to right: bearded Jiang Ziya sage in cream teal robes with wooden staff; nine-tailed fox spirit woman in lavender with visible fluffy white tails; dragon prince Ao Bing blue-haired man with curved horns in turquoise armor and spear; red phoenix woman in fiery red gold dress and feathered wings. Row3 left to right: Xuanwu dark jade armored turtle general with shield; white tiger warrior in silver armor with tiger ears and great sword; Nuwa goddess with emerald snake tail and gold crown; Lei Zhenzi thunder god with blue bird wings and hammer. No lettering, no typography, no frames, no ground planes, no grid lines, no watermarks. Clear beautiful silhouettes, consistent art quality, genuine transparent background around every isolated character. Portrait total canvas 1536x1536.

## 扩展英灵最终提示词

Create a NEW TRANSPARENT PNG sprite sheet matching the supplied reference's isolated cutout technique and art style. The reference is a STYLE REFERENCE ONLY; do not reproduce its characters. Use a REAL transparent alpha channel, as in reference. The canvas must have NO painted background whatsoever, including NO colored glow or gradient. Exactly 8 entirely separate full-body chibi Chinese mythology figurines in an evenly spaced 4 columns by 2 rows grid. Each is 2.5 heads tall with clear silhouette, at least 25 pixels EMPTY transparent margin between cells. Row 1: Houyi male archer with gold bow; Gonggong blue male water god with blue armor; Zhurong red male fire god with staff; Chiyou horned bronze armored male warrior with axes. Row 2: Jingwei petite bird girl with orange wings; Fuxi male teal scholar with bagua disk; Daji purple fox enchantress with ears and tails; Shennong elderly green-robed herbalist with leaf crown and herb basket. Each isolated figurine on transparency, no background. Keep each whole body inside its cell. High quality detailed cute game characters. No text. Square canvas. Real transparent PNG is the essential deliverable.

风格参考：首批 12 位英灵图集。两个带底色的中间版本未被采纳，没有随游戏打包。

## 幽冥英灵最终提示词

Use case: stylized-concept. Create a game sprite sheet for an original Chinese mythology game with exactly FOUR detailed full-body chibi 3D painted figurines in strict 2 columns by 2 rows equal square cells. Genuine transparent background, generous transparent gaps between figures, no figure extends beyond its own cell. Expressive 2.5 heads tall chibi proportions, front three-quarter view, premium fantasy game art, coherent jade teal ivory gold with dark purple accents. Top left Zhong Kui Chinese bearded ghost-catching judge with red official robes, black official cap, great sword and golden talisman; top right Yanluo king of the underworld, stern handsome man in black purple gold ceremonial robes with tall judge crown and a book of souls; bottom left Meng Po elegant mature white-haired woman in dark turquoise robes holding a small steaming jade tea bowl and staff, gentle mystical; bottom right Bai Wuchang ghost spirit with a tall white official hat WITHOUT any lettering, long white robes with pale turquoise accents and ghost lantern and chain. No words, no text, no typography, no lettering on hats, no card frames, no borders, no ground plane, no watermarks. Entire isolated silhouettes fully visible, feet aligned near bottom of each cell. Square canvas 1024x1024. Matching art direction of high-end Chinese mythology auto chess miniature characters.

