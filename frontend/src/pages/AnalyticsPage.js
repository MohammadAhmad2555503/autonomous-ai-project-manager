import React, { useEffect, useState, useCallback } from 'react';
import { projects as projectsAPI, analytics as analyticsAPI } from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { toast } from 'sonner';

const AnalyticsPage = () => {
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadProjects = useCallback(async () => {
    try {
      const res = await projectsAPI.getAll();
      setProjects(res.data);
      if (res.data.length > 0) {
        setSelectedProject(res.data[0].id);
      }
    } catch (error) {
      toast.error('Failed to load projects');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAnalytics = useCallback(async () => {
    try {
      const res = await analyticsAPI.getProjectAnalytics(selectedProject);
      setAnalytics(res.data);
    } catch (error) {
      toast.error('Failed to load analytics');
    }
  }, [selectedProject]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    if (selectedProject) {
      loadAnalytics();
    }
  }, [selectedProject, loadAnalytics]);

  if (loading) {
    return <div className="text-muted-foreground">Loading...</div>;
  }

  const taskStatusData = analytics ? [
    { name: 'Completed', value: analytics.completed_tasks, color: '#16a34a' },
    { name: 'In Progress', value: analytics.in_progress_tasks, color: '#0284c7' },
    { name: 'Blocked', value: analytics.blocked_tasks, color: '#dc2626' },
    { name: 'Other', value: analytics.total_tasks - analytics.completed_tasks - analytics.in_progress_tasks - analytics.blocked_tasks, color: '#71717a' },
  ] : [];

  const workloadData = analytics?.team_workload?.map(member => ({
    name: member.user_name.split(' ')[0],
    tasks: member.total_tasks,
    completed: member.completed_tasks,
    hours: member.total_estimated_hours,
  })) || [];

  return (
    <div className="space-y-6" data-testid="analytics-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-black tracking-tighter mb-2">Team Analytics</h1>
          <p className="text-muted-foreground">Performance metrics and workload distribution</p>
        </div>
        {projects.length > 0 && (
          <Select value={selectedProject} onValueChange={setSelectedProject}>
            <SelectTrigger className="w-64" data-testid="project-select">
              <SelectValue placeholder="Select project" />
            </SelectTrigger>
            <SelectContent>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {!analytics ? (
        <div className="text-muted-foreground">Loading analytics...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle>Task Status Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={taskStatusData}
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {taskStatusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a', borderRadius: '4px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="grid grid-cols-2 gap-2 mt-4">
                  {taskStatusData.map((item) => (
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
                <CardTitle>Team Workload</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={workloadData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="name" stroke="#71717a" />
                    <YAxis stroke="#71717a" />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a', borderRadius: '4px' }}
                    />
                    <Bar dataKey="tasks" fill="#0284c7" />
                    <Bar dataKey="completed" fill="#16a34a" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle>Team Member Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-muted-foreground">Name</th>
                      <th className="text-center py-3 px-4 text-xs uppercase tracking-wider text-muted-foreground">Total Tasks</th>
                      <th className="text-center py-3 px-4 text-xs uppercase tracking-wider text-muted-foreground">Completed</th>
                      <th className="text-center py-3 px-4 text-xs uppercase tracking-wider text-muted-foreground">In Progress</th>
                      <th className="text-center py-3 px-4 text-xs uppercase tracking-wider text-muted-foreground">Overdue</th>
                      <th className="text-center py-3 px-4 text-xs uppercase tracking-wider text-muted-foreground">Est. Hours</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.team_workload.map((member) => (
                      <tr key={member.user_id} className="border-b border-border hover:bg-muted/50 transition-colors duration-200">
                        <td className="py-3 px-4 font-medium">{member.user_name}</td>
                        <td className="py-3 px-4 text-center font-mono">{member.total_tasks}</td>
                        <td className="py-3 px-4 text-center font-mono text-success">{member.completed_tasks}</td>
                        <td className="py-3 px-4 text-center font-mono text-primary">{member.in_progress_tasks}</td>
                        <td className="py-3 px-4 text-center font-mono text-destructive">{member.overdue_tasks}</td>
                        <td className="py-3 px-4 text-center font-mono">{member.total_estimated_hours.toFixed(1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default AnalyticsPage;

