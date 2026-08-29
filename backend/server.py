from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ASCENDING
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr, field_validator, model_validator
from typing import List, Optional, Dict, Any
from enum import Enum
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'ai_rpm')]

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET')
JWT_ALGORITHM = os.environ.get('JWT_ALGORITHM', 'HS256')
JWT_EXPIRATION_HOURS = int(os.environ.get('JWT_EXPIRATION_HOURS', '72'))
APP_ENV = os.environ.get('APP_ENV', 'development')
AUTH_COOKIE_NAME = os.environ.get('AUTH_COOKIE_NAME', 'ai_rpm_token')
COOKIE_SECURE = os.environ.get('COOKIE_SECURE', str(APP_ENV == 'production')).lower() == 'true'

if not JWT_SECRET:
    if APP_ENV == 'production':
        raise RuntimeError('Set JWT_SECRET to a strong unique value in production.')
    JWT_SECRET = 'dev-only-insecure-secret-change-me'

# Security
security = HTTPBearer(auto_error=False)

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")

# ==================== MODELS ====================

class APIModel(BaseModel):
    model_config = ConfigDict(use_enum_values=True, extra='forbid')


class UserRole(str, Enum):
    ADMIN = "admin"
    PROJECT_MANAGER = "project_manager"
    TEAM_MEMBER = "team_member"


class TaskStatus(str, Enum):
    TODO = "todo"
    IN_PROGRESS = "in_progress"
    BLOCKED = "blocked"
    COMPLETED = "completed"


class TaskPriority(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class ProjectStatus(str, Enum):
    PLANNING = "planning"
    ACTIVE = "active"
    ON_HOLD = "on_hold"
    COMPLETED = "completed"
    ARCHIVED = "archived"


class RiskLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"

# User Models
class UserBase(APIModel):
    full_name: str = Field(..., min_length=1, max_length=120)
    email: EmailStr
    role: UserRole = UserRole.TEAM_MEMBER


class UserCreate(APIModel):
    full_name: str = Field(..., min_length=1, max_length=120)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)


class UserLogin(APIModel):
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=128)

class User(UserBase):
    id: str
    created_at: str


class UserWithToken(APIModel):
    user: User
    token: str

# Project Models
class ProjectCreate(APIModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: str = Field(default="", max_length=5000)
    start_date: str
    target_end_date: str
    team_member_ids: List[str] = Field(default_factory=list)

    @field_validator('start_date', 'target_end_date')
    @classmethod
    def validate_project_dates(cls, value: str) -> str:
        return normalize_datetime(value)

    @model_validator(mode='after')
    def validate_date_order(self) -> 'ProjectCreate':
        if parse_datetime_string(self.target_end_date) < parse_datetime_string(self.start_date):
            raise ValueError('target_end_date must be on or after start_date')
        return self


class ProjectUpdate(APIModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=5000)
    status: Optional[ProjectStatus] = None
    start_date: Optional[str] = None
    target_end_date: Optional[str] = None
    team_member_ids: Optional[List[str]] = None

    @field_validator('start_date', 'target_end_date')
    @classmethod
    def validate_optional_project_dates(cls, value: Optional[str]) -> Optional[str]:
        return normalize_datetime(value) if value else value


class Project(APIModel):
    id: str
    title: str = Field(..., min_length=1, max_length=200)
    description: str
    status: ProjectStatus
    owner_id: str
    team_member_ids: List[str]
    start_date: str
    target_end_date: str
    created_at: str
    updated_at: str

# Task Models
class TaskCreate(APIModel):
    project_id: str
    title: str = Field(..., min_length=1, max_length=200)
    description: str = Field(default="", max_length=5000)
    assignee_id: Optional[str] = None
    status: TaskStatus = TaskStatus.TODO
    priority: TaskPriority = TaskPriority.MEDIUM
    due_date: Optional[str] = None
    estimated_hours: float = Field(default=0, ge=0)
    actual_hours: float = Field(default=0, ge=0)
    blockers: str = Field(default="", max_length=3000)
    tags: List[str] = Field(default_factory=list)

    @field_validator('due_date')
    @classmethod
    def validate_due_date(cls, value: Optional[str]) -> Optional[str]:
        return normalize_datetime(value) if value else value


class TaskUpdate(APIModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=5000)
    assignee_id: Optional[str] = None
    status: Optional[TaskStatus] = None
    priority: Optional[TaskPriority] = None
    due_date: Optional[str] = None
    estimated_hours: Optional[float] = Field(default=None, ge=0)
    actual_hours: Optional[float] = Field(default=None, ge=0)
    blockers: Optional[str] = Field(default=None, max_length=3000)
    tags: Optional[List[str]] = None

    @field_validator('due_date')
    @classmethod
    def validate_optional_due_date(cls, value: Optional[str]) -> Optional[str]:
        return normalize_datetime(value) if value else value


class Task(APIModel):
    id: str
    project_id: str
    title: str = Field(..., min_length=1, max_length=200)
    description: str
    assignee_id: Optional[str] = None
    status: TaskStatus
    priority: TaskPriority
    due_date: Optional[str] = None
    estimated_hours: float
    actual_hours: float
    blockers: str
    tags: List[str]
    created_at: str
    updated_at: str

# Dependency Models
class DependencyCreate(APIModel):
    predecessor_task_id: str
    successor_task_id: str


class Dependency(APIModel):
    id: str
    predecessor_task_id: str
    successor_task_id: str
    created_at: str

# Comment Models
class CommentCreate(APIModel):
    task_id: str
    content: str = Field(..., min_length=1, max_length=3000)


class Comment(APIModel):
    id: str
    task_id: str
    author_id: str
    content: str
    created_at: str

# Risk Assessment Models
class RiskAssessment(APIModel):
    id: str
    task_id: str
    delay_risk_level: RiskLevel
    risk_score: float
    reasons: List[str]
    created_at: str

# AI Insight Models
class AIInsight(APIModel):
    id: str
    project_id: str
    insight_type: str
    content: str
    created_at: str

# Analytics Models
class TeamMemberWorkload(APIModel):
    user_id: str
    user_name: str
    total_tasks: int
    completed_tasks: int
    in_progress_tasks: int
    overdue_tasks: int
    total_estimated_hours: float
    total_actual_hours: float


class ProjectAnalytics(APIModel):
    total_tasks: int
    completed_tasks: int
    in_progress_tasks: int
    blocked_tasks: int
    overdue_tasks: int
    high_risk_tasks: int
    team_workload: List[TeamMemberWorkload]

# ==================== HELPER FUNCTIONS ====================

def enum_value(value: Any) -> Any:
    return value.value if isinstance(value, Enum) else value


def model_update_dict(model: BaseModel) -> Dict[str, Any]:
    return {
        key: enum_value(value)
        for key, value in model.model_dump(exclude_unset=True).items()
        if value is not None
    }


def parse_datetime_string(value: str) -> datetime:
    try:
        parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
    except ValueError as exc:
        raise ValueError('date must be ISO-8601 formatted') from exc

    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def normalize_datetime(value: str) -> str:
    return parse_datetime_string(value).isoformat()


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))


