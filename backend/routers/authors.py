from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from ..database import crud, database
from ..schemas import author

router = APIRouter(
    prefix="/api/authors",
    tags=["authors"],
    responses={404: {"description": "Not found"}},
)


@router.get("/", response_model=List[author.Author])
def get_authors(
    process_type: Optional[str] = Query(None, description="공정 타입 (PHOTO, ETCH)"),
    is_active: Optional[bool] = Query(None, description="활성화 여부"),
    db: Session = Depends(database.get_db)
):
    """
    작성자 목록을 조회합니다.
    process_type으로 PHOTO/ETCH 구분하여 조회할 수 있습니다.
    """
    return crud.get_authors(db, process_type=process_type, is_active=is_active)


@router.get("/{author_id}", response_model=author.Author)
def get_author(author_id: int, db: Session = Depends(database.get_db)):
    """작성자 단일 조회"""
    db_author = crud.get_author(db, author_id=author_id)
    if db_author is None:
        raise HTTPException(status_code=404, detail="작성자를 찾을 수 없습니다.")
    return db_author


@router.post("/", response_model=author.Author)
def create_author(
    author_data: author.AuthorCreate,
    db: Session = Depends(database.get_db)
):
    """
    새 작성자를 등록합니다.
    같은 이름과 공정 타입의 작성자가 이미 있으면 등록되지 않습니다.
    """
    db_author = crud.create_author(db, author_data=author_data)
    if db_author is None:
        raise HTTPException(status_code=400, detail="이미 존재하는 작성자입니다.")
    return db_author


@router.put("/{author_id}", response_model=author.Author)
def update_author(
    author_id: int,
    author_data: author.AuthorUpdate,
    db: Session = Depends(database.get_db)
):
    """작성자 정보를 수정합니다."""
    db_author = crud.update_author(db, author_id=author_id, author_data=author_data)
    if db_author is None:
        raise HTTPException(status_code=404, detail="작성자를 찾을 수 없습니다.")
    return db_author


@router.delete("/{author_id}")
def delete_author(author_id: int, db: Session = Depends(database.get_db)):
    """작성자를 삭제합니다."""
    success = crud.delete_author(db, author_id=author_id)
    if not success:
        raise HTTPException(status_code=404, detail="작성자를 찾을 수 없습니다.")
    return {"success": True, "message": "작성자가 삭제되었습니다."}
