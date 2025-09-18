from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, Form
from sqlalchemy.orm import Session
from typing import Optional
from ..database import database
from ..services import bulk_import
from fastapi.responses import Response

router = APIRouter(
    prefix="/api/bulk-upload",
    tags=["bulk-upload"],
    responses={404: {"description": "Not found"}},
)

@router.post("/")
async def upload_measurement_data(
    file: UploadFile = File(...),
    target_id: int = Form(...),
    author: str = Form(...),
    coating_equipment_id: Optional[int] = Form(None),
    exposure_equipment_id: Optional[int] = Form(None),
    development_equipment_id: Optional[int] = Form(None),
    db: Session = Depends(database.get_db)
):
    """
    측정 데이터 파일 일괄 업로드
    """
    result = await bulk_import.process_bulk_import(
        db=db,
        file=file,
        target_id=target_id,
        author=author,
        coating_equipment_id=coating_equipment_id,
        exposure_equipment_id=exposure_equipment_id,
        development_equipment_id=development_equipment_id
    )
    
    return result

@router.get("/template/excel")
async def download_excel_template():
    """
    Excel 업로드 템플릿 다운로드
    """
    try:
        excel_data = bulk_import.generate_template_excel()
        
        # 파일이 생성되었는지 확인
        if not excel_data or len(excel_data) == 0:
            raise HTTPException(status_code=500, detail="Excel 템플릿 파일 생성에 실패했습니다.")
        
        return Response(
            content=excel_data,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": "attachment; filename=measurement_upload_template.xlsx"
            }
        )
    except Exception as e:
        # 오류 발생 시 로그 기록 및 사용자에게 적절한 오류 메시지 전달
        print(f"Excel 템플릿 생성 오류: {str(e)}")
        raise HTTPException(status_code=500, detail=f"템플릿 생성 중 오류가 발생했습니다: {str(e)}")


@router.get("/template/csv")
async def download_csv_template():
    """
    CSV 업로드 템플릿 다운로드
    """
    csv_data = bulk_import.generate_template_csv()
    
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={
            "Content-Disposition": "attachment; filename=measurement_upload_template.csv"
        }
    )