def create_token(user_id: str, email: str, role: str | UserRole) -> str:
    payload = {
        "user_id": user_id,
        "email": email,
        "role": enum_value(role),
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def set_auth_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=AUTH_COOKIE_NAME,
        value=token,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite='lax',
        max_age=JWT_EXPIRATION_HOURS * 60 * 60,
        path='/',
    )


def public_user_doc(user: Dict[str, Any]) -> Dict[str, Any]:
    return {key: value for key, value in user.items() if key not in {'_id', 'password_hash'}}


def current_role(current_user: Dict[str, Any]) -> str:
    return str(enum_value(current_user.get('role', UserRole.TEAM_MEMBER)))


def is_admin(current_user: Dict[str, Any]) -> bool:
    return current_role(current_user) == UserRole.ADMIN.value


def is_project_manager(current_user: Dict[str, Any]) -> bool:
    return current_role(current_user) == UserRole.PROJECT_MANAGER.value


def can_read_project(project: Dict[str, Any], current_user: Dict[str, Any]) -> bool:
    user_id = current_user['id']
    return (
        is_admin(current_user)
        or project.get('owner_id') == user_id
        or user_id in project.get('team_member_ids', [])
    )


def can_manage_project(project: Dict[str, Any], current_user: Dict[str, Any]) -> bool:
    return is_admin(current_user) or project.get('owner_id') == current_user['id']


def can_manage_project_tasks(project: Dict[str, Any], current_user: Dict[str, Any]) -> bool:
    return can_manage_project(project, current_user) or (
        is_project_manager(current_user) and can_read_project(project, current_user)
    )


def can_update_task(task: Dict[str, Any], project: Dict[str, Any], current_user: Dict[str, Any]) -> bool:
    return can_manage_project_tasks(project, current_user) or task.get('assignee_id') == current_user['id']


