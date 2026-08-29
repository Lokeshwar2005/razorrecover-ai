from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session
from typing import List, Optional
import json
import csv
import io

from backend.app.db.session import get_db
from backend.app.db.models import AuditEventModel, AgentTraceModel
from backend.app.schemas.domain import AuditEventResponse, AgentTraceResponse, AgentTraceStep
from backend.app.services.audit.ledger import AuditLedgerService

router = APIRouter(tags=["Audit & Agent Trace"])


@router.get("/audit/events", response_model=List[AuditEventResponse])
def list_all_audit_events(
    limit: int = Query(100, ge=1, le=500),
    event_type: Optional[str] = Query(None),
    transaction_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    query = db.query(AuditEventModel)
    if event_type:
        query = query.filter(AuditEventModel.event_type == event_type)
    if transaction_id:
        query = query.filter(AuditEventModel.transaction_id == transaction_id)
    
    events = query.order_by(AuditEventModel.recorded_at.desc()).limit(limit).all()
    
    result: List[AuditEventResponse] = []
    for ev in events:
        meta = json.loads(ev.metadata_json) if ev.metadata_json else {}
        result.append(
            AuditEventResponse(
                id=ev.id,
                transaction_id=ev.transaction_id,
                event_type=ev.event_type,
                actor=ev.actor,
                decision=ev.decision,
                reason=ev.reason,
                metadata=meta,
                prev_event_hash=ev.prev_event_hash,
                event_hash=ev.event_hash,
                recorded_at=ev.recorded_at,
            )
        )
    return result


@router.get("/audit/export")
def export_audit_events(
    format: str = Query("json", description="Export format: json or csv"),
    db: Session = Depends(get_db),
):
    events = db.query(AuditEventModel).order_by(AuditEventModel.recorded_at.asc()).all()
    
    if format.lower() == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["Event ID", "Transaction ID", "Event Type", "Actor", "Decision", "Reason", "Event Hash", "Recorded At UTC"])
        
        for ev in events:
            writer.writerow([
                ev.id,
                ev.transaction_id,
                ev.event_type,
                ev.actor,
                ev.decision or "",
                ev.reason or "",
                ev.event_hash,
                ev.recorded_at.isoformat(),
            ])
        
        csv_data = output.getvalue()
        return Response(
            content=csv_data,
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=razorrecover_audit_ledger.csv"},
        )
    else:
        # JSON export
        json_data = [
            {
                "id": ev.id,
                "transaction_id": ev.transaction_id,
                "event_type": ev.event_type,
                "actor": ev.actor,
                "decision": ev.decision,
                "reason": ev.reason,
                "event_hash": ev.event_hash,
                "prev_event_hash": ev.prev_event_hash,
                "recorded_at": ev.recorded_at.isoformat(),
            }
            for ev in events
        ]
        return Response(
            content=json.dumps(json_data, indent=2),
            media_type="application/json",
            headers={"Content-Disposition": "attachment; filename=razorrecover_audit_ledger.json"},
        )


@router.get("/audit/{transaction_id}", response_model=List[AuditEventResponse])
def get_audit_trail_for_transaction(transaction_id: str, db: Session = Depends(get_db)):
    events = db.query(AuditEventModel).filter(AuditEventModel.transaction_id == transaction_id).order_by(AuditEventModel.recorded_at.asc()).all()
    
    result: List[AuditEventResponse] = []
    for ev in events:
        meta = json.loads(ev.metadata_json) if ev.metadata_json else {}
        result.append(
            AuditEventResponse(
                id=ev.id,
                transaction_id=ev.transaction_id,
                event_type=ev.event_type,
                actor=ev.actor,
                decision=ev.decision,
                reason=ev.reason,
                metadata=meta,
                prev_event_hash=ev.prev_event_hash,
                event_hash=ev.event_hash,
                recorded_at=ev.recorded_at,
            )
        )
    return result


@router.get("/agent-trace/{transaction_id}", response_model=AgentTraceResponse)
def get_agent_trace(transaction_id: str, db: Session = Depends(get_db)):
    traces = db.query(AgentTraceModel).filter(AgentTraceModel.transaction_id == transaction_id).order_by(AgentTraceModel.stage_index.asc()).all()
    
    steps = [
        AgentTraceStep(
            stage_index=tr.stage_index,
            stage_name=tr.stage_name,
            status=tr.status,
            input_summary=tr.input_summary,
            output_summary=tr.output_summary,
            decision=tr.decision,
            detail=tr.detail,
            recorded_at=tr.recorded_at,
        )
        for tr in traces
    ]

    current_st = max((tr.stage_index for tr in traces), default=0)
    return AgentTraceResponse(
        transaction_id=transaction_id,
        current_stage=current_st,
        overall_status="COMPLETED" if any(tr.stage_name == "Verify" and tr.status == "DONE" for tr in traces) else "IN_PROGRESS",
        steps=steps,
    )
