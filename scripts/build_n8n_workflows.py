#!/usr/bin/env python3
"""Regenerate consolidated n8n workflow exports under n8n_flows/export/."""

from __future__ import annotations

import json
import os
import uuid


def nid() -> str:
    return str(uuid.uuid4())


def code_node(name: str, pos: list[int], js: str) -> dict:
    return {
        "parameters": {"mode": "runOnceForAllItems", "jsCode": js},
        "id": nid(),
        "name": name,
        "type": "n8n-nodes-base.code",
        "typeVersion": 2,
        "position": pos,
    }


def if_node(
    name: str,
    pos: list[int],
    left: str,
    op_type: str,
    op: str,
    right: str | None = None,
    *,
    single: bool = False,
) -> dict:
    op_obj: dict = {"type": op_type, "operation": op}
    if single:
        op_obj["singleValue"] = True
    cond = {
        "id": nid(),
        "leftValue": left,
        "rightValue": "" if right is None else right,
        "operator": op_obj,
    }
    return {
        "parameters": {
            "conditions": {
                "options": {
                    "version": 2,
                    "leftValue": "",
                    "caseSensitive": True,
                    "typeValidation": "loose",
                },
                "conditions": [cond],
                "combinator": "and",
            }
        },
        "id": nid(),
        "name": name,
        "type": "n8n-nodes-base.if",
        "typeVersion": 2.2,
        "position": pos,
    }


def fix_respond_codes(workflow: dict) -> None:
    for n in workflow.get("nodes", []):
        if n.get("type") == "n8n-nodes-base.respondToWebhook":
            opts = n.setdefault("parameters", {}).setdefault("options", {})
            opts["responseCode"] = 200


