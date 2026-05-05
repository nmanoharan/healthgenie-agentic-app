# HealthGenie End-to-End Test Plan

## Test Objective
Validate onboarding, personalized planning, checkpoint adaptation, and safety escalation across mock user profiles.

## Test Cases

### TC-01: Standard Onboarding Success
- Input: Valid profile (age 35, moderate activity, vegetarian)
- Expected:
  - Profile stored successfully
  - BMI calculated
  - Risk summary generated
  - Initial diet and exercise recommendations returned

### TC-02: Missing Required Fields
- Input: Missing height and activity level
- Expected:
  - Validation agent requests follow-up inputs
  - No plan generated until required fields complete

### TC-03: Unrealistic Value Confirmation
- Input: Weight 900 lb entered accidentally
- Expected:
  - Validation agent requests user confirmation
  - Plan generation paused until corrected

### TC-04: Family History Personalization
- Input: South Asian + family diabetes history
- Expected:
  - Risk focus includes glucose prevention and post-meal movement
  - Diet plan emphasizes low glycemic combinations

### TC-05: Exercise Adaptation from Pain Report
- Input: User reports knee pain in checkpoint
- Expected:
  - Adaptive plan reduces impact-heavy activity
  - Replaces running with low-impact alternatives

### TC-06: Safety Red Flag Escalation
- Input: User reports chest pain and fainting
- Expected:
  - Safety agent blocks wellness advice
  - Escalation message shown immediately
  - Event logged for follow-up

## Success Criteria
- All critical flows execute without unsafe outputs
- Safety agent always supersedes planning agents
- Adaptive loop updates next-day plan using checkpoint history