async def require_project_access(project_id: str, current_user: Dict[str, Any]) -> Dict[str, Any]:
    project = await db.projects.find_one({"id": project_id}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if not can_read_project(project, current_user):
        raise HTTPException(status_code=403, detail="Not authorized")
    return project


async def require_project_manager_access(project_id: str, current_user: Dict[str, Any]) -> Dict[str, Any]:
    project = await require_project_access(project_id, current_user)
    if not can_manage_project_tasks(project, current_user):
        raise HTTPException(status_code=403, detail="Not authorized")
    return project


async def require_project_owner_or_admin(project_id: str, current_user: Dict[str, Any]) -> Dict[str, Any]:
    project = await require_project_access(project_id, current_user)
    if not can_manage_project(project, current_user):
        raise HTTPException(status_code=403, detail="Not authorized")
    return project


async def require_task_access(task_id: str, current_user: Dict[str, Any]) -> tuple[Dict[str, Any], Dict[str, Any]]:
    task = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    project = await require_project_access(task["project_id"], current_user)
    return task, project


async def require_task_update_access(task_id: str, current_user: Dict[str, Any]) -> tuple[Dict[str, Any], Dict[str, Any]]:
    task, project = await require_task_access(task_id, current_user)
    if not can_update_task(task, project, current_user):
        raise HTTPException(status_code=403, detail="Not authorized")
    return task, project


async def require_task_manager_access(task_id: str, current_user: Dict[str, Any]) -> tuple[Dict[str, Any], Dict[str, Any]]:
    task, project = await require_task_access(task_id, current_user)
    if not can_manage_project_tasks(project, current_user):
        raise HTTPException(status_code=403, detail="Not authorized")
    return task, project


async def get_accessible_project_ids(current_user: Dict[str, Any]) -> Optional[List[str]]:
    if is_admin(current_user):
        return None

    projects = await db.projects.find({
        "$or": [
            {"owner_id": current_user["id"]},
            {"team_member_ids": current_user["id"]}
        ]
    }, {"_id": 0, "id": 1}).to_list(1000)
    return [project["id"] for project in projects]


async def ensure_users_exist(user_ids: List[str]) -> List[str]:
    unique_ids = sorted({user_id for user_id in user_ids if user_id})
    if not unique_ids:
        return []

    count = await db.users.count_documents({"id": {"$in": unique_ids}})
    if count != len(unique_ids):
        raise HTTPException(status_code=400, detail="One or more users do not exist")
    return unique_ids


async def ensure_assignee_is_valid(project: Dict[str, Any], assignee_id: Optional[str]) -> None:
    if not assignee_id:
        return
    allowed_ids = set(project.get("team_member_ids", []))
    allowed_ids.add(project["owner_id"])
    if assignee_id not in allowed_ids:
        raise HTTPException(status_code=400, detail="Assignee must be the project owner or a team member")


async def would_create_dependency_cycle(predecessor_task_id: str, successor_task_id: str) -> bool:
    stack = [successor_task_id]
    visited = set()

    while stack:
        task_id = stack.pop()
        if task_id == predecessor_task_id:
            return True
        if task_id in visited:
            continue

        visited.add(task_id)
        deps = await db.task_dependencies.find(
            {"predecessor_task_id": task_id},
            {"_id": 0, "successor_task_id": 1}
        ).to_list(1000)
        stack.extend(dep["successor_task_id"] for dep in deps)

    return False


async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> Dict[str, Any]:
    try:
        token = credentials.credentials if credentials else request.cookies.get(AUTH_COOKIE_NAME)
        if not token:
            raise HTTPException(status_code=401, detail="Missing authentication token")
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"id": payload["user_id"]}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return public_user_doc(user)
    except HTTPException:
        raise
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

def is_overdue(due_date: Optional[str]) -> bool:
    if not due_date:
        return False
    try:
        due = parse_datetime_string(due_date)
        return due < datetime.now(timezone.utc)
    except ValueError:
        return False

# ==================== RISK ASSESSMENT ENGINE ====================

async def calculate_task_risk(task: Dict[str, Any]) -> Dict[str, Any]:
    """Calculate delay risk for a task based on multiple factors"""
    risk_score = 0.0
    reasons = []
    
    # Factor 1: Overdue status (highest weight)
    if is_overdue(task.get('due_date')):
        risk_score += 40
        reasons.append("Task is overdue")
    
    # Factor 2: Blockers
    if task.get('blockers') and len(task.get('blockers', '').strip()) > 0:
        risk_score += 25
        reasons.append("Task has blockers")
    
    # Factor 3: Priority
    priority = task.get('priority', TaskPriority.MEDIUM.value)
    if priority == TaskPriority.CRITICAL.value:
        risk_score += 15
        reasons.append("Critical priority task")
    elif priority == TaskPriority.HIGH.value:
        risk_score += 10
    
    # Factor 4: Upstream dependencies
    dependencies = await db.task_dependencies.count_documents({"successor_task_id": task['id']})
    if dependencies > 3:
        risk_score += 15
        reasons.append(f"Task depends on {dependencies} predecessor tasks")
    elif dependencies > 1:
        risk_score += 8
    
    # Factor 5: Estimated vs actual hours
    estimated = task.get('estimated_hours', 0)
    actual = task.get('actual_hours', 0)
    if estimated > 0 and actual > estimated * 0.8:
        risk_score += 12
        reasons.append("Nearing or exceeding estimated hours")
    
    # Factor 6: Status
    if task.get('status') == TaskStatus.BLOCKED.value:
        risk_score += 20
        reasons.append("Task is blocked")
    
    # Determine risk level
    if risk_score >= 60:
        risk_level = RiskLevel.HIGH
    elif risk_score >= 30:
        risk_level = RiskLevel.MEDIUM
    else:
        risk_level = RiskLevel.LOW
    
    return {
        "id": str(uuid.uuid4()),
        "task_id": task['id'],
        "delay_risk_level": risk_level.value,
        "risk_score": risk_score,
        "reasons": reasons,
        "created_at": datetime.now(timezone.utc).isoformat()
    }

# ==================== AI SERVICE LAYER ====================

async def generate_ai_insight(project_id: str, insight_type: str, context: Dict[str, Any]) -> str:
    """Generate deterministic project-management insights for local demos."""
    return get_mock_ai_response(insight_type, context)

