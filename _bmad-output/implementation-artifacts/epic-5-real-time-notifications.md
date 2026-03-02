# Epic 5: Real-time Notifications

> **⚠️ Epic Numbering Note**: This supplemental file was numbered from the securities-order domain and corresponds to **Epic 7 in epics.md: Channel Notifications, Admin, Channel Security**. The canonical story authority is always `_bmad-output/planning-artifacts/epics.md`.


## Summary

Order execution results are delivered immediately to the user via SSE (Server-Sent Events). If the connection is lost, automatic reconnection is attempted 3 times, and missing notifications can be retrieved via a fallback API after reconnection. Order results can be checked even after closing and reopening the browser tab.

**FRs covered:** FR-30, FR-31, FR-32  
**Architecture requirements:** SseNotificationService(@Async), NotificationController(/api/v1/notifications/stream), V3 Flyway(notification table), SSE reconnection 3 times fallback, GET /api/v1/portfolio/{id}/orders(fallback API)  
**Frontend:** NotificationContext.tsx(SSE + 3 retries + error display), useNotification.ts

---

## Story 5.1: SSE Notification Backend

As a **system**,  
I want to push order result notifications to connected clients in real time and persist them for fallback retrieval,  
So that users receive immediate feedback and can recover missed notifications after reconnection.

**Depends On:** Story 4.1 (Order completion event), Story 1.2 (Spring Session auth)

### Acceptance Criteria

**Given** `GET /api/v1/notifications/stream` (valid JSESSIONID cookie)  
**When** SSE connection established  
**Then** `Content-Type: text/event-stream;charset=UTF-8` response  
**And** `SseEmitter(Long.MAX_VALUE)` created — no timeout  
**And** send heartbeat event immediately on connect: `event: heartbeat\ndata: {}\n\n`  
**And** Single registration `memberId → SseEmitter` in `SseEmitterRegistry`  
**And** New connection with same `memberId` calls `SseEmitter.complete()` on existing one then replaces it (single connection guarantee)  
**And** remove from registry on connection termination (`onCompletion`, `onTimeout`)  
**And** Single instance assumption — multi-instance environment requires Redis pub/sub (out of current scope)

**Given** `CORS` config includes `allowCredentials=true` + SSE endpoint  
**When** Frontend `EventSource({ withCredentials: true })` connects  
**Then** `HttpOnly` cookie passed (session auth)

**Given** Order `FILLED` or `FAILED` event occurs (Story 4.1)  
**When** `NotificationService.send(memberId, notificationPayload)` called  
**Then** dual-write order: ① `channel_db.notifications` INSERT (persist) ② `SseEmitter.send()` (@Async)  
**And** SSE event format: `event: notification\ndata: {"notificationId":N,"type":"ORDER_FILLED","message":"Order of ₩X filled.","orderId":"UUID","createdAt":"ISO8601"}\n\n`  
**And** DB save success even if SSE client disconnected (FR-31)

**Given** `GET /api/v1/notifications` (valid JSESSIONID cookie)  
**When** notification list query  
**Then** HTTP 200: `{ content: [...], totalElements, ... }` paginated response (FR-32)  
**And** sorted by `createdAt DESC`, default `size=20`  
**And** includes `isRead` field

**Given** `PATCH /api/v1/notifications/{notificationId}/read`  
**When** notification mark as read  
**Then** HTTP 204, `notifications.is_read = true` update

**Given** `SseEmitter.send()` failure (client disconnected)  
**When** `IOException` occurs  
**Then** call `SseEmitter.completeWithError()` + remove from registry  
**And** DB record already committed (guaranteed by dual-write order)

**Given** `@Async SSE` integration test (using `@TestConfiguration` `SyncTaskExecutor`)  
**When** notification send after order completion test  
**Then** Verify DB save in async context using `Awaitility.await().atMost(3, SECONDS).until(() -> notificationRepository.count() > 0)`  
**And** `Thread.sleep()` usage forbidden in SSE tests

**Given** Notification retention policy  
**When** creating notification  
**Then** set `expires_at = orderSession.expiresAt + 24h` on save  
**And** `@Scheduled` daily cleanup: `DELETE WHERE created_at < now() - INTERVAL 25 HOUR`

**Given** `Flyway V3__create_notification_table.sql` (channel_db)  
**When** service startup  
**Then** `notifications` table created: `id, member_id, type, message, order_id, is_read, created_at, expires_at`

---

## Story 5.2: SSE Frontend — NotificationContext & Reconnection

As a **logged-in user**,  
I want real-time order notifications with automatic SSE reconnection,  
So that I receive immediate results without polling and never miss a notification after brief disconnection.

**Depends On:** Story 5.1, Story 1.7

### Acceptance Criteria

**Given** Authenticated user enters app (`<NotificationProvider>` mounted)  
**When** `useEffect` runs  
**Then** Single `EventSource` instance created (`withCredentials: true`)  
**And** on `event: notification` received, `dispatch({ type: 'ADD_NOTIFICATION', payload })` runs  
**And** Network tab shows `GET /api/v1/notifications/stream` as `EventStream` type

**Given** SSE disconnected (`onerror` event)  
**When** error detected  
**Then** Attempt 1st reconnection (1s delay)  
**And** if fail, 2nd attempt (2s), 3rd attempt (3s) — exponential backoff  
**And** Stop reconnection after 3 failures → Call `recoverOrderSession()` in `hooks/useOrderRecovery.ts`  
**And** Only if `recoverOrderSession()` API fails (404/403) display `data-testid="sse-error-msg"`: "Connection lost. Please refresh the page." (NFR-UX2)  
**And** On reconnection success, call `GET /api/v1/notifications?since={lastEventTime}` fallback to retrieve missing notifications (FR-31)

**Given** SSE `notification` event received after order completion  
**When** `NotificationContext` dispatch  
**Then** New notification immediately added to `data-testid="notification-item"` list (re-render)

**Given** NotificationFeed screen (`/notifications`)  
**When** Rendering  
**Then** Call `GET /api/v1/notifications` and display list  
**And** If empty list → Display "No notifications yet." empty state

**Given** Epic 2 Story 2.3 10s polling → SSE switch  
**When** `NotificationContext` receives SSE `notification` event  
**Then** `window.dispatchEvent(new CustomEvent('order-notification', { detail: notification }))` emitted
**And** `useOrder` hook: replace existing 10s polling `useEffect` with `addEventListener('order-notification', handler)` subscription
**And** Maintain same `dispatch` interface (no changes needed for `OrderModal`, `DashboardPage`)
**And** Include test verifying removal of Story 2.3 polling code

**Given** `hooks/useOrderRecovery.ts` shared hook (Story 4.4 & Story 5.2)  
**When** SSE 3-fail or dashboard recovery scenario  
**Then** Reuse same `recoverOrderSession()` function (no duplicate implementation)

**Given** `vitest` unit test with `MockEventSource` stub (`src/test/setup.ts`)  
**When** test execution  
**Then** Simulate `onerror` with `EventSource` mock → Verify 3 connection retries  
**And** Verify `recoverOrderSession()` call after 3 failures

**Given** Logout (`<NotificationProvider>` unmount)  
**When** cleanup runs  
**Then** `EventSource.close()` called to gracefully terminate SSE connection
