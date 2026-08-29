#!/usr/bin/env python3
"""
Comprehensive Backend API Testing for Autonomous AI Project Manager
Tests all endpoints including auth, projects, tasks, AI insights, analytics, and dependencies
"""

import requests
import sys
import json
import os
from datetime import datetime, timedelta

class ProjectManagerAPITester:
    def __init__(self, base_url=None):
        self.base_url = base_url or os.environ.get("API_BASE_URL", "http://localhost:8000")
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.user_id = None
        self.project_id = None
        self.task_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'
        
        if headers:
            test_headers.update(headers)

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=30)
            elif method == 'PATCH':
                response = requests.patch(url, json=data, headers=test_headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers, timeout=30)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return True, response.json() if response.content else {}
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_detail = response.json()
                    print(f"   Error: {error_detail}")
                except:
                    print(f"   Response: {response.text[:200]}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_auth_signup(self):
        """Test user signup"""
        test_user_data = {
            "full_name": f"Test User {datetime.now().strftime('%H%M%S')}",
            "email": f"test_{datetime.now().strftime('%H%M%S')}@test.com",
            "password": "TestPass123!"
        }
        
        success, response = self.run_test(
            "User Signup",
            "POST",
            "auth/signup",
            200,
            data=test_user_data
        )
        
        if success and 'token' in response:
            self.token = response['token']
            self.user_id = response['user']['id']
            print(f"   Token obtained: {self.token[:20]}...")
            return True
        return False

    def test_auth_signup_rejects_role_escalation(self):
        """Test that public signup cannot select privileged roles"""
        test_user_data = {
            "full_name": f"Escalation User {datetime.now().strftime('%H%M%S')}",
            "email": f"escalation_{datetime.now().strftime('%H%M%S')}@test.com",
            "password": "TestPass123!",
            "role": "admin"
        }

        success, _response = self.run_test(
            "Reject Signup Role Escalation",
            "POST",
            "auth/signup",
            422,
            data=test_user_data
        )
        return success

    def test_auth_login(self):
        """Test login with admin credentials"""
        login_data = {
            "email": "admin@demo.com",
            "password": "demo-password"
        }
        
        success, response = self.run_test(
            "Admin Login",
            "POST",
            "auth/login",
            200,
            data=login_data
        )
        
        if success and 'token' in response:
            self.token = response['token']
            self.user_id = response['user']['id']
            print(f"   Admin token obtained: {self.token[:20]}...")
            return True
        return False

    def test_auth_me(self):
        """Test get current user"""
        success, response = self.run_test(
            "Get Current User",
            "GET",
            "auth/me",
            200
        )
        return success

    def test_auth_logout(self):
        """Test logout clears auth cookie"""
        success, response = self.run_test(
            "Logout",
            "POST",
            "auth/logout",
            200
        )
        return success

    def test_users_list(self):
        """Test get all users"""
        success, response = self.run_test(
            "Get All Users",
            "GET",
            "users",
            200
        )
        if success:
            print(f"   Found {len(response)} users")
        return success

    def test_project_create(self):
        """Test project creation"""
        project_data = {
            "title": f"Test Project {datetime.now().strftime('%H%M%S')}",
            "description": "Test project for API testing",
            "start_date": datetime.now().isoformat(),
            "target_end_date": (datetime.now() + timedelta(days=30)).isoformat(),
            "team_member_ids": []
        }
        
        success, response = self.run_test(
            "Create Project",
            "POST",
            "projects",
            200,
            data=project_data
        )
        
        if success and 'id' in response:
            self.project_id = response['id']
            print(f"   Project created with ID: {self.project_id}")
            return True
        return False

    def test_projects_list(self):
        """Test get all projects"""
        success, response = self.run_test(
            "Get All Projects",
            "GET",
            "projects",
            200
        )
        if success:
            print(f"   Found {len(response)} projects")
        return success

    def test_project_get(self):
        """Test get specific project"""
        if not self.project_id:
            print("❌ No project ID available for testing")
            return False
            
        success, response = self.run_test(
            "Get Project by ID",
            "GET",
            f"projects/{self.project_id}",
            200
        )
        return success

    def test_task_create(self):
        """Test task creation"""
        if not self.project_id:
            print("❌ No project ID available for task creation")
            return False
            
        task_data = {
            "project_id": self.project_id,
            "title": f"Test Task {datetime.now().strftime('%H%M%S')}",
            "description": "Test task for API testing",
            "priority": "high",
            "due_date": (datetime.now() + timedelta(days=7)).isoformat(),
            "estimated_hours": 8.0
        }
        
        success, response = self.run_test(
            "Create Task",
            "POST",
            "tasks",
            200,
            data=task_data
        )
        
        if success and 'id' in response:
            self.task_id = response['id']
            print(f"   Task created with ID: {self.task_id}")
            return True
        return False

    def test_tasks_list(self):
        """Test get all tasks"""
        success, response = self.run_test(
            "Get All Tasks",
            "GET",
            "tasks",
            200
        )
        if success:
            print(f"   Found {len(response)} tasks")
        return success

    def test_task_update(self):
        """Test task status update"""
        if not self.task_id:
            print("❌ No task ID available for testing")
            return False
            
        update_data = {
            "status": "in_progress",
            "actual_hours": 2.5
        }
        
        success, response = self.run_test(
            "Update Task Status",
            "PATCH",
            f"tasks/{self.task_id}",
            200,
            data=update_data
        )
        return success

    def test_analytics_project(self):
        """Test project analytics"""
        if not self.project_id:
            print("❌ No project ID available for analytics testing")
            return False
            
        success, response = self.run_test(
            "Get Project Analytics",
            "GET",
            f"analytics/project/{self.project_id}",
            200
        )
        
        if success:
            print(f"   Analytics: {response.get('total_tasks', 0)} total tasks, {response.get('completed_tasks', 0)} completed")
        return success

    def test_ai_project_health(self):
        """Test AI project health generation"""
        if not self.project_id:
            print("❌ No project ID available for AI testing")
            return False
            
        success, response = self.run_test(
            "Generate AI Project Health",
            "POST",
            f"ai/project-health/{self.project_id}",
            200
        )
        
        if success:
            print(f"   AI Insight generated: {response.get('content', '')[:100]}...")
        return success

    def test_ai_top_risks(self):
        """Test AI top risks generation"""
        if not self.project_id:
            print("❌ No project ID available for AI testing")
            return False
            
        success, response = self.run_test(
            "Generate AI Top Risks",
            "POST",
            f"ai/top-risks/{self.project_id}",
            200
        )
        
        if success:
            print(f"   AI Risks generated: {response.get('content', '')[:100]}...")
        return success

    def test_ai_recommendations(self):
        """Test AI recommendations generation"""
        if not self.project_id:
            print("❌ No project ID available for AI testing")
            return False
            
        success, response = self.run_test(
            "Generate AI Recommendations",
            "POST",
            f"ai/recommendations/{self.project_id}",
            200
        )
        
        if success:
            print(f"   AI Recommendations generated: {response.get('content', '')[:100]}...")
        return success

    def test_ai_insights_list(self):
        """Test get AI insights"""
        if not self.project_id:
            print("❌ No project ID available for AI insights testing")
            return False
            
        success, response = self.run_test(
            "Get AI Insights",
            "GET",
            f"ai/insights/{self.project_id}",
            200
        )
        
        if success:
            print(f"   Found {len(response)} AI insights")
        return success

    def test_dependencies_list(self):
        """Test get dependencies"""
        success, response = self.run_test(
            "Get Dependencies",
            "GET",
            "dependencies",
            200
        )
        if success:
            print(f"   Found {len(response)} dependencies")
        return success

def main():
    print("🚀 Starting Autonomous AI Project Manager API Tests")
    print("=" * 60)
    
    tester = ProjectManagerAPITester()
    
    # Test sequence
    test_sequence = [
        ("Reject Signup Role Escalation", tester.test_auth_signup_rejects_role_escalation),
        # Authentication tests
        ("Admin Login", tester.test_auth_login),
        ("Get Current User", tester.test_auth_me),
        ("Get All Users", tester.test_users_list),
        
        # Project tests
        ("Create Project", tester.test_project_create),
        ("Get All Projects", tester.test_projects_list),
        ("Get Project by ID", tester.test_project_get),
        
        # Task tests
        ("Create Task", tester.test_task_create),
        ("Get All Tasks", tester.test_tasks_list),
        ("Update Task", tester.test_task_update),
        
        # Analytics tests
        ("Project Analytics", tester.test_analytics_project),
        
        # AI tests (with delay for processing)
        ("AI Project Health", tester.test_ai_project_health),
        ("AI Top Risks", tester.test_ai_top_risks),
        ("AI Recommendations", tester.test_ai_recommendations),
        ("Get AI Insights", tester.test_ai_insights_list),
        
        # Dependencies tests
        ("Get Dependencies", tester.test_dependencies_list),

        # Session cleanup
        ("Logout", tester.test_auth_logout),
    ]
    
    failed_tests = []
    
    for test_name, test_func in test_sequence:
        try:
            if not test_func():
                failed_tests.append(test_name)
        except Exception as e:
            print(f"❌ {test_name} - Exception: {str(e)}")
            failed_tests.append(test_name)
    
    # Print results
    print("\n" + "=" * 60)
    print(f"📊 Test Results: {tester.tests_passed}/{tester.tests_run} tests passed")
    
    if failed_tests:
        print(f"\n❌ Failed tests ({len(failed_tests)}):")
        for test in failed_tests:
            print(f"   - {test}")
    else:
        print("\n✅ All tests passed!")
    
    success_rate = (tester.tests_passed / tester.tests_run * 100) if tester.tests_run > 0 else 0
    print(f"\n📈 Success rate: {success_rate:.1f}%")
    
    return 0 if len(failed_tests) == 0 else 1

if __name__ == "__main__":
    sys.exit(main())

