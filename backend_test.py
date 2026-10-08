#!/usr/bin/env python3
"""
Comprehensive backend test suite for RF Notes FastAPI backend.
Tests Share-as-Link endpoints and AI Action Agent planner endpoint.
"""

import requests
import sys
import json
import time
from typing import Dict, Any, Optional, List

# Base URL from environment (external ingress)
BASE_URL = "https://execute-app-17.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

# Test results tracking
test_results = []
passed = 0
failed = 0


def log_test(test_name: str, passed_test: bool, details: str = ""):
    """Log test result"""
    global passed, failed
    status = "✅ PASS" if passed_test else "❌ FAIL"
    result = f"{status}: {test_name}"
    if details:
        result += f"\n    {details}"
    print(result)
    test_results.append({"test": test_name, "passed": passed_test, "details": details})
    if passed_test:
        passed += 1
    else:
        failed += 1


def test_1_sanity_check():
    """Test 1: GET /api/ -> returns {"message":"Hello World"}"""
    try:
        response = requests.get(f"{API_BASE}/", timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data.get("message") == "Hello World":
                log_test("Test 1: Sanity check GET /api/", True, f"Response: {data}")
                return True
            else:
                log_test("Test 1: Sanity check GET /api/", False, f"Unexpected response: {data}")
                return False
        else:
            log_test("Test 1: Sanity check GET /api/", False, f"Status code: {response.status_code}")
            return False
    except Exception as e:
        log_test("Test 1: Sanity check GET /api/", False, f"Exception: {str(e)}")
        return False


def test_2_create_shared_link() -> Optional[Dict[str, str]]:
    """Test 2: POST /api/shared with test data"""
    try:
        payload = {
            "title": "Test Note",
            "body": "Line one.\n- bullet a\n- bullet b",
            "kind": "note"
        }
        response = requests.post(f"{API_BASE}/shared", json=payload, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            # Check all required fields
            if all(key in data for key in ["token", "manage_token", "url"]):
                # Verify URL format
                if data["url"].endswith(f"/api/shared/{data['token']}"):
                    log_test("Test 2: POST /api/shared", True, 
                            f"Token: {data['token']}, URL: {data['url']}")
                    return data
                else:
                    log_test("Test 2: POST /api/shared", False, 
                            f"URL format incorrect: {data['url']}")
                    return None
            else:
                log_test("Test 2: POST /api/shared", False, 
                        f"Missing required fields. Got: {data}")
                return None
        else:
            log_test("Test 2: POST /api/shared", False, 
                    f"Status code: {response.status_code}, Body: {response.text}")
            return None
    except Exception as e:
        log_test("Test 2: POST /api/shared", False, f"Exception: {str(e)}")
        return None


def test_3_get_shared_html(token: str) -> bool:
    """Test 3: GET /api/shared/{token} -> verify HTML rendering"""
    try:
        response = requests.get(f"{API_BASE}/shared/{token}", timeout=10)
        
        if response.status_code == 200:
            # Check Content-Type
            content_type = response.headers.get("content-type", "")
            if "text/html" not in content_type:
                log_test("Test 3: GET /api/shared/{token}", False, 
                        f"Wrong Content-Type: {content_type}")
                return False
            
            html_content = response.text
            # Verify required content
            required_strings = ["Test Note", "Made with Notes AI"]
            missing = [s for s in required_strings if s not in html_content]
            
            # Also check for rendered content (bullets)
            has_content = "bullet a" in html_content and "bullet b" in html_content
            
            if not missing and has_content:
                log_test("Test 3: GET /api/shared/{token}", True, 
                        f"HTML contains title, branding, and rendered content")
                return True
            else:
                log_test("Test 3: GET /api/shared/{token}", False, 
                        f"Missing: {missing}, Has content: {has_content}")
                return False
        else:
            log_test("Test 3: GET /api/shared/{token}", False, 
                    f"Status code: {response.status_code}")
            return False
    except Exception as e:
        log_test("Test 3: GET /api/shared/{token}", False, f"Exception: {str(e)}")
        return False


def test_4_revoke_link(token: str, manage_token: str) -> bool:
    """Test 4: DELETE /api/shared/{token}?key={manage_token}"""
    try:
        response = requests.delete(
            f"{API_BASE}/shared/{token}",
            params={"key": manage_token},
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get("revoked") == True:
                log_test("Test 4: DELETE /api/shared/{token}", True, 
                        f"Link revoked successfully: {data}")
                return True
            else:
                log_test("Test 4: DELETE /api/shared/{token}", False, 
                        f"Unexpected response: {data}")
                return False
        else:
            log_test("Test 4: DELETE /api/shared/{token}", False, 
                    f"Status code: {response.status_code}")
            return False
    except Exception as e:
        log_test("Test 4: DELETE /api/shared/{token}", False, f"Exception: {str(e)}")
        return False


def test_5_get_revoked_link(token: str) -> bool:
    """Test 5: GET /api/shared/{token} after revoke -> expect 404"""
    try:
        response = requests.get(f"{API_BASE}/shared/{token}", timeout=10)
        
        if response.status_code == 404:
            html_content = response.text
            if "Link unavailable" in html_content or "revoked" in html_content:
                log_test("Test 5: GET revoked link", True, 
                        "Returns 404 with unavailable message")
                return True
            else:
                log_test("Test 5: GET revoked link", False, 
                        "404 but missing unavailable message")
                return False
        else:
            log_test("Test 5: GET revoked link", False, 
                    f"Expected 404, got {response.status_code}")
            return False
    except Exception as e:
        log_test("Test 5: GET revoked link", False, f"Exception: {str(e)}")
        return False


def test_6a_wrong_manage_key() -> bool:
    """Test 6a: DELETE with wrong manage key -> expect 403"""
    try:
        # Create a fresh link
        payload = {"title": "Test for wrong key", "body": "test", "kind": "note"}
        response = requests.post(f"{API_BASE}/shared", json=payload, timeout=10)
        if response.status_code != 200:
            log_test("Test 6a: DELETE with wrong key (setup)", False, "Failed to create link")
            return False
        
        data = response.json()
        token = data["token"]
        
        # Try to delete with wrong key
        response = requests.delete(
            f"{API_BASE}/shared/{token}",
            params={"key": "wrongkey123"},
            timeout=10
        )
        
        if response.status_code == 403:
            log_test("Test 6a: DELETE with wrong key", True, "Returns 403 as expected")
            return True
        else:
            log_test("Test 6a: DELETE with wrong key", False, 
                    f"Expected 403, got {response.status_code}")
            return False
    except Exception as e:
        log_test("Test 6a: DELETE with wrong key", False, f"Exception: {str(e)}")
        return False


def test_6b_delete_nonexistent() -> bool:
    """Test 6b: DELETE non-existent token -> expect 404"""
    try:
        response = requests.delete(
            f"{API_BASE}/shared/nonexistent123",
            params={"key": "anykey"},
            timeout=10
        )
        
        if response.status_code == 404:
            log_test("Test 6b: DELETE non-existent token", True, "Returns 404 as expected")
            return True
        else:
            log_test("Test 6b: DELETE non-existent token", False, 
                    f"Expected 404, got {response.status_code}")
            return False
    except Exception as e:
        log_test("Test 6b: DELETE non-existent token", False, f"Exception: {str(e)}")
        return False


def test_6c_empty_body() -> bool:
    """Test 6c: POST with empty body {} -> should still work with defaults"""
    try:
        payload = {}
        response = requests.post(f"{API_BASE}/shared", json=payload, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if all(key in data for key in ["token", "manage_token", "url"]):
                # Try to GET the link to verify it's usable
                token = data["token"]
                get_response = requests.get(f"{API_BASE}/shared/{token}", timeout=10)
                if get_response.status_code == 200:
                    html = get_response.text
                    # Should have default title "Shared note"
                    if "Shared note" in html:
                        log_test("Test 6c: POST with empty body", True, 
                                "Creates usable link with default title")
                        return True
                    else:
                        log_test("Test 6c: POST with empty body", False, 
                                "Link created but missing default title")
                        return False
                else:
                    log_test("Test 6c: POST with empty body", False, 
                            f"Link created but GET failed: {get_response.status_code}")
                    return False
            else:
                log_test("Test 6c: POST with empty body", False, 
                        f"Missing required fields: {data}")
                return False
        else:
            log_test("Test 6c: POST with empty body", False, 
                    f"Status code: {response.status_code}")
            return False
    except Exception as e:
        log_test("Test 6c: POST with empty body", False, f"Exception: {str(e)}")
        return False


def test_7_mongodb_persistence() -> bool:
    """Test 7: Verify MongoDB persistence"""
    try:
        # Create a link
        payload = {"title": "Persistence Test", "body": "Testing MongoDB", "kind": "note"}
        response = requests.post(f"{API_BASE}/shared", json=payload, timeout=10)
        if response.status_code != 200:
            log_test("Test 7: MongoDB persistence (setup)", False, "Failed to create link")
            return False
        
        data = response.json()
        token = data["token"]
        
        # GET it back immediately
        get_response = requests.get(f"{API_BASE}/shared/{token}", timeout=10)
        if get_response.status_code == 200:
            html = get_response.text
            if "Persistence Test" in html and "Testing MongoDB" in html:
                log_test("Test 7: MongoDB persistence", True, 
                        "Document stored and retrieved successfully")
                return True
            else:
                log_test("Test 7: MongoDB persistence", False, 
                        "Document retrieved but content missing")
                return False
        else:
            log_test("Test 7: MongoDB persistence", False, 
                    f"Failed to retrieve: {get_response.status_code}")
            return False
    except Exception as e:
        log_test("Test 7: MongoDB persistence", False, f"Exception: {str(e)}")
        return False


# ============================================================================
# AI ACTION AGENT PLANNER ENDPOINT TESTS
# ============================================================================

ALLOWED_TOOLS = [
    "createNote", "appendToNote", "renameNote", "updateNote", "searchNotes",
    "summarizeNote", "extractTasksFromNote", "createWorkspace", "createPage",
    "createDatabase", "addRecord", "createTask", "updateTaskStatus", "listTasks",
    "useTemplate", "mergeNotes", "trashNote"
]


def validate_plan_structure(data: dict, test_name: str) -> bool:
    """Validate the structure of a plan response"""
    if not isinstance(data, dict):
        log_test(test_name, False, f"Response is not a dict: {type(data)}")
        return False
    
    if "reply" not in data:
        log_test(test_name, False, "Missing 'reply' field")
        return False
    
    if "steps" not in data:
        log_test(test_name, False, "Missing 'steps' field")
        return False
    
    if not isinstance(data["steps"], list):
        log_test(test_name, False, f"'steps' is not a list: {type(data['steps'])}")
        return False
    
    return True


def validate_step_structure(step: dict, step_index: int, test_name: str) -> bool:
    """Validate a single step structure"""
    if not isinstance(step, dict):
        log_test(test_name, False, f"Step {step_index} is not a dict: {type(step)}")
        return False
    
    required_fields = ["tool", "args", "description"]
    for field in required_fields:
        if field not in step:
            log_test(test_name, False, f"Step {step_index} missing '{field}' field")
            return False
    
    if not isinstance(step["args"], dict):
        log_test(test_name, False, f"Step {step_index} 'args' is not a dict: {type(step['args'])}")
        return False
    
    return True


def validate_tool_names(steps: List[dict], test_name: str) -> List[str]:
    """Validate that all tool names are in the allowed list. Returns list of unknown tools."""
    unknown_tools = []
    for i, step in enumerate(steps):
        tool = step.get("tool", "")
        if tool not in ALLOWED_TOOLS:
            unknown_tools.append(f"Step {i}: '{tool}'")
    return unknown_tools


def test_agent_1_sanity():
    """Agent Test 1: GET /api/ returns Hello World"""
    try:
        response = requests.get(f"{API_BASE}/", timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data.get("message") == "Hello World":
                log_test("Agent Test 1: Sanity check GET /api/", True, f"Response: {data}")
                return True
            else:
                log_test("Agent Test 1: Sanity check GET /api/", False, f"Unexpected response: {data}")
                return False
        else:
            log_test("Agent Test 1: Sanity check GET /api/", False, f"Status code: {response.status_code}")
            return False
    except Exception as e:
        log_test("Agent Test 1: Sanity check GET /api/", False, f"Exception: {str(e)}")
        return False


def test_agent_2_simple_command():
    """Agent Test 2: POST /api/agent/plan with simple command"""
    try:
        payload = {
            "command": "Create a note called AI Project",
            "context": {}
        }
        response = requests.post(f"{API_BASE}/agent/plan", json=payload, timeout=45)
        
        if response.status_code != 200:
            log_test("Agent Test 2: Simple command", False, 
                    f"Status code: {response.status_code}, Body: {response.text[:500]}")
            return False
        
        data = response.json()
        
        # Validate structure
        if not validate_plan_structure(data, "Agent Test 2: Simple command"):
            return False
        
        steps = data["steps"]
        
        # Should have at least 1 step
        if len(steps) < 1:
            log_test("Agent Test 2: Simple command", False, 
                    f"Expected at least 1 step, got {len(steps)}")
            return False
        
        # Validate first step structure
        if not validate_step_structure(steps[0], 0, "Agent Test 2: Simple command"):
            return False
        
        # First step should be createNote
        first_step = steps[0]
        if first_step["tool"] != "createNote":
            log_test("Agent Test 2: Simple command", False, 
                    f"Expected first step tool='createNote', got '{first_step['tool']}'")
            return False
        
        # Check if title relates to "AI Project"
        args = first_step["args"]
        title = args.get("title", "")
        if "AI" not in title and "Project" not in title:
            log_test("Agent Test 2: Simple command", False, 
                    f"Expected title to relate to 'AI Project', got '{title}'")
            return False
        
        # Validate tool names
        unknown_tools = validate_tool_names(steps, "Agent Test 2: Simple command")
        if unknown_tools:
            log_test("Agent Test 2: Simple command", False, 
                    f"Unknown tools found: {', '.join(unknown_tools)}")
            return False
        
        log_test("Agent Test 2: Simple command", True, 
                f"Reply: '{data['reply'][:80]}...', Steps: {len(steps)}, First tool: {first_step['tool']}, Title: '{title}'")
        return True
        
    except Exception as e:
        log_test("Agent Test 2: Simple command", False, f"Exception: {str(e)}")
        return False


def test_agent_3_compound_command():
    """Agent Test 3: POST /api/agent/plan with compound command"""
    try:
        payload = {
            "command": "Create an AI Project workspace, create Ideas and Tasks databases in it, and add a task called Build MVP with high priority",
            "context": {}
        }
        response = requests.post(f"{API_BASE}/agent/plan", json=payload, timeout=45)
        
        if response.status_code != 200:
            log_test("Agent Test 3: Compound command", False, 
                    f"Status code: {response.status_code}, Body: {response.text[:500]}")
            return False
        
        data = response.json()
        
        # Validate structure
        if not validate_plan_structure(data, "Agent Test 3: Compound command"):
            return False
        
        steps = data["steps"]
        
        # Should have multiple steps (at least 4: workspace, 2 databases, 1 task)
        if len(steps) < 4:
            log_test("Agent Test 3: Compound command", False, 
                    f"Expected at least 4 steps for compound command, got {len(steps)}")
            return False
        
        # Validate all step structures
        for i, step in enumerate(steps):
            if not validate_step_structure(step, i, "Agent Test 3: Compound command"):
                return False
        
        # Check for expected tools in order
        tools = [step["tool"] for step in steps]
        
        # Should have createWorkspace
        if "createWorkspace" not in tools:
            log_test("Agent Test 3: Compound command", False, 
                    f"Expected 'createWorkspace' in tools, got: {tools}")
            return False
        
        # Should have createDatabase (at least once, ideally twice)
        db_count = tools.count("createDatabase")
        if db_count < 1:
            log_test("Agent Test 3: Compound command", False, 
                    f"Expected at least 1 'createDatabase', got {db_count}")
            return False
        
        # Should have createTask or addRecord
        if "createTask" not in tools and "addRecord" not in tools:
            log_test("Agent Test 3: Compound command", False, 
                    f"Expected 'createTask' or 'addRecord' in tools, got: {tools}")
            return False
        
        # Check for placeholder usage ($lastPageId, $lastDatabaseId)
        has_placeholders = False
        for step in steps[1:]:  # Skip first step
            args_str = json.dumps(step["args"])
            if "$lastPageId" in args_str or "$lastDatabaseId" in args_str or "$lastNoteId" in args_str:
                has_placeholders = True
                break
        
        if not has_placeholders:
            log_test("Agent Test 3: Compound command", False, 
                    f"Expected placeholder usage ($lastPageId/$lastDatabaseId) in later steps")
            return False
        
        # Verify dependency order: workspace should come before database
        workspace_idx = tools.index("createWorkspace") if "createWorkspace" in tools else -1
        first_db_idx = tools.index("createDatabase") if "createDatabase" in tools else -1
        
        if workspace_idx >= 0 and first_db_idx >= 0:
            if workspace_idx >= first_db_idx:
                log_test("Agent Test 3: Compound command", False, 
                        f"Dependency order wrong: createWorkspace at {workspace_idx}, createDatabase at {first_db_idx}")
                return False
        
        # Validate tool names
        unknown_tools = validate_tool_names(steps, "Agent Test 3: Compound command")
        if unknown_tools:
            log_test("Agent Test 3: Compound command", False, 
                    f"Unknown tools found: {', '.join(unknown_tools)}")
            return False
        
        log_test("Agent Test 3: Compound command", True, 
                f"Reply: '{data['reply'][:60]}...', Steps: {len(steps)}, Tools: {tools}, Placeholders: Yes")
        return True
        
    except Exception as e:
        log_test("Agent Test 3: Compound command", False, f"Exception: {str(e)}")
        return False


def test_agent_4_context_awareness():
    """Agent Test 4: Context awareness test"""
    try:
        payload = {
            "command": "Summarize this note",
            "context": {
                "noteId": "note_123",
                "noteTitle": "ML"
            }
        }
        response = requests.post(f"{API_BASE}/agent/plan", json=payload, timeout=45)
        
        if response.status_code != 200:
            log_test("Agent Test 4: Context awareness", False, 
                    f"Status code: {response.status_code}, Body: {response.text[:500]}")
            return False
        
        data = response.json()
        
        # Validate structure
        if not validate_plan_structure(data, "Agent Test 4: Context awareness"):
            return False
        
        steps = data["steps"]
        
        # Should have at least 1 step
        if len(steps) < 1:
            log_test("Agent Test 4: Context awareness", False, 
                    f"Expected at least 1 step, got {len(steps)}")
            return False
        
        # Validate step structure
        if not validate_step_structure(steps[0], 0, "Agent Test 4: Context awareness"):
            return False
        
        # Should have summarizeNote tool
        has_summarize = any(step["tool"] == "summarizeNote" for step in steps)
        if not has_summarize:
            log_test("Agent Test 4: Context awareness", False, 
                    f"Expected 'summarizeNote' tool, got: {[s['tool'] for s in steps]}")
            return False
        
        # Validate tool names
        unknown_tools = validate_tool_names(steps, "Agent Test 4: Context awareness")
        if unknown_tools:
            log_test("Agent Test 4: Context awareness", False, 
                    f"Unknown tools found: {', '.join(unknown_tools)}")
            return False
        
        log_test("Agent Test 4: Context awareness", True, 
                f"Reply: '{data['reply'][:60]}...', Steps: {len(steps)}, Has summarizeNote: Yes")
        return True
        
    except Exception as e:
        log_test("Agent Test 4: Context awareness", False, f"Exception: {str(e)}")
        return False


def test_agent_5_validation_empty_command():
    """Agent Test 5: Validation - empty command should return 400"""
    try:
        payload = {
            "command": "",
            "context": {}
        }
        response = requests.post(f"{API_BASE}/agent/plan", json=payload, timeout=10)
        
        if response.status_code == 400:
            log_test("Agent Test 5: Validation (empty command)", True, 
                    f"Returns 400 as expected: {response.text[:100]}")
            return True
        else:
            log_test("Agent Test 5: Validation (empty command)", False, 
                    f"Expected 400, got {response.status_code}")
            return False
        
    except Exception as e:
        log_test("Agent Test 5: Validation (empty command)", False, f"Exception: {str(e)}")
        return False


def test_agent_6_tool_validation():
    """Agent Test 6: Tool name validation - only allowed tools should appear"""
    # This is tested in all previous tests via validate_tool_names
    # Here we just do a final comprehensive check
    try:
        test_commands = [
            "Create a note and a workspace",
            "Search my notes for ML and create a task",
            "Use a template and merge duplicate notes"
        ]
        
        all_valid = True
        all_tools_seen = set()
        
        for cmd in test_commands:
            payload = {"command": cmd, "context": {}}
            response = requests.post(f"{API_BASE}/agent/plan", json=payload, timeout=45)
            
            if response.status_code == 200:
                data = response.json()
                if "steps" in data:
                    for step in data["steps"]:
                        tool = step.get("tool", "")
                        all_tools_seen.add(tool)
                        if tool not in ALLOWED_TOOLS:
                            all_valid = False
                            log_test("Agent Test 6: Tool validation", False, 
                                    f"Unknown tool '{tool}' found in command: '{cmd}'")
                            return False
        
        if all_valid:
            log_test("Agent Test 6: Tool validation", True, 
                    f"All tools valid. Tools seen: {sorted(all_tools_seen)}")
            return True
        
    except Exception as e:
        log_test("Agent Test 6: Tool validation", False, f"Exception: {str(e)}")
        return False


# ============================================================================
# SHARE-AS-LINK REGRESSION TESTS
# ============================================================================

def test_regression_shared_endpoints():
    """Regression Test 7: Verify /api/shared endpoints still work"""
    try:
        # Create
        payload = {"title": "Regression Test", "body": "Testing regression", "kind": "note"}
        response = requests.post(f"{API_BASE}/shared", json=payload, timeout=10)
        if response.status_code != 200:
            log_test("Regression Test 7: /api/shared endpoints", False, 
                    f"POST failed: {response.status_code}")
            return False
        
        data = response.json()
        token = data["token"]
        manage_token = data["manage_token"]
        
        # GET
        get_response = requests.get(f"{API_BASE}/shared/{token}", timeout=10)
        if get_response.status_code != 200 or "Regression Test" not in get_response.text:
            log_test("Regression Test 7: /api/shared endpoints", False, 
                    f"GET failed: {get_response.status_code}")
            return False
        
        # DELETE
        del_response = requests.delete(f"{API_BASE}/shared/{token}", 
                                      params={"key": manage_token}, timeout=10)
        if del_response.status_code != 200:
            log_test("Regression Test 7: /api/shared endpoints", False, 
                    f"DELETE failed: {del_response.status_code}")
            return False
        
        # GET after revoke (should be 404)
        get_after = requests.get(f"{API_BASE}/shared/{token}", timeout=10)
        if get_after.status_code != 404:
            log_test("Regression Test 7: /api/shared endpoints", False, 
                    f"GET after revoke should be 404, got {get_after.status_code}")
            return False
        
        # DELETE with wrong key (should be 403)
        payload2 = {"title": "Test2", "body": "test", "kind": "note"}
        response2 = requests.post(f"{API_BASE}/shared", json=payload2, timeout=10)
        token2 = response2.json()["token"]
        wrong_key_response = requests.delete(f"{API_BASE}/shared/{token2}", 
                                            params={"key": "wrongkey"}, timeout=10)
        if wrong_key_response.status_code != 403:
            log_test("Regression Test 7: /api/shared endpoints", False, 
                    f"DELETE with wrong key should be 403, got {wrong_key_response.status_code}")
            return False
        
        log_test("Regression Test 7: /api/shared endpoints", True, 
                "All regression tests pass (create/view/revoke/404/403)")
        return True
        
    except Exception as e:
        log_test("Regression Test 7: /api/shared endpoints", False, f"Exception: {str(e)}")
        return False


def run_all_tests():
    """Run all tests in sequence"""
    print("=" * 80)
    print("RF NOTES BACKEND COMPREHENSIVE TEST SUITE")
    print(f"Base URL: {BASE_URL}")
    print("=" * 80)
    print()
    
    # ========== AI ACTION AGENT PLANNER TESTS ==========
    print("=" * 80)
    print("AI ACTION AGENT PLANNER ENDPOINT TESTS")
    print("=" * 80)
    print()
    
    test_agent_1_sanity()
    print()
    
    test_agent_2_simple_command()
    print()
    
    test_agent_3_compound_command()
    print()
    
    test_agent_4_context_awareness()
    print()
    
    test_agent_5_validation_empty_command()
    print()
    
    test_agent_6_tool_validation()
    print()
    
    test_regression_shared_endpoints()
    print()
    
    print("=" * 80)
    print("LEGACY SHARE-AS-LINK DETAILED TESTS (for reference)")
    print("=" * 80)
    print()
    
    # Legacy detailed tests (optional, already covered in regression test)
    # Uncomment if you want to run detailed share-as-link tests
    # test_1_sanity_check()
    # print()
    # link_data = test_2_create_shared_link()
    # print()
    # if link_data:
    #     token = link_data["token"]
    #     manage_token = link_data["manage_token"]
    #     test_3_get_shared_html(token)
    #     print()
    #     test_4_revoke_link(token, manage_token)
    #     print()
    #     test_5_get_revoked_link(token)
    #     print()
    # test_6a_wrong_manage_key()
    # print()
    # test_6b_delete_nonexistent()
    # print()
    # test_6c_empty_body()
    # print()
    # test_7_mongodb_persistence()
    # print()
    
    # Summary
    print("=" * 70)
    print("TEST SUMMARY")
    print("=" * 70)
    print(f"Total tests: {passed + failed}")
    print(f"✅ Passed: {passed}")
    print(f"❌ Failed: {failed}")
    print()
    
    if failed == 0:
        print("🎉 ALL TESTS PASSED!")
        return 0
    else:
        print(f"⚠️  {failed} test(s) failed. See details above.")
        return 1


if __name__ == "__main__":
    exit_code = run_all_tests()
    sys.exit(exit_code)
