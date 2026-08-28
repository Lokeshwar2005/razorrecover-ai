# RazorRecover AI: Claude + Razorpay MCP

## Target architecture

```text
Failed payment
    ↓
Claude / Anthropic
  diagnosis + recommendation
    ↓
RazorRecover deterministic policy gate
  risk · retry limit · bounded playbook
    ↓
Allowed action only
    ↓
Razorpay test-mode / MCP tool
  Payment Link · payment/order status · refund/etc.
    ↓
Verification
    ↓
Audit trail + recovered revenue
```

The browser must never contain Razorpay API secrets or an Anthropic API key. The AI/API layer belongs on a trusted server.

## Claude configuration

Set these server-side variables:

```bash
ANTHROPIC_API_KEY=...
ANTHROPIC_MODEL=claude-sonnet-5
```

The current app calls `/api/ai/recovery`. When hosted separately from the frontend, set `VITE_AI_API_URL` to the HTTPS API endpoint.

## Razorpay MCP

Razorpay's official Remote MCP endpoint is:

```text
https://mcp.razorpay.com/mcp
```

Use Razorpay **test-mode** credentials while developing. Configure MCP in the trusted AI/server environment, not in React/browser code.

For Claude Code, Razorpay documents the HTTP configuration as:

```bash
claude mcp add --transport http razorpay https://mcp.razorpay.com/mcp \
  --header "Authorization: Basic <your-base64-encoded-key-secret>"
```

The MCP server exposes payment, Payment Link, order, refund, settlement, payout and QR-code tools. RazorRecover should only invoke a money-moving tool after its deterministic policy gate returns `executionAllowed: true`.

## Safety contract

Claude can recommend an action, but it cannot override:

- risk threshold
- maximum retry count
- escalation rules
- bounded recovery playbook
- verification requirement
- audit logging

A recommendation that conflicts with the policy engine must be shown as **POLICY BLOCKED** and must not execute a Razorpay operation.

## Deployment

The AI endpoint is provided as a Vercel-compatible serverless function at `api/ai/recovery.js`. GitHub Pages remains suitable for the static frontend, but it cannot safely host the server-side API key. For a live AI demo, deploy the API function to a trusted backend (for example Vercel) and point `VITE_AI_API_URL` at it.