def create_ai_prompt(insight_type: str, context: Dict[str, Any]) -> str:
    """Create prompts for different insight types"""
    if insight_type == "project_health":
        return f"""
Analyze this project's health:
- Total tasks: {context.get('total_tasks', 0)}
- Completed: {context.get('completed_tasks', 0)}
- In progress: {context.get('in_progress_tasks', 0)}
- Blocked: {context.get('blocked_tasks', 0)}
- Overdue: {context.get('overdue_tasks', 0)}
- High risk: {context.get('high_risk_tasks', 0)}

Provide a 3-sentence health summary and overall status (Healthy/At Risk/Critical).
"""
    elif insight_type == "top_risks":
        return f"""
Identify top 3 project risks based on:
- {context.get('blocked_tasks', 0)} blocked tasks
- {context.get('overdue_tasks', 0)} overdue tasks
- {context.get('high_risk_tasks', 0)} high-risk tasks
- Team workload data available

List 3 specific risks with mitigation suggestions.
"""
    elif insight_type == "recommendations":
        return f"""
Given project data:
- {context.get('overdue_tasks', 0)} overdue tasks
- {context.get('blocked_tasks', 0)} blocked tasks
- {context.get('team_size', 0)} team members

Provide 3 actionable recommendations to improve project delivery.
"""
    elif insight_type == "stakeholder_summary":
        return f"""
Create a stakeholder-ready weekly summary:
- Project: {context.get('project_title', 'Project')}
- Progress: {context.get('completed_tasks', 0)}/{context.get('total_tasks', 0)} tasks completed
- Status: {context.get('blocked_tasks', 0)} blocked, {context.get('overdue_tasks', 0)} overdue

Provide a professional 4-sentence executive summary.
"""
    else:
        return f"Analyze project data: {context}"

def get_mock_ai_response(insight_type: str, context: Dict[str, Any]) -> str:
    """Fallback mock AI responses"""
    if insight_type == "project_health":
        total = context.get('total_tasks', 0)
        completed = context.get('completed_tasks', 0)
        overdue = context.get('overdue_tasks', 0)
        blocked = context.get('blocked_tasks', 0)
        
        if total == 0:
            return "Status: Healthy. Project is in planning phase with no tasks created yet. Ready to begin execution."
        
        progress_rate = (completed / total * 100) if total > 0 else 0
        
        if overdue > total * 0.3 or blocked > total * 0.2:
            status = "Critical"
            health = f"Project requires immediate attention. {overdue} overdue and {blocked} blocked tasks are significantly impacting progress."
        elif overdue > 0 or blocked > 0:
            status = "At Risk"
            health = f"Project facing moderate challenges with {overdue} overdue and {blocked} blocked tasks. Team should prioritize unblocking critical path items."
        else:
            status = "Healthy"
            health = f"Project is on track with {progress_rate:.0f}% completion rate. Team maintaining good momentum with minimal blockers."
        
        return f"Status: {status}. {health} Current velocity suggests {'adjustments needed' if status != 'Healthy' else 'timely delivery'}."
    
    elif insight_type == "top_risks":
        risks = []
        if context.get('overdue_tasks', 0) > 0:
            risks.append(f"1. Schedule Risk: {context['overdue_tasks']} overdue tasks may cascade delays. Mitigation: Reassign resources to critical path items.")
        if context.get('blocked_tasks', 0) > 0:
            risks.append(f"2. Dependency Risk: {context['blocked_tasks']} blocked tasks indicate bottlenecks. Mitigation: Daily unblocking sessions with stakeholders.")
        if context.get('high_risk_tasks', 0) > 0:
            risks.append(f"3. Execution Risk: {context['high_risk_tasks']} high-risk tasks need attention. Mitigation: Increase check-in frequency and pair programming.")
        
        if not risks:
            risks = ["1. No immediate risks detected. Continue monitoring task progress.",
                    "2. Maintain current velocity and team communication.",
                    "3. Proactively identify dependencies for upcoming sprints."]
        
        return "\n".join(risks[:3])
    
    elif insight_type == "recommendations":
        recs = []
        if context.get('overdue_tasks', 0) > 0:
            recs.append(f"1. Address {context['overdue_tasks']} overdue tasks immediately - consider team reallocation")
        if context.get('blocked_tasks', 0) > 0:
            recs.append(f"2. Unblock {context['blocked_tasks']} tasks through stakeholder escalation or workarounds")
        if context.get('team_size', 0) > 0:
            recs.append(f"3. Balance workload across {context['team_size']} team members to prevent burnout")
        else:
            recs = ["1. Establish clear task priorities and dependencies",
                   "2. Set up daily standups to track progress and blockers",
                   "3. Implement regular retrospectives for continuous improvement"]
        return "\n".join(recs[:3])
    
    elif insight_type == "stakeholder_summary":
        total = context.get('total_tasks', 0)
        completed = context.get('completed_tasks', 0)
        project = context.get('project_title', 'Project')
        
        return f"""{project} Weekly Update: Team has completed {completed} of {total} tasks ({(completed/total*100) if total > 0 else 0:.0f}% complete). 
Current focus is on maintaining delivery momentum while addressing {context.get('blocked_tasks', 0)} blocked items. 
No critical blockers preventing progress at this time. 
On track for planned delivery timeline with {total - completed} tasks remaining in backlog."""
    
    return "AI analysis complete. No specific insights available for this request type."

# ==================== AUTH ROUTES ====================