def build_onboarding() -> dict:
    normalize_js = r"""const root = $json.body ?? $json;
const body = (typeof root === 'object' && root !== null) ? root : {};
const required = ['age','height_cm','weight_kg','activity_level','goal','diet_pref'];
const missing = required.filter(k => body[k] === undefined || body[k] === null || String(body[k]).trim() === '');
return [{ json: { profile: body, missing_fields: missing } }];"""

    validate_js = r"""const p = $json.profile || {};
const issues = [];
if (($json.missing_fields || []).length) {
  issues.push('Missing required fields: ' + $json.missing_fields.join(', '));
}
if (!p.height_cm) issues.push('Height missing');
if (!p.weight_kg) issues.push('Weight missing');
if (p.weight_kg && (Number(p.weight_kg) < 25 || Number(p.weight_kg) > 300)) issues.push('Weight unrealistic, confirm value');
if (p.height_cm && (Number(p.height_cm) < 100 || Number(p.height_cm) > 240)) issues.push('Height unrealistic, confirm value');
if (p.medical_constraints && String(p.medical_constraints).toLowerCase() !== 'none') {
  issues.push('Medical constraints noted: include safety disclaimer in coaching copy');
}
return [{ json: { ...$json, validation_issues: issues, is_valid: issues.length === 0 } }];"""

    risk_js = r"""const p = $json.profile || {};
const h = (Number(p.height_cm) || 0) / 100;
const w = Number(p.weight_kg) || 0;
const bmi = (h > 0) ? +(w / (h*h)).toFixed(1) : null;
const risks = [];
if (bmi && bmi >= 30) risks.push('weight_management_risk:high');
else if (bmi && bmi >= 25) risks.push('weight_management_risk:moderate');
if (String(p.family_history || '').toLowerCase().includes('diabetes')) risks.push('diabetes_lifestyle_risk:elevated');
if (String(p.activity_level || '').toLowerCase() === 'low') risks.push('low_activity_risk:elevated');
if (Number(p.age) >= 45) risks.push('cardiometabolic_prevention_focus:recommended');
return [{ json: { ...$json, bmi, wellness_risks: risks } }];"""

    ethnicity_js = r"""const p = $json.profile || {};
const notes = [];
const eth = String(p.ethnicity || '').toLowerCase();
const fh = String(p.family_history || '').toLowerCase();
if (fh.includes('diabetes')) {
  notes.push('Prioritize low-glycemic meal pairings and a short walk after larger meals.');
}
if (eth.includes('south') && eth.includes('asian')) {
  notes.push('Emphasize legumes, vegetables, and whole grains; moderate refined flour where possible.');
}
if (fh.includes('heart') || fh.includes('hypertension')) {
  notes.push('Favor DASH-style patterns: vegetables, potassium-rich foods, limited sodium.');
}
return [{ json: { ...$json, personalization_notes: notes } }];"""

    diet_js = r"""const p = $json.profile || {};
const goal = p.goal || 'maintain';
const baseCalories = goal === 'weight_loss' ? 1800 : (goal === 'muscle_gain' ? 2400 : 2100);
const proteinG = Math.round((Number(p.weight_kg) || 70) * (goal === 'muscle_gain' ? 1.8 : 1.2));
const vegetarian = String(p.diet_pref || '').toLowerCase().includes('vegetarian');
const plan = {
  calories_target: baseCalories,
  protein_target_g: proteinG,
  meals: [
    vegetarian ? 'Greek yogurt + berries + nuts' : 'Eggs + whole grain toast + fruit',
    vegetarian ? 'Lentil bowl + vegetables + brown rice' : 'Grilled chicken + quinoa + vegetables',
    vegetarian ? 'Tofu/paneer + mixed vegetables + salad' : 'Fish + vegetables + olive oil salad'
  ]
};
return [{ json: { ...$json, diet_plan: plan } }];"""

    exercise_js = r"""const p = $json.profile || {};
const low = String(p.activity_level || '').toLowerCase() === 'low';
const jointPain = String(p.medical_constraints || '').toLowerCase().includes('joint');
let cardio = low ? '20-30 min brisk walk, 5x/week' : '30-40 min mixed cardio, 4-5x/week';
if (jointPain) cardio = 'Low-impact cardio (walk/cycle/swim), 5x/week';
const plan = {
  weekly_plan: [cardio, 'Strength training 2-3x/week', 'Mobility and stretching 10 min daily'],
  avoid: jointPain ? ['High-impact running', 'Deep loaded knee flexion'] : []
};
return [{ json: { ...$json, exercise_plan: plan } }];"""

    safety_js = r"""const text = JSON.stringify($json).toLowerCase();
const redFlags = ['chest pain','fainting','severe shortness of breath','very high blood sugar','very high blood pressure','sudden weakness','severe allergic reaction'];
const hits = redFlags.filter(r => text.includes(r));
if (hits.length) {
  return [{ json: { safe_to_continue: false, red_flags: hits, escalation: 'Possible urgent symptoms detected. Seek immediate medical care or call emergency services.', stage: 'safety_escalation' } }];
}
return [{ json: { ...$json, safe_to_continue: true, red_flags: [] } }];"""

    build_invalid_js = r"""return [{ json: {
  ok: false,
  http_status: 422,
  stage: 'validation',
  validation_issues: $json.validation_issues || [],
  missing_fields: $json.missing_fields || [],
  message: 'Please fix validation issues before generating a plan.'
} }];"""

    build_success_js = r"""const j = $json;
return [{ json: {
  ok: true,
  http_status: 200,
  stage: 'plan_ready',
  profile_summary: { bmi: j.bmi, wellness_risks: j.wellness_risks },
  personalization_notes: j.personalization_notes || [],
  diet_plan: j.diet_plan,
  exercise_plan: j.exercise_plan,
  safety: { passed: true, red_flags: j.red_flags || [] },
  disclaimer: 'Preventive wellness guidance only — not medical diagnosis or treatment.'
} }];"""

    build_escalation_js = r"""return [{ json: {
  ok: false,
  http_status: 200,
  stage: 'safety_escalation',
  escalation: $json.escalation,
  red_flags: $json.red_flags,
  diet_plan: null,
  exercise_plan: null,
  disclaimer: 'Safety stop: seek licensed urgent or emergency care if appropriate.'
} }];"""

    webhook = {
        "parameters": {
            "httpMethod": "POST",
            "path": "healthgenie/onboarding",
            "responseMode": "responseNode",
            "options": {},
        },
        "id": nid(),
        "name": "Webhook Onboarding",
        "type": "n8n-nodes-base.webhook",
        "typeVersion": 2,
        "position": [0, 0],
        "webhookId": str(uuid.uuid4()),
    }

    respond = {
        "parameters": {
            "respondWith": "json",
            "responseBody": "={{ $json }}",
            "options": {"responseCode": 200},
        },
        "id": nid(),
        "name": "Respond To Client",
        "type": "n8n-nodes-base.respondToWebhook",
        "typeVersion": 1.4,
        "position": [1600, 200],
    }

    sticky = {
        "parameters": {
            "content": "## Optional LLM layer\nAdd **OpenAI** / **Anthropic** nodes after Ethnicity Context to rewrite meal copy using `prompts/diet_agent_prompt.md`.\nCreate credentials in n8n: **OpenAI API** or **Header Auth** for HTTP Request."
        },
        "id": nid(),
        "name": "Sticky LLM Placeholder",
        "type": "n8n-nodes-base.stickyNote",
        "typeVersion": 1,
        "position": [400, -200],
    }

    nodes = [
        webhook,
        code_node("Normalize Profile", [240, 0], normalize_js),
        code_node("Validate Profile", [480, 0], validate_js),
        if_node("IF Profile Valid", [720, 0], "={{ $json.is_valid }}", "boolean", "true", single=True),
        code_node("Build Validation Response", [960, 220], build_invalid_js),
        code_node("Compute Wellness Indicators", [960, -80], risk_js),
        code_node("Ethnicity Family Context", [1200, -80], ethnicity_js),
        code_node("Generate Diet Plan", [1440, -80], diet_js),
        code_node("Generate Exercise Plan", [1680, -80], exercise_js),
        code_node("Run Safety Filter", [1920, -80], safety_js),
        if_node("IF Safe To Continue", [2160, -80], "={{ $json.safe_to_continue }}", "boolean", "true", single=True),
        code_node("Build Success Response", [2400, -180], build_success_js),
        code_node("Build Escalation Response", [2400, 40], build_escalation_js),
        respond,
        sticky,
    ]

    connections = {
        "Webhook Onboarding": {"main": [[{"node": "Normalize Profile", "type": "main", "index": 0}]]},
        "Normalize Profile": {"main": [[{"node": "Validate Profile", "type": "main", "index": 0}]]},
        "Validate Profile": {"main": [[{"node": "IF Profile Valid", "type": "main", "index": 0}]]},
        "IF Profile Valid": {
            "main": [
                [{"node": "Compute Wellness Indicators", "type": "main", "index": 0}],
                [{"node": "Build Validation Response", "type": "main", "index": 0}],
            ]
        },
        "Build Validation Response": {"main": [[{"node": "Respond To Client", "type": "main", "index": 0}]]},
        "Compute Wellness Indicators": {"main": [[{"node": "Ethnicity Family Context", "type": "main", "index": 0}]]},
        "Ethnicity Family Context": {"main": [[{"node": "Generate Diet Plan", "type": "main", "index": 0}]]},
        "Generate Diet Plan": {"main": [[{"node": "Generate Exercise Plan", "type": "main", "index": 0}]]},
        "Generate Exercise Plan": {"main": [[{"node": "Run Safety Filter", "type": "main", "index": 0}]]},
        "Run Safety Filter": {"main": [[{"node": "IF Safe To Continue", "type": "main", "index": 0}]]},
        "IF Safe To Continue": {
            "main": [
                [{"node": "Build Success Response", "type": "main", "index": 0}],
                [{"node": "Build Escalation Response", "type": "main", "index": 0}],
            ]
        },
        "Build Success Response": {"main": [[{"node": "Respond To Client", "type": "main", "index": 0}]]},
        "Build Escalation Response": {"main": [[{"node": "Respond To Client", "type": "main", "index": 0}]]},
    }

    wf = {
        "name": "HealthGenie — Onboarding (Full Pipeline)",
        "nodes": nodes,
        "connections": connections,
        "pinData": {},
        "settings": {"executionOrder": "v1"},
        "staticData": None,
        "meta": {"templateCredsSetupCompleted": False},
        "tags": [],
    }
    fix_respond_codes(wf)
    return wf


