"use client";

import {
  PolarGrid,
  PolarAngleAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  PolarRadiusAxis,
  Legend,
  Tooltip,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const statsData = [
  { subject: "Pace", A: 86, fullMark: 100 },
  { subject: "Shooting", A: 90, fullMark: 100 },
  { subject: "Passing", A: 75, fullMark: 100 },
  { subject: "Dribbling", A: 95, fullMark: 100 },
  { subject: "Defense", A: 60, fullMark: 100 },
  { subject: "Physical", A: 78, fullMark: 100 },
];

const detailedStats = [
    { metric: "Games Played", value: 25 },
    { metric: "Goals", value: 18 },
    { metric: "Assists", value: 12 },
    { metric: "Tackles Won", value: "78%" },
    { metric: "Pass Accuracy", value: "85%" },
    { metric: "Distance Covered (avg)", value: "9.2 km" },
]

export function PlayerStatsChart() {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
      <Card className="lg:col-span-3">
        <CardHeader>
          <CardTitle className="font-headline">Player Skill Overview</CardTitle>
          <CardDescription>Hexagonal chart showing key attributes.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="80%" data={statsData}>
                <defs>
                    <radialGradient id="radar-gradient">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4}/>
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.1}/>
                    </radialGradient>
                </defs>
                <PolarGrid stroke="hsl(var(--border))" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: 'hsl(var(--foreground))', fontSize: 14 }} className="font-semibold" />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                <Radar
                  name="Player"
                  dataKey="A"
                  stroke="hsl(var(--primary))"
                  fill="url(#radar-gradient)"
                  fillOpacity={0.8}
                  strokeWidth={2}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    borderColor: "hsl(var(--border))",
                    borderRadius: "var(--radius)",
                    color: "hsl(var(--foreground))"
                  }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="font-headline">Detailed Statistics</CardTitle>
           <CardDescription>Your performance numbers in detail.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-semibold">Metric</TableHead>
                <TableHead className="text-right font-semibold">Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {detailedStats.map((stat) => (
                <TableRow key={stat.metric}>
                  <TableCell className="font-medium">{stat.metric}</TableCell>
                  <TableCell className="text-right font-mono">{stat.value}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
