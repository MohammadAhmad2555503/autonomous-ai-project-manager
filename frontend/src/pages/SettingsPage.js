import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { User, Shield, Mail } from 'lucide-react';

const SettingsPage = () => {
  const { user } = useAuth();
  const runtimeEnv = process.env.NODE_ENV || 'development';

  return (
    <div className="space-y-6" data-testid="settings-page">
      <div>
        <h1 className="text-4xl font-black tracking-tighter mb-2">Settings</h1>
        <p className="text-muted-foreground">Manage your account and preferences</p>
      </div>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-sm bg-primary/20 border border-primary/30 flex items-center justify-center">
              <User className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h3 className="text-xl font-semibold">{user?.full_name}</h3>
              <div className="flex items-center gap-2 mt-1">
                <Badge className="capitalize">{user?.role.replace('_', ' ')}</Badge>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="w-4 h-4" />
                <span className="text-xs uppercase tracking-wider">Email</span>
              </div>
              <p className="text-sm font-medium">{user?.email}</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Shield className="w-4 h-4" />
                <span className="text-xs uppercase tracking-wider">Role</span>
              </div>
              <p className="text-sm font-medium capitalize">{user?.role.replace('_', ' ')}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle>About This Application</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">Autonomous AI Project Manager</h3>
            <p className="text-sm text-muted-foreground">
              An intelligent project management system powered by AI. Track tasks, manage dependencies, 
              analyze risks, and receive AI-driven recommendations to keep your projects on track.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Version</p>
              <p className="text-sm font-mono">1.0.0</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">AI Model</p>
              <p className="text-sm font-mono">Backend configured</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Status</p>
              <p className="text-sm font-mono text-success">{user ? 'Signed in' : 'Signed out'}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Env</p>
              <p className="text-sm font-mono capitalize">{runtimeEnv}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SettingsPage;

