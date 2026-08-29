import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  analytics as analyticsAPI,
  comments as commentsAPI,
  projects as projectsAPI,
  tasks as tasksAPI,
  users as usersAPI,
} from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { ArrowLeft, MessageSquare, Pencil, Save, Trash2 } from 'lucide-react';
import { cn, formatDate, getPriorityColor, getRiskColor, getStatusColor } from '../lib/utils';
import { toast } from 'sonner';

const emptyForm = {
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
};

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

const TaskDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [task, setTask] = useState(null);
  const [project, setProject] = useState(null);
  const [users, setUsers] = useState([]);
  const [comments, setComments] = useState([]);
  const [risk, setRisk] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [commentText, setCommentText] = useState('');
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const canManageTask = user && project && (
    user.role === 'admin'
    || user.role === 'project_manager'
    || user.id === project.owner_id
  );
  const canUpdateOwnTask = user && task?.assignee_id === user.id;
  const canEdit = canManageTask || canUpdateOwnTask;

  const hydrateForm = useCallback((taskData) => {
    setFormData({
      title: taskData.title || '',
      description: taskData.description || '',
      assignee_id: taskData.assignee_id || '',
      status: taskData.status || 'todo',
      priority: taskData.priority || 'medium',
      due_date: toDateInput(taskData.due_date),
      estimated_hours: taskData.estimated_hours ?? 0,
      actual_hours: taskData.actual_hours ?? 0,
      blockers: taskData.blockers || '',
      tags: (taskData.tags || []).join(', '),
    });
  }, []);

  const loadTaskData = useCallback(async () => {
    setLoading(true);
    try {
      const taskRes = await tasksAPI.getById(id);
      const taskData = taskRes.data;
      const [projectRes, usersRes, commentsRes, riskRes] = await Promise.all([
        projectsAPI.getById(taskData.project_id),
        usersAPI.getAll(),
        commentsAPI.getByTaskId(id),
        analyticsAPI.getTaskRisk(id),
      ]);

      setTask(taskData);
      setProject(projectRes.data);
      setUsers(usersRes.data);
      setComments(commentsRes.data);
      setRisk(riskRes.data);
      hydrateForm(taskData);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to load task');
    } finally {
      setLoading(false);
    }
  }, [hydrateForm, id]);

  useEffect(() => {
    loadTaskData();
  }, [loadTaskData]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!canEdit) return;
    setSaving(true);

    const payload = canManageTask
      ? {
          ...formData,
          assignee_id: formData.assignee_id || null,
          due_date: formData.due_date || null,
          estimated_hours: Number(formData.estimated_hours) || 0,
          actual_hours: Number(formData.actual_hours) || 0,
          tags: parseTags(formData.tags),
        }
      : {
          status: formData.status,
          actual_hours: Number(formData.actual_hours) || 0,
          blockers: formData.blockers,
        };

    try {
      const res = await tasksAPI.update(id, payload);
      setTask(res.data);
      hydrateForm(res.data);
      setEditing(false);
      toast.success('Task updated');
      loadTaskData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update task');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!canManageTask || !window.confirm('Delete this task?')) return;

    try {
      await tasksAPI.delete(id);
      toast.success('Task deleted');
      navigate(project ? `/projects/${project.id}` : '/projects');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete task');
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    const content = commentText.trim();
    if (!content) return;

    try {
      await commentsAPI.create({ task_id: id, content });
      setCommentText('');
      const res = await commentsAPI.getByTaskId(id);
      setComments(res.data);
      toast.success('Comment added');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add comment');
    }
  };

  if (loading) {
    return <div className="text-muted-foreground">Loading task...</div>;
  }

  if (!task) {
    return <div className="text-muted-foreground">Task not found</div>;
  }

  const assignee = users.find((item) => item.id === task.assignee_id);

  return (
    <div className="space-y-6" data-testid="task-detail-page">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-3">
          <Link to={project ? `/projects/${project.id}` : '/projects'} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" />
            Back to project
          </Link>
          <div>
            <h1 className="text-4xl font-black tracking-tighter mb-2">{task.title}</h1>
            <p className="text-muted-foreground">{project?.title}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={cn(getStatusColor(task.status))}>{task.status.replace('_', ' ')}</Badge>
            <Badge className={cn(getPriorityColor(task.priority))}>{task.priority}</Badge>
            {risk && (
              <Badge className={cn('border', getRiskColor(risk.delay_risk_level))}>
                {risk.delay_risk_level} risk ({risk.risk_score})
              </Badge>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          {canEdit && (
            <Button variant="outline" onClick={() => setEditing((value) => !value)} data-testid="edit-task-button">
              <Pencil className="w-4 h-4 mr-2" />
              {editing ? 'Cancel' : 'Edit'}
            </Button>
          )}
          {canManageTask && (
            <Button variant="destructive" onClick={handleDelete} data-testid="delete-task-button">
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6">
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle>{editing ? 'Edit Task' : 'Task Details'}</CardTitle>
          </CardHeader>
          <CardContent>
            {editing ? (
              <form onSubmit={handleSave} className="space-y-4">
                {canManageTask && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="task-title">Title</Label>
                      <Input
                        id="task-title"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="task-description">Description</Label>
                      <Textarea
                        id="task-description"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        className="min-h-28"
                      />
                    </div>
                  </>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {canManageTask && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="task-assignee">Assignee</Label>
                        <select
                          id="task-assignee"
                          value={formData.assignee_id}
                          onChange={(e) => setFormData({ ...formData, assignee_id: e.target.value })}
                          className="w-full h-10 px-3 rounded-sm border border-border bg-input text-foreground text-sm"
                        >
                          <option value="">Unassigned</option>
                          {users.map((item) => (
                            <option key={item.id} value={item.id}>{item.full_name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="task-priority">Priority</Label>
                        <select
                          id="task-priority"
                          value={formData.priority}
                          onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                          className="w-full h-10 px-3 rounded-sm border border-border bg-input text-foreground text-sm"
                        >
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                          <option value="critical">Critical</option>
                        </select>
                      </div>
                    </>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="task-status">Status</Label>
                    <select
                      id="task-status"
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full h-10 px-3 rounded-sm border border-border bg-input text-foreground text-sm"
                    >
                      <option value="todo">To Do</option>
                      <option value="in_progress">In Progress</option>
                      <option value="blocked">Blocked</option>
                      <option value="completed">Completed</option>
                    </select>
                  </div>
                  {canManageTask && (
                    <div className="space-y-2">
                      <Label htmlFor="task-due">Due Date</Label>
                      <Input
                        id="task-due"
                        type="date"
                        value={formData.due_date}
                        onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                      />
                    </div>
                  )}
                  {canManageTask && (
                    <div className="space-y-2">
                      <Label htmlFor="task-estimated">Estimated Hours</Label>
                      <Input
                        id="task-estimated"
                        type="number"
                        min="0"
                        value={formData.estimated_hours}
                        onChange={(e) => setFormData({ ...formData, estimated_hours: e.target.value })}
                      />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="task-actual">Actual Hours</Label>
                    <Input
                      id="task-actual"
                      type="number"
                      min="0"
                      value={formData.actual_hours}
                      onChange={(e) => setFormData({ ...formData, actual_hours: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="task-blockers">Blockers</Label>
                  <Textarea
                    id="task-blockers"
                    value={formData.blockers}
                    onChange={(e) => setFormData({ ...formData, blockers: e.target.value })}
                    className="min-h-24"
                  />
                </div>

                {canManageTask && (
                  <div className="space-y-2">
                    <Label htmlFor="task-tags">Tags</Label>
                    <Input
                      id="task-tags"
                      value={formData.tags}
                      onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                      placeholder="frontend, api, launch"
                    />
                  </div>
                )}

                <Button type="submit" disabled={saving}>
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? 'Saving...' : 'Save Task'}
                </Button>
              </form>
            ) : (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Description</h3>
                  <p className="text-sm whitespace-pre-line">{task.description || 'No description provided'}</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Info label="Assignee" value={assignee?.full_name || 'Unassigned'} />
                  <Info label="Due Date" value={task.due_date ? formatDate(task.due_date) : 'No due date'} />
                  <Info label="Estimated Hours" value={task.estimated_hours.toFixed(1)} />
                  <Info label="Actual Hours" value={task.actual_hours.toFixed(1)} />
                </div>
                <div>
                  <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Blockers</h3>
                  <p className="text-sm whitespace-pre-line">{task.blockers || 'No blockers reported'}</p>
                </div>
                <div>
                  <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Tags</h3>
                  <div className="flex gap-2 flex-wrap">
                    {(task.tags || []).length === 0 ? (
                      <span className="text-sm text-muted-foreground">No tags</span>
                    ) : (
                      task.tags.map((tag) => <Badge key={tag} variant="outline">{tag}</Badge>)
                    )}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle>Risk Reasons</CardTitle>
            </CardHeader>
            <CardContent>
              {!risk || risk.reasons.length === 0 ? (
                <p className="text-sm text-muted-foreground">No active risk signals.</p>
              ) : (
                <ul className="space-y-2">
                  {risk.reasons.map((reason) => (
                    <li key={reason} className="text-sm text-muted-foreground">{reason}</li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                Comments
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={handleAddComment} className="space-y-2">
                <Textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Add an update"
                  className="min-h-20"
                />
                <Button type="submit" size="sm" disabled={!commentText.trim()}>Add Comment</Button>
              </form>

              <div className="space-y-3">
                {comments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No comments yet</p>
                ) : (
                  comments.map((comment) => {
                    const author = users.find((item) => item.id === comment.author_id);
                    return (
                      <div key={comment.id} className="rounded-sm border border-border p-3">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="text-sm font-medium">{author?.full_name || 'Unknown user'}</span>
                          <span className="text-xs text-muted-foreground">{formatDate(comment.created_at)}</span>
                        </div>
                        <p className="text-sm text-muted-foreground whitespace-pre-line">{comment.content}</p>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

const Info = ({ label, value }) => (
  <div className="rounded-sm border border-border p-3">
    <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
    <p className="text-sm font-medium">{value}</p>
  </div>
);

export default TaskDetailPage;