@api_router.post("/auth/signup", response_model=UserWithToken)
async def signup(user_data: UserCreate, response: Response):
    # Check if user exists
    existing = await db.users.find_one({"email": user_data.email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user
    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "full_name": user_data.full_name,
        "email": user_data.email,
        "password_hash": hash_password(user_data.password),
        "role": UserRole.TEAM_MEMBER.value,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(user_doc)
    
    token = create_token(user_id, user_data.email, UserRole.TEAM_MEMBER)
    set_auth_cookie(response, token)
    
    user = User(
        id=user_id,
        full_name=user_data.full_name,
        email=user_data.email,
        role=UserRole.TEAM_MEMBER,
        created_at=user_doc["created_at"]
    )
    
    return UserWithToken(user=user, token=token)

@api_router.post("/auth/login", response_model=UserWithToken)
async def login(credentials: UserLogin, response: Response):
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_token(user["id"], user["email"], user["role"])
    set_auth_cookie(response, token)
    
    user_obj = User(
        id=user["id"],
        full_name=user["full_name"],
        email=user["email"],
        role=user["role"],
        created_at=user["created_at"]
    )
    
    return UserWithToken(user=user_obj, token=token)


@api_router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie(AUTH_COOKIE_NAME, path='/')
    return {"message": "Logged out"}

@api_router.get("/auth/me", response_model=User)
async def get_me(current_user: dict = Depends(get_current_user)):
    return User(**current_user)

# ==================== USER ROUTES ====================

@api_router.get("/users", response_model=List[User])
async def get_users(current_user: dict = Depends(get_current_user)):
    if is_admin(current_user) or is_project_manager(current_user):
        users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(1000)
        return [User(**u) for u in users]

    accessible_project_ids = await get_accessible_project_ids(current_user)
    projects = await db.projects.find(
        {"id": {"$in": accessible_project_ids or []}},
        {"_id": 0, "owner_id": 1, "team_member_ids": 1}
    ).to_list(1000)
    user_ids = {current_user["id"]}
    for project in projects:
        user_ids.add(project["owner_id"])
        user_ids.update(project.get("team_member_ids", []))

    users = await db.users.find({"id": {"$in": list(user_ids)}}, {"_id": 0, "password_hash": 0}).to_list(1000)
    return [User(**u) for u in users]

@api_router.get("/users/{user_id}", response_model=User)
async def get_user(user_id: str, current_user: dict = Depends(get_current_user)):
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user_id != current_user["id"] and not is_admin(current_user) and not is_project_manager(current_user):
        visible_users = await get_users(current_user)
        if user_id not in {visible_user.id for visible_user in visible_users}:
            raise HTTPException(status_code=403, detail="Not authorized")
    return User(**user)

# ==================== PROJECT ROUTES ====================

@api_router.post("/projects", response_model=Project)
async def create_project(project_data: ProjectCreate, current_user: dict = Depends(get_current_user)):
    if not (is_admin(current_user) or is_project_manager(current_user)):
        raise HTTPException(status_code=403, detail="Only admins and project managers can create projects")

    project_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    team_member_ids = await ensure_users_exist(project_data.team_member_ids)
    team_member_ids = [user_id for user_id in team_member_ids if user_id != current_user["id"]]
    
    project_doc = {
        "id": project_id,
        "title": project_data.title,
        "description": project_data.description,
        "status": ProjectStatus.PLANNING.value,
        "owner_id": current_user["id"],
        "team_member_ids": team_member_ids,
        "start_date": project_data.start_date,
        "target_end_date": project_data.target_end_date,
        "created_at": now,
        "updated_at": now
    }
    
    await db.projects.insert_one(project_doc)
    return Project(**project_doc)

@api_router.get("/projects", response_model=List[Project])
async def get_projects(current_user: dict = Depends(get_current_user)):
    # Show all projects for admin, own + assigned for others
    if is_admin(current_user):
        query = {}
    else:
        query = {
            "$or": [
                {"owner_id": current_user["id"]},
                {"team_member_ids": current_user["id"]}
            ]
        }
    
    projects = await db.projects.find(query, {"_id": 0}).to_list(1000)
    return [Project(**p) for p in projects]

@api_router.get("/projects/{project_id}", response_model=Project)
async def get_project(project_id: str, current_user: dict = Depends(get_current_user)):
    project = await require_project_access(project_id, current_user)
    return Project(**project)

@api_router.patch("/projects/{project_id}", response_model=Project)
async def update_project(project_id: str, update_data: ProjectUpdate, current_user: dict = Depends(get_current_user)):
    project = await require_project_owner_or_admin(project_id, current_user)
    update_dict = model_update_dict(update_data)
    if update_dict:
        if "team_member_ids" in update_dict:
            update_dict["team_member_ids"] = await ensure_users_exist(update_dict["team_member_ids"])
            update_dict["team_member_ids"] = [
                user_id for user_id in update_dict["team_member_ids"] if user_id != project["owner_id"]
            ]
        next_start = update_dict.get("start_date", project["start_date"])
        next_end = update_dict.get("target_end_date", project["target_end_date"])
        if parse_datetime_string(next_end) < parse_datetime_string(next_start):
            raise HTTPException(status_code=400, detail="target_end_date must be on or after start_date")

        update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.projects.update_one({"id": project_id}, {"$set": update_dict})
        project.update(update_dict)
    
    return Project(**project)

@api_router.delete("/projects/{project_id}")
async def delete_project(project_id: str, current_user: dict = Depends(get_current_user)):
    await require_project_owner_or_admin(project_id, current_user)
    task_ids = [
        task["id"]
        for task in await db.tasks.find({"project_id": project_id}, {"_id": 0, "id": 1}).to_list(1000)
    ]

    await db.projects.delete_one({"id": project_id})
    await db.tasks.delete_many({"project_id": project_id})
    await db.task_dependencies.delete_many({
        "$or": [
            {"predecessor_task_id": {"$in": task_ids}},
            {"successor_task_id": {"$in": task_ids}}
        ]
    })
    await db.task_comments.delete_many({"task_id": {"$in": task_ids}})
    await db.task_updates.delete_many({"task_id": {"$in": task_ids}})
    await db.risk_assessments.delete_many({"task_id": {"$in": task_ids}})
    await db.ai_insights.delete_many({"project_id": project_id})
    return {"message": "Project deleted"}

# ==================== TASK ROUTES ====================

@api_router.post("/tasks", response_model=Task)
async def create_task(task_data: TaskCreate, current_user: dict = Depends(get_current_user)):
    project = await require_project_manager_access(task_data.project_id, current_user)
    await ensure_assignee_is_valid(project, task_data.assignee_id)

    task_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    task_doc = {
        "id": task_id,
        "project_id": task_data.project_id,
        "title": task_data.title,
        "description": task_data.description,
        "assignee_id": task_data.assignee_id,
        "status": enum_value(task_data.status),
        "priority": enum_value(task_data.priority),
        "due_date": task_data.due_date,
        "estimated_hours": task_data.estimated_hours,
        "actual_hours": task_data.actual_hours,
        "blockers": task_data.blockers,
        "tags": task_data.tags,
        "created_at": now,
        "updated_at": now
    }
    
    await db.tasks.insert_one(task_doc)
    return Task(**task_doc)

@api_router.get("/tasks", response_model=List[Task])
async def get_tasks(project_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    if project_id:
        await require_project_access(project_id, current_user)
        query = {"project_id": project_id}
    else:
        accessible_project_ids = await get_accessible_project_ids(current_user)
        query = {} if accessible_project_ids is None else {"project_id": {"$in": accessible_project_ids}}
    
    tasks = await db.tasks.find(query, {"_id": 0}).to_list(1000)
    return [Task(**t) for t in tasks]

@api_router.get("/tasks/{task_id}", response_model=Task)
async def get_task(task_id: str, current_user: dict = Depends(get_current_user)):
    task, _project = await require_task_access(task_id, current_user)
    return Task(**task)

@api_router.patch("/tasks/{task_id}", response_model=Task)
async def update_task(task_id: str, update_data: TaskUpdate, current_user: dict = Depends(get_current_user)):
    task, project = await require_task_update_access(task_id, current_user)
    update_dict = model_update_dict(update_data)

    if not can_manage_project_tasks(project, current_user):
        allowed_fields = {"status", "actual_hours", "blockers"}
        if set(update_dict) - allowed_fields:
            raise HTTPException(status_code=403, detail="Only project managers can edit task details")

    if "assignee_id" in update_dict:
        await ensure_assignee_is_valid(project, update_dict["assignee_id"])
    
    # Log status update
    if "status" in update_dict and update_dict["status"] != task.get("status"):
        update_log = {
            "id": str(uuid.uuid4()),
            "task_id": task_id,
            "author_id": current_user["id"],
            "previous_status": task.get("status"),
            "new_status": update_dict["status"],
            "note": "",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.task_updates.insert_one(update_log)
    
    if update_dict:
        update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.tasks.update_one({"id": task_id}, {"$set": update_dict})
        task.update(update_dict)
    
    return Task(**task)

@api_router.delete("/tasks/{task_id}")
async def delete_task(task_id: str, current_user: dict = Depends(get_current_user)):
    await require_task_manager_access(task_id, current_user)
    await db.tasks.delete_one({"id": task_id})
    await db.task_dependencies.delete_many({"$or": [{"predecessor_task_id": task_id}, {"successor_task_id": task_id}]})
    await db.task_comments.delete_many({"task_id": task_id})
    await db.task_updates.delete_many({"task_id": task_id})
    await db.risk_assessments.delete_many({"task_id": task_id})
    return {"message": "Task deleted"}

# ==================== DEPENDENCY ROUTES ====================

@api_router.post("/dependencies", response_model=Dependency)
async def create_dependency(dep_data: DependencyCreate, current_user: dict = Depends(get_current_user)):
    # Prevent self-dependency
    if dep_data.predecessor_task_id == dep_data.successor_task_id:
        raise HTTPException(status_code=400, detail="Task cannot depend on itself")

    predecessor, predecessor_project = await require_task_manager_access(dep_data.predecessor_task_id, current_user)
    successor, successor_project = await require_task_manager_access(dep_data.successor_task_id, current_user)
    if predecessor["project_id"] != successor["project_id"]:
        raise HTTPException(status_code=400, detail="Dependencies must stay within one project")
    if predecessor_project["id"] != successor_project["id"]:
        raise HTTPException(status_code=400, detail="Dependencies must stay within one project")
    
    # Check if dependency already exists
    existing = await db.task_dependencies.find_one({
        "predecessor_task_id": dep_data.predecessor_task_id,
        "successor_task_id": dep_data.successor_task_id
    })
    if existing:
        raise HTTPException(status_code=400, detail="Dependency already exists")

    if await would_create_dependency_cycle(dep_data.predecessor_task_id, dep_data.successor_task_id):
        raise HTTPException(status_code=400, detail="Dependency would create a cycle")
    
    dep_id = str(uuid.uuid4())
    dep_doc = {
        "id": dep_id,
        "predecessor_task_id": dep_data.predecessor_task_id,
        "successor_task_id": dep_data.successor_task_id,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.task_dependencies.insert_one(dep_doc)
    return Dependency(**dep_doc)

@api_router.get("/dependencies", response_model=List[Dependency])
async def get_dependencies(project_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    if project_id:
        await require_project_access(project_id, current_user)
        # Get all tasks for this project
        tasks = await db.tasks.find({"project_id": project_id}, {"_id": 0, "id": 1}).to_list(1000)
        task_ids = [t["id"] for t in tasks]
        
        deps = await db.task_dependencies.find({
            "predecessor_task_id": {"$in": task_ids},
            "successor_task_id": {"$in": task_ids}
        }, {"_id": 0}).to_list(1000)
    else:
        accessible_project_ids = await get_accessible_project_ids(current_user)
        task_query = {} if accessible_project_ids is None else {"project_id": {"$in": accessible_project_ids}}
        tasks = await db.tasks.find(task_query, {"_id": 0, "id": 1}).to_list(1000)
        task_ids = [t["id"] for t in tasks]
        deps = await db.task_dependencies.find({
            "predecessor_task_id": {"$in": task_ids},
            "successor_task_id": {"$in": task_ids}
        }, {"_id": 0}).to_list(1000)
    
    return [Dependency(**d) for d in deps]

@api_router.delete("/dependencies/{dependency_id}")
async def delete_dependency(dependency_id: str, current_user: dict = Depends(get_current_user)):
    dependency = await db.task_dependencies.find_one({"id": dependency_id}, {"_id": 0})
    if not dependency:
        raise HTTPException(status_code=404, detail="Dependency not found")
    await require_task_manager_access(dependency["predecessor_task_id"], current_user)
    await require_task_manager_access(dependency["successor_task_id"], current_user)
    await db.task_dependencies.delete_one({"id": dependency_id})
    return {"message": "Dependency deleted"}

# ==================== COMMENT ROUTES ====================

@api_router.post("/comments", response_model=Comment)
async def create_comment(comment_data: CommentCreate, current_user: dict = Depends(get_current_user)):
    await require_task_access(comment_data.task_id, current_user)
    comment_id = str(uuid.uuid4())
    comment_doc = {
        "id": comment_id,
        "task_id": comment_data.task_id,
        "author_id": current_user["id"],
        "content": comment_data.content,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.task_comments.insert_one(comment_doc)
    return Comment(**comment_doc)

@api_router.get("/comments/{task_id}", response_model=List[Comment])
async def get_comments(task_id: str, current_user: dict = Depends(get_current_user)):
    await require_task_access(task_id, current_user)
    comments = await db.task_comments.find({"task_id": task_id}, {"_id": 0}).to_list(1000)
    return [Comment(**c) for c in comments]

# ==================== ANALYTICS ROUTES ====================

@api_router.get("/analytics/project/{project_id}", response_model=ProjectAnalytics)
async def get_project_analytics(project_id: str, current_user: dict = Depends(get_current_user)):
    project = await require_project_access(project_id, current_user)
    # Get all tasks for project
    tasks = await db.tasks.find({"project_id": project_id}, {"_id": 0}).to_list(1000)
    
    total_tasks = len(tasks)
    completed_tasks = sum(1 for t in tasks if t["status"] == TaskStatus.COMPLETED.value)
    in_progress_tasks = sum(1 for t in tasks if t["status"] == TaskStatus.IN_PROGRESS.value)
    blocked_tasks = sum(1 for t in tasks if t["status"] == TaskStatus.BLOCKED.value)
    overdue_tasks = sum(1 for t in tasks if is_overdue(t.get("due_date")) and t["status"] != TaskStatus.COMPLETED.value)
    
    # Calculate risk for all tasks
    high_risk_count = 0
    for task in tasks:
        risk = await calculate_task_risk(task)
        if risk["delay_risk_level"] == RiskLevel.HIGH.value:
            high_risk_count += 1
    
    # Get team workload
    team_ids = list(dict.fromkeys([project["owner_id"], *project.get("team_member_ids", [])]))
    
    team_workload = []
    for user_id in team_ids:
        if not user_id:
            continue
        user = await db.users.find_one({"id": user_id}, {"_id": 0})
        if not user:
            continue
        
        user_tasks = [t for t in tasks if t.get("assignee_id") == user_id]
        team_workload.append(TeamMemberWorkload(
            user_id=user_id,
            user_name=user["full_name"],
            total_tasks=len(user_tasks),
            completed_tasks=sum(1 for t in user_tasks if t["status"] == TaskStatus.COMPLETED.value),
            in_progress_tasks=sum(1 for t in user_tasks if t["status"] == TaskStatus.IN_PROGRESS.value),
            overdue_tasks=sum(1 for t in user_tasks if is_overdue(t.get("due_date")) and t["status"] != TaskStatus.COMPLETED.value),
            total_estimated_hours=sum(t.get("estimated_hours", 0) for t in user_tasks),
            total_actual_hours=sum(t.get("actual_hours", 0) for t in user_tasks)
        ))
    
    return ProjectAnalytics(
        total_tasks=total_tasks,
        completed_tasks=completed_tasks,
        in_progress_tasks=in_progress_tasks,
        blocked_tasks=blocked_tasks,
        overdue_tasks=overdue_tasks,
        high_risk_tasks=high_risk_count,
        team_workload=team_workload
    )

@api_router.get("/analytics/task-risk/{task_id}", response_model=RiskAssessment)
async def get_task_risk(task_id: str, current_user: dict = Depends(get_current_user)):
    task, _project = await require_task_access(task_id, current_user)
    
    risk = await calculate_task_risk(task)
    existing = await db.risk_assessments.find_one({"task_id": task_id}, {"_id": 0, "id": 1})
    if existing:
        risk["id"] = existing["id"]
        await db.risk_assessments.update_one({"task_id": task_id}, {"$set": risk})
    else:
        await db.risk_assessments.insert_one(risk)
    return RiskAssessment(**risk)

# ==================== AI ROUTES ====================

@api_router.post("/ai/project-health/{project_id}")
async def generate_project_health(project_id: str, current_user: dict = Depends(get_current_user)):
    analytics = await get_project_analytics(project_id, current_user)
    
    context = {
        "total_tasks": analytics.total_tasks,
        "completed_tasks": analytics.completed_tasks,
        "in_progress_tasks": analytics.in_progress_tasks,
        "blocked_tasks": analytics.blocked_tasks,
        "overdue_tasks": analytics.overdue_tasks,
        "high_risk_tasks": analytics.high_risk_tasks
    }
    
    content = await generate_ai_insight(project_id, "project_health", context)
    
    insight_doc = {
        "id": str(uuid.uuid4()),
        "project_id": project_id,
        "insight_type": "project_health",
        "content": content,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.ai_insights.insert_one(insight_doc)
    return AIInsight(**insight_doc)

@api_router.post("/ai/top-risks/{project_id}")
async def generate_top_risks(project_id: str, current_user: dict = Depends(get_current_user)):
    analytics = await get_project_analytics(project_id, current_user)
    
    context = {
        "blocked_tasks": analytics.blocked_tasks,
        "overdue_tasks": analytics.overdue_tasks,
        "high_risk_tasks": analytics.high_risk_tasks
    }
    
    content = await generate_ai_insight(project_id, "top_risks", context)
    
    insight_doc = {
        "id": str(uuid.uuid4()),
        "project_id": project_id,
        "insight_type": "top_risks",
        "content": content,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.ai_insights.insert_one(insight_doc)
    return AIInsight(**insight_doc)

@api_router.post("/ai/recommendations/{project_id}")
async def generate_recommendations(project_id: str, current_user: dict = Depends(get_current_user)):
    analytics = await get_project_analytics(project_id, current_user)
    
    context = {
        "overdue_tasks": analytics.overdue_tasks,
        "blocked_tasks": analytics.blocked_tasks,
        "team_size": len(analytics.team_workload)
    }
    
    content = await generate_ai_insight(project_id, "recommendations", context)
    
    insight_doc = {
        "id": str(uuid.uuid4()),
        "project_id": project_id,
        "insight_type": "recommendations",
        "content": content,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.ai_insights.insert_one(insight_doc)
    return AIInsight(**insight_doc)

@api_router.post("/ai/stakeholder-summary/{project_id}")
async def generate_stakeholder_summary(project_id: str, current_user: dict = Depends(get_current_user)):
    analytics = await get_project_analytics(project_id, current_user)
    project = await require_project_access(project_id, current_user)
    
    context = {
        "project_title": project.get("title", "Project") if project else "Project",
        "total_tasks": analytics.total_tasks,
        "completed_tasks": analytics.completed_tasks,
        "blocked_tasks": analytics.blocked_tasks,
        "overdue_tasks": analytics.overdue_tasks
    }
    
    content = await generate_ai_insight(project_id, "stakeholder_summary", context)
    
    insight_doc = {
        "id": str(uuid.uuid4()),
        "project_id": project_id,
        "insight_type": "stakeholder_summary",
        "content": content,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.ai_insights.insert_one(insight_doc)
    return AIInsight(**insight_doc)

@api_router.get("/ai/insights/{project_id}", response_model=List[AIInsight])
async def get_ai_insights(project_id: str, current_user: dict = Depends(get_current_user)):
    await require_project_access(project_id, current_user)
    insights = await db.ai_insights.find({"project_id": project_id}, {"_id": 0}).sort("created_at", -1).limit(20).to_list(20)
    return [AIInsight(**i) for i in insights]

# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get(
        'CORS_ORIGINS',
        'http://localhost:3000,http://127.0.0.1:3000'
    ).split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("startup")
async def startup_db_indexes():
    await db.users.create_index([("id", ASCENDING)], unique=True)
    await db.users.create_index([("email", ASCENDING)], unique=True)
    await db.projects.create_index([("id", ASCENDING)], unique=True)
    await db.projects.create_index([("owner_id", ASCENDING)])
    await db.projects.create_index([("team_member_ids", ASCENDING)])
    await db.tasks.create_index([("id", ASCENDING)], unique=True)
    await db.tasks.create_index([("project_id", ASCENDING)])
    await db.tasks.create_index([("assignee_id", ASCENDING)])
    await db.task_dependencies.create_index(
        [("predecessor_task_id", ASCENDING), ("successor_task_id", ASCENDING)],
        unique=True
    )
    await db.task_comments.create_index([("task_id", ASCENDING)])
    await db.task_updates.create_index([("task_id", ASCENDING)])
    await db.risk_assessments.create_index([("task_id", ASCENDING)])
    await db.ai_insights.create_index([("project_id", ASCENDING)])


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()


