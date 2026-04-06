import type { HistoricalArbitrageAnalysisOutput } from '@/ai/flows/historical-arbitrage-analysis';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, ShieldAlert, VenetianMask } from 'lucide-react';

export function AnalysisResult({ result }: { result: HistoricalArbitrageAnalysisOutput }) {
  return (
    <div className="w-full space-y-6">
      <Card className="bg-card/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-headline">
            <VenetianMask className="text-primary" />
            Suggested Strategy
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-foreground/90">{result.suggestedStrategy}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-headline">
            <BarChart className="text-primary" />
            Rationale
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">{result.rationale}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-headline">
            <ShieldAlert className="text-primary" />
            Risk Assessment
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">{result.riskAssessment}</p>
        </CardContent>
      </Card>
    </div>
  );
}
