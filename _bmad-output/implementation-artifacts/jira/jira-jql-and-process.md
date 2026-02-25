# Jira Registration Process and JQL

Date: 2026-02-25  
Scope: Register BMAD stories (Epic 0~10, Story 70개) into existing Jira project `FIX`.

## 1) Canonical Artifacts

- Active files for current FIX import UI:
  - `_bmad-output/implementation-artifacts/jira/jira-epics-import-active.csv`
  - `_bmad-output/implementation-artifacts/jira/jira-stories-import-epic-link-label-columns.csv`
  - `_bmad-output/implementation-artifacts/jira/jira-epic-key-map-template.csv`

## 2) Generation Commands

```bash
cd /Users/yeongjae/fixyz
node ./scripts/generate-jira-artifacts.mjs
node ./scripts/apply-jira-epic-map.mjs
```

Notes:
- `generate-jira-artifacts.mjs` now preserves existing `Jira Epic Key` values in `jira-epic-key-map-template.csv`.
- `apply-jira-epic-map.mjs` now generates both `jira-stories-import-final.csv` and `jira-stories-import-active.csv`.
- 현재 운영 기준은 `*-active.csv` 두 파일이며, core CSV는 필요 시 스크립트로 재생성합니다.

## 3) FIX Upload Flow (Final)

1. Import Epics into existing `FIX` project using `jira-epics-import-active.csv`.
2. Verify Epic keys and update `jira-epic-key-map-template.csv` (`EPIC-x -> FIX-xx`).
3. Run `node ./scripts/apply-jira-epic-map.mjs`.
4. Import Stories using `jira-stories-import-epic-link-label-columns.csv` with `Epic Link` mapping.
5. Run validation JQL and confirm no orphan stories.

If Epics were imported as `Task` accidentally:
- Detect:
```jql
project = FIX AND issuetype = Task AND labels = epic-ready ORDER BY key ASC
```
- Convert with bulk `Move` to `Epic` (or delete/re-import if cross-hierarchy conversion is blocked).

## 4) Current FIX Epic Key Map Snapshot

- `EPIC-0 -> FIX-16`
- `EPIC-1 -> FIX-17`
- `EPIC-2 -> FIX-18`
- `EPIC-3 -> FIX-19`
- `EPIC-4 -> FIX-20`
- `EPIC-5 -> FIX-21`
- `EPIC-6 -> FIX-22`
- `EPIC-7 -> FIX-23`
- `EPIC-8 -> FIX-24`
- `EPIC-9 -> FIX-25`
- `EPIC-10 -> FIX-26`

## 5) Validation JQL

All queries below assume project key `FIX`.

### 5.1 Baseline Count

```jql
project = FIX AND issuetype = Epic ORDER BY key ASC
```

```jql
project = FIX AND issuetype = Story ORDER BY key ASC
```

### 5.2 Link/Parent Integrity

Company-managed:
```jql
project = FIX AND issuetype = Story AND "Epic Link" is EMPTY
```

Team-managed / active import path:
```jql
project = FIX AND issuetype = Story AND parent is EMPTY
```

### 5.3 Status Queue

```jql
project = FIX AND issuetype = Story AND labels = bmad-status-ready-for-dev ORDER BY Rank ASC
```

```jql
project = FIX AND issuetype = Story AND labels = bmad-status-in-progress ORDER BY updated DESC
```

```jql
project = FIX AND issuetype = Story AND labels = bmad-status-review ORDER BY updated DESC
```

### 5.4 Story 0.5 (Webhook) Check

```jql
project = FIX AND issuetype = Story AND labels = story-0-5
```

```jql
project = FIX AND issuetype = Story AND labels = story-0-5 AND labels = bmad-status-ready-for-dev
```

## 6) Operational Checklist

- [ ] Epic 11개 생성 확인
- [ ] Story 70개 생성 확인
- [ ] Story `parent` 또는 `Epic Link` 누락 0건
- [ ] `bmad-status-ready-for-dev` 건수와 `sprint-status.yaml` 동기화 확인
- [ ] Story 0.5는 1안(직접 연동, no relay) 기준으로 검증
