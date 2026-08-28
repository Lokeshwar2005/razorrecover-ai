# RazorRecover AI

> Autonomous, explainable revenue recovery for failed payments.

RazorRecover AI is a high-performance fintech control room prototype for the Razorpay AI Buildathon — **AI Revenue Recovery** track.

## Product loop

**Detect → Diagnose → Decide → Recover → Verify**

The system is designed around bounded autonomy: the AI can recommend a recovery action, but a deterministic policy layer remains the final gate for money-moving actions.

## Prototype principles

- Fast first render and minimal runtime dependencies
- Responsive desktop/mobile experience
- Synthetic data for the public demo
- Graceful fallback when external AI/API services are unavailable
- Explainable decisions and visible policy gates
- Audit-ready recovery events
- Three.js reserved for focused 3D enhancement rather than making the whole UI dependent on WebGL

## Roadmap

- [x] Premium command-center UI foundation
- [x] 100-transaction simulation shell
- [x] Recovery metrics and event stream
- [x] Bounded-policy presentation
- [ ] Deterministic transaction engine
- [ ] AI diagnosis + recovery agent
- [ ] Razorpay Test Mode integration
- [ ] Persistent audit event store
- [ ] Focused 3D revenue-recovery core
- [ ] Production deployment + performance testing

## Development

```bash
npm install
npm run dev
```

Build:

```bash
npm run build
```

## Security

Never commit API keys, tokens, credentials, or real customer/payment data. Public prototype data is synthetic.
