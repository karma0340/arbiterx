import { AnalysisClient } from "@/components/analysis/AnalysisClient";
import { runAnalysis } from "@/lib/actions";

export default function AnalysisPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-headline text-3xl font-bold tracking-tight">Historical Arbitrage Analysis</h1>
        <p className="text-muted-foreground">
          Use AI to analyze historical data and suggest optimal staking strategies.
        </p>
      </header>
      <AnalysisClient runAnalysisAction={runAnalysis} />
    </div>
  );
}