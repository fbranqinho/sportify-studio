import { PlayerStatsChart } from "@/components/player-stats-chart";

export default function StatsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-headline">Player Statistics</h1>
        <p className="text-muted-foreground">
          An overview of your performance and attributes.
        </p>
      </div>
      <PlayerStatsChart />
    </div>
  );
}
