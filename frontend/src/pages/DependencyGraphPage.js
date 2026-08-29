import React, { useEffect, useState, useCallback } from 'react';
import ReactFlow, { Background, Controls, MiniMap } from 'reactflow';
import 'reactflow/dist/style.css';
import { projects as projectsAPI, tasks as tasksAPI, dependencies as dependenciesAPI } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const DependencyGraphPage = () => {
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [tasks, setTasks] = useState([]);
  const [dependencies, setDependencies] = useState([]);
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [criticalPath, setCriticalPath] = useState({ nodes: [], edges: [], totalHours: 0, hasCycle: false });
  const [newDependency, setNewDependency] = useState({ predecessor_task_id: '', successor_task_id: '' });
  const [loading, setLoading] = useState(true);
  const selectedProjectData = projects.find((project) => project.id === selectedProject);
  const canManageDependencies = user && selectedProjectData && (
    user.role === 'admin'
    || user.id === selectedProjectData.owner_id
    || (user.role === 'project_manager' && (selectedProjectData.team_member_ids || []).includes(user.id))
  );

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

  const computeCriticalPath = useCallback((taskList, depList) => {
    if (taskList.length === 0) {
      return { nodes: [], edges: [], totalHours: 0, hasCycle: false };
    }

    const taskIds = new Set(taskList.map((task) => task.id));
    const durationById = new Map(taskList.map((task) => [task.id, Number(task.estimated_hours) || 1]));
    const incomingCount = new Map(taskList.map((task) => [task.id, 0]));
    const outgoing = new Map(taskList.map((task) => [task.id, []]));

    depList.forEach((dep) => {
      if (!taskIds.has(dep.predecessor_task_id) || !taskIds.has(dep.successor_task_id)) return;
      outgoing.get(dep.predecessor_task_id).push(dep.successor_task_id);
      incomingCount.set(dep.successor_task_id, incomingCount.get(dep.successor_task_id) + 1);
    });

    const queue = taskList.filter((task) => incomingCount.get(task.id) === 0).map((task) => task.id);
    const distance = new Map(taskList.map((task) => [task.id, durationById.get(task.id)]));
    const parent = new Map();
    const ordered = [];

    while (queue.length) {
      const current = queue.shift();
      ordered.push(current);

      outgoing.get(current).forEach((next) => {
        const candidate = distance.get(current) + durationById.get(next);
        if (candidate > distance.get(next)) {
          distance.set(next, candidate);
          parent.set(next, current);
        }

        incomingCount.set(next, incomingCount.get(next) - 1);
        if (incomingCount.get(next) === 0) {
          queue.push(next);
        }
      });
    }

    if (ordered.length !== taskList.length) {
      return { nodes: [], edges: [], totalHours: 0, hasCycle: true };
    }

    let endTaskId = taskList[0].id;
    taskList.forEach((task) => {
      if (distance.get(task.id) > distance.get(endTaskId)) {
        endTaskId = task.id;
      }
    });

    const pathNodes = [];
    let cursor = endTaskId;
    while (cursor) {
      pathNodes.unshift(cursor);
      cursor = parent.get(cursor);
    }

    const pathEdges = [];
    for (let index = 0; index < pathNodes.length - 1; index += 1) {
      const source = pathNodes[index];
      const target = pathNodes[index + 1];
      const edge = depList.find((dep) => dep.predecessor_task_id === source && dep.successor_task_id === target);
      if (edge) pathEdges.push(edge.id);
    }

    return {
      nodes: pathNodes,
      edges: pathEdges,
      totalHours: distance.get(endTaskId),
      hasCycle: false,
    };
  }, []);

  const buildGraph = useCallback((taskList, depList, path) => {
    const criticalNodeIds = new Set(path.nodes);
    const criticalEdgeIds = new Set(path.edges);
    const graphNodes = taskList.map((task, idx) => {
      const x = (idx % 4) * 300 + 100;
      const y = Math.floor(idx / 4) * 150 + 100;
      
      let nodeColor = '#27272a';
      let borderColor = '#3f3f46';
      
      if (task.status === 'completed') {
        nodeColor = '#16a34a20';
        borderColor = '#16a34a';
      } else if (task.status === 'blocked') {
        nodeColor = '#dc262620';
        borderColor = '#dc2626';
      } else if (task.status === 'in_progress') {
        nodeColor = '#0284c720';
        borderColor = '#0284c7';
      }

      if (criticalNodeIds.has(task.id)) {
        nodeColor = '#f59e0b20';
        borderColor = '#f59e0b';
      }

      return {
        id: task.id,
        type: 'default',
        position: { x, y },
        data: { 
          label: (
            <div className="text-xs">
              <div className="font-semibold text-foreground">{task.title}</div>
              <div className="text-muted-foreground mt-1">
                {task.status.replace('_', ' ')}
              </div>
            </div>
          )
        },
        style: {
          background: nodeColor,
          border: `2px solid ${borderColor}`,
          borderRadius: '4px',
          padding: '12px',
          width: 200,
        },
      };
    });

    const graphEdges = depList.map((dep) => ({
      id: dep.id,
      source: dep.predecessor_task_id,
      target: dep.successor_task_id,
      type: 'smoothstep',
      animated: true,
      style: {
        stroke: criticalEdgeIds.has(dep.id) ? '#f59e0b' : '#0284c7',
        strokeWidth: criticalEdgeIds.has(dep.id) ? 3 : 2,
      },
    }));

    setNodes(graphNodes);
    setEdges(graphEdges);
  }, []);

  const loadProjectGraph = useCallback(async () => {
    try {
      const [tasksRes, depsRes] = await Promise.all([
        tasksAPI.getAll(selectedProject),
        dependenciesAPI.getAll(selectedProject),
      ]);
      setTasks(tasksRes.data);
      setDependencies(depsRes.data);
      const path = computeCriticalPath(tasksRes.data, depsRes.data);
      setCriticalPath(path);
      buildGraph(tasksRes.data, depsRes.data, path);
    } catch (error) {
      toast.error('Failed to load graph data');
    }
  }, [buildGraph, computeCriticalPath, selectedProject]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    if (selectedProject) {
      setNewDependency({ predecessor_task_id: '', successor_task_id: '' });
      loadProjectGraph();
    }
  }, [selectedProject, loadProjectGraph]);

  const handleCreateDependency = async (e) => {
    e.preventDefault();
    try {
      await dependenciesAPI.create(newDependency);
      toast.success('Dependency created');
      setNewDependency({ predecessor_task_id: '', successor_task_id: '' });
      loadProjectGraph();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create dependency');
    }
  };

  const handleDeleteDependency = async (dependencyId) => {
    try {
      await dependenciesAPI.delete(dependencyId);
      toast.success('Dependency deleted');
      loadProjectGraph();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete dependency');
    }
  };

  if (loading) {
    return <div className="text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="space-y-6" data-testid="dependency-graph-page">
      <div>
        <h1 className="text-4xl font-black tracking-tighter mb-2">Dependency Graph</h1>
        <p className="text-muted-foreground">Visualize task dependencies and critical paths</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-6">
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle>Critical Path</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {criticalPath.hasCycle ? (
              <p className="text-sm text-destructive">A cycle exists in this project, so a critical path cannot be computed.</p>
            ) : criticalPath.nodes.length === 0 ? (
              <p className="text-sm text-muted-foreground">Select a project with tasks to calculate the longest dependency path.</p>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <Badge className="bg-warning/20 text-warning border border-warning/30">
                    {criticalPath.totalHours.toFixed(1)} estimated hours
                  </Badge>
                  <span className="text-sm text-muted-foreground">{criticalPath.nodes.length} tasks</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {criticalPath.nodes.map((taskId) => {
                    const task = tasks.find((item) => item.id === taskId);
                    return task ? (
                      <Badge key={taskId} variant="outline" className="border-warning/50">
                        {task.title}
                      </Badge>
                    ) : null;
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle>Dependencies</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {canManageDependencies && tasks.length >= 2 && (
              <form onSubmit={handleCreateDependency} className="space-y-3">
                <Select
                  value={newDependency.predecessor_task_id}
                  onValueChange={(value) => setNewDependency({ ...newDependency, predecessor_task_id: value })}
                >
                  <SelectTrigger data-testid="predecessor-select">
                    <SelectValue placeholder="Predecessor task" />
                  </SelectTrigger>
                  <SelectContent>
                    {tasks.map((task) => (
                      <SelectItem key={task.id} value={task.id}>{task.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={newDependency.successor_task_id}
                  onValueChange={(value) => setNewDependency({ ...newDependency, successor_task_id: value })}
                >
                  <SelectTrigger data-testid="successor-select">
                    <SelectValue placeholder="Successor task" />
                  </SelectTrigger>
                  <SelectContent>
                    {tasks.map((task) => (
                      <SelectItem key={task.id} value={task.id}>{task.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={
                    !newDependency.predecessor_task_id
                    || !newDependency.successor_task_id
                    || newDependency.predecessor_task_id === newDependency.successor_task_id
                  }
                  data-testid="create-dependency-button"
                >
                  Add Dependency
                </Button>
              </form>
            )}

            <div className="space-y-2 max-h-64 overflow-auto">
              {dependencies.length === 0 ? (
                <p className="text-sm text-muted-foreground">No dependencies yet</p>
              ) : (
                dependencies.map((dependency) => {
                  const predecessor = tasks.find((task) => task.id === dependency.predecessor_task_id);
                  const successor = tasks.find((task) => task.id === dependency.successor_task_id);
                  const isCritical = criticalPath.edges.includes(dependency.id);
                  return (
                    <div key={dependency.id} className="flex items-center justify-between gap-3 rounded-sm border border-border p-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{predecessor?.title || 'Unknown task'}</p>
                        <p className="text-xs text-muted-foreground truncate">blocks {successor?.title || 'Unknown task'}</p>
                        {isCritical && <Badge className="mt-2 bg-warning/20 text-warning">Critical path</Badge>}
                      </div>
                      {canManageDependencies && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteDependency(dependency.id)}
                          aria-label="Delete dependency"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border bg-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Project Dependency Map</CardTitle>
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
        </CardHeader>
        <CardContent>
          {tasks.length === 0 ? (
            <div className="h-96 flex items-center justify-center text-muted-foreground">
              No tasks in this project
            </div>
          ) : (
            <div className="h-[600px] rounded-sm border border-border bg-background">
              <ReactFlow
                nodes={nodes}
                edges={edges}
                fitView
                minZoom={0.5}
                maxZoom={1.5}
              >
                <Background color="#27272a" gap={16} />
                <Controls className="bg-card border-border" />
                <MiniMap
                  nodeColor={(node) => {
                    const task = tasks.find(t => t.id === node.id);
                    if (!task) return '#27272a';
                    if (criticalPath.nodes.includes(node.id)) return '#f59e0b';
                    if (task.status === 'completed') return '#16a34a';
                    if (task.status === 'blocked') return '#dc2626';
                    if (task.status === 'in_progress') return '#0284c7';
                    return '#27272a';
                  }}
                  className="bg-card border-border"
                />
              </ReactFlow>
            </div>
          )}
          
          <div className="flex items-center gap-6 mt-4">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-sm bg-primary/20 border-2 border-primary" />
              <span className="text-xs text-muted-foreground">In Progress</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-sm bg-success/20 border-2 border-success" />
              <span className="text-xs text-muted-foreground">Completed</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-sm bg-destructive/20 border-2 border-destructive" />
              <span className="text-xs text-muted-foreground">Blocked</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-sm bg-muted border-2 border-border" />
              <span className="text-xs text-muted-foreground">To Do</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-sm bg-warning/20 border-2 border-warning" />
              <span className="text-xs text-muted-foreground">Critical Path</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DependencyGraphPage;

