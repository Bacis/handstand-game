import { useState } from 'react';
import { ACHIEVEMENTS } from '../lib/achievements.js';
import { MASTERIES } from '../lib/masteries.js';
import Badge from '../components/Badge.jsx';

const TIER_ORDER = ['bronze', 'silver', 'gold', 'mythic'];

const TIER_LABEL = {
  bronze: 'Bronze',
  silver: 'Silver',
  gold:   'Gold',
  mythic: 'Mythic',
};

const TIER_BLURB = {
  bronze: 'Entry — copper-to-dark ring, no glow.',
  silver: 'Intermediate — cyan ring, soft cyan glow.',
  gold:   'Advanced — gold ring, gold glow.',
  mythic: 'Apex — cyan→purple→gold gradient ring, gold glow.',
};

function BadgeRow({ item, label, subLabel }) {
  return (
    <div className="flex items-center gap-6 py-3 border-b border-white/5 last:border-b-0">
      <div className="flex items-center gap-5 w-56 shrink-0">
        <div className="flex flex-col items-center gap-1 w-8">
          <Badge achievement={item} size="sm" />
          <span className="text-[9px] text-gray-500 font-mono">sm</span>
        </div>
        <div className="flex flex-col items-center gap-1 w-12">
          <Badge achievement={item} size="md" />
          <span className="text-[9px] text-gray-500 font-mono">md</span>
        </div>
        <div className="flex flex-col items-center gap-1 w-14">
          <Badge achievement={item} size="lg" />
          <span className="text-[9px] text-gray-500 font-mono">lg</span>
        </div>
        <div className="flex flex-col items-center gap-1 w-12">
          <Badge achievement={item} size="md" locked />
          <span className="text-[9px] text-gray-500 font-mono">locked</span>
        </div>
      </div>
      <div className="min-w-0">
        <div className="font-bold text-sm text-white">{label}</div>
        <div className="text-xs text-gray-500">{subLabel}</div>
        <div className="text-[10px] text-gray-600 font-mono mt-0.5">glyph: {item.glyph}</div>
      </div>
    </div>
  );
}

function TierSection({ items, tier, renderLabel, renderSubLabel }) {
  if (!items.length) return null;
  return (
    <section key={tier} className="mb-10">
      <div className="flex items-baseline gap-3 mb-2">
        <h3 className="text-lg font-black uppercase tracking-wider text-white">{TIER_LABEL[tier]}</h3>
        <span className="text-xs text-gray-500">{TIER_BLURB[tier]}</span>
        <span className="ml-auto text-xs text-gray-600 tabular-nums">
          {items.length} badge{items.length === 1 ? '' : 's'}
        </span>
      </div>
      <div className="rounded-xl border border-white/5 bg-ink-800/40 px-5">
        {items.map((item, idx) => (
          <BadgeRow
            key={item.key || item.atSec}
            item={item}
            label={renderLabel(item, idx)}
            subLabel={renderSubLabel(item)}
          />
        ))}
      </div>
    </section>
  );
}

function GridShowcase({ items, getKey, getLabel, getSubLabel }) {
  return (
    <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-8 gap-3">
      {items.map((item) => (
        <div
          key={getKey(item)}
          className="flex flex-col items-center gap-1 rounded-lg border border-white/5 bg-ink-800/40 p-3"
          title={getSubLabel(item)}
        >
          <Badge achievement={item} size="lg" />
          <div className="mt-1 text-[10px] text-white text-center leading-tight line-clamp-2">
            {getLabel(item)}
          </div>
          <div className="text-[9px] text-gray-500 font-mono">{getSubLabel(item)}</div>
        </div>
      ))}
    </div>
  );
}

export default function BadgeLab() {
  const [view, setView] = useState('achievements');

  const achievementsByTier = (tier) => ACHIEVEMENTS.filter((a) => a.tier === tier);
  const masteriesByTier = (tier) => MASTERIES.filter((m) => m.tier === tier);

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-8">
      <header className="mb-6">
        <h1 className="text-3xl font-black uppercase tracking-wide">
          <span className="bg-aura-gradient bg-clip-text text-transparent">Badge Lab</span>
        </h1>
        <p className="text-sm text-gray-400 mt-1">
          Glyphs from <a className="underline hover:text-aura-gold" href="https://game-icons.net" target="_blank" rel="noreferrer">game-icons.net</a> (CC BY 3.0).
        </p>
      </header>

      <div className="flex gap-1 mb-6 border-b border-white/10">
        {[
          { id: 'achievements', label: `Achievements · ${ACHIEVEMENTS.length}` },
          { id: 'ranks',        label: `Ranks · ${MASTERIES.length}` },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setView(t.id)}
            className={`px-4 py-2 text-xs font-mono uppercase tracking-widest transition ${
              view === t.id
                ? 'text-white border-b-2 border-aura-gold -mb-px'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {view === 'achievements' && (
        <>
          <div className="mb-8">
            <h2 className="text-sm font-mono uppercase tracking-widest text-gray-400 mb-3">Grid overview</h2>
            <GridShowcase
              items={ACHIEVEMENTS}
              getKey={(a) => a.key}
              getLabel={(a) => a.name}
              getSubLabel={(a) => a.key}
            />
          </div>
          <div>
            <h2 className="text-sm font-mono uppercase tracking-widest text-gray-400 mb-3">By tier</h2>
            {TIER_ORDER.map((tier) => (
              <TierSection
                key={tier}
                tier={tier}
                items={achievementsByTier(tier)}
                renderLabel={(a) => a.name}
                renderSubLabel={(a) => `${a.key} · ${a.description}`}
              />
            ))}
          </div>
        </>
      )}

      {view === 'ranks' && (
        <>
          <div className="mb-8">
            <h2 className="text-sm font-mono uppercase tracking-widest text-gray-400 mb-3">
              All 40 ranks · 3s → 120s
            </h2>
            <GridShowcase
              items={MASTERIES}
              getKey={(m) => m.atSec}
              getLabel={(m) => m.name}
              getSubLabel={(m) => `${m.atSec}s`}
            />
          </div>
          <div>
            <h2 className="text-sm font-mono uppercase tracking-widest text-gray-400 mb-3">By tier</h2>
            {TIER_ORDER.map((tier) => (
              <TierSection
                key={tier}
                tier={tier}
                items={masteriesByTier(tier)}
                renderLabel={(m) => `${m.atSec}s — ${m.name}`}
                renderSubLabel={(m) => m.tagline}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
