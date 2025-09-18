from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta
from ..database import crud, models, database
from ..schemas import measurement

router = APIRouter(
    prefix="/api/measurements",
    tags=["measurements"],
    responses={404: {"description": "Not found"}},
)

@router.post("/", response_model=measurement.Measurement)
def create_measurement(
    measurement_data: measurement.MeasurementCreate, db: Session = Depends(database.get_db)
):
    return crud.create_measurement(db=db, measurement_data=measurement_data)

# backend/routers/measurements.py 파일의 read_measurements 함수 업데이트

@router.get("/", response_model=List[measurement.Measurement])
def read_measurements(
    target_id: Optional[int] = None,
    process_id: Optional[int] = None,
    product_group_id: Optional[int] = None,
    device: Optional[str] = None,
    lot_no: Optional[str] = None,
    days: Optional[int] = Query(7, description="최근 일수 (기본 1주)"),
    start_date: Optional[str] = None,  # 문자열로 날짜 받기 추가
    end_date: Optional[str] = None,    # 문자열로 날짜 받기 추가
    equipment_id: Optional[int] = None,
    keyword: Optional[str] = None,
    db: Session = Depends(database.get_db)
):
    # 날짜 처리 로직 수정
    start_datetime = None
    
    # 문자열 날짜가 제공된 경우 datetime으로 변환
    if start_date and end_date:
        try:
            start_datetime = datetime.strptime(start_date, "%Y-%m-%d")
            end_datetime = datetime.strptime(end_date, "%Y-%m-%d")
            # 종료일은 해당 일자의 마지막 시간으로 설정
            end_datetime = end_datetime.replace(hour=23, minute=59, second=59)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    elif days:
        # 기존 로직: 일수 기준으로 시작 날짜 계산
        start_datetime = datetime.now() - timedelta(days=days)
        end_datetime = None
    
    measurements = crud.get_measurements(
        db, 
        target_id=target_id,
        process_id=process_id,
        product_group_id=product_group_id,
        device=device, 
        lot_no=lot_no, 
        start_date=start_datetime,  # 변환된 datetime 사용
        end_date=end_datetime if 'end_datetime' in locals() else None,  # 변환된 datetime 사용
        equipment_id=equipment_id,
        keyword=keyword,
    )
    return measurements

@router.get("/{measurement_id}", response_model=measurement.MeasurementWithSpec)
def read_measurement(measurement_id: int, db: Session = Depends(database.get_db)):
    db_measurement = crud.get_measurement(db, measurement_id=measurement_id)
    if db_measurement is None:
        raise HTTPException(status_code=404, detail="Measurement not found")
    
    # SPEC 상태 확인
    spec_status = crud.check_spec_status(db, measurement_id=measurement_id)
    
    # 응답 모델 생성
    result = measurement.Measurement.from_orm(db_measurement)
    result_dict = result.dict()
    result_dict["spec_status"] = spec_status
    
    return result_dict

@router.put("/{measurement_id}", response_model=measurement.Measurement)
def update_measurement(
    measurement_id: int, 
    measurement_data: measurement.MeasurementCreate, 
    db: Session = Depends(database.get_db)
):
    db_measurement = crud.update_measurement(db, measurement_id=measurement_id, measurement_data=measurement_data)
    if db_measurement is None:
        raise HTTPException(status_code=404, detail="Measurement not found")
    return db_measurement

@router.delete("/{measurement_id}", response_model=bool)
def delete_measurement(measurement_id: int, db: Session = Depends(database.get_db)):
    success = crud.delete_measurement(db, measurement_id=measurement_id)
    if not success:
        raise HTTPException(status_code=404, detail="Measurement not found")
    return success
