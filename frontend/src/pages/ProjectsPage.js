import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { projects as projectsAPI, users as usersAPI } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Plus, FolderKanban } from 'lucide-react';
import { cn, getStatusColor, formatDate } from '../lib/utils';
import { toast } from 'sonner';

const ProjectsPage = () => {
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    start_date: new Date().toISOString().split('T')[0],
    target_end_date: '',
    team_member_ids: [],
  });
  const canCreateProjects = user?.role === 'admin' || user?.role === 'project_manager';

  const loadData = useCallback(async () => {
    try {
      const [projectsRes, usersRes] = await Promise.all([
        projectsAPI.getAll(),
        usersAPI.getAll(),
      ]);
      setProjects(projectsRes.data);
      setUsers(usersRes.data);
    } catch (error) {
      toast.error('Failed to load projects');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateProject = async (e) => {
    e.preventDefault();
    try {
      await projectsAPI.create(formData);
      toast.success('Project created successfully!');
      setDialogOpen(false);
      setFormData({
        title: '',
        description: '',
        start_date: new Date().toISOString().split('T')[0],
        target_end_date: '',
        team_member_ids: [],
      });
      loadData();
    } catch (error) {
      toast.error('Failed to create project');
    }
  };

  const toggleTeamMember = (userId) => {
    setFormData((current) => ({
      ...current,
      team_member_ids: current.team_member_ids.includes(userId)
        ? current.team_member_ids.filter((id) => id !== userId)
        : [...current.team_member_ids, userId],
    }));
  };

  if (loading) {
    return <div className="text-muted-foreground">Loading projects...</div>;
  }

  return (
    <div className="space-y-6" data-testid="projects-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-black tracking-tighter mb-2">Projects</h1>
          <p className="text-muted-foreground">Manage and oversee all active initiatives</p>
        </div>
        {canCreateProjects && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="create-project-button">
                <Plus className="w-4 h-4 mr-2" />
                New Project
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create New Project</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateProject} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Project Title</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                    data-testid="project-title-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full h-24 px-3 py-2 rounded-sm border border-border bg-input text-foreground text-sm"
                    data-testid="project-description-input"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="start_date">Start Date</Label>
                    <Input
                      id="start_date"
                      type="date"
                      value={formData.start_date}
                      onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                      required
                      data-testid="project-start-date-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="target_end_date">Target End Date</Label>
                    <Input
                      id="target_end_date"
                      type="date"
                      value={formData.target_end_date}
                      onChange={(e) => setFormData({ ...formData, target_end_date: e.target.value })}
                      required
                      data-testid="project-end-date-input"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Team Members</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-auto rounded-sm border border-border p-3">
                    {users.filter((item) => item.id !== user?.id).map((item) => (
                      <label key={item.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={formData.team_member_ids.includes(item.id)}
                          onChange={() => toggleTeamMember(item.id)}
                        />
                        <span>{item.full_name}</span>
                      </label>
                    ))}
                    {users.length <= 1 && (
                      <p className="text-sm text-muted-foreground">No other users available</p>
                    )}
                  </div>
                </div>
                <Button type="submit" className="w-full" data-testid="submit-project-button">
                  Create Project
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {projects.length === 0 ? (
        <Card className="border-border bg-card">
          <CardContent className="p-12 text-center">
            <FolderKanban className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-xl font-semibold mb-2">No projects yet</h3>
            <p className="text-muted-foreground mb-6">Create your first project to get started</p>
            {canCreateProjects && (
              <Button onClick={() => setDialogOpen(true)} data-testid="create-first-project-cta">
                <Plus className="w-4 h-4 mr-2" />
                Create Project
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <Link
              key={project.id}
              to={`/projects/${project.id}`}
              data-testid={`project-card-${project.id}`}
            >
              <Card className="border-border bg-card hover:border-primary/50 transition-all duration-200 h-full">
                <CardHeader>
                  <CardTitle className="text-lg">{project.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-3 mb-4">
                    {project.description || 'No description provided'}
                  </p>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Status</span>
                      <span className={cn('px-2 py-1 text-xs rounded-sm', getStatusColor(project.status))}>
                        {project.status.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Target Date</span>
                      <span className="text-xs font-mono">{formatDate(project.target_end_date)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Team Size</span>
                      <span className="text-xs font-mono">{project.team_member_ids.length + 1}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProjectsPage;

