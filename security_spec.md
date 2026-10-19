# Security Specification & Dirty Dozen Payloads

## 1. Data Invariants
1. **Strict Ownership Isolation**: Every document under `/users/{userId}` and its subcollections (`sessions`, `messages`, `vocabulary`, `dailyActivity`) may ONLY be read or written by the authenticated user whose `request.auth.uid == userId` and `request.auth.token.email_verified == true`.
2. **Immutable Identity & Creation Fields**: `uid`, `userId`, `id`, `sessionId`, `dateKey`, and `createdAt` cannot be modified once created.
3. **Server Timestamp Enforcement**: `createdAt` must equal `request.time` on creation, and `updatedAt` must equal `request.time` on both creation and update.
4. **Volumetric & Key Bounds**: Every document write must strictly match the allowed keys via `.keys().hasAll(...)` and `.keys().hasOnly(...)`, and every string field must adhere to its maximum character length from `firebase-blueprint.json`.
5. **Relational Integrity**: Subcollection documents (`sessions`, `vocabulary`, `dailyActivity`) require the parent `/users/{userId}` document to exist, and `messages` require `/users/{userId}/sessions/{sessionId}` to exist.

## 2. The "Dirty Dozen" Payloads
1. **Unauthenticated Write**: Writing to `/users/user_1` with `request.auth == null` -> `PERMISSION_DENIED`.
2. **Unverified Email Spoof**: Writing to `/users/user_1` where `email_verified == false` -> `PERMISSION_DENIED`.
3. **Cross-Tenant Profile Read (PII Leak)**: Authenticated `user_2` reading `/users/user_1` -> `PERMISSION_DENIED`.
4. **Cross-Tenant Session Creation**: Authenticated `user_2` creating `/users/user_1/sessions/sess_1` -> `PERMISSION_DENIED`.
5. **Shadow / Ghost Field Injection**: Updating `/users/user_1` with extra field `{"isAdmin": true}` -> `PERMISSION_DENIED`.
6. **Value Poisoning (Oversized String)**: Creating a message with `content` length > 4000 chars -> `PERMISSION_DENIED`.
7. **ID Poisoning**: Creating a document with path ID containing spaces or special characters (`sess$123!`) -> `PERMISSION_DENIED`.
8. **Immutable Field Mutation**: Updating `createdAt` or `userId` on an existing session document -> `PERMISSION_DENIED`.
9. **Client Timestamp Forgery**: Creating a profile where `createdAt` is a client-forged past/future timestamp (`!= request.time`) -> `PERMISSION_DENIED`.
10. **Orphaned Subcollection Write**: Creating `/users/user_1/sessions/sess_1` when `/users/user_1` does not exist -> `PERMISSION_DENIED`.
11. **Unauthorized List Scraping**: Listing `/users/user_1/sessions` where `resource.data.userId != request.auth.uid` -> `PERMISSION_DENIED`.
12. **Enum Violation**: Setting `theme: "neon-hacker"` outside `["light", "dark", "system"]` -> `PERMISSION_DENIED`.
