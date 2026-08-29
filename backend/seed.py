import asyncio
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os
from datetime import datetime, timezone, timedelta
import bcrypt
import uuid

# Load environment
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
db_name = os.environ.get('DB_NAME', 'ai_rpm')

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

async def seed_database():
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    print("🌱 Starting database seeding...")
    
    # Clear existing data
    await db.users.delete_many({})
    await db.projects.delete_many({})
    await db.tasks.delete_many({})
    await db.task_dependencies.delete_many({})
    await db.task_comments.delete_many({})
    await db.task_updates.delete_many({})
    await db.risk_assessments.delete_many({})
    await db.ai_insights.delete_many({})
    
    # Create users
    users = [
        {
            "id": str(uuid.uuid4()),
            "full_name": "Admin User",
            "email": "admin@demo.com",
            "password_hash": hash_password("demo-password"),
            "role": "admin",
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "full_name": "Sarah Chen",
            "email": "sarah@demo.com",
            "password_hash": hash_password("demo-password"),
            "role": "project_manager",
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "full_name": "Marcus Rodriguez",
            "email": "marcus@demo.com",
            "password_hash": hash_password("demo-password"),
            "role": "team_member",
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "full_name": "Aisha Patel",
            "email": "aisha@demo.com",
            "password_hash": hash_password("demo-password"),
            "role": "team_member",
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "full_name": "David Kim",
            "email": "david@demo.com",
            "password_hash": hash_password("demo-password"),
            "role": "team_member",
            "created_at": datetime.now(timezone.utc).isoformat()
        },
    ]
    
    await db.users.insert_many(users)
    print(f"✓ Created {len(users)} users")
    
    # Create projects
    now = datetime.now(timezone.utc)
    
    projects = [
        {
            "id": str(uuid.uuid4()),
            "title": "AI-Powered Customer Platform Rebuild",
            "description": "Complete redesign and migration of legacy customer portal to modern microservices architecture with AI-driven personalization",
            "status": "active",
            "owner_id": users[1]["id"],  # Sarah
            "team_member_ids": [users[2]["id"], users[3]["id"], users[4]["id"]],
            "start_date": (now - timedelta(days=30)).isoformat(),
            "target_end_date": (now + timedelta(days=60)).isoformat(),
            "created_at": (now - timedelta(days=30)).isoformat(),
            "updated_at": now.isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "title": "Mobile App MVP Launch",
            "description": "Development and launch of iOS and Android mobile applications with core features for Q1 release",
            "status": "planning",
            "owner_id": users[1]["id"],
            "team_member_ids": [users[2]["id"], users[4]["id"]],
            "start_date": now.isoformat(),
            "target_end_date": (now + timedelta(days=90)).isoformat(),
            "created_at": now.isoformat(),
            "updated_at": now.isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "title": "Data Analytics Dashboard",
            "description": "Real-time analytics dashboard for executive team with predictive insights and KPI tracking",
            "status": "active",
            "owner_id": users[0]["id"],  # Admin
            "team_member_ids": [users[3]["id"]],
            "start_date": (now - timedelta(days=14)).isoformat(),
            "target_end_date": (now + timedelta(days=45)).isoformat(),
            "created_at": (now - timedelta(days=14)).isoformat(),
            "updated_at": now.isoformat()
        },
    ]
    
    await db.projects.insert_many(projects)
    print(f"✓ Created {len(projects)} projects")
    
    # Create tasks for first project (AI Platform)
    project1_tasks = [
        {
            "id": str(uuid.uuid4()),
            "project_id": projects[0]["id"],
            "title": "Architecture Design & Tech Stack Selection",
            "description": "Define microservices architecture, select technology stack (Node.js/Python), design API contracts, and establish deployment pipeline",
            "assignee_id": users[2]["id"],  # Marcus
            "status": "completed",
            "priority": "critical",
            "due_date": (now - timedelta(days=20)).isoformat(),
            "estimated_hours": 40,
            "actual_hours": 42,
            "blockers": "",
            "tags": ["architecture", "planning"],
            "created_at": (now - timedelta(days=28)).isoformat(),
            "updated_at": (now - timedelta(days=20)).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "project_id": projects[0]["id"],
            "title": "Database Schema Migration",
            "description": "Migrate from monolithic MySQL to distributed PostgreSQL with proper indexing and partitioning strategy",
            "assignee_id": users[3]["id"],  # Aisha
            "status": "in_progress",
            "priority": "high",
            "due_date": (now + timedelta(days=5)).isoformat(),
            "estimated_hours": 60,
            "actual_hours": 45,
            "blockers": "",
            "tags": ["database", "migration"],
            "created_at": (now - timedelta(days=15)).isoformat(),
            "updated_at": now.isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "project_id": projects[0]["id"],
            "title": "User Authentication Service",
            "description": "Implement OAuth 2.0 + JWT authentication microservice with SSO integration and MFA support",
            "assignee_id": users[2]["id"],
            "status": "completed",
            "priority": "critical",
            "due_date": (now - timedelta(days=5)).isoformat(),
            "estimated_hours": 50,
            "actual_hours": 55,
            "blockers": "",
            "tags": ["authentication", "security"],
            "created_at": (now - timedelta(days=18)).isoformat(),
            "updated_at": (now - timedelta(days=5)).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "project_id": projects[0]["id"],
            "title": "AI Recommendation Engine Integration",
            "description": "Integrate machine learning model for personalized product recommendations using collaborative filtering",
            "assignee_id": users[4]["id"],  # David
            "status": "blocked",
            "priority": "high",
            "due_date": (now + timedelta(days=10)).isoformat(),
            "estimated_hours": 70,
            "actual_hours": 25,
            "blockers": "Waiting for ML model training data from analytics team. Current dataset insufficient for accurate predictions.",
            "tags": ["ai", "ml", "recommendations"],
            "created_at": (now - timedelta(days=12)).isoformat(),
            "updated_at": now.isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "project_id": projects[0]["id"],
            "title": "Payment Gateway Migration",
            "description": "Migrate from legacy Stripe integration to modern Payment Intents API with support for multiple payment methods",
            "assignee_id": users[3]["id"],
            "status": "in_progress",
            "priority": "critical",
            "due_date": (now + timedelta(days=8)).isoformat(),
            "estimated_hours": 45,
            "actual_hours": 20,
            "blockers": "",
            "tags": ["payments", "integration"],
            "created_at": (now - timedelta(days=10)).isoformat(),
            "updated_at": now.isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "project_id": projects[0]["id"],
            "title": "Frontend React Components Library",
            "description": "Build reusable component library with Storybook documentation and accessibility compliance",
            "assignee_id": users[4]["id"],
            "status": "in_progress",
            "priority": "medium",
            "due_date": (now + timedelta(days=15)).isoformat(),
            "estimated_hours": 55,
            "actual_hours": 30,
            "blockers": "",
            "tags": ["frontend", "react", "components"],
            "created_at": (now - timedelta(days=8)).isoformat(),
            "updated_at": now.isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "project_id": projects[0]["id"],
            "title": "API Rate Limiting & Caching",
            "description": "Implement Redis-based rate limiting and caching layer for high-traffic endpoints",
            "assignee_id": users[2]["id"],
            "status": "todo",
            "priority": "medium",
            "due_date": (now + timedelta(days=20)).isoformat(),
            "estimated_hours": 30,
            "actual_hours": 0,
            "blockers": "",
            "tags": ["performance", "caching"],
            "created_at": (now - timedelta(days=5)).isoformat(),
            "updated_at": now.isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "project_id": projects[0]["id"],
            "title": "Automated Testing Suite",
            "description": "Set up E2E testing with Playwright and unit tests with 80% coverage target",
            "assignee_id": None,
            "status": "todo",
            "priority": "high",
            "due_date": (now + timedelta(days=25)).isoformat(),
            "estimated_hours": 40,
            "actual_hours": 0,
            "blockers": "",
            "tags": ["testing", "qa"],
            "created_at": (now - timedelta(days=3)).isoformat(),
            "updated_at": now.isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "project_id": projects[0]["id"],
            "title": "Performance Monitoring Setup",
            "description": "Configure DataDog/New Relic for APM, error tracking, and performance monitoring across all services",
            "assignee_id": users[3]["id"],
            "status": "todo",
            "priority": "medium",
            "due_date": (now + timedelta(days=30)).isoformat(),
            "estimated_hours": 25,
            "actual_hours": 0,
            "blockers": "",
            "tags": ["monitoring", "devops"],
            "created_at": (now - timedelta(days=2)).isoformat(),
            "updated_at": now.isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "project_id": projects[0]["id"],
            "title": "User Onboarding Flow Redesign",
            "description": "Complete UX overhaul of onboarding process with progressive disclosure and gamification elements",
            "assignee_id": users[4]["id"],
            "status": "in_progress",
            "priority": "high",
            "due_date": (now - timedelta(days=2)).isoformat(),  # Overdue!
            "estimated_hours": 35,
            "actual_hours": 38,
            "blockers": "",
            "tags": ["ux", "onboarding"],
            "created_at": (now - timedelta(days=14)).isoformat(),
            "updated_at": now.isoformat()
        },
    ]
    
    # Tasks for second project
    project2_tasks = [
        {
            "id": str(uuid.uuid4()),
            "project_id": projects[1]["id"],
            "title": "Mobile App Wireframes & Design System",
            "description": "Create complete design system and wireframes for iOS and Android apps",
            "assignee_id": users[4]["id"],
            "status": "in_progress",
            "priority": "critical",
            "due_date": (now + timedelta(days=10)).isoformat(),
            "estimated_hours": 40,
            "actual_hours": 15,
            "blockers": "",
            "tags": ["design", "mobile"],
            "created_at": now.isoformat(),
            "updated_at": now.isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "project_id": projects[1]["id"],
            "title": "React Native Project Setup",
            "description": "Initialize React Native project with navigation, state management, and core architecture",
            "assignee_id": users[2]["id"],
            "status": "todo",
            "priority": "high",
            "due_date": (now + timedelta(days=15)).isoformat(),
            "estimated_hours": 30,
            "actual_hours": 0,
            "blockers": "",
            "tags": ["mobile", "setup"],
            "created_at": now.isoformat(),
            "updated_at": now.isoformat()
        },
    ]
    
    # Tasks for third project
    project3_tasks = [
        {
            "id": str(uuid.uuid4()),
            "project_id": projects[2]["id"],
            "title": "Data Pipeline Architecture",
            "description": "Design ETL pipeline for real-time data ingestion from multiple sources",
            "assignee_id": users[3]["id"],
            "status": "completed",
            "priority": "critical",
            "due_date": (now - timedelta(days=7)).isoformat(),
            "estimated_hours": 45,
            "actual_hours": 48,
            "blockers": "",
            "tags": ["data", "architecture"],
            "created_at": (now - timedelta(days=14)).isoformat(),
            "updated_at": (now - timedelta(days=7)).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "project_id": projects[2]["id"],
            "title": "Dashboard UI Development",
            "description": "Build interactive dashboard with Recharts and real-time WebSocket updates",
            "assignee_id": users[3]["id"],
            "status": "in_progress",
            "priority": "high",
            "due_date": (now + timedelta(days=12)).isoformat(),
            "estimated_hours": 50,
            "actual_hours": 25,
            "blockers": "",
            "tags": ["frontend", "dashboard"],
            "created_at": (now - timedelta(days=7)).isoformat(),
            "updated_at": now.isoformat()
        },
    ]
    
    all_tasks = project1_tasks + project2_tasks + project3_tasks
    await db.tasks.insert_many(all_tasks)
    print(f"✓ Created {len(all_tasks)} tasks")
    
    # Create some task dependencies for project 1
    dependencies = [
        {
            "id": str(uuid.uuid4()),
            "predecessor_task_id": project1_tasks[0]["id"],  # Architecture design
            "successor_task_id": project1_tasks[1]["id"],     # Database migration
            "created_at": now.isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "predecessor_task_id": project1_tasks[0]["id"],  # Architecture design
            "successor_task_id": project1_tasks[2]["id"],     # Auth service
            "created_at": now.isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "predecessor_task_id": project1_tasks[1]["id"],  # Database migration
            "successor_task_id": project1_tasks[3]["id"],     # AI recommendation
            "created_at": now.isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "predecessor_task_id": project1_tasks[2]["id"],  # Auth service
            "successor_task_id": project1_tasks[4]["id"],     # Payment gateway
            "created_at": now.isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "predecessor_task_id": project1_tasks[5]["id"],  # Component library
            "successor_task_id": project1_tasks[9]["id"],     # Onboarding flow
            "created_at": now.isoformat()
        },
    ]
    
    await db.task_dependencies.insert_many(dependencies)
    print(f"✓ Created {len(dependencies)} task dependencies")
    
    client.close()
    print("✨ Database seeding complete!")
    print("\n📝 Demo Credentials:")
    print("   Email: admin@demo.com")
    print("   Password: demo-password\n")

if __name__ == "__main__":
    asyncio.run(seed_database())

