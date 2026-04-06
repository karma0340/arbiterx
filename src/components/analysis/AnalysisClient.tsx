'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { useToast } from '@/hooks/use-toast';
import { useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { AnalysisResult } from './AnalysisResult';
import { Loader2 } from 'lucide-react';

const initialState: { success: boolean; message: string; data?: any; error?: string } = {
  success: false,
  message: '',
  data: undefined,
  error: undefined,
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full sm:w-auto">
      {pending ? <Loader2 className="animate-spin" /> : 'Analyze Strategy'}
    </Button>
  );
}

export function AnalysisClient({ runAnalysisAction }: { runAnalysisAction: any }) {
  const [state, formAction] = useFormState(runAnalysisAction, initialState);
  const { toast } = useToast();

  useEffect(() => {
    if (!state) return;
    if (state.success === false && state.error) {
      toast({
        variant: 'destructive',
        title: 'Analysis Failed',
        description: state.error,
      });
    }
  }, [state, toast]);

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Analysis Parameters</CardTitle>
          <CardDescription>Provide data and define your preferences to get a suggested strategy.</CardDescription>
        </CardHeader>
        <form action={formAction}>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="historicalData">Historical Data (CSV or text)</Label>
              <Textarea
                id="historicalData"
                name="historicalData"
                placeholder="Paste your historical data here. e.g., Date,Profit%,Volume..."
                className="min-h-[200px] font-code text-xs"
                required
              />
            </div>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="riskTolerance">Risk Tolerance</Label>
                 <Select name="riskTolerance" defaultValue="Medium">
                  <SelectTrigger id="riskTolerance">
                    <SelectValue placeholder="Select risk level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Low">Low</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="High">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
               <div className="space-y-2">
                <Label htmlFor="liquidityConsiderations">Liquidity Constraints</Label>
                <Textarea
                  id="liquidityConsiderations"
                  name="liquidityConsiderations"
                  placeholder="e.g., max stake per bet, exchange limits"
                  className="min-h-[100px]"
                />
              </div>
            </div>
            <SubmitButton />
          </CardContent>
        </form>
      </Card>

      <div className="flex items-center justify-center">
        {state.success && state.data ? (
          <AnalysisResult result={state.data} />
        ) : (
          <Card className="flex h-full w-full flex-col items-center justify-center border-dashed">
            <div className="text-center">
              <p className="text-lg font-medium text-muted-foreground">AI Analysis will appear here</p>
              <p className="text-sm text-muted-foreground">Fill out the form to get started</p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
