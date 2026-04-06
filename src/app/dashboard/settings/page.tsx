import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plug } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-headline text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your data sources and application preferences.</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-headline">
            <Plug className="text-primary" />
            Data Adapters
          </CardTitle>
          <CardDescription>Configure your connections to bookmaker APIs and other data sources.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4 rounded-lg border p-4">
            <h3 className="font-semibold text-lg">OrbitExch API</h3>
            <p className="text-sm text-muted-foreground">
              Fetches lay odds from the OrbitExch (Betfair-like) exchange.
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="orbit-api-key">API Key</Label>
                <Input id="orbit-api-key" placeholder="Enter your OrbitExch API Key" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="orbit-api-url">API URL</Label>
                <Input id="orbit-api-url" defaultValue="https://orbitexch.com/customer/api" />
              </div>
            </div>
             <Button>Save Configuration</Button>
          </div>

          <div className="space-y-4 rounded-lg border border-dashed p-4 text-center">
             <h3 className="font-semibold">Add New Adapter</h3>
             <p className="text-sm text-muted-foreground">
                More integrations for other bookmakers are coming soon.
             </p>
             <Button variant="outline" disabled>Add New</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
