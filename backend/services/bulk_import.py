"""
DICD 측정 관리 시스템 - 벌크 데이터 가져오기 서비스
이 모듈은 CSV 및 Excel 파일에서 측정 데이터를 일괄 가져오는 기능을 제공합니다.
"""

import io
import pandas as pd
import numpy as np
from sqlalchemy.orm import Session
from fastapi import UploadFile, HTTPException
from typing import Dict, List, Any, Tuple, Optional
from datetime import datetime

from ..database import models
from ..schemas import measurement

async def validate_file_extension(file: UploadFile) -> str:
    """
    업로드된 파일의 확장자 유효성 검사
    """
    # 파일명에서 확장자 추출
    filename = file.filename.lower()
    
    if filename.endswith('.csv'):
        return 'csv'
    elif filename.endswith('.xlsx') or filename.endswith('.xls'):
        return 'excel'
    else:
        raise HTTPException(status_code=400, detail="지원되지 않는 파일 형식입니다. CSV 또는 Excel 파일만 업로드해주세요.")

async def process_bulk_import(
    db: Session, 
    file: UploadFile, 
    target_id: int,
    author: str,
    coating_equipment_id: Optional[int] = None,
    exposure_equipment_id: Optional[int] = None,
    development_equipment_id: Optional[int] = None
) -> Dict[str, Any]:
    """
    업로드된 파일 처리 및 데이터 일괄 가져오기
    """
    # 파일 확장자 확인
    file_type = await validate_file_extension(file)
    
    # 파일 내용 읽기
    content = await file.read()
    
    try:
        # 파일 타입에 따라 데이터프레임 로드
        if file_type == 'csv':
            df = pd.read_csv(io.BytesIO(content), encoding='utf-8-sig')
        else:  # Excel
            df = pd.read_excel(io.BytesIO(content))
        
        # 필수 열 확인
        required_columns = ['device', 'lot_no', 'wafer_no', 'value_top', 'value_center', 'value_bottom', 'value_left', 'value_right']
        missing_columns = [col for col in required_columns if col not in df.columns]
        
        if missing_columns:
            raise HTTPException(
                status_code=400, 
                detail=f"업로드 파일에 필수 열이 누락되었습니다: {', '.join(missing_columns)}"
            )
        
        # 데이터 검증 및 가공
        validated_data, errors = validate_measurement_data(df, target_id)
        
        # 검증된 데이터가 없으면 오류 반환
        if not validated_data:
            raise HTTPException(
                status_code=400,
                detail="유효한 데이터가 없습니다. 모든 행에 오류가 있습니다."
            )
        
        # 중복 검사
        duplicates = check_duplicates(db, validated_data)
        
        # 측정 데이터 생성
        imported_count = 0
        for row in validated_data:
            # 중복 항목 건너뛰기
            lot_wafer_key = f"{row['lot_no']}_{row['wafer_no']}"
            if lot_wafer_key in duplicates:
                errors.append({
                    "row": row.get("original_row", "알 수 없음"),
                    "error": f"중복된 LOT_NO ({row['lot_no']})와 WAFER_NO ({row['wafer_no']})의 조합입니다. 건너뜁니다."
                })
                continue
            
            # 데이터 준비
            measurement_data = measurement.MeasurementCreate(
                target_id=target_id,
                coating_equipment_id=coating_equipment_id,
                exposure_equipment_id=exposure_equipment_id,
                development_equipment_id=development_equipment_id,
                device=row['device'],
                lot_no=row['lot_no'],
                wafer_no=row['wafer_no'],
                exposure_time=row.get('exposure_time'),
                value_top=row['value_top'],
                value_center=row['value_center'],
                value_bottom=row['value_bottom'],
                value_left=row['value_left'],
                value_right=row['value_right'],
                author=author
            )
            
            # 측정값의 통계치 계산
            values = [
                measurement_data.value_top,
                measurement_data.value_center,
                measurement_data.value_bottom,
                measurement_data.value_left,
                measurement_data.value_right
            ]
            
            avg_value = sum(values) / len(values)
            min_value = min(values)
            max_value = max(values)
            range_value = max_value - min_value
            
            # 표준편차 계산 (샘플이 5개이므로 Bessel's correction 적용)
            mean = sum(values) / len(values)
            sum_sq_diff = sum((x - mean) ** 2 for x in values)
            std_dev = (sum_sq_diff / (len(values) - 1)) ** 0.5 if len(values) > 1 else 0
            
            # 데이터베이스 객체 생성
            db_measurement = models.Measurement(
                target_id=measurement_data.target_id,
                coating_equipment_id=measurement_data.coating_equipment_id,
                exposure_equipment_id=measurement_data.exposure_equipment_id,
                development_equipment_id=measurement_data.development_equipment_id,
                device=measurement_data.device,
                lot_no=measurement_data.lot_no,
                wafer_no=measurement_data.wafer_no,
                exposure_time=measurement_data.exposure_time,
                value_top=measurement_data.value_top,
                value_center=measurement_data.value_center,
                value_bottom=measurement_data.value_bottom,
                value_left=measurement_data.value_left,
                value_right=measurement_data.value_right,
                avg_value=round(avg_value, 3),
                min_value=round(min_value, 3),
                max_value=round(max_value, 3),
                range_value=round(range_value, 3),
                std_dev=round(std_dev, 3),
                author=measurement_data.author
            )
            
            db.add(db_measurement)
            imported_count += 1
        
        # 변경 사항 커밋
        db.commit()
        
        # 결과 반환
        return {
            "success": True,
            "imported_count": imported_count,
            "total_rows": len(df),
            "errors": errors,
            "duplicate_count": len(duplicates)
        }
    
    except pd.errors.ParserError:
        raise HTTPException(status_code=400, detail="파일 형식이 올바르지 않습니다. 올바른 CSV 또는 Excel 파일인지 확인해주세요.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"파일 처리 중 오류가 발생했습니다: {str(e)}")

def validate_measurement_data(df: pd.DataFrame, target_id: int) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    데이터프레임의 각 행을 검증하고 변환합니다
    """
    validated_data = []
    errors = []
    
    for idx, row in df.iterrows():
        try:
            # 원본 행 번호 저장 (1부터 시작하는 행 번호)
            original_row = idx + 2  # 헤더 포함하여 +2
            
            # 누락된 필수 값 확인
            for field in ['device', 'lot_no', 'wafer_no', 'value_top', 'value_center', 'value_bottom', 'value_left', 'value_right']:
                if pd.isna(row[field]):
                    raise ValueError(f"필수 필드 '{field}'가 누락되었습니다")
            
            # 필드 타입 변환 및 유효성 검사
            processed_row = {
                "original_row": original_row,
                "target_id": target_id,
                "device": str(row['device']).strip(),
                "lot_no": str(row['lot_no']).strip(),
                "wafer_no": str(row['wafer_no']).strip(),
            }
            
            # wafer_no 유효성 검사 (01~50)
            try:
                wafer_no_int = int(processed_row['wafer_no'])
                if wafer_no_int < 1 or wafer_no_int > 50:
                    raise ValueError("WAFER NO는 01~50 사이의 값이어야 합니다")
            except ValueError:
                raise ValueError("WAFER NO는 유효한 숫자여야 합니다")
            
            # 숫자 필드 처리
            for field in ['value_top', 'value_center', 'value_bottom', 'value_left', 'value_right']:
                try:
                    # NaN 값이면 오류
                    if pd.isna(row[field]):
                        raise ValueError(f"'{field}' 값이 누락되었습니다")
                    
                    value = float(row[field])
                    processed_row[field] = round(value, 3)  # 소수점 3자리로 반올림
                except (ValueError, TypeError):
                    raise ValueError(f"'{field}'가 유효한 숫자 형식이 아닙니다: {row[field]}")
            
            # 선택적 필드 처리
            if 'exposure_time' in row and not pd.isna(row['exposure_time']):
                try:
                    processed_row['exposure_time'] = int(row['exposure_time'])
                except (ValueError, TypeError):
                    raise ValueError(f"'exposure_time'이 유효한 정수 형식이 아닙니다: {row['exposure_time']}")
            
            validated_data.append(processed_row)
            
        except ValueError as ve:
            errors.append({
                "row": original_row,
                "error": str(ve)
            })
        except Exception as e:
            errors.append({
                "row": original_row,
                "error": f"처리 중 오류 발생: {str(e)}"
            })
    
    return validated_data, errors

def check_duplicates(db: Session, validated_data: List[Dict[str, Any]]) -> Dict[str, bool]:
    """
    이미 존재하는 LOT_NO + WAFER_NO 조합을 확인합니다
    """
    # 모든 LOT_NO와 WAFER_NO 조합 추출
    lot_wafer_pairs = [(item['lot_no'], item['wafer_no'], item['target_id']) for item in validated_data]
    
    # 중복 저장을 위한 딕셔너리
    duplicates = {}
    
    for lot_no, wafer_no, target_id in lot_wafer_pairs:
        # 데이터베이스에서 중복 확인
        existing = db.query(models.Measurement).filter(
            models.Measurement.target_id == target_id,
            models.Measurement.lot_no == lot_no,
            models.Measurement.wafer_no == wafer_no
        ).first()
        
        if existing:
            duplicates[f"{lot_no}_{wafer_no}"] = True
    
    return duplicates

def create_template_dataframe() -> pd.DataFrame:
    """
    업로드 템플릿용 데이터프레임 생성
    """
    # 필수 열
    columns = [
        'device', 'lot_no', 'wafer_no', 'exposure_time',
        'value_top', 'value_center', 'value_bottom', 'value_left', 'value_right'
    ]
    
    # 예시 데이터 (1행)
    data = [{
        'device': 'DEVICE-001',
        'lot_no': 'LOT12345',
        'wafer_no': '01',
        'exposure_time': 2000,
        'value_top': 1.234,
        'value_center': 1.234,
        'value_bottom': 1.234,
        'value_left': 1.234,
        'value_right': 1.234
    }]
    
    return pd.DataFrame(data, columns=columns)

def generate_template_excel() -> bytes:
    """
    Excel 템플릿 파일 생성
    """
    df = create_template_dataframe()
    excel_buffer = io.BytesIO()
    
    # 간단한 방식으로 Excel 파일 생성 (xlsxwriter 대신 openpyxl 사용)
    try:
        # xlsxwriter 방식
        with pd.ExcelWriter(excel_buffer, engine='xlsxwriter') as writer:
            df.to_excel(writer, sheet_name='Template', index=False)
            
            # 워크시트 및 워크북 참조 가져오기
            workbook = writer.book
            worksheet = writer.sheets['Template']
            
            # 헤더 형식 설정
            header_format = workbook.add_format({
                'bold': True,
                'text_wrap': True,
                'valign': 'top',
                'fg_color': '#D7E4BC',
                'border': 1
            })
            
            # 헤더 높이 및 형식 설정
            for col_num, value in enumerate(df.columns.values):
                worksheet.write(0, col_num, value, header_format)
            
            # 열 너비 설정
            column_widths = {
                'device': 15,
                'lot_no': 12,
                'wafer_no': 10,
                'exposure_time': 12,
                'value_top': 12,
                'value_center': 12,
                'value_bottom': 12,
                'value_left': 12,
                'value_right': 12
            }
            
            for i, col in enumerate(df.columns):
                if col in column_widths:
                    worksheet.set_column(i, i, column_widths[col])
    except Exception as e:
        # 오류 발생 시 기본 방식으로 생성
        print(f"xlsxwriter 오류, 기본 방식으로 대체: {e}")
        df.to_excel(excel_buffer, index=False)
    
    excel_buffer.seek(0)
    return excel_buffer.getvalue()

def generate_template_csv() -> bytes:
    """
    CSV 템플릿 파일 생성
    """
    df = create_template_dataframe()
    csv_buffer = io.BytesIO()
    df.to_csv(csv_buffer, index=False, encoding='utf-8-sig')
    csv_buffer.seek(0)
    return csv_buffer.getvalue()