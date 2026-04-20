# Achievement badge glyphs — attribution

The monochrome glyphs used inside the tier-colored badge frame are sourced
from [game-icons.net](https://game-icons.net), delivered to this app via the
[`react-icons/gi`](https://react-icons.github.io/react-icons/icons?name=gi)
package. They are licensed under
[**CC BY 3.0**](https://creativecommons.org/licenses/by/3.0/).

## Per-badge credits

| achievement key  | glyph (react-icons export) | game-icons.net page                                       |
| ---------------- | -------------------------- | --------------------------------------------------------- |
| `first_liftoff`  | `GiRocket`                 | https://game-icons.net/1x1/lorc/rocket.html               |
| `five_club`      | `GiHighFive`               | https://game-icons.net/1x1/delapouite/high-five.html      |
| `fifteen_club`   | `GiSpiralBloom`            | https://game-icons.net/1x1/lorc/spiral-bloom.html         |
| `half_minute`    | `GiMedal`                  | https://game-icons.net/1x1/delapouite/medal.html          |
| `minute_maker`   | `GiCrown`                  | https://game-icons.net/1x1/lorc/crown.html                |
| `two_min_titan`  | `GiMoai`                   | https://game-icons.net/1x1/delapouite/moai.html           |
| `nice`           | `GiSunglasses`             | https://game-icons.net/1x1/delapouite/sunglasses.html     |
| `persistent`     | `GiCycle`                  | https://game-icons.net/1x1/lorc/cycle.html                |
| `marathoner`     | `GiSprint`                 | https://game-icons.net/1x1/delapouite/sprint.html         |
| `streak_3`       | `GiCalendar`               | https://game-icons.net/1x1/delapouite/calendar.html       |
| `comeback_kid`   | `GiMuscleUp`               | https://game-icons.net/1x1/delapouite/muscle-up.html      |
| `early_bird`     | `GiSunrise`                | https://game-icons.net/1x1/lorc/sunrise.html              |
| `night_owl`      | `GiOwl`                    | https://game-icons.net/1x1/lorc/owl.html                  |
| `shared`         | `GiMegaphone`              | https://game-icons.net/1x1/delapouite/megaphone.html      |

Primary authors: **Lorc** and **Delapouite**. Confirm the author on the linked
page before publishing if attribution needs to be surfaced anywhere visible to
end users.

## Mastery ladder (40 rank badges)

The 40-rank ladder in `src/lib/masteries.js` uses these additional glyphs from
game-icons.net (same CC BY 3.0 license, same authors pool). Look each up at
`https://game-icons.net/1x1/{author}/{slug}.html` — the `react-icons` export
name maps 1:1 to the kebab-case slug (e.g. `GiWeightScale` → `weight-scale`).

```
GiWeightScale   GiStairsGoal    GiAnchor        GiBanana        GiStoneTower
GiVideoCamera   GiFlame         GiToaster       GiMeditation    GiBiceps
GiPoliceBadge   GiTrophyCup     GiBeastEye      GiJuggler       GiAcrobatic
GiTargetShot    GiFinishLine    GiTimeTrap      GiMonkFace      GiFist
GiStoneBlock    GiSoundWaves    GiWaterDrop     GiStraightPipe  GiInvisible
GiHourglass     GiCrownedHeart  GiCrab          GiDragonHead    GiDevilMask
GiTrident       GiAngelWings    GiSandsOfTime   GiTreeBranch    GiCrosshair
GiZeusSword
```

`GiRocket`, `GiMedal`, `GiCrown`, and `GiSunglasses` are reused from the
achievement set above.