def build_daily_plan() -> dict:
    risk_js = r"""const p = $json.profile || {};
const h = (Number(p.height_cm) || 0) / 100;
const w = Number(p.weight_kg) || 0;
const bmi = (h > 0) ? +(w / (h*h)).toFixed(1) : null;
const risks = [];
if (bmi && bmi >= 30) risks.push('weight_management_risk:high');
else if (bmi && bmi >= 25) risks.push('weight_management_risk:moderate');
if (String(p.family_history || '').toLowerCase().includes('diabetes')) risks.push('diabetes_lifestyle_risk:elevated');
if (String(p.activity_level || '').toLowerCase() === 'low') risks.push('low_activity_risk:elevated');
if (Number(p.age) >= 45) risks.push('cardiometabolic_prevention_focus:recommended');
return [{ json: { ...$json, bmi, wellness_risks: risks } }];"""

    diet_js = r"""const p = $json.profile || {};
const goal = p.goal || 'maintain';
const baseCalories = goal === 'weight_loss' ? 1800 : (goal === 'muscle_gain' ? 2400 : 2100);
const proteinG = Math.round((Number(p.weight_kg) || 70) * (goal === 'muscle_gain' ? 1.8 : 1.2));
const vegetarian = String(p.diet_pref || '').toLowerCase().includes('vegetarian');
const plan = {
  calories_target: baseCalories,
  protein_target_g: proteinG,
  meals: [
    vegetarian ? 'Greek yogurt + berries + nuts' : 'Eggs + whole grain toast + fruit',
    vegetarian ? 'Lentil bowl + vegetables + brown rice' : 'Grilled chicken + quinoa + vegetables',
    vegetarian ? 'Tofu/paneer + mixed vegetables + salad' : 'Fish + vegetables + olive oil salad'
  ]
};
return [{ json: { ...$json, diet_plan: plan } }];"""

    exercise_js = r"""const p = $json.profile || {};
const low = String(p.activity_level || '').toLowerCase() === 'low';
const jointPain = String(p.medical_constraints || '').toLowerCase().includes('joint');
let cardio = low ? '20-30 min brisk walk, 5x/week' : '30-40 min mixed cardio, 4-5x/week';
if (jointPain) cardio = 'Low-impact cardio (walk/cycle/swim), 5x/week';
const plan = {
  weekly_plan: [cardio, 'Strength training 2-3x/week', 'Mobility and stretching 10 min daily'],
  avoid: jointPain ? ['High-impact running', 'Deep loaded knee flexion'] : []
};
return [{ json: { ...$json, exercise_plan: plan } }];"""

    safety_js = r"""const text = JSON.stringify($json).toLowerCase();
const redFlags = ['chest pain','fainting','severe shortness of breath','very high blood sugar','very high blood pressure','sudden weakness','severe allergic reaction'];
const hits = redFlags.filter(r => text.includes(r));
if (hits.length) {
  return [{ json: { safe_to_continue: false, red_flags: hits, escalation: 'Possible urgent symptoms detected. Seek immediate medical care or call emergency services.', stage: 'safety_escalation' } }];
}
return [{ json: { ...$json, safe_to_continue: true, red_flags: [] } }];"""

    set_mock_js = r"""return [{ json: {
  profile: {
    user_id: 'MOCK_SCHEDULED',
    age: 45,
    gender: 'male',
    height_cm: 173,
    weight_kg: 86,
    activity_level: 'low',
    goal: 'weight_loss',
    diet_pref: 'vegetarian',
    allergies: 'none',
    ethnicity: 'south_asian',
    family_history: 'diabetes',
    medical_constraints: 'none'
  }
} }];"""

    build_daily_out_js = r"""const j = $json;
return [{ json: {
  ok: j.safe_to_continue !== false,
  stage: j.safe_to_continue === false ? 'safety_escalation' : 'daily_plan_ready',
  generated_at: new Date().toISOString(),
  profile_summary: { bmi: j.bmi, wellness_risks: j.wellness_risks },
  diet_plan: j.diet_plan,
  exercise_plan: j.exercise_plan,
  escalation: j.escalation || null,
  red_flags: j.red_flags || [],
  note: 'Replace Set Mock Active User with Supabase/Postgres fetch for real users.'
} }];"""

    manual = {
        "parameters": {},
        "id": nid(),
        "name": "Manual Test Trigger",
        "type": "n8n-nodes-base.manualTrigger",
        "typeVersion": 1,
        "position": [0, 200],
    }
    schedule = {
        "parameters": {"rule": {"interval": [{"field": "cronExpression", "expression": "0 7 * * *"}]}},
        "id": nid(),
        "name": "Schedule Morning 7am",
        "type": "n8n-nodes-base.scheduleTrigger",
        "typeVersion": 1.2,
        "position": [0, 400],
    }

    nodes = [
        manual,
        schedule,
        code_node("Set Mock Active User", [280, 300], set_mock_js),
        code_node("Compute Wellness Indicators", [520, 300], risk_js),
        code_node("Generate Diet Plan", [760, 300], diet_js),
        code_node("Generate Exercise Plan", [1000, 300], exercise_js),
        code_node("Run Safety Filter", [1240, 300], safety_js),
        code_node("Build Daily Plan Output", [1480, 300], build_daily_out_js),
        {
            "parameters": {
                "content": "## Wire your datastore\nReplace **Set Mock Active User** with **Postgres** / **Supabase** node.\nAdd **FCM** / **Twilio** after Build Daily Plan Output for push."
            },
            "id": nid(),
            "name": "Sticky Data And Notify",
            "type": "n8n-nodes-base.stickyNote",
            "typeVersion": 1,
            "position": [240, 80],
        },
    ]

    connections = {
        "Manual Test Trigger": {"main": [[{"node": "Set Mock Active User", "type": "main", "index": 0}]]},
        "Schedule Morning 7am": {"main": [[{"node": "Set Mock Active User", "type": "main", "index": 0}]]},
        "Set Mock Active User": {"main": [[{"node": "Compute Wellness Indicators", "type": "main", "index": 0}]]},
        "Compute Wellness Indicators": {"main": [[{"node": "Generate Diet Plan", "type": "main", "index": 0}]]},
        "Generate Diet Plan": {"main": [[{"node": "Generate Exercise Plan", "type": "main", "index": 0}]]},
        "Generate Exercise Plan": {"main": [[{"node": "Run Safety Filter", "type": "main", "index": 0}]]},
        "Run Safety Filter": {"main": [[{"node": "Build Daily Plan Output", "type": "main", "index": 0}]]},
    }

    wf = {
        "name": "HealthGenie — Daily Plan Generation",
        "nodes": nodes,
        "connections": connections,
        "pinData": {},
        "settings": {"executionOrder": "v1"},
        "staticData": None,
        "meta": {"templateCredsSetupCompleted": False},
        "tags": [],
    }
    fix_respond_codes(wf)
    return wf


