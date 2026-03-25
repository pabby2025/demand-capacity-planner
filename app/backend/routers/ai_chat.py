import json
import os
from openai import AzureOpenAI, AuthenticationError, RateLimitError
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional, List
from pydantic import BaseModel

from models import Resource, WeeklyMetric
from database import get_db

router = APIRouter()

AZURE_OPENAI_ENDPOINT   = "https://cvs-solutions.openai.azure.com/"
AZURE_OPENAI_KEY        = os.environ.get("AZURE_OPENAI_KEY", "")
AZURE_OPENAI_DEPLOYMENT = os.environ.get("AZURE_OPENAI_DEPLOYMENT", "gpt-4o")
AZURE_OPENAI_API_VERSION = "2024-10-21"

SYSTEM_PROMPT = """You are an expert AI assistant for a Resource Capacity Planning system used by an IT services organization. You have real-time access to data for 250+ resources across vendors (Cognizant, CVS, TCS), multiple projects, and weekly utilization metrics.

You help managers identify:
- Over-allocated resources and their impact on project delivery
- Demand vs capacity gaps across skills, vendors, and projects
- Under-utilized skill sets that represent optimization opportunities
- Project delivery risks based on fulfillment rates and over-allocation patterns
- Vendor performance comparisons and staffing recommendations

Guidelines:
- ALWAYS use the available tools to fetch fresh, real data before answering any question
- Be specific with numbers — cite exact counts, percentages, hours, and names
- Highlight critical issues (over-allocation > 20%, fulfillment < 80%, etc.)
- Suggest concrete, actionable steps managers can take
- Keep responses professional, structured, and easy to scan
- Use bullet points and clear sections when presenting multiple data points
- If a question requires multiple tools, call them all to provide a comprehensive answer"""

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_dashboard_overview",
            "description": (
                "Returns a high-level overview of the entire resource capacity planning system. "
                "Includes total active resource count, average utilization percentage, over-allocation count and percentage, "
                "total demand hours, actual hours, and max capacity hours, demand gap, and vendor breakdown by resource count. "
                "Use this tool when the user asks for a summary, overview, or general status of the organization."
            ),
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_overallocated_resources",
            "description": (
                "Returns a list of resources that are currently over-allocated (demand exceeds capacity). "
                "Each record includes resource name, skill, vendor, location, project area, demand hours, "
                "actual hours, max hours, over-allocated hours, and utilization percentage. "
                "Use this when the user asks who is over-allocated, stretched, or at risk of burnout. "
                "Can be filtered by vendor."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "limit": {
                        "type": "integer",
                        "description": "Maximum number of over-allocated resources to return. Default is 20.",
                    },
                    "vendor": {
                        "type": "string",
                        "description": "Optional vendor name to filter results (e.g., 'Cognizant', 'TCS', 'CVS').",
                    },
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_utilization_by_skill",
            "description": (
                "Groups all utilization metrics by primary skill and returns per-skill analytics. "
                "Each record includes skill name, resource count, average utilization percentage, "
                "total demand hours, total actual hours, total capacity (max hours), over-allocated count, "
                "and demand gap (demand - actual). "
                "Use this to identify under-utilized skills, over-demanded skills, or skill shortages."
            ),
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_project_demand_analysis",
            "description": (
                "Groups metrics by project area and returns demand vs capacity analysis per project/area. "
                "Each record includes area/project name, resource count, total demand hours, total actual hours, "
                "total max capacity, demand gap, fulfillment percentage (actual/demand*100), "
                "over-allocated count, and a is_critical flag (true when fulfillment < 80%). "
                "Use this to identify projects at delivery risk, projects with capacity shortfalls, "
                "or high-demand project areas."
            ),
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_vendor_performance",
            "description": (
                "Groups metrics by resource vendor and returns comparative vendor performance data. "
                "Each record includes vendor name, total resource count, onshore count, offshore count, "
                "average utilization percentage, total demand hours, total actual hours, total capacity, "
                "demand gap, and over-allocated count. "
                "Use this to compare vendor performance, onshore vs offshore ratios, or vendor utilization efficiency."
            ),
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_resources_by_criteria",
            "description": (
                "Searches and filters the resource database by one or more criteria, then joins the latest "
                "utilization metrics for each matching resource. "
                "Returns resource details (name, role, skill, vendor, location, manager, status) along with "
                "utilization metrics (demand hours, actual hours, max hours, utilization pct, over-allocation flag). "
                "Use this when the user asks about specific resources, wants to find resources by skill or vendor, "
                "or needs to look up a particular person or group."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "skill":     {"type": "string", "description": "Filter by primary skill (e.g., 'Java', 'Python', 'AWS')."},
                    "vendor":    {"type": "string", "description": "Filter by vendor name (e.g., 'Cognizant', 'TCS')."},
                    "location":  {"type": "string", "description": "Filter by location type: 'Onshore' or 'Offshore'."},
                    "area":      {"type": "string", "description": "Filter by project area or domain."},
                    "status":    {"type": "string", "description": "Filter by resource status: 'ACTIVE' or 'INACTIVE'."},
                    "limit":     {"type": "integer", "description": "Maximum number of resources to return. Default is 25."},
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_weekly_trend",
            "description": (
                "Returns week-over-week trend data for demand, actual hours, capacity, and over-allocation. "
                "Each record includes the week date, total demand hours, total actual hours, total capacity, "
                "total over-allocated hours, and resource count — sorted chronologically. "
                "Use this to identify trends, spikes, seasonal patterns, or whether the situation is improving or worsening."
            ),
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
]


def safe_div(numerator: float, denominator: float, default: float = 0.0) -> float:
    """Safely divide two numbers, returning default if denominator is zero."""
    if denominator == 0:
        return default
    return numerator / denominator


def execute_tool(tool_name: str, tool_input: dict, db: Session) -> dict:
    """Execute a tool by name with the given input and return results."""

    if tool_name == "get_dashboard_overview":
        # Active resource count
        active_count = db.query(Resource).filter(Resource.resource_status == "ACTIVE").count()
        total_count = db.query(Resource).count()

        # Aggregate metrics
        metrics = db.query(WeeklyMetric).filter(WeeklyMetric.sheet_type == "Utilization").all()

        total_demand = sum(m.demand_hours or 0.0 for m in metrics)
        total_actual = sum(m.actual_hours or 0.0 for m in metrics)
        total_capacity = sum(m.max_hours or 0.0 for m in metrics)
        demand_gap = total_demand - total_actual

        # Over-allocation
        over_alloc_resources = set(m.resource_code for m in metrics if m.over_allocation)
        over_alloc_count = len(over_alloc_resources)
        over_alloc_pct = round(safe_div(over_alloc_count, total_count) * 100, 1)

        # Avg utilization per resource
        resource_util = {}
        for m in metrics:
            if m.resource_code not in resource_util:
                resource_util[m.resource_code] = {"actual": 0.0, "max": 0.0}
            resource_util[m.resource_code]["actual"] += m.actual_hours or 0.0
            resource_util[m.resource_code]["max"] += m.max_hours or 0.0

        util_pcts = [
            safe_div(v["actual"], v["max"]) * 100
            for v in resource_util.values()
            if v["max"] > 0
        ]
        avg_utilization = round(safe_div(sum(util_pcts), len(util_pcts)), 1) if util_pcts else 0.0

        # Vendor breakdown
        resources = db.query(Resource).all()
        vendor_map = {}
        for r in resources:
            v = r.resource_vendor or "Unknown"
            if v not in vendor_map:
                vendor_map[v] = 0
            vendor_map[v] += 1

        vendor_breakdown = [
            {"vendor": v, "resource_count": c}
            for v, c in sorted(vendor_map.items(), key=lambda x: x[1], reverse=True)
        ]

        return {
            "total_resources": total_count,
            "active_resources": active_count,
            "avg_utilization_pct": avg_utilization,
            "over_allocated_count": over_alloc_count,
            "over_allocated_pct": over_alloc_pct,
            "total_demand_hours": round(total_demand, 1),
            "total_actual_hours": round(total_actual, 1),
            "total_capacity_hours": round(total_capacity, 1),
            "demand_gap_hours": round(demand_gap, 1),
            "vendor_breakdown": vendor_breakdown,
        }

    elif tool_name == "get_overallocated_resources":
        limit = tool_input.get("limit", 20)
        vendor_filter = tool_input.get("vendor")

        query = (
            db.query(WeeklyMetric, Resource)
            .join(Resource, WeeklyMetric.resource_code == Resource.resource_code)
            .filter(
                WeeklyMetric.over_allocation == True,
                WeeklyMetric.sheet_type == "Utilization",
            )
        )

        if vendor_filter:
            query = query.filter(Resource.resource_vendor == vendor_filter)

        query = query.order_by(WeeklyMetric.over_allocated_hours.desc()).limit(limit)
        rows = query.all()

        results = []
        for metric, resource in rows:
            util_pct = round(
                safe_div(metric.actual_hours or 0.0, metric.max_hours or 0.0) * 100, 1
            )
            results.append({
                "resource_code": resource.resource_code,
                "resource_name": resource.resource_name or resource.resource_code,
                "role": resource.role,
                "primary_skill": resource.primary_skill,
                "vendor": resource.resource_vendor,
                "location": resource.location,
                "project_area": metric.area,
                "week": metric.week.isoformat() if metric.week else metric.week_text,
                "demand_hours": round(metric.demand_hours or 0.0, 1),
                "actual_hours": round(metric.actual_hours or 0.0, 1),
                "max_hours": round(metric.max_hours or 0.0, 1),
                "over_allocated_hours": round(metric.over_allocated_hours or 0.0, 1),
                "utilization_pct": util_pct,
            })

        return {
            "count": len(results),
            "vendor_filter": vendor_filter,
            "over_allocated_resources": results,
        }

    elif tool_name == "get_utilization_by_skill":
        metrics = (
            db.query(WeeklyMetric, Resource)
            .join(Resource, WeeklyMetric.resource_code == Resource.resource_code)
            .filter(WeeklyMetric.sheet_type == "Utilization")
            .all()
        )

        skill_data = {}
        for metric, resource in metrics:
            skill = resource.primary_skill or "Unknown"
            if skill not in skill_data:
                skill_data[skill] = {
                    "resources": set(),
                    "demand_hours": 0.0,
                    "actual_hours": 0.0,
                    "max_hours": 0.0,
                    "over_allocated_resources": set(),
                }
            skill_data[skill]["resources"].add(resource.resource_code)
            skill_data[skill]["demand_hours"] += metric.demand_hours or 0.0
            skill_data[skill]["actual_hours"] += metric.actual_hours or 0.0
            skill_data[skill]["max_hours"] += metric.max_hours or 0.0
            if metric.over_allocation:
                skill_data[skill]["over_allocated_resources"].add(resource.resource_code)

        results = []
        for skill, data in skill_data.items():
            resource_count = len(data["resources"])
            avg_util = round(
                safe_div(data["actual_hours"], data["max_hours"]) * 100, 1
            )
            demand_gap = round(data["demand_hours"] - data["actual_hours"], 1)
            results.append({
                "skill": skill,
                "resource_count": resource_count,
                "avg_utilization_pct": avg_util,
                "total_demand_hours": round(data["demand_hours"], 1),
                "total_actual_hours": round(data["actual_hours"], 1),
                "total_capacity_hours": round(data["max_hours"], 1),
                "over_allocated_count": len(data["over_allocated_resources"]),
                "demand_gap": demand_gap,
            })

        results.sort(key=lambda x: x["total_demand_hours"], reverse=True)
        return {"skill_count": len(results), "skills": results}

    elif tool_name == "get_project_demand_analysis":
        metrics = (
            db.query(WeeklyMetric, Resource)
            .join(Resource, WeeklyMetric.resource_code == Resource.resource_code)
            .filter(WeeklyMetric.sheet_type == "Utilization")
            .all()
        )

        area_data = {}
        for metric, resource in metrics:
            area = metric.area or resource.area or "Unknown"
            if area not in area_data:
                area_data[area] = {
                    "resources": set(),
                    "demand_hours": 0.0,
                    "actual_hours": 0.0,
                    "max_hours": 0.0,
                    "over_allocated_resources": set(),
                }
            area_data[area]["resources"].add(resource.resource_code)
            area_data[area]["demand_hours"] += metric.demand_hours or 0.0
            area_data[area]["actual_hours"] += metric.actual_hours or 0.0
            area_data[area]["max_hours"] += metric.max_hours or 0.0
            if metric.over_allocation:
                area_data[area]["over_allocated_resources"].add(resource.resource_code)

        results = []
        for area, data in area_data.items():
            fulfillment_pct = round(
                safe_div(data["actual_hours"], data["demand_hours"]) * 100, 1
            )
            demand_gap = round(data["demand_hours"] - data["actual_hours"], 1)
            is_critical = fulfillment_pct < 80 and data["demand_hours"] > 0
            results.append({
                "area": area,
                "resource_count": len(data["resources"]),
                "total_demand_hours": round(data["demand_hours"], 1),
                "total_actual_hours": round(data["actual_hours"], 1),
                "total_max_capacity_hours": round(data["max_hours"], 1),
                "demand_gap": demand_gap,
                "fulfillment_pct": fulfillment_pct,
                "over_allocated_count": len(data["over_allocated_resources"]),
                "is_critical": is_critical,
            })

        results.sort(key=lambda x: x["total_demand_hours"], reverse=True)
        critical_count = sum(1 for r in results if r["is_critical"])
        return {
            "area_count": len(results),
            "critical_area_count": critical_count,
            "areas": results,
        }

    elif tool_name == "get_vendor_performance":
        metrics = (
            db.query(WeeklyMetric, Resource)
            .join(Resource, WeeklyMetric.resource_code == Resource.resource_code)
            .filter(WeeklyMetric.sheet_type == "Utilization")
            .all()
        )

        vendor_data = {}
        for metric, resource in metrics:
            vendor = resource.resource_vendor or "Unknown"
            if vendor not in vendor_data:
                vendor_data[vendor] = {
                    "resources": set(),
                    "onshore_resources": set(),
                    "offshore_resources": set(),
                    "demand_hours": 0.0,
                    "actual_hours": 0.0,
                    "max_hours": 0.0,
                    "over_allocated_resources": set(),
                }
            vendor_data[vendor]["resources"].add(resource.resource_code)
            if resource.location == "Onshore":
                vendor_data[vendor]["onshore_resources"].add(resource.resource_code)
            else:
                vendor_data[vendor]["offshore_resources"].add(resource.resource_code)
            vendor_data[vendor]["demand_hours"] += metric.demand_hours or 0.0
            vendor_data[vendor]["actual_hours"] += metric.actual_hours or 0.0
            vendor_data[vendor]["max_hours"] += metric.max_hours or 0.0
            if metric.over_allocation:
                vendor_data[vendor]["over_allocated_resources"].add(resource.resource_code)

        results = []
        for vendor, data in vendor_data.items():
            avg_util = round(
                safe_div(data["actual_hours"], data["max_hours"]) * 100, 1
            )
            demand_gap = round(data["demand_hours"] - data["actual_hours"], 1)
            results.append({
                "vendor": vendor,
                "resource_count": len(data["resources"]),
                "onshore_count": len(data["onshore_resources"]),
                "offshore_count": len(data["offshore_resources"]),
                "avg_utilization_pct": avg_util,
                "total_demand_hours": round(data["demand_hours"], 1),
                "total_actual_hours": round(data["actual_hours"], 1),
                "total_capacity_hours": round(data["max_hours"], 1),
                "demand_gap": demand_gap,
                "over_allocated_count": len(data["over_allocated_resources"]),
            })

        results.sort(key=lambda x: x["resource_count"], reverse=True)
        return {"vendor_count": len(results), "vendors": results}

    elif tool_name == "get_resources_by_criteria":
        skill = tool_input.get("skill")
        vendor = tool_input.get("vendor")
        location = tool_input.get("location")
        area = tool_input.get("area")
        status = tool_input.get("status")
        limit = tool_input.get("limit", 25)

        query = db.query(Resource)
        if skill:
            query = query.filter(Resource.primary_skill.ilike(f"%{skill}%"))
        if vendor:
            query = query.filter(Resource.resource_vendor.ilike(f"%{vendor}%"))
        if location:
            query = query.filter(Resource.location.ilike(f"%{location}%"))
        if area:
            query = query.filter(Resource.area.ilike(f"%{area}%"))
        if status:
            query = query.filter(Resource.resource_status == status.upper())

        resources = query.limit(limit).all()

        # Get latest metrics for each resource
        resource_codes = [r.resource_code for r in resources]
        metrics_map = {}
        if resource_codes:
            all_metrics = (
                db.query(WeeklyMetric)
                .filter(
                    WeeklyMetric.resource_code.in_(resource_codes),
                    WeeklyMetric.sheet_type == "Utilization",
                )
                .order_by(WeeklyMetric.resource_code, WeeklyMetric.week.desc())
                .all()
            )
            # Keep only the latest metric per resource
            for m in all_metrics:
                if m.resource_code not in metrics_map:
                    metrics_map[m.resource_code] = m

        results = []
        for resource in resources:
            metric = metrics_map.get(resource.resource_code)
            util_pct = 0.0
            if metric:
                util_pct = round(
                    safe_div(metric.actual_hours or 0.0, metric.max_hours or 0.0) * 100, 1
                )
            results.append({
                "resource_code": resource.resource_code,
                "resource_name": resource.resource_name or resource.resource_code,
                "role": resource.role,
                "primary_skill": resource.primary_skill,
                "vendor": resource.resource_vendor,
                "location": resource.location,
                "resource_manager": resource.resource_manager,
                "status": resource.resource_status,
                "area": resource.area,
                "demand_hours": round(metric.demand_hours or 0.0, 1) if metric else None,
                "actual_hours": round(metric.actual_hours or 0.0, 1) if metric else None,
                "max_hours": round(metric.max_hours or 0.0, 1) if metric else None,
                "utilization_pct": util_pct,
                "is_over_allocated": metric.over_allocation if metric else False,
                "latest_week": metric.week.isoformat() if metric and metric.week else None,
            })

        return {
            "count": len(results),
            "filters_applied": {
                "skill": skill,
                "vendor": vendor,
                "location": location,
                "area": area,
                "status": status,
            },
            "resources": results,
        }

    elif tool_name == "get_weekly_trend":
        metrics = (
            db.query(WeeklyMetric)
            .filter(WeeklyMetric.sheet_type == "Utilization")
            .order_by(WeeklyMetric.week)
            .all()
        )

        week_data = {}
        for m in metrics:
            wk = m.week.isoformat() if m.week else (m.week_text or "Unknown")
            if wk not in week_data:
                week_data[wk] = {
                    "week": wk,
                    "demand_hours": 0.0,
                    "actual_hours": 0.0,
                    "capacity_hours": 0.0,
                    "over_allocated_hours": 0.0,
                    "resources": set(),
                }
            week_data[wk]["demand_hours"] += m.demand_hours or 0.0
            week_data[wk]["actual_hours"] += m.actual_hours or 0.0
            week_data[wk]["capacity_hours"] += m.max_hours or 0.0
            week_data[wk]["over_allocated_hours"] += m.over_allocated_hours or 0.0
            week_data[wk]["resources"].add(m.resource_code)

        results = []
        for wk, data in sorted(week_data.items()):
            results.append({
                "week": data["week"],
                "total_demand_hours": round(data["demand_hours"], 1),
                "total_actual_hours": round(data["actual_hours"], 1),
                "total_capacity_hours": round(data["capacity_hours"], 1),
                "total_over_allocated_hours": round(data["over_allocated_hours"], 1),
                "resource_count": len(data["resources"]),
                "utilization_pct": round(
                    safe_div(data["actual_hours"], data["capacity_hours"]) * 100, 1
                ),
            })

        return {"week_count": len(results), "weekly_trends": results}

    else:
        return {"error": f"Unknown tool: {tool_name}"}


def run_agentic_loop(messages: list, db: Session):
    """
    Synchronous generator that runs the agentic tool-use loop with Azure OpenAI.
    Yields SSE-formatted lines for streaming to the client.
    """
    if not AZURE_OPENAI_KEY:
        yield 'data: {"type": "error", "message": "AZURE_OPENAI_KEY environment variable is not set. Please configure it in Azure App Service settings."}\n\n'
        yield 'data: {"type": "done"}\n\n'
        return

    try:
        client = AzureOpenAI(
            azure_endpoint=AZURE_OPENAI_ENDPOINT,
            api_key=AZURE_OPENAI_KEY,
            api_version=AZURE_OPENAI_API_VERSION,
        )

        # Build message history — system prompt first, then conversation
        history = [{"role": "system", "content": SYSTEM_PROMPT}]
        for msg in messages:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            if role in ("user", "assistant"):
                history.append({"role": role, "content": content})

        max_iterations = 10
        iteration = 0

        while iteration < max_iterations:
            iteration += 1

            response = client.chat.completions.create(
                model=AZURE_OPENAI_DEPLOYMENT,
                messages=history,
                tools=TOOLS,
                tool_choice="auto",
                max_tokens=4096,
            )

            choice = response.choices[0]

            if choice.finish_reason == "tool_calls":
                # Append assistant message with tool_calls to history
                history.append(choice.message)

                # Execute each tool call
                for tc in choice.message.tool_calls:
                    tool_name = tc.function.name
                    try:
                        tool_input = json.loads(tc.function.arguments or "{}")
                    except json.JSONDecodeError:
                        tool_input = {}

                    # Notify client which tool is being called
                    yield f'data: {json.dumps({"type": "tool_call", "tool": tool_name})}\n\n'

                    try:
                        result = execute_tool(tool_name, tool_input, db)
                    except Exception as e:
                        result = {"error": f"Tool execution failed: {str(e)}"}

                    # Append tool result to history
                    history.append({
                        "role": "tool",
                        "tool_call_id": tc.id,
                        "content": json.dumps(result),
                    })

                # Continue loop to get the next response
                continue

            elif choice.finish_reason in ("stop", "length"):
                # Final text response
                final_text = choice.message.content or ""
                if final_text:
                    yield f'data: {json.dumps({"type": "text", "content": final_text})}\n\n'
                yield 'data: {"type": "done"}\n\n'
                return

            else:
                yield f'data: {json.dumps({"type": "error", "message": f"Unexpected finish reason: {choice.finish_reason}"})}\n\n'
                yield 'data: {"type": "done"}\n\n'
                return

        yield 'data: {"type": "error", "message": "Maximum reasoning iterations reached. Please try a more specific question."}\n\n'
        yield 'data: {"type": "done"}\n\n'

    except AuthenticationError:
        yield 'data: {"type": "error", "message": "Invalid Azure OpenAI key. Please check the AZURE_OPENAI_KEY setting."}\n\n'
        yield 'data: {"type": "done"}\n\n'
    except RateLimitError:
        yield 'data: {"type": "error", "message": "Azure OpenAI rate limit reached. Please wait a moment and try again."}\n\n'
        yield 'data: {"type": "done"}\n\n'
    except Exception as e:
        yield f'data: {json.dumps({"type": "error", "message": f"An error occurred: {str(e)}"})}\n\n'
        yield 'data: {"type": "done"}\n\n'


# ---------- Pydantic Models ----------

class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessage]


# ---------- Endpoint ----------

@router.post("/ai/chat")
def ai_chat(request: ChatRequest, db: Session = Depends(get_db)):
    """
    Streaming AI chat endpoint. Returns SSE stream.
    Each event is a JSON line: data: {"type": "...", ...}
    Types: "tool_call", "text", "done", "error"
    """
    messages_list = [{"role": m.role, "content": m.content} for m in request.messages]

    return StreamingResponse(
        run_agentic_loop(messages_list, db),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
