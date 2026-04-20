// Achievement badges. Glyphs are from game-icons.net (CC BY 3.0) via the
// react-icons/gi package. See src/assets/badges/ATTRIBUTION.md for credits.
import {
  // Achievement glyphs
  GiRocket, GiHighFive, GiCycle, GiMegaphone, GiSpiralBloom, GiSunrise,
  GiOwl, GiCalendar, GiMuscleUp, GiMedal, GiCrown, GiSprint, GiSunglasses, GiMoai,
  // Mastery ladder glyphs (ranks 1–40, GiRocket/GiMedal/GiCrown/GiSunglasses reused)
  GiWeightScale, GiStairsGoal, GiAnchor, GiBanana, GiStoneTower, GiVideoCamera,
  GiFlame, GiToaster, GiMeditation, GiBiceps, GiPoliceBadge, GiTrophyCup,
  GiBeastEye, GiJuggler, GiAcrobatic, GiTargetShot, GiFinishLine, GiTimeTrap,
  GiMonkFace, GiFist, GiStoneBlock, GiSoundWaves, GiWaterDrop, GiStraightPipe,
  GiInvisible, GiHourglass, GiCrownedHeart, GiCrab, GiDragonHead, GiDevilMask,
  GiTrident, GiAngelWings, GiSandsOfTime, GiTreeBranch, GiCrosshair, GiZeusSword,
} from 'react-icons/gi';

const GLYPHS = {
  GiRocket, GiHighFive, GiCycle, GiMegaphone, GiSpiralBloom, GiSunrise,
  GiOwl, GiCalendar, GiMuscleUp, GiMedal, GiCrown, GiSprint, GiSunglasses, GiMoai,
  GiWeightScale, GiStairsGoal, GiAnchor, GiBanana, GiStoneTower, GiVideoCamera,
  GiFlame, GiToaster, GiMeditation, GiBiceps, GiPoliceBadge, GiTrophyCup,
  GiBeastEye, GiJuggler, GiAcrobatic, GiTargetShot, GiFinishLine, GiTimeTrap,
  GiMonkFace, GiFist, GiStoneBlock, GiSoundWaves, GiWaterDrop, GiStraightPipe,
  GiInvisible, GiHourglass, GiCrownedHeart, GiCrab, GiDragonHead, GiDevilMask,
  GiTrident, GiAngelWings, GiSandsOfTime, GiTreeBranch, GiCrosshair, GiZeusSword,
};

const TIER_RING = {
  bronze: 'bg-gradient-to-br from-[#cd7f32] to-[#5a2e0b]',
  silver: 'bg-gradient-to-br from-aura-cyan to-[#0e7490]',
  gold:   'bg-gradient-to-br from-aura-gold to-[#854d0e]',
  mythic: 'bg-aura-gradient',
};

const TIER_GLOW = {
  bronze: '',
  silver: 'shadow-[0_0_14px_rgba(34,211,238,0.35)]',
  gold:   'shadow-glow-gold',
  mythic: 'shadow-glow-gold',
};

const SIZE = {
  sm: { outer: 'w-7 h-7',   glyph: 'text-[15px]' },
  md: { outer: 'w-10 h-10', glyph: 'text-[22px]' },
  lg: { outer: 'w-12 h-12', glyph: 'text-[28px]' },
};

export default function Badge({ achievement, size = 'md', locked = false }) {
  const Glyph = achievement?.glyph ? GLYPHS[achievement.glyph] : null;
  const tier = achievement?.tier || 'bronze';
  const { outer, glyph } = SIZE[size] || SIZE.md;
  const ring = TIER_RING[tier] || TIER_RING.bronze;
  const glow = locked ? '' : TIER_GLOW[tier] || '';
  const lockedCls = locked ? 'grayscale opacity-40' : '';

  return (
    <span
      aria-hidden="true"
      className={`inline-grid place-items-center rounded-full p-[2px] shrink-0 ${outer} ${ring} ${glow} ${lockedCls}`}
    >
      <span className="w-full h-full rounded-full bg-ink-800 grid place-items-center">
        {Glyph ? (
          <Glyph className={`${glyph} text-white`} />
        ) : (
          <span className={`${glyph} leading-none text-white`}>{achievement?.icon || '🏆'}</span>
        )}
      </span>
    </span>
  );
}
