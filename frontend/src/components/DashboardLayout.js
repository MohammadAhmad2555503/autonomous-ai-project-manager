import React from 'react';
import { Outlet, Navigate, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { LayoutDashboard, FolderKanban, Network, BarChart3, Sparkles, LogOut, Settings } from 'lucide-react';
import { toast } from 'sonner';

const DashboardLayout = () => {
  const { user, logout, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Projects', href: '/projects', icon: FolderKanban },
    { name: 'Dependencies', href: '/dependencies', icon: Network },
    { name: 'Analytics', href: '/analytics', icon: BarChart3 },
    { name: 'AI Insights', href: '/ai-insights', icon: Sparkles },
  ];

  const handleLogout = () => {
    logout();
    navigate('/');
    toast.success('Logged out successfully');
  };

  const isActive = (path) => {
    if (path === '/dashboard') return location.pathname === path;
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-background/60 backdrop-blur-xl">
        <div className="flex h-16 items-center px-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-sm bg-primary/20 border border-primary/30 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <div>
              <div className="text-sm font-bold tracking-tight">AI Project Manager</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Control Center</div>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-4">
            <div className="text-sm">
              <div className="text-foreground font-medium">{user.full_name}</div>
              <div className="text-xs text-muted-foreground capitalize">{user.role.replace('_', ' ')}</div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              data-testid="logout-button"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <div className="flex">
        <aside className="w-64 border-r border-border min-h-[calc(100vh-4rem)] p-4">
          <nav className="space-y-2">
            {navigation.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  data-testid={`nav-${item.name.toLowerCase().replace(' ', '-')}`}
                  className={`flex items-center gap-3 px-4 py-3 rounded-sm border transition-all duration-200 ${
                    isActive(item.href)
                      ? 'bg-primary/10 border-primary/50 text-primary'
                      : 'border-transparent hover:border-border hover:bg-muted/50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-sm font-medium">{item.name}</span>
                </Link>
              );
            })}

            <Link
              to="/settings"
              data-testid="nav-settings"
              className={`flex items-center gap-3 px-4 py-3 rounded-sm border transition-all duration-200 ${
                isActive('/settings')
                  ? 'bg-primary/10 border-primary/50 text-primary'
                  : 'border-transparent hover:border-border hover:bg-muted/50'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span className="text-sm font-medium">Settings</span>
            </Link>
          </nav>
        </aside>

        <main className="flex-1 p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;

