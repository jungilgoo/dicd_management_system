from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from ..database import database, models
from ..schemas import spc_memo as schemas

router = APIRouter(
    prefix="/api/spc-memos",
    tags=["spc-memos"],
    responses={404: {"description": "Not found"}},
)


def _filter_by_pgt(query, product_group_id: Optional[int],
                   process_id: Optional[int], target_id: Optional[int],
                   process_type: Optional[str]):
    """공통 필터 적용"""
    if product_group_id is not None:
        query = query.filter(models.SpcMemo.product_group_id == product_group_id)
    if process_id is not None:
        query = query.filter(models.SpcMemo.process_id == process_id)
    if target_id is not None:
        query = query.filter(models.SpcMemo.target_id == target_id)
    if process_type:
        query = query.filter(models.SpcMemo.process_type == process_type)
    return query


@router.get("/summary", response_model=schemas.SpcMemoSummary)
def get_memo_summary(
    target_id: int = Query(..., description="타겟 ID"),
    product_group_id: Optional[int] = None,
    process_id: Optional[int] = None,
    process_type: Optional[str] = Query('PHOTO'),
    db: Session = Depends(database.get_db)
):
    """카드 헤더 뱃지/알림 바용 메모 요약 (개수 + 최신 1건)"""
    query = db.query(models.SpcMemo)
    query = _filter_by_pgt(query, product_group_id, process_id, target_id, process_type)

    count = query.count()
    summary = schemas.SpcMemoSummary(count=count)

    if count > 0:
        latest = query.order_by(models.SpcMemo.created_at.desc()).first()
        if latest:
            summary.latest_id = latest.id
            summary.latest_title = latest.title
            summary.latest_created_at = latest.created_at

    return summary


@router.get("/", response_model=List[schemas.SpcMemo])
def list_memos(
    target_id: int = Query(..., description="타겟 ID"),
    product_group_id: Optional[int] = None,
    process_id: Optional[int] = None,
    process_type: Optional[str] = Query('PHOTO'),
    limit: int = Query(100, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(database.get_db)
):
    """메모 목록 조회 (최신순)"""
    query = db.query(models.SpcMemo)
    query = _filter_by_pgt(query, product_group_id, process_id, target_id, process_type)

    memos = query.order_by(
        models.SpcMemo.created_at.desc()
    ).offset(offset).limit(limit).all()

    return memos


@router.get("/{memo_id}", response_model=schemas.SpcMemo)
def get_memo(memo_id: int, db: Session = Depends(database.get_db)):
    """메모 상세 조회"""
    memo = db.query(models.SpcMemo).filter(models.SpcMemo.id == memo_id).first()
    if not memo:
        raise HTTPException(status_code=404, detail="메모를 찾을 수 없습니다.")
    return memo


@router.post("/", response_model=schemas.SpcMemo)
def create_memo(data: schemas.SpcMemoCreate, db: Session = Depends(database.get_db)):
    """메모 생성"""
    # FK 유효성 검증
    target = db.query(models.Target).filter(models.Target.id == data.target_id).first()
    if not target:
        raise HTTPException(status_code=400, detail="존재하지 않는 타겟입니다.")
    process = db.query(models.Process).filter(models.Process.id == data.process_id).first()
    if not process:
        raise HTTPException(status_code=400, detail="존재하지 않는 공정입니다.")
    pg = db.query(models.ProductGroup).filter(
        models.ProductGroup.id == data.product_group_id
    ).first()
    if not pg:
        raise HTTPException(status_code=400, detail="존재하지 않는 제품군입니다.")

    memo = models.SpcMemo(
        product_group_id=data.product_group_id,
        process_id=data.process_id,
        target_id=data.target_id,
        process_type=data.process_type,
        title=data.title.strip(),
        content=data.content.strip(),
    )
    db.add(memo)
    db.commit()
    db.refresh(memo)
    return memo


@router.put("/{memo_id}", response_model=schemas.SpcMemo)
def update_memo(
    memo_id: int,
    data: schemas.SpcMemoUpdate,
    db: Session = Depends(database.get_db)
):
    """메모 수정"""
    memo = db.query(models.SpcMemo).filter(models.SpcMemo.id == memo_id).first()
    if not memo:
        raise HTTPException(status_code=404, detail="메모를 찾을 수 없습니다.")

    if data.title is not None:
        memo.title = data.title.strip()
    if data.content is not None:
        memo.content = data.content.strip()

    db.commit()
    db.refresh(memo)
    return memo


@router.delete("/{memo_id}")
def delete_memo(memo_id: int, db: Session = Depends(database.get_db)):
    """메모 삭제"""
    memo = db.query(models.SpcMemo).filter(models.SpcMemo.id == memo_id).first()
    if not memo:
        raise HTTPException(status_code=404, detail="메모를 찾을 수 없습니다.")

    db.delete(memo)
    db.commit()
    return {"deleted": True, "id": memo_id}
