# Architecture Discussion: FEP Gateway vs. FEP Simulator

## 1. Requirement Analysis & Clarification
**User Feedback:** The current `planning-artifacts/fep/` describes the **Sim Counterpart FEP (Simulator)**. We are missing the design for the **Real FEP (Gateway)** (Internal System) that connects to this simulator.

**Consensus:**
- **System A: FEP Gateway (Internal)**: The actual application handling protocol translation, connection management, and secure communication with external networks.
- **System B: FEP Simulator (External)**: The test double (Sim Exchange/Network) simulating the behavior of external financial exchange institutions.

## 2. Architecture & Design (Winston - Architect)

We need to decouple the internal gateway logic from the external simulator logic.

### 2.1. Structural Changes
Current: `planning-artifacts/fep/` (contains simulator specs)
Proposed:
- `planning-artifacts/fep-simulator/` (Renamed from `fep/`)
- `planning-artifacts/fep-gateway/` (New directory for the internal system)

### 2.2. Responsibility Boundaries
| Feature | **FEP Gateway (Internal)** | **FEP Simulator (External)** |
| :--- | :--- | :--- |
| **Role** | Client / Initiator | Server / Responder |
| **Protocol** | Converts Internal JSON -> FIX 4.2/TCP | Parses FIX 4.2/TCP -> Internal Logic |
| **Connection** | Manages QuickFIX/J Session Pool, Keep-Alive | Accepts FIX Sessions, Heartbeat Response |
| **Security** | TLS_CERT/LOGON_PASSWORD (PKI/CA) | Validates FIX Logon credentials |
| **Routing** | Decides FIX Session based on SecurityExchange | N/A (It *is* the endpoint) |
| **Data Scope** | Canonical Order Record, Audit Log | Mock Accounts, Chaos Rules |

## 3. Schema Design (Amelia - Dev)

### 3.1. FEP Gateway Schema (Draft)
The FEP Gateway needs its own database to manage the "pipes" and "security", distinct from the business logic (Ledger/Account) or the simulator.

#### `fep_routing_config`
Determines where to send a request based on SecurityExchange (Tag 207) or Symbol prefix.
- `institution_code` (PK): 'KRX', 'KOSDAQ'
- `ip_address`: Target Host (FIX Simulator IP in dev)
- `port`: Target Port
- `protocol_type`: 'FIX42_TCP'
- `timeout_ms`: 3000

#### `fep_connection_pool`
Tracks active QuickFIX/J sessions (stateful FIX 4.2 TCP).
- `pool_id` (PK)
- `institution_code`: FK to routing_config
- `socket_status`: 'LOGGED_ON', 'DISCONNECTED', 'CONNECTING'
- `last_active_at`: Timestamp

#### `fep_key_management`
Stores TLS credentials for FIX session security (PKI/CA based).
- `key_index` (PK): Key Slot ID
- `institution_code`: FK
- `key_type`: 'TLS_CERT', 'LOGON_PASSWORD', 'ADMIN_TOKEN'
- `key_value_encrypted`: Encrypted credential blob
- `check_value`: Fingerprint / Hash for integrity check

#### `fep_transaction_journal`
The raw record of FIX messages sent and received (Audit Trail).
- `trace_id` (PK): ClOrdID (FIX Tag 11)
- `institution_code`: FK
- `message_type`: 'D' (NewOrderSingle), '8' (ExecutionReport), 'F' (OrderCancelRequest), '0' (Heartbeat)
- `request_payload`: Encrypted/Masked Payload
- `response_payload`: Encrypted/Masked Payload
- `response_code`: External Response Code (e.g., '0000', '9912')
- `latency_ms`: Time taken
- `created_at`: Timestamp

## 4. Testing Strategy (Quinn - QA)

- **Integration Testing:**
    - Spin up **FEP Simulator** (Dockerized).
    - Configure **FEP Gateway** to point to Simulator Localhost.
    - Trigger `Order` flow -> `Account Service` -> `FEP Gateway` -> `FIX Simulator (KRX/KOSDAQ)`.
- **Chaos Testing:**
    - Update `simulator_rules` in the Simulator DB to drop 50% of packets.
    - Verify `FEP Gateway` handles timeouts and triggers OrderCancelRequest (`F`) correctly.
- **Protocol validation:**
    - Verify `fep_transaction_journal` in Gateway matches `sim_fep_messages` in Simulator.

## 5. Execution Plan

1.  **Move** existing artifacts from `planning-artifacts/fep/` to `planning-artifacts/fep-simulator/` (User confirms this is the Simulator).
2.  **Create** `planning-artifacts/fep-gateway/` directory.
3.  **Create** `planning-artifacts/fep-gateway/gateway_schema.md` containing the schema drafted above.
4.  **Create** `planning-artifacts/fep-gateway/gateway_architecture.md` describing the interaction flow.
