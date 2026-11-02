# Axe Legends

A Golden Axe–style side-scrolling beat-em-up (belt-scroller) built with **Phaser 3.80.1**.
All art is procedural pixel graphics. Sound is synthesized with WebAudio. Runs offline from `file://`.

## Play

Open `index.html` in a modern browser, or visit the GitHub Pages link after publish:

**https://buzzhq.github.io/axe-legends/**

## Heroes

| Hero | Role | Magic |
|------|------|-------|
| **GRIMAX** — Dwarf Axeman | Slow, strong, high HP | Earth / earthquake (cracks, rocks, boulders) |
| **TYRIA** — Flame Swordswoman | Fast combos | Fire (flames → fire dragon at MAX) |
| **TORAN** — Thunder Barbarian | Balanced; overhead slam | Lightning (bolts → thunder storm at MAX) |

Magic spends **all** stored potions at once: **1** = small, **2** = medium, **3+** = **MAX** (HUD shows `[MAX]`). Potion cap is 6.

## Controls

| Action | Keyboard | Gamepad (PS5 / generic) |
|--------|----------|-------------------------|
| Move | Arrows or WASD | Left stick or D-pad |
| Attack | J or Z | Cross / A (also Square / X) |
| Jump | K or X | Circle / B |
| Magic | L or C | Square / X, Y, or L1/R1 |
| Mute music | M | — |

Combos, jump attacks, running dash attacks, grab/throw (warrior & barbarian on weakened foes), and rideable beasts (walk into a beast and press Up; Jump to dismount).

## Stages

1. **Turtle Village** — Orc Warlord  
2. **Fiendish Caverns** — Dark Knight  
3. **Castle of Evil** — Sorcerer King (final boss)

Kid-friendly combat: enemies flash and vanish — no blood.

## Files

- `index.html` — shell  
- `game.js` — full game  
- `phaser.min.js` — Phaser 3.80.1 (local)  
- `PHASER_LICENSE.md` — MIT license for Phaser  
- `favicon.png` / `screenshot.png`  
- `AxeLegends.zip` — distributable bundle  

High score is saved in `localStorage` (`axeLegendsHighScore`).

## License

Game code and original art: free to play and remix. Phaser is MIT (see `PHASER_LICENSE.md`).
