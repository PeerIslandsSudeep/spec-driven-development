<!--
  SYNC IMPACT REPORT
  ==================
  Version change: (none) → 1.0.0
  Added principles:
    - I. Spec Is the Source of Truth (new)
    - II. Spec Before Code (new)
    - III. Human-Reviewable Specs (new)
    - IV. Layered Specification Hierarchy (new)
    - V. Minimal Specification (new)
    - VI. Continuous Validation (new)
    - VII. MongoDB-First Data Modeling (new)
  Added sections: Core Principles, Development Workflow, Governance
  Removed sections: none (initial ratification)
  Templates reviewed:
    - .specify/templates/plan-template.md ✅ no changes required (Constitution Check is dynamic)
    - .specify/templates/spec-template.md ✅ no changes required
    - .specify/templates/tasks-template.md ✅ no changes required
  Deferred TODOs: none
-->

# SmartInvoice Constitution

## Core Principles

### I. Spec Is the Source of Truth

Every feature, data model, and behaviour in SmartInvoice MUST be defined in a specification
document before it exists in code. The spec—not the implementation—governs what the system does.
When code and spec conflict, the spec wins and the code MUST be corrected.

**Rationale**: Prevents specification drift and ensures any contributor can understand the intended
system from `.specify/specs/` without reading implementation files.

### II. Spec Before Code

No implementation work MAY begin without an approved, human-readable specification. The sequence
is invariant: specify → clarify → plan → implement. Skipping or reversing steps is a constitution
violation requiring an explicit waiver and justification recorded in the plan.

**Rationale**: Forces requirements clarity upfront, reducing rework and ensuring AI-assisted
generation targets well-defined outcomes.

### III. Human-Reviewable Specs

Specifications MUST be written in plain Markdown understandable by a non-technical business
stakeholder. Acceptance scenarios MUST use Given/When/Then form. Technical jargon, code snippets,
and schema details belong in plan artifacts (data-model.md, contracts/), not in spec.md.

**Rationale**: Indian SMB domain owners—the primary users of SmartInvoice—need to validate
requirements. Specs they cannot read cannot be verified.

### IV. Layered Specification Hierarchy

Specifications MUST follow the four-layer hierarchy in strict order:

1. **Constitution** — immutable governance (this document)
2. **Feature Spec** (`spec.md`) — what and why, technology-agnostic
3. **Implementation Plan** (`plan.md`, `data-model.md`, `contracts/`) — how, technology-specific
4. **Tasks** (`tasks.md`) — atomic work items derived from the plan

Lower layers MUST NOT contradict higher layers. Amendments propagate downward; changes to plan
artifacts do not modify the spec.

**Rationale**: Prevents lower-level decisions from leaking upward and corrupting business
requirements.

### V. Minimal Specification

Specs MUST capture only what is necessary to build and validate a feature. Gold-plating,
speculative requirements, and future-proofing language ("may later support…") are prohibited.
Every requirement MUST map to at least one acceptance scenario.

**Rationale**: YAGNI applied to specifications. Excess requirements increase implementation scope
without delivering validated user value.

### VI. Continuous Validation

Every spec MUST include measurable success criteria. Tasks marked complete MUST satisfy all
acceptance scenarios in the associated spec before the feature branch is merged. Validation gates
(Constitution Check in plan.md) MUST be completed and signed off before Phase 0 research begins.

**Rationale**: Ensures the spec-driven process produces verifiable outcomes, not just documents.

### VII. MongoDB-First Data Modeling

MongoDB Atlas is the system of record for SmartInvoice. Data modeling MUST follow
document-oriented principles:

- Model data so documents reflect query patterns, not normalized relational tables.
- Embedding is the default; referencing (DBRef or manual `_id` links) requires explicit
  justification in `data-model.md`.
- Every collection MUST have a defined schema validation document (`$jsonSchema`) in the data
  model artifact.
- Atlas Search, Atlas Vector Search, and Aggregation Pipelines are preferred over
  application-side joins or in-memory aggregation.
- Schema evolution MUST be backward-compatible or include an explicit migration plan in the
  implementation plan.

**Rationale**: Modeling against MongoDB's strengths—rich documents, flexible schema, Atlas
services—avoids an impedance mismatch that would degrade performance and developer experience
for the Indian SMB invoicing domain.

## Development Workflow

Feature development MUST follow this sequence:

1. `/speckit.specify` — write spec.md (user scenarios, requirements, success criteria)
2. `/speckit.clarify` — resolve ambiguities; output: annotated spec.md
3. `/speckit.plan` — produce plan.md, research.md, data-model.md, contracts/
4. `/speckit.tasks` — generate tasks.md from plan artifacts
5. `/speckit.implement` — implement task by task; validate against spec after each user story

All feature branches MUST be prefixed `###-feature-name` per the plan template convention.
Merges to `main` require all acceptance scenarios in spec.md to pass.

## Governance

This constitution supersedes all other development practices and guidelines for SmartInvoice.
Amendments require:

1. A proposed change authored on a dedicated feature branch.
2. At least one human reviewer approval (in addition to the author).
3. A version bump per semantic versioning:
   - **MAJOR**: Principle removal, redefinition, or backward-incompatible governance change.
   - **MINOR**: New principle or section added, or material expansion of an existing principle.
   - **PATCH**: Clarification, wording refinement, or typo fix with no semantic change.
4. A migration plan if the amendment invalidates existing specs or data models.

All PRs MUST include a Constitution Check section in `plan.md` confirming compliance with all
seven principles. Complexity violations MUST be tracked in the Complexity Tracking table in
plan.md.

**Version**: 1.0.0 | **Ratified**: 2026-04-21 | **Last Amended**: 2026-04-21
