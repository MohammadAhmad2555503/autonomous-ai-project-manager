import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { projects as projectsAPI, tasks as tasksAPI } from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { CheckCircle2, Clock, AlertTriangle, TrendingUp } from 'lucide-react';
import { Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { cn, getStatusColor, formatDate } from '../lib/utils';
import { toast } from 'sonner';

const Dashboard = () => {
  const [projects, setProjects] = useState([]);
  const [allTasks, setAllTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalProjects: 0,
    activeTasks: 0,
    overdueTasks: 0,
    blockedTasks: 0,
    completedTasks: 0,
  });

  const loadDashboardData = useCallback(async () => {
    try {
      const [projectsRes, tasksRes] = await Promise.all([
        projectsAPI.getAll(),
        tasksAPI.getAll(),
      ]);

      setProjects(projectsRes.data);
      setAllTasks(tasksRes.data);

      const now = new Date();
      const overdue = tasksRes.data.filter(t => t.due_date && new Date(t.due_date) < now && t.status !== 'completed');
      const blocked = tasksRes.data.filter(t => t.status === 'blocked');
      const active = tasksRes.data.filter(t => t.status === 'in_progress' || t.status === 'todo');
      const completed = tasksRes.data.filter(t => t.status === 'completed');

      setStats({
        totalProjects: projectsRes.data.length,
        activeTasks: active.length,
        overdueTasks: overdue.length,
        blockedTasks: blocked.length,
        completedTasks: completed.length,
      });
    } catch (error) {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const statusDistribution = [
    { name: 'To Do', value: allTasks.filter(t => t.status === 'todo').length, color: '#71717a' },
    { name: 'In Progress', value: allTasks.filter(t => t.status === 'in_progress').length, color: '#0284c7' },
    { name: 'Blocked', value: allTasks.filter(t => t.status === 'blocked').length, color: '#dc2626' },
    { name: 'Completed', value: allTasks.filter(t => t.status === 'completed').length, color: '#16a34a' },
  ];

  const recentTasks = [...allTasks]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 5);

  if (loading) {
    return <div className="text-muted-foreground">Loading dashboard...</div>;
  }

  return (
    <div className="space-y-8" data-testid="dashboard-page">
      <div>
        <h1 className="text-4xl font-black tracking-tighter mb-2">Mission Control</h1>
        <p className="text-muted-foreground">Real-time project intelligence and team performance metrics</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border bg-card" data-testid="active-tasks-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Active Tasks</p>
                <p className="text-3xl font-bold font-mono">{stats.activeTasks}</p>
              </div>
              <div className="w-12 h-12 rounded-sm bg-primary/20 border border-primary/30 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card" data-testid="completed-tasks-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Completed</p>
                <p className="text-3xl font-bold font-mono">{stats.completedTasks}</p>
              </div>
              <div className="w-12 h-12 rounded-sm bg-success/20 border border-success/30 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-success" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card" data-testid="overdue-tasks-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Overdue</p>
                <p className="text-3xl font-bold font-mono">{stats.overdueTasks}</p>
              </div>
              <div className="w-12 h-12 rounded-sm bg-warning/20 border border-warning/30 flex items-center justify-center">
                <Clock className="w-6 h-6 text-warning" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card" data-testid="blocked-tasks-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Blocked</p>
                <p className="text-3xl font-bold font-mono">{stats.blockedTasks}</p>
              </div>
              <div className="w-12 h-12 rounded-sm bg-destructive/20 border border-destructive/30 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-destructive" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-xl font-semibold tracking-tight">Task Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={statusDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {statusDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a', borderRadius: '4px' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-2 gap-2 mt-4">
              {statusDistribution.map((item) => (
                <div key={item.name} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: item.color }} />
                  <span className="text-sm text-muted-foreground">{item.name}: {item.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-xl font-semibold tracking-tight">Recent Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">No tasks yet</p>
              ) : (
                recentTasks.map((task) => (
                  <Link
                    key={task.id}
                    to={`/tasks/${task.id}`}
                    className="block p-3 rounded-sm border border-border hover:border-primary/50 transition-all duration-200"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{task.title}</p>
                        <p className="text-xs text-muted-foreground mt-1">{formatDate(task.created_at)}</p>
                      </div>
                      <span className={cn('px-2 py-1 text-xs rounded-sm', getStatusColor(task.status))}>
                        {task.status.replace('_', ' ')}
                      </span>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border bg-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-semibold tracking-tight">Active Projects</CardTitle>
            <Link to="/projects">
              <Button variant="outline" size="sm" data-testid="view-all-projects-button">
                View All
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.slice(0, 6).map((project) => (
              <Link
                key={project.id}
                to={`/projects/${project.id}`}
                className="block p-4 rounded-sm border border-border hover:border-primary/50 transition-all duration-200"
                data-testid={`project-card-${project.id}`}
              >
                <h3 className="font-semibold mb-2 truncate">{project.title}</h3>
                <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{project.description}</p>
                <div className="flex items-center justify-between">
                  <span className={cn('px-2 py-1 text-xs rounded-sm', getStatusColor(project.status))}>
                    {project.status.replace('_', ' ')}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(project.target_end_date)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
          {projects.length === 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">No projects yet</p>
              <Link to="/projects">
                <Button data-testid="create-first-project-button">
                  Create Your First Project
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;

