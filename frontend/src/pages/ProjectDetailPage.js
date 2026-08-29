import React, { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { projects as projectsAPI, tasks as tasksAPI, users as usersAPI, ai as aiAPI, analytics as analyticsAPI } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Badge } from '../components/ui/badge';
import { Pencil, Plus, Save, Sparkles, AlertTriangle, CheckCircle2, Clock, Trash2 } from 'lucide-react';
import { cn, getStatusColor, getPriorityColor, formatDate } from '../lib/utils';
import { toast } from 'sonner';

const toDateInput = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().split('T')[0];
};

const parseTags = (value) => value
  .split(',')
  .map((tag) => tag.trim())
  .filter(Boolean);

const ProjectDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [aiInsight, setAiInsight] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    assignee_id: '',
    status: 'todo',
    priority: 'medium',
    due_date: '',
    estimated_hours: 0,
    actual_hours: 0,
    blockers: '',
    tags: '',
  });
  const [projectForm, setProjectForm] = useState({
    title: '',
    description: '',
    status: 'planning',
    start_date: '',
    target_end_date: '',
    team_member_ids: [],
  });

  const canManageProject = user && project && (user.role === 'admin' || user.id === project.owner_id);
  const canManageTasks = user && project && (
    user.role === 'admin'
    || user.id === project.owner_id
    || (user.role === 'project_manager' && (project.team_member_ids || []).includes(user.id))
  );

  const projectUsers = users.filter((item) => (
    item.id === project?.owner_id || (project?.team_member_ids || []).includes(item.id)
  ));

  const loadProjectData = useCallback(async () => {
    try {
      const [projectRes, tasksRes, usersRes, analyticsRes] = await Promise.all([
        projectsAPI.getById(id),
        tasksAPI.getAll(id),
        usersAPI.getAll(),
        analyticsAPI.getProjectAnalytics(id),
      ]);
      setProject(projectRes.data);
      setTasks(tasksRes.data);
      setUsers(usersRes.data);
      setAnalytics(analyticsRes.data);
      setProjectForm({
        title: projectRes.data.title || '',
        description: projectRes.data.description || '',
        status: projectRes.data.status || 'planning',
        start_date: toDateInput(projectRes.data.start_date),
        target_end_date: toDateInput(projectRes.data.target_end_date),
        team_member_ids: projectRes.data.team_member_ids || [],
      });
    } catch (error) {
      toast.error('Failed to load project data');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadProjectData();
  }, [loadProjectData]);

  const handleCreateTask = async (e) => {
    e.preventDefault();
    const payload = {
      ...formData,
      project_id: id,
      assignee_id: formData.assignee_id || null,
      due_date: formData.due_date || null,
      estimated_hours: Number(formData.estimated_hours) || 0,
      actual_hours: Number(formData.actual_hours) || 0,
      tags: parseTags(formData.tags),
    };

    try {
      await tasksAPI.create(payload);
      toast.success('Task created successfully!');
      setDialogOpen(false);
      setFormData({
        title: '',
        description: '',
        assignee_id: '',
        status: 'todo',
        priority: 'medium',
        due_date: '',
        estimated_hours: 0,
        actual_hours: 0,
        blockers: '',
        tags: '',
      });
      loadProjectData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create task');
    }
  };

  const handleUpdateProject = async (e) => {
    e.preventDefault();
    try {
      const res = await projectsAPI.update(id, projectForm);
      setProject(res.data);
      setEditDialogOpen(false);
      toast.success('Project updated');
      loadProjectData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update project');
    }
  };

  const handleDeleteProject = async () => {
    if (!window.confirm('Delete this project and all related tasks, comments, dependencies, risks, and insights?')) {
      return;
    }

    try {
      await projectsAPI.delete(id);
      toast.success('Project deleted');
      navigate('/projects');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete project');
    }
  };

  const handleGenerateAIInsight = async () => {
    try {
      const res = await aiAPI.generateProjectHealth(id);
      setAiInsight(res.data);
      toast.success('AI insight generated!');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to generate AI insight');
    }
  };

  const handleUpdateTaskStatus = async (taskId, newStatus) => {
    try {
      await tasksAPI.update(taskId, { status: newStatus });
      toast.success('Task status updated!');
      loadProjectData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update task');
    }
  };

  const toggleProjectTeamMember = (memberId) => {
    setProjectForm((current) => ({
      ...current,
      team_member_ids: current.team_member_ids.includes(memberId)
        ? current.team_member_ids.filter((item) => item !== memberId)
        : [...current.team_member_ids, memberId],
    }));
  };

  if (loading) {
    return <div className="text-muted-foreground">Loading project...</div>;
  }

  if (!project) {
    return <div className="text-muted-foreground">Project not found</div>;
  }

  return (
    <div className="space-y-6" data-testid="project-detail-page">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-4xl font-black tracking-tighter mb-2">{project.title}</h1>
          <p className="text-muted-foreground">{project.description}</p>
          <div className="flex items-center gap-4 mt-4">
            <Badge className={cn(getStatusColor(project.status))}>
              {project.status.replace('_', ' ')}
            </Badge>
            <span className="text-sm text-muted-foreground">
              Due: {formatDate(project.target_end_date)}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          {canManageProject && (
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" data-testid="edit-project-button">
                  <Pencil className="w-4 h-4 mr-2" />
                  Edit
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Edit Project</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleUpdateProject} className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="project-title-edit">Project Title</Label>
                    <Input
                      id="project-title-edit"
                      value={projectForm.title}
                      onChange={(e) => setProjectForm({ ...projectForm, title: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="project-description-edit">Description</Label>
                    <textarea
                      id="project-description-edit"
                      value={projectForm.description}
                      onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })}
                      className="w-full h-24 px-3 py-2 rounded-sm border border-border bg-input text-foreground text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="project-status-edit">Status</Label>
                      <select
                        id="project-status-edit"
                        value={projectForm.status}
                        onChange={(e) => setProjectForm({ ...projectForm, status: e.target.value })}
                        className="w-full h-10 px-3 rounded-sm border border-border bg-input text-foreground text-sm"
                      >
                        <option value="planning">Planning</option>
                        <option value="active">Active</option>
                        <option value="on_hold">On Hold</option>
                        <option value="completed">Completed</option>
                        <option value="archived">Archived</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="project-start-edit">Start Date</Label>
                      <Input
                        id="project-start-edit"
                        type="date"
                        value={projectForm.start_date}
                        onChange={(e) => setProjectForm({ ...projectForm, start_date: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="project-end-edit">Target End Date</Label>
                      <Input
                        id="project-end-edit"
                        type="date"
                        value={projectForm.target_end_date}
                        onChange={(e) => setProjectForm({ ...projectForm, target_end_date: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Team Members</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-auto rounded-sm border border-border p-3">
                      {users.filter((item) => item.id !== project.owner_id).map((item) => (
                        <label key={item.id} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={projectForm.team_member_ids.includes(item.id)}
                            onChange={() => toggleProjectTeamMember(item.id)}
                          />
                          <span>{item.full_name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <Button type="submit" className="w-full">
                    <Save className="w-4 h-4 mr-2" />
                    Save Project
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
          <Button onClick={handleGenerateAIInsight} variant="outline" data-testid="generate-ai-insight-button">
            <Sparkles className="w-4 h-4 mr-2" />
            AI Insight
          </Button>
          {canManageProject && (
            <Button onClick={handleDeleteProject} variant="destructive" data-testid="delete-project-button">
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          )}
          {canManageTasks && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="create-task-button">
                  <Plus className="w-4 h-4 mr-2" />
                  New Task
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Create New Task</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreateTask} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="task-title">Task Title</Label>
                  <Input
                    id="task-title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                    data-testid="task-title-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="task-description">Description</Label>
                  <textarea
                    id="task-description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full h-24 px-3 py-2 rounded-sm border border-border bg-input text-foreground text-sm"
                    data-testid="task-description-input"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="assignee">Assignee</Label>
                    <select
                      id="assignee"
                      value={formData.assignee_id}
                      onChange={(e) => setFormData({ ...formData, assignee_id: e.target.value })}
                      className="w-full h-10 px-3 rounded-sm border border-border bg-input text-foreground text-sm"
                      data-testid="task-assignee-select"
                    >
                      <option value="">Unassigned</option>
                      {projectUsers.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.full_name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="priority">Priority</Label>
                    <select
                      id="priority"
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                      className="w-full h-10 px-3 rounded-sm border border-border bg-input text-foreground text-sm"
                      data-testid="task-priority-select"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <select
                      id="status"
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full h-10 px-3 rounded-sm border border-border bg-input text-foreground text-sm"
                      data-testid="task-status-create-select"
                    >
                      <option value="todo">To Do</option>
                      <option value="in_progress">In Progress</option>
                      <option value="blocked">Blocked</option>
                      <option value="completed">Completed</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="actual-hours">Actual Hours</Label>
                    <Input
                      id="actual-hours"
                      type="number"
                      min="0"
                      value={formData.actual_hours}
                      onChange={(e) => setFormData({ ...formData, actual_hours: e.target.value })}
                      data-testid="task-actual-hours-input"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="due-date">Due Date</Label>
                    <Input
                      id="due-date"
                      type="date"
                      value={formData.due_date}
                      onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                      data-testid="task-due-date-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="estimated-hours">Estimated Hours</Label>
                    <Input
                      id="estimated-hours"
                      type="number"
                      min="0"
                      value={formData.estimated_hours}
                      onChange={(e) => setFormData({ ...formData, estimated_hours: e.target.value })}
                      data-testid="task-estimated-hours-input"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="task-blockers">Blockers</Label>
                  <textarea
                    id="task-blockers"
                    value={formData.blockers}
                    onChange={(e) => setFormData({ ...formData, blockers: e.target.value })}
                    className="w-full h-20 px-3 py-2 rounded-sm border border-border bg-input text-foreground text-sm"
                    data-testid="task-blockers-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="task-tags">Tags</Label>
                  <Input
                    id="task-tags"
                    value={formData.tags}
                    onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                    placeholder="frontend, api, launch"
                    data-testid="task-tags-input"
                  />
                </div>
                <Button type="submit" className="w-full" data-testid="submit-task-button">
                  Create Task
                </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {analytics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="border-border bg-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Total Tasks</p>
                  <p className="text-3xl font-bold font-mono">{analytics.total_tasks}</p>
                </div>
                <CheckCircle2 className="w-8 h-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">In Progress</p>
                  <p className="text-3xl font-bold font-mono">{analytics.in_progress_tasks}</p>
                </div>
                <Clock className="w-8 h-8 text-primary" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Overdue</p>
                  <p className="text-3xl font-bold font-mono">{analytics.overdue_tasks}</p>
                </div>
                <AlertTriangle className="w-8 h-8 text-warning" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">High Risk</p>
                  <p className="text-3xl font-bold font-mono">{analytics.high_risk_tasks}</p>
                </div>
                <AlertTriangle className="w-8 h-8 text-destructive" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {aiInsight && (
        <Card className="border-l-4 border-primary bg-primary/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              AI Project Health Insight
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-line">{aiInsight.content}</p>
            <p className="text-xs text-muted-foreground mt-2">Generated: {formatDate(aiInsight.created_at)}</p>
          </CardContent>
        </Card>
      )}

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle>Tasks</CardTitle>
        </CardHeader>
        <CardContent>
          {tasks.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">No tasks yet</p>
              {canManageTasks && (
                <Button onClick={() => setDialogOpen(true)} data-testid="create-first-task-button">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Task
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {tasks.map((task) => {
                const assignee = users.find(u => u.id === task.assignee_id);
                const canUpdateThisTask = canManageTasks || task.assignee_id === user?.id;
                return (
                  <div
                    key={task.id}
                    className="p-4 rounded-sm border border-border hover:border-primary/50 transition-all duration-200"
                    data-testid={`task-item-${task.id}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <Link to={`/tasks/${task.id}`} className="font-semibold mb-1 inline-block hover:text-primary">
                          {task.title}
                        </Link>
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{task.description}</p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge className={cn('text-xs', getPriorityColor(task.priority))}>
                            {task.priority}
                          </Badge>
                          {task.due_date && (
                            <span className="text-xs text-muted-foreground">
                              Due: {formatDate(task.due_date)}
                            </span>
                          )}
                          {assignee && (
                            <span className="text-xs text-muted-foreground">
                              Assigned to: {assignee.full_name}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <select
                          value={task.status}
                          onChange={(e) => handleUpdateTaskStatus(task.id, e.target.value)}
                          disabled={!canUpdateThisTask}
                          className={cn(
                            'px-2 py-1 text-xs rounded-sm border-0 font-medium disabled:cursor-not-allowed disabled:opacity-60',
                            getStatusColor(task.status)
                          )}
                          data-testid={`task-status-select-${task.id}`}
                        >
                          <option value="todo">To Do</option>
                          <option value="in_progress">In Progress</option>
                          <option value="blocked">Blocked</option>
                          <option value="completed">Completed</option>
                        </select>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ProjectDetailPage;