def build_checkpoint() -> dict:
    parse_cp_js = r"""const root = $json.body ?? $json;
const body = (typeof root === 'object' && root !== null) ? root : {};
const required = ['activity_done','steps','energy','sleep_quality','pain_reported','meal_adherence'];
const missing = required.filter(k => body[k] === undefined || body[k] === null || String(body[k]).trim() === '');
return [{ json: { checkpoint: body, missing_fields: missing } }];"""

    adapt_js = r"""const c = $json.checkpoint || {};
const updates = [];
if (String(c.pain_reported || '').toLowerCase().includes('knee')) {
  updates.push('Reduce impact activities');
  updates.push('Replace running with walking/cycling');
  updates.push('Add 10-minute mobility routine');
}
if (Number(c.energy) <= 2) updates.push('Lower training intensity by 20% for next session');
if (Number(c.sleep_quality) <= 2) updates.push('Focus on sleep hygiene and earlier workout timing');
if (String(c.meal_adherence || '').toLowerCase() === 'low') updates.push('Simplify meals and add prep-friendly options');
return [{ json: { ...$json, adaptive_updates: updates, next_day_plan_adjusted: updates.length > 0 } }];"""

    progress_js = r"""const c = $json.checkpoint || {};
let score = 0;
if (c.activity_done === true || String(c.activity_done).toLowerCase() === 'yes') score += 1;
if (Number(c.steps) >= 5000) score += 1;
if (String(c.meal_adherence || '').toLowerCase() === 'high') score += 1;
return [{ json: { ...$json, adherence_score: score } }];"""

    safety_cp_js = r"""const text = JSON.stringify($json.checkpoint || {}).toLowerCase();
const redFlags = ['chest pain','fainting','severe shortness of breath','very high blood sugar','very high blood pressure','sudden weakness','severe allergic reaction'];
const hits = redFlags.filter(r => text.includes(r));
if (hits.length) {
  return [{ json: { ...$json, safe_to_continue: false, red_flags: hits, escalation: 'Possible urgent symptoms detected. Seek immediate medical care or call emergency services.' } }];
}
return [{ json: { ...$json, safe_to_continue: true, red_flags: [] } }];"""

    build_cp_missing_js = r"""return [{ json: {
  ok: false,
  http_status: 422,
  stage: 'checkpoint_incomplete',
  missing_fields: $json.missing_fields,
  message: 'Please answer all checkpoint fields.'
} }];"""

    build_cp_ok_js = r"""const j = $json;
return [{ json: {
  ok: j.safe_to_continue !== false,
  http_status: 200,
  stage: j.safe_to_continue === false ? 'safety_escalation' : 'checkpoint_processed',
  adherence_score: j.adherence_score,
  adaptive_updates: j.adaptive_updates,
  next_day_plan_adjusted: j.next_day_plan_adjusted,
  escalation: j.escalation || null,
  red_flags: j.red_flags || [],
  disclaimer: 'Preventive wellness guidance only.'
} }];"""

    webhook_cp = {
        "parameters": {
            "httpMethod": "POST",
            "path": "healthgenie/checkpoint",
            "responseMode": "responseNode",
            "options": {},
        },
        "id": nid(),
        "name": "Webhook Checkpoint",
        "type": "n8n-nodes-base.webhook",
        "typeVersion": 2,
        "position": [0, 0],
        "webhookId": str(uuid.uuid4()),
    }

    respond_cp = {
        "parameters": {
            "respondWith": "json",
            "responseBody": "={{ $json }}",
            "options": {"responseCode": 200},
        },
        "id": nid(),
        "name": "Respond Checkpoint",
        "type": "n8n-nodes-base.respondToWebhook",
        "typeVersion": 1.4,
        "position": [1920, 0],
    }

    nodes = [
        webhook_cp,
        code_node("Parse Checkpoint", [240, 0], parse_cp_js),
        if_node(
            "IF Checkpoint Complete",
            [480, 0],
            "={{ ($json.missing_fields || []).length === 0 }}",
            "boolean",
            "true",
            single=True,
        ),
        code_node("Build Missing Checkpoint Response", [720, 200], build_cp_missing_js),
        code_node("Adapt Next-Day Plan", [720, -80], adapt_js),
        code_node("Progress Analyzer", [960, -80], progress_js),
        code_node("Safety On Checkpoint Text", [1200, -80], safety_cp_js),
        code_node("Build Checkpoint Response", [1440, -80], build_cp_ok_js),
        respond_cp,
    ]

    connections = {
        "Webhook Checkpoint": {"main": [[{"node": "Parse Checkpoint", "type": "main", "index": 0}]]},
        "Parse Checkpoint": {"main": [[{"node": "IF Checkpoint Complete", "type": "main", "index": 0}]]},
        "IF Checkpoint Complete": {
            "main": [
                [{"node": "Adapt Next-Day Plan", "type": "main", "index": 0}],
                [{"node": "Build Missing Checkpoint Response", "type": "main", "index": 0}],
            ]
        },
        "Build Missing Checkpoint Response": {"main": [[{"node": "Respond Checkpoint", "type": "main", "index": 0}]]},
        "Adapt Next-Day Plan": {"main": [[{"node": "Progress Analyzer", "type": "main", "index": 0}]]},
        "Progress Analyzer": {"main": [[{"node": "Safety On Checkpoint Text", "type": "main", "index": 0}]]},
        "Safety On Checkpoint Text": {"main": [[{"node": "Build Checkpoint Response", "type": "main", "index": 0}]]},
        "Build Checkpoint Response": {"main": [[{"node": "Respond Checkpoint", "type": "main", "index": 0}]]},
    }

    wf = {
        "name": "HealthGenie — Daily Checkpoint Loop",
        "nodes": nodes,
        "connections": connections,
        "pinData": {},
        "settings": {"executionOrder": "v1"},
        "staticData": None,
        "meta": {"templateCredsSetupCompleted": False},
        "tags": [],
    }
    fix_respond_codes(wf)
    return wf


def main() -> None:
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    out_dir = os.path.join(root, "n8n_flows", "export")
    os.makedirs(out_dir, exist_ok=True)

    w1 = build_onboarding()
    w2 = build_daily_plan()
    w3 = build_checkpoint()

    files = [
        ("01_healthgenie_onboarding.full.json", w1),
        ("02_healthgenie_daily_plan_generation.full.json", w2),
        ("03_healthgenie_daily_checkpoint.full.json", w3),
        ("healthgenie_all_workflows.bundle.json", [w1, w2, w3]),
    ]

    for name, obj in files:
        path = os.path.join(out_dir, name)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(obj, f, indent=2)
            f.write("\n")
        print("wrote", path)


if __name__ == "__main__":
    main()
