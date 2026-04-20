import { useEffect, useState } from 'react';
import HeroGame from '../components/home/HeroGame.jsx';
import StatsBanner from '../components/home/StatsBanner.jsx';
import MyProgressStrip from '../components/home/MyProgressStrip.jsx';
import LeaderboardPeek from '../components/home/LeaderboardPeek.jsx';
import FinalCTA from '../components/home/FinalCTA.jsx';
import MasteryLadder from '../components/MasteryLadder.jsx';
import { getPersonalBest } from '../lib/personalBest.js';

export default function Home() {
  const [pb, setPb] = useState(0);
  useEffect(() => { setPb(getPersonalBest()); }, []);

  return (
    <div className="pb-20">
      <HeroGame />
      <div className="space-y-12 md:space-y-16 mt-10">
        <StatsBanner />
        <MyProgressStrip />
        <section className="max-w-6xl mx-auto px-4 md:px-7">
          <MasteryLadder id="ranks" unlockedMs={pb} />
        </section>
        <LeaderboardPeek />
        <FinalCTA />
      </div>
    </div>
  );
}